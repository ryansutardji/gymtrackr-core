import { createMigratedDb, createNodeDb } from '@/test-utils/nodeDb';
import { migrate, MIGRATIONS, type SqlDb } from '../db';
import * as repo from '../repo';
import { difficultyRank, ratingCounts, sessions } from '../derive';

let db: SqlDb;
let id: string;
beforeEach(async () => {
  db = await createMigratedDb();
  id = (await repo.createWorkout(db, { name: 'Bench', group: 'chest', sets: 3, reps: 8 })).id;
});

describe('set ratings', () => {
  it('saves a rating with the weight, changes it, and leaves unrated sets empty', async () => {
    await repo.logSet(db, '2026-10-07', id, 0, 135, 'easy');
    await repo.logSet(db, '2026-10-07', id, 2, 145, 'hard');
    await repo.logSet(db, '2026-10-07', id, 1, 140);
    let data = await repo.loadAll(db);
    expect(data.logs['2026-10-07'][id]).toEqual([135, 140, 145]);
    expect(data.ratings['2026-10-07'][id]).toEqual(['easy', null, 'hard']);

    await repo.logSet(db, '2026-10-07', id, 0, 135, 'medium'); // Update set
    await repo.logSet(db, '2026-10-07', id, 2, 145, null); // rating cleared
    data = await repo.loadAll(db);
    expect(data.ratings['2026-10-07'][id]).toEqual(['medium']);
  });

  it('clearing a set clears its rating too', async () => {
    await repo.logSet(db, '2026-10-07', id, 0, 135, 'hard');
    await repo.logSet(db, '2026-10-07', id, 0, null);
    expect((await repo.loadAll(db)).ratings).toEqual({});
  });

  it('sessions carry ratings; counts cover the last 5 rated', async () => {
    const days = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06'];
    const r = ['hard', 'hard', 'medium', 'medium', null, 'easy'] as const;
    for (const [i, d] of days.entries()) await repo.logSet(db, d, id, 0, 135, r[i]);
    const data = await repo.loadAll(db);
    const list = sessions(data.logs, id, data.ratings);
    expect(list.map((s) => s.ratings?.[0] ?? null)).toEqual([...r]);
    // Last 5 = Sep 8 … Oct 6: hard, medium, medium, (none), easy.
    expect(ratingCounts(list, 0)).toEqual({ easy: 1, medium: 2, hard: 1 });
  });

  it('ranks hard > medium > easy > unrated', () => {
    expect([null, 'easy', 'hard', 'medium'].map((d) => difficultyRank(d as never))).toEqual([0, 1, 3, 2]);
  });

  it('upgrading a version-2 database keeps every logged weight, unrated', async () => {
    const old = createNodeDb();
    await old.execAsync(MIGRATIONS[0]);
    await old.execAsync(MIGRATIONS[1]);
    await old.execAsync('PRAGMA user_version = 2');
    await old.runAsync(
      "INSERT INTO workouts (id, name, muscle_group, sets, reps, created_at) VALUES ('w1', 'Bench', 'chest', 3, 8, 'x')",
      []
    );
    await old.runAsync("INSERT INTO set_logs (date, workout_id, set_index, weight) VALUES ('2026-10-01', 'w1', 0, 135)", []);
    await migrate(old);
    const data = await repo.loadAll(old);
    expect(data.logs['2026-10-01'].w1).toEqual([135]);
    expect(data.ratings).toEqual({});
  });
});
