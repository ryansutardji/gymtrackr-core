import type { SqlDb } from './db';
import { addDays, weekdayOf } from './dates';
import type {
  AppData,
  DateKey,
  Logs,
  MuscleGroup,
  Plans,
  Routine,
  RoutineSchedule,
  Workout,
  WorkoutDraft,
} from './types';

type WorkoutRow = {
  id: string;
  name: string;
  muscle_group: string;
  sets: number;
  reps: number;
  deleted_at: string | null;
};

type ScheduleRow = {
  id: string;
  routine_id: string;
  weekday: number;
  start_date: string;
  ended_on: string | null;
  materialized_through: string | null;
};

export function newId(prefix = 'w'): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Reads everything into the in-memory shape the screens use. A few years of
 * daily logging is only thousands of rows, so loading it all is cheap.
 */
export async function loadAll(db: SqlDb): Promise<AppData> {
  const workoutRows = await db.getAllAsync<WorkoutRow>(
    'SELECT id, name, muscle_group, sets, reps, deleted_at FROM workouts ORDER BY rowid',
    []
  );
  const workouts: Workout[] = workoutRows.map((r) => ({
    id: r.id,
    name: r.name,
    group: r.muscle_group as MuscleGroup,
    sets: r.sets,
    reps: r.reps,
    deletedAt: r.deleted_at,
  }));

  const plans: Plans = {};
  const planSources: AppData['planSources'] = {};
  const planRows = await db.getAllAsync<{ date: string; workout_id: string; routine_id: string | null }>(
    'SELECT date, workout_id, routine_id FROM plan_entries ORDER BY date, rowid',
    []
  );
  for (const r of planRows) {
    (plans[r.date] ??= []).push(r.workout_id);
    if (r.routine_id) (planSources[r.date] ??= {})[r.workout_id] = r.routine_id;
  }

  const logs: Logs = {};
  const logRows = await db.getAllAsync<{ date: string; workout_id: string; set_index: number; weight: number }>(
    'SELECT date, workout_id, set_index, weight FROM set_logs ORDER BY date, workout_id, set_index',
    []
  );
  for (const r of logRows) {
    const day = (logs[r.date] ??= {});
    const sets = (day[r.workout_id] ??= []);
    while (sets.length < r.set_index) sets.push(null);
    sets[r.set_index] = r.weight;
  }

  const routineRows = await db.getAllAsync<{ id: string; name: string; deleted_at: string | null }>(
    'SELECT id, name, deleted_at FROM routines ORDER BY created_at, rowid',
    []
  );
  const memberRows = await db.getAllAsync<{ routine_id: string; workout_id: string }>(
    'SELECT routine_id, workout_id FROM routine_workouts ORDER BY routine_id, position',
    []
  );
  const routines: Routine[] = routineRows.map((r) => ({
    id: r.id,
    name: r.name,
    workoutIds: memberRows.filter((m) => m.routine_id === r.id).map((m) => m.workout_id),
    deletedAt: r.deleted_at,
  }));

  const scheduleRows = await db.getAllAsync<ScheduleRow>('SELECT * FROM routine_schedules ORDER BY rowid', []);
  const schedules: RoutineSchedule[] = scheduleRows.map(toSchedule);

  const exclusions: AppData['exclusions'] = {};
  const exclusionRows = await db.getAllAsync<{ date: string; workout_id: string }>(
    'SELECT date, workout_id FROM day_exclusions',
    []
  );
  for (const r of exclusionRows) (exclusions[r.date] ??= []).push(r.workout_id);

  return { workouts, plans, logs, routines, schedules, exclusions, planSources };
}

function toSchedule(r: ScheduleRow): RoutineSchedule {
  return {
    id: r.id,
    routineId: r.routine_id,
    weekday: r.weekday,
    startDate: r.start_date,
    endedOn: r.ended_on,
    materializedThrough: r.materialized_through,
  };
}

// ---- workouts

export async function createWorkout(db: SqlDb, draft: WorkoutDraft): Promise<Workout> {
  const w: Workout = { id: newId(), ...draft, name: draft.name.trim(), deletedAt: null };
  await db.runAsync(
    'INSERT INTO workouts (id, name, muscle_group, sets, reps, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [w.id, w.name, w.group, w.sets, w.reps, new Date().toISOString()]
  );
  return w;
}

/** Changing sets/reps only affects future sessions — past logs are untouched. */
export async function updateWorkout(db: SqlDb, id: string, draft: WorkoutDraft): Promise<void> {
  await db.runAsync('UPDATE workouts SET name = ?, muscle_group = ?, sets = ?, reps = ? WHERE id = ?', [
    draft.name.trim(),
    draft.group,
    draft.sets,
    draft.reps,
    id,
  ]);
}

/** Removes the workout from every plan but keeps its log history for Stats. */
export async function deleteWorkout(db: SqlDb, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM plan_entries WHERE workout_id = ?', [id]);
    await db.runAsync('UPDATE workouts SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  });
}

// ---- plans

export async function addToPlan(db: SqlDb, date: DateKey, workoutIds: string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const id of workoutIds) {
      await db.runAsync('INSERT OR IGNORE INTO plan_entries (date, workout_id) VALUES (?, ?)', [date, id]);
      await db.runAsync('DELETE FROM day_exclusions WHERE date = ? AND workout_id = ?', [date, id]);
    }
  });
}

/**
 * Press-and-hold delete: removes the workout from that date's plan and that
 * date's logs only. The exclusion keeps a weekly repeat from putting it back.
 */
export async function removeFromDay(db: SqlDb, date: DateKey, workoutId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM plan_entries WHERE date = ? AND workout_id = ?', [date, workoutId]);
    await db.runAsync('DELETE FROM set_logs WHERE date = ? AND workout_id = ?', [date, workoutId]);
    await db.runAsync('INSERT OR IGNORE INTO day_exclusions (date, workout_id) VALUES (?, ?)', [date, workoutId]);
  });
}

// ---- logs

/**
 * Records one set's weight (`null` clears it). Logging a workout that isn't
 * planned that day adds it to the plan.
 */
export async function logSet(
  db: SqlDb,
  date: DateKey,
  workoutId: string,
  setIndex: number,
  weight: number | null
): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (weight == null) {
      await db.runAsync('DELETE FROM set_logs WHERE date = ? AND workout_id = ? AND set_index = ?', [
        date,
        workoutId,
        setIndex,
      ]);
      return;
    }
    await db.runAsync(
      `INSERT INTO set_logs (date, workout_id, set_index, weight) VALUES (?, ?, ?, ?)
       ON CONFLICT (date, workout_id, set_index) DO UPDATE SET weight = excluded.weight`,
      [date, workoutId, setIndex, Math.max(0, weight)]
    );
    await db.runAsync('INSERT OR IGNORE INTO plan_entries (date, workout_id) VALUES (?, ?)', [date, workoutId]);
    await db.runAsync('DELETE FROM day_exclusions WHERE date = ? AND workout_id = ?', [date, workoutId]);
  });
}

// ---- routines (shown as "Plans")

async function activeMemberIds(db: SqlDb, routineId: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ workout_id: string }>(
    `SELECT rw.workout_id FROM routine_workouts rw JOIN workouts w ON w.id = rw.workout_id
     WHERE rw.routine_id = ? AND w.deleted_at IS NULL ORDER BY rw.position`,
    [routineId]
  );
  return rows.map((r) => r.workout_id);
}

export async function createRoutine(db: SqlDb, name: string, workoutIds: string[]): Promise<Routine> {
  const ids = [...new Set(workoutIds)];
  if (!name.trim()) throw new Error('A plan needs a name');
  if (!ids.length) throw new Error('A plan needs at least one workout');
  const r: Routine = { id: newId('r'), name: name.trim(), workoutIds: ids, deletedAt: null };
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO routines (id, name, created_at) VALUES (?, ?, ?)', [
      r.id,
      r.name,
      new Date().toISOString(),
    ]);
    for (const [i, id] of ids.entries()) {
      await db.runAsync('INSERT INTO routine_workouts (routine_id, workout_id, position) VALUES (?, ?, ?)', [
        r.id,
        id,
        i,
      ]);
    }
  });
  return r;
}

export async function renameRoutine(db: SqlDb, id: string, name: string): Promise<void> {
  if (!name.trim()) throw new Error('A plan needs a name');
  await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', [name.trim(), id]);
}

/** Appends workouts to the end of the plan; ones already in it are skipped. */
export async function addToRoutine(db: SqlDb, id: string, workoutIds: string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ max: number | null }>(
      'SELECT MAX(position) AS max FROM routine_workouts WHERE routine_id = ?',
      [id]
    );
    let next = (row?.max ?? -1) + 1;
    for (const wid of workoutIds) {
      await db.runAsync('INSERT OR IGNORE INTO routine_workouts (routine_id, workout_id, position) VALUES (?, ?, ?)', [
        id,
        wid,
        next++,
      ]);
    }
  });
}

/** Drops the workout from the plan only (it stays in the library). A plan can't be emptied. */
export async function removeFromRoutine(db: SqlDb, id: string, workoutId: string): Promise<void> {
  const active = await activeMemberIds(db, id);
  if (active.includes(workoutId) && active.length <= 1) throw new Error('A plan needs at least one workout');
  await db.runAsync('DELETE FROM routine_workouts WHERE routine_id = ? AND workout_id = ?', [id, workoutId]);
}

/**
 * Soft delete. Its repeats stop after today; days up to today keep their
 * workouts (they're copied in first), and logs are untouched.
 */
export async function deleteRoutine(db: SqlDb, id: string, today: DateKey): Promise<void> {
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<ScheduleRow>(
      'SELECT * FROM routine_schedules WHERE routine_id = ? AND ended_on IS NULL',
      [id]
    );
    for (const s of rows) await endSchedule(db, s, today);
    await db.runAsync('UPDATE routines SET deleted_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  });
}

/**
 * Copies the plan's workouts onto the day (a copy: later plan edits don't
 * change it), skipping ones already there. With `repeat`, the plan also
 * repeats on that weekday from this day on.
 */
export async function addRoutineToDay(db: SqlDb, date: DateKey, routineId: string, repeat: boolean): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const wid of await activeMemberIds(db, routineId)) {
      await db.runAsync('INSERT OR IGNORE INTO plan_entries (date, workout_id, routine_id) VALUES (?, ?, ?)', [
        date,
        wid,
        routineId,
      ]);
      await db.runAsync('DELETE FROM day_exclusions WHERE date = ? AND workout_id = ?', [date, wid]);
    }
    if (!repeat) return;
    const weekday = weekdayOf(date);
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM routine_schedules WHERE routine_id = ? AND weekday = ? AND ended_on IS NULL',
      [routineId, weekday]
    );
    if (existing) return;
    await db.runAsync('INSERT INTO routine_schedules (id, routine_id, weekday, start_date) VALUES (?, ?, ?, ?)', [
      newId('s'),
      routineId,
      weekday,
      date,
    ]);
  });
}

/** Turns a weekly repeat off. Days up to today keep their workouts. */
export async function stopSchedule(db: SqlDb, scheduleId: string, today: DateKey): Promise<void> {
  await db.withTransactionAsync(async () => {
    const s = await db.getFirstAsync<ScheduleRow>('SELECT * FROM routine_schedules WHERE id = ?', [scheduleId]);
    if (s && !s.ended_on) await endSchedule(db, s, today);
  });
}

async function endSchedule(db: SqlDb, s: ScheduleRow, today: DateKey): Promise<void> {
  await lockIn(db, s, today);
  // A repeat that hasn't started yet ends before its first day.
  const endedOn = s.start_date > today ? addDays(s.start_date, -1) : today;
  await db.runAsync('UPDATE routine_schedules SET ended_on = ? WHERE id = ?', [endedOn, s.id]);
}

/**
 * Run on app open: copies every past repeat day into the day plans so it no
 * longer changes when the plan is edited. Today and later keep following the plan.
 */
export async function lockInPastRepeats(db: SqlDb, today: DateKey): Promise<void> {
  const rows = await db.getAllAsync<ScheduleRow>('SELECT * FROM routine_schedules', []);
  const yesterday = addDays(today, -1);
  for (const s of rows) {
    await db.withTransactionAsync(() => lockIn(db, s, yesterday));
  }
}

/** Copies the schedule's not-yet-copied days, up to `through`, into plan_entries. */
async function lockIn(db: SqlDb, s: ScheduleRow, through: DateKey): Promise<void> {
  const last = s.ended_on && s.ended_on < through ? s.ended_on : through;
  const after = s.materialized_through ? addDays(s.materialized_through, 1) : s.start_date;
  const from = after > s.start_date ? after : s.start_date;
  if (from > last) return;
  const ids = await activeMemberIds(db, s.routine_id);
  let date = addDays(from, (s.weekday - weekdayOf(from) + 7) % 7);
  for (; date <= last; date = addDays(date, 7)) {
    const excluded = await db.getAllAsync<{ workout_id: string }>(
      'SELECT workout_id FROM day_exclusions WHERE date = ?',
      [date]
    );
    const skip = new Set(excluded.map((r) => r.workout_id));
    for (const wid of ids) {
      if (skip.has(wid)) continue;
      await db.runAsync(
        `INSERT INTO plan_entries (date, workout_id, routine_id) VALUES (?, ?, ?)
         ON CONFLICT (date, workout_id) DO UPDATE SET routine_id = COALESCE(plan_entries.routine_id, excluded.routine_id)`,
        [date, wid, s.routine_id]
      );
    }
  }
  await db.runAsync('UPDATE routine_schedules SET materialized_through = ? WHERE id = ?', [last, s.id]);
}
