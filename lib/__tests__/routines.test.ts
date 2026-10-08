import { createMigratedDb, createNodeDb } from '@/test-utils/nodeDb';
import { migrate, MIGRATIONS, type SqlDb } from '../db';
import * as repo from '../repo';
import { activeSchedules, dayGroups, dayStatus, dayWorkouts, routineMeta } from '../derive';
import type { WorkoutDraft } from '../types';

// 2026-10-08 is a Thursday (weekday 4).
const THU = '2026-10-08';
const NEXT_THU = '2026-10-15';
const THU_AFTER = '2026-10-22';
const FRI = '2026-10-09';

const bench: WorkoutDraft = { name: 'Bench press', group: 'chest', sets: 4, reps: 8 };
const ohp: WorkoutDraft = { name: 'Overhead press', group: 'shoulders', sets: 3, reps: 8 };
const fly: WorkoutDraft = { name: 'Cable fly', group: 'chest', sets: 3, reps: 12 };

let db: SqlDb;
let b: string, o: string, f: string;

beforeEach(async () => {
  db = await createMigratedDb();
  b = (await repo.createWorkout(db, bench)).id;
  o = (await repo.createWorkout(db, ohp)).id;
  f = (await repo.createWorkout(db, fly)).id;
});

const names = async (date: string) => dayWorkouts(await repo.loadAll(db), date).map((w) => w.name);

describe('routines', () => {
  it('creates in selection order, loads back, and summarises', async () => {
    const r = await repo.createRoutine(db, '  Push day ', [o, b]);
    const data = await repo.loadAll(db);
    expect(data.routines).toEqual([{ id: r.id, name: 'Push day', workoutIds: [o, b], deletedAt: null }]);
    expect(routineMeta(data.routines[0], data.workouts)).toBe('2 workouts · shoulders · chest');
  });

  it('rejects an empty name or no workouts', async () => {
    await expect(repo.createRoutine(db, '  ', [b])).rejects.toThrow();
    await expect(repo.createRoutine(db, 'Push', [])).rejects.toThrow();
  });

  it('appends, skips duplicates, removes, and never empties a plan', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addToRoutine(db, r.id, [b, o, f]);
    expect((await repo.loadAll(db)).routines[0].workoutIds).toEqual([b, o, f]);
    await repo.removeFromRoutine(db, r.id, o);
    await repo.removeFromRoutine(db, r.id, f);
    await expect(repo.removeFromRoutine(db, r.id, b)).rejects.toThrow();
    expect((await repo.loadAll(db)).routines[0].workoutIds).toEqual([b]);
  });

  it('renames', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.renameRoutine(db, r.id, 'Upper A');
    expect((await repo.loadAll(db)).routines[0].name).toBe('Upper A');
  });

  it('hides deleted workouts from the plan', async () => {
    const r = await repo.createRoutine(db, 'Push', [b, o]);
    await repo.deleteWorkout(db, o);
    const data = await repo.loadAll(db);
    expect(routineMeta(data.routines[0], data.workouts)).toBe('1 workout · chest');
    await repo.addRoutineToDay(db, THU, r.id, false);
    expect(await names(THU)).toEqual(['Bench press']);
  });
});

describe('adding a plan to a day', () => {
  it('copies its workouts, skipping ones already there, and labels the group', async () => {
    const r = await repo.createRoutine(db, 'Push', [b, o]);
    await repo.addToPlan(db, THU, [f, b]);
    await repo.addRoutineToDay(db, THU, r.id, false);
    const data = await repo.loadAll(db);
    expect(dayWorkouts(data, THU).map((w) => w.id)).toEqual([f, b, o]);
    const groups = dayGroups(data, THU);
    expect(groups.map((g) => [g.routine?.name, g.workouts.map((w) => w.id)])).toEqual([
      [undefined, [f, b]],
      ['Push', [o]],
    ]);
    expect(groups[1].repeatWeekday).toBeUndefined();
  });

  it('is a copy: later plan edits leave that day alone', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addRoutineToDay(db, THU, r.id, false);
    await repo.addToRoutine(db, r.id, [o]);
    expect(await names(THU)).toEqual(['Bench press']);
    expect(await names(NEXT_THU)).toEqual([]);
  });
});

describe('weekly repeat', () => {
  it('fills the same weekday from the start day on, and follows plan edits', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addRoutineToDay(db, THU, r.id, true);
    await repo.addToRoutine(db, r.id, [o]);

    expect(await names('2026-10-01')).toEqual([]); // before the start
    expect(await names(FRI)).toEqual([]); // other weekday
    expect(await names(NEXT_THU)).toEqual(['Bench press', 'Overhead press']);
    const data = await repo.loadAll(db);
    expect(dayStatus(data, THU_AFTER)).toBe('planned');
    expect(dayGroups(data, NEXT_THU)[0]).toMatchObject({ routine: { name: 'Push' }, repeatWeekday: 4 });
    expect(activeSchedules(data, r.id)).toHaveLength(1);
  });

  it('does not create a second repeat for the same weekday', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addRoutineToDay(db, THU, r.id, true);
    await repo.addRoutineToDay(db, NEXT_THU, r.id, true);
    expect((await repo.loadAll(db)).schedules).toHaveLength(1);
  });

  it('removing a workout from one repeat day affects that day only; adding it back undoes that', async () => {
    const r = await repo.createRoutine(db, 'Push', [b, o]);
    await repo.addRoutineToDay(db, THU, r.id, true);
    await repo.removeFromDay(db, NEXT_THU, o);
    expect(await names(NEXT_THU)).toEqual(['Bench press']);
    expect(await names(THU_AFTER)).toEqual(['Bench press', 'Overhead press']);
    await repo.addToPlan(db, NEXT_THU, [o]);
    expect(await names(NEXT_THU)).toEqual(['Bench press', 'Overhead press']);
  });

  it('a logged repeat workout keeps its plan label', async () => {
    const r = await repo.createRoutine(db, 'Push', [b, o]);
    await repo.addRoutineToDay(db, THU, r.id, true);
    await repo.logSet(db, NEXT_THU, o, 0, 95);
    const groups = dayGroups(await repo.loadAll(db), NEXT_THU);
    expect(groups).toHaveLength(1);
    expect(groups[0].workouts.map((w) => w.id)).toEqual([b, o]);
  });

  it('locks in past days on app open, so plan edits only change today and later', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addRoutineToDay(db, '2026-09-24', r.id, true);
    await repo.removeFromDay(db, '2026-10-01', b); // skipped that week

    await repo.lockInPastRepeats(db, THU); // app opened on Thu Oct 8
    await repo.addToRoutine(db, r.id, [o]);

    expect(await names('2026-09-24')).toEqual(['Bench press']);
    expect(await names('2026-10-01')).toEqual([]);
    expect(await names(THU)).toEqual(['Bench press', 'Overhead press']);
    const data = await repo.loadAll(db);
    expect(data.schedules[0].materializedThrough).toBe('2026-10-07');
    expect(dayGroups(data, '2026-09-24')[0].routine?.name).toBe('Push');

    await repo.lockInPastRepeats(db, THU); // running again changes nothing
    expect(await names('2026-09-24')).toEqual(['Bench press']);
  });

  it('stopping keeps days up to today and clears later ones', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addRoutineToDay(db, '2026-10-01', r.id, true);
    const [s] = (await repo.loadAll(db)).schedules;
    await repo.stopSchedule(db, s.id, THU);
    await repo.addToRoutine(db, r.id, [o]);

    expect(await names('2026-10-01')).toEqual(['Bench press']);
    expect(await names(THU)).toEqual(['Bench press']);
    expect(await names(NEXT_THU)).toEqual([]);
    expect(activeSchedules(await repo.loadAll(db), r.id)).toEqual([]);
  });

  it('stopping a repeat that starts later removes it entirely', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addToPlan(db, FRI, []);
    await repo.addRoutineToDay(db, NEXT_THU, r.id, true);
    await repo.removeFromDay(db, NEXT_THU, b); // the one-off copy on the start day
    const [s] = (await repo.loadAll(db)).schedules;
    await repo.stopSchedule(db, s.id, THU);
    expect(await names(NEXT_THU)).toEqual([]);
    expect(await names(THU_AFTER)).toEqual([]);
  });
});

describe('deleting a plan', () => {
  it('stops its repeats but keeps days up to today, workouts, and logs', async () => {
    const r = await repo.createRoutine(db, 'Push', [b]);
    await repo.addRoutineToDay(db, '2026-10-01', r.id, true);
    await repo.logSet(db, '2026-10-01', b, 0, 135);
    await repo.deleteRoutine(db, r.id, THU);

    const data = await repo.loadAll(db);
    expect(data.routines[0].deletedAt).not.toBeNull();
    expect(data.workouts.every((w) => !w.deletedAt)).toBe(true);
    expect(dayWorkouts(data, THU).map((w) => w.id)).toEqual([b]);
    expect(dayWorkouts(data, NEXT_THU)).toEqual([]);
    expect(data.logs['2026-10-01'][b]).toEqual([135]);
  });
});

describe('database upgrade', () => {
  it('keeps existing data when a version-1 database is upgraded', async () => {
    const old = createNodeDb();
    await old.execAsync(MIGRATIONS[0]);
    await old.execAsync('PRAGMA user_version = 1');
    await old.runAsync(
      "INSERT INTO workouts (id, name, muscle_group, sets, reps, created_at) VALUES ('w1', 'Bench', 'chest', 3, 8, 'x')",
      []
    );
    await old.runAsync("INSERT INTO plan_entries (date, workout_id) VALUES ('2026-10-01', 'w1')", []);
    await old.runAsync("INSERT INTO set_logs VALUES ('2026-10-01', 'w1', 0, 135)", []);

    await migrate(old);
    const data = await repo.loadAll(old);
    expect(data.workouts.map((w) => w.name)).toEqual(['Bench']);
    expect(data.plans).toEqual({ '2026-10-01': ['w1'] });
    expect(data.logs['2026-10-01'].w1).toEqual([135]);
    expect(data.routines).toEqual([]);
  });
});
