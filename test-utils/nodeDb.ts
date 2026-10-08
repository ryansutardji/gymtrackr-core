import { DatabaseSync } from 'node:sqlite';
import { migrate, type SqlDb } from '@/lib/db';

/** In-memory SqlDb backed by Node's built-in SQLite, for tests. */
export function createNodeDb(): SqlDb {
  const raw = new DatabaseSync(':memory:');
  const db: SqlDb = {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params) {
      return raw.prepare(source).run(...(params as any[]));
    },
    async getAllAsync<T>(source: string, params: any[] = []) {
      return raw.prepare(source).all(...params) as T[];
    },
    async getFirstAsync<T>(source: string, params: any[] = []) {
      return (raw.prepare(source).get(...params) as T) ?? null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db;
}

export async function createMigratedDb(): Promise<SqlDb> {
  const db = createNodeDb();
  await migrate(db);
  return db;
}
