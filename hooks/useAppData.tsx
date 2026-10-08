import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { openDatabase, type SqlDb } from '@/lib/db';
import * as repo from '@/lib/repo';
import type { AppData, DateKey, Workout, WorkoutDraft } from '@/lib/types';

type Actions = {
  createWorkout(draft: WorkoutDraft): Promise<Workout>;
  updateWorkout(id: string, draft: WorkoutDraft): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  addToPlan(date: DateKey, workoutIds: string[]): Promise<void>;
  removeFromDay(date: DateKey, workoutId: string): Promise<void>;
  logSet(date: DateKey, workoutId: string, setIndex: number, weight: number | null): Promise<void>;
};

type AppDataValue = AppData & Actions & { ready: boolean; error: Error | null };

const EMPTY: AppData = { workouts: [], plans: {}, logs: {} };

const AppDataContext = createContext<AppDataValue | null>(null);

/**
 * Owns the on-device database. Every change is written to the database first,
 * then the in-memory copy is reloaded from it, so the screens always show
 * exactly what's stored.
 */
export function AppDataProvider({
  children,
  openDb = openDatabase,
}: {
  children: ReactNode;
  openDb?: () => Promise<SqlDb>;
}) {
  const dbRef = useRef<SqlDb | null>(null);
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await openDb();
        const loaded = await repo.loadAll(db);
        if (cancelled) return;
        dbRef.current = db;
        setData(loaded);
        setReady(true);
      } catch (e) {
        console.error('Failed to open database', e);
        if (!cancelled) setError(e as Error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openDb]);

  // Runs a write, then refreshes the in-memory copy.
  const write = useCallback(async <T,>(op: (db: SqlDb) => Promise<T>): Promise<T> => {
    const db = dbRef.current;
    if (!db) throw new Error('Database not ready');
    const result = await op(db);
    setData(await repo.loadAll(db));
    return result;
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      createWorkout: (draft) => write((db) => repo.createWorkout(db, draft)),
      updateWorkout: (id, draft) => write((db) => repo.updateWorkout(db, id, draft)),
      deleteWorkout: (id) => write((db) => repo.deleteWorkout(db, id)),
      addToPlan: (date, ids) => write((db) => repo.addToPlan(db, date, ids)),
      removeFromDay: (date, id) => write((db) => repo.removeFromDay(db, date, id)),
      logSet: (date, id, setIndex, weight) => write((db) => repo.logSet(db, date, id, setIndex, weight)),
    }),
    [write]
  );

  const value = useMemo(() => ({ ...data, ...actions, ready, error }), [data, actions, ready, error]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}
