import type { SqlDb } from './db';
import type { AppData, DateKey, Logs, MuscleGroup, Plans, Workout, WorkoutDraft } from './types';

type WorkoutRow = {
  id: string;
  name: string;
  muscle_group: string;
  sets: number;
  reps: number;
  deleted_at: string | null;
};

export function newId(): string {
  return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
  const planRows = await db.getAllAsync<{ date: string; workout_id: string }>(
    'SELECT date, workout_id FROM plan_entries ORDER BY date, rowid',
    []
  );
  for (const r of planRows) (plans[r.date] ??= []).push(r.workout_id);

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

  return { workouts, plans, logs };
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
    }
  });
}

/** Press-and-hold delete: removes the workout from that date's plan and that date's logs only. */
export async function removeFromDay(db: SqlDb, date: DateKey, workoutId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM plan_entries WHERE date = ? AND workout_id = ?', [date, workoutId]);
    await db.runAsync('DELETE FROM set_logs WHERE date = ? AND workout_id = ?', [date, workoutId]);
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
  });
}
