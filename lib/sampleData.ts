import type { SqlDb } from './db';
import { addDays, parseKey, todayKey } from './dates';
import type { DateKey, MuscleGroup } from './types';

// Development-only sample history, ported from the prototype's `initial()`:
// ~3 months of a 4-day split ending yesterday, plus a few planned days ahead
// and a half-logged workout today. Never called by the shipped app.

type Def = {
  id: string;
  name: string;
  group: MuscleGroup;
  sets: number;
  reps: number;
  base?: number;
  prog?: number;
  offs?: number[];
};

const DEFS: Def[] = [
  { id: 'bench', name: 'Bench press', group: 'chest', sets: 5, reps: 8, base: 115, prog: 0.55, offs: [0, 5, 10, 15, 5] },
  { id: 'incline', name: 'Incline DB press', group: 'chest', sets: 4, reps: 10, base: 40, prog: 0.25, offs: [0, 5, 5, 0] },
  { id: 'row', name: 'Barbell row', group: 'back', sets: 4, reps: 8, base: 95, prog: 0.5, offs: [0, 5, 10, 5] },
  { id: 'skull', name: 'Skull crushers', group: 'triceps', sets: 4, reps: 10, base: 45, prog: 0.25, offs: [0, 5, 5, 0] },
  { id: 'squat', name: 'Back squat', group: 'legs', sets: 4, reps: 6, base: 135, prog: 0.8, offs: [0, 10, 20, 10] },
  { id: 'curl', name: 'Hammer curl', group: 'biceps', sets: 3, reps: 12 },
  { id: 'ohp', name: 'Overhead press', group: 'shoulders', sets: 4, reps: 8 },
  { id: 'crunch', name: 'Cable crunch', group: 'abs', sets: 3, reps: 15 },
];

// Day of week (0 = Sunday) → workouts.
const SCHEDULE: Record<number, string[]> = {
  1: ['bench', 'incline'],
  2: ['squat'],
  3: ['row', 'skull'],
  4: ['bench', 'incline'],
};

/** Wipes the database and fills it with sample history around `today`. */
export async function seedSampleData(db: SqlDb, today: DateKey = todayKey()): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM set_logs; DELETE FROM plan_entries; DELETE FROM workouts;');
    const now = new Date().toISOString();
    for (const d of DEFS) {
      await db.runAsync(
        'INSERT INTO workouts (id, name, muscle_group, sets, reps, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [d.id, d.name, d.group, d.sets, d.reps, now]
      );
    }

    const count: Record<string, number> = {};
    for (let k = addDays(today, -93); k <= addDays(today, 5); k = addDays(k, 1)) {
      const ids = SCHEDULE[parseKey(k).getDay()];
      if (!ids) continue;
      for (const id of ids) {
        await db.runAsync('INSERT INTO plan_entries (date, workout_id) VALUES (?, ?)', [k, id]);
        if (k >= today) continue;
        const def = DEFS.find((x) => x.id === id)!;
        const n = (count[id] = (count[id] ?? 0) + 1);
        for (let i = 0; i < def.offs!.length; i++) {
          const w =
            Math.round((def.base! + n * def.prog! + def.offs![i]) / 5) * 5 + ((n * 7 + i * 3) % 5 === 0 ? -5 : 0);
          await db.runAsync('INSERT INTO set_logs (date, workout_id, set_index, weight) VALUES (?, ?, ?, ?)', [
            k,
            id,
            i,
            w,
          ]);
        }
      }
    }

    // Today: skull crushers half done.
    await db.runAsync('INSERT OR IGNORE INTO plan_entries (date, workout_id) VALUES (?, ?)', [today, 'skull']);
    for (const [i, w] of [50, 50].entries()) {
      await db.runAsync(
        'INSERT OR REPLACE INTO set_logs (date, workout_id, set_index, weight) VALUES (?, ?, ?, ?)',
        [today, 'skull', i, w]
      );
    }
  });
}
