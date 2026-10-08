import type { SQLiteBindValue } from 'expo-sqlite';

/**
 * The slice of expo-sqlite's database that the app uses. Keeping it this
 * narrow lets the tests swap in Node's built-in SQLite.
 */
export interface SqlDb {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindValue[]): Promise<unknown>;
  getAllAsync<T>(source: string, params: SQLiteBindValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SQLiteBindValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export const DB_NAME = 'gymtrackr.db';

// Each entry upgrades the database by one version. Never edit a shipped step —
// add a new one. `PRAGMA user_version` records how many have run.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE workouts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    sets INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE plan_entries (
    date TEXT NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts(id),
    PRIMARY KEY (date, workout_id)
  );
  CREATE TABLE set_logs (
    date TEXT NOT NULL,
    workout_id TEXT NOT NULL REFERENCES workouts(id),
    set_index INTEGER NOT NULL,
    weight REAL NOT NULL,
    PRIMARY KEY (date, workout_id, set_index)
  );
  CREATE INDEX set_logs_workout ON set_logs (workout_id, date);
  `,
];

export async function migrate(db: SqlDb): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export async function openDatabase(): Promise<SqlDb> {
  // Imported lazily so tests (which use their own database) never load the native module.
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(db);
  return db;
}
