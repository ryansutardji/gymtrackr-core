import { createMigratedDb } from '@/test-utils/nodeDb';
import { migrate, type SqlDb } from '../db';
import * as repo from '../repo';
import type { WorkoutDraft } from '../types';

const bench: WorkoutDraft = { name: 'Bench press', group: 'chest', sets: 3, reps: 8 };
const row: WorkoutDraft = { name: 'Barbell row', group: 'back', sets: 4, reps: 8 };

let db: SqlDb;
beforeEach(async () => {
  db = await createMigratedDb();
});

describe('migrate', () => {
  it('is safe to run again on an up-to-date database', async () => {
    await migrate(db);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(v?.user_version).toBe(1);
  });
});

describe('workouts', () => {
  it('creates, trims the name, and loads back', async () => {
    const w = await repo.createWorkout(db, { ...bench, name: '  Bench press  ' });
    const data = await repo.loadAll(db);
    expect(data.workouts).toEqual([{ ...bench, id: w.id, deletedAt: null }]);
  });

  it('updates fields without touching past logs', async () => {
    const w = await repo.createWorkout(db, bench);
    await repo.logSet(db, '2026-10-01', w.id, 2, 135);
    await repo.updateWorkout(db, w.id, { ...bench, sets: 2, reps: 10 });
    const data = await repo.loadAll(db);
    expect(data.workouts[0]).toMatchObject({ sets: 2, reps: 10 });
    expect(data.logs['2026-10-01'][w.id]).toEqual([null, null, 135]);
  });

  it('delete removes it from all plans but keeps its history', async () => {
    const w = await repo.createWorkout(db, bench);
    const other = await repo.createWorkout(db, row);
    await repo.addToPlan(db, '2026-10-01', [w.id, other.id]);
    await repo.addToPlan(db, '2026-10-20', [w.id]);
    await repo.logSet(db, '2026-10-01', w.id, 0, 135);

    await repo.deleteWorkout(db, w.id);
    const data = await repo.loadAll(db);
    expect(data.workouts.find((x) => x.id === w.id)?.deletedAt).toEqual(expect.any(String));
    expect(data.plans).toEqual({ '2026-10-01': [other.id] });
    expect(data.logs['2026-10-01'][w.id]).toEqual([135]);
  });
});

describe('plans', () => {
  it('adds workouts to a day, ignoring duplicates, in the order added', async () => {
    const a = await repo.createWorkout(db, bench);
    const b = await repo.createWorkout(db, row);
    await repo.addToPlan(db, '2026-10-07', [b.id]);
    await repo.addToPlan(db, '2026-10-07', [a.id, b.id]);
    expect((await repo.loadAll(db)).plans).toEqual({ '2026-10-07': [b.id, a.id] });
  });

  it('removeFromDay clears that day only — plan and logs', async () => {
    const w = await repo.createWorkout(db, bench);
    await repo.logSet(db, '2026-10-01', w.id, 0, 130);
    await repo.logSet(db, '2026-10-07', w.id, 0, 135);
    await repo.removeFromDay(db, '2026-10-07', w.id);
    const data = await repo.loadAll(db);
    expect(data.plans).toEqual({ '2026-10-01': [w.id] });
    expect(data.logs).toEqual({ '2026-10-01': { [w.id]: [130] } });
  });
});

describe('logSet', () => {
  it('logs, overwrites, and auto-adds an unplanned workout to the day', async () => {
    const w = await repo.createWorkout(db, bench);
    await repo.logSet(db, '2026-10-07', w.id, 0, 135);
    await repo.logSet(db, '2026-10-07', w.id, 1, 140);
    await repo.logSet(db, '2026-10-07', w.id, 0, 137.5);
    const data = await repo.loadAll(db);
    expect(data.logs['2026-10-07'][w.id]).toEqual([137.5, 140]);
    expect(data.plans['2026-10-07']).toEqual([w.id]);
  });

  it('clears a set with null and never stores a negative weight', async () => {
    const w = await repo.createWorkout(db, bench);
    await repo.logSet(db, '2026-10-07', w.id, 0, -10);
    await repo.logSet(db, '2026-10-07', w.id, 1, 100);
    await repo.logSet(db, '2026-10-07', w.id, 1, null);
    expect((await repo.loadAll(db)).logs['2026-10-07'][w.id]).toEqual([0]);
  });
});
