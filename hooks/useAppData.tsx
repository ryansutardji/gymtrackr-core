import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { openDatabase, type SqlDb } from '@/lib/db';
import * as repo from '@/lib/repo';
import { todayKey } from '@/lib/dates';
import { EMPTY_DATA, type AppData, type DateKey, type Routine, type Workout, type WorkoutDraft } from '@/lib/types';

type Actions = {
  createWorkout(draft: WorkoutDraft): Promise<Workout>;
  updateWorkout(id: string, draft: WorkoutDraft): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  addToPlan(date: DateKey, workoutIds: string[]): Promise<void>;
  removeFromDay(date: DateKey, workoutId: string): Promise<void>;
  logSet(date: DateKey, workoutId: string, setIndex: number, weight: number | null): Promise<void>;
  createRoutine(name: string, workoutIds: string[]): Promise<Routine>;
  renameRoutine(id: string, name: string): Promise<void>;
  addToRoutine(id: string, workoutIds: string[]): Promise<void>;
  removeFromRoutine(id: string, workoutId: string): Promise<void>;
  deleteRoutine(id: string): Promise<void>;
  addRoutineToDay(date: DateKey, routineId: string, repeat: boolean): Promise<void>;
  stopSchedule(scheduleId: string): Promise<void>;
};

type AppDataValue = AppData & Actions & { ready: boolean; error: Error | null };

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
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await openDb();
        await repo.lockInPastRepeats(db, todayKey());
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
      createRoutine: (name, ids) => write((db) => repo.createRoutine(db, name, ids)),
      renameRoutine: (id, name) => write((db) => repo.renameRoutine(db, id, name)),
      addToRoutine: (id, ids) => write((db) => repo.addToRoutine(db, id, ids)),
      removeFromRoutine: (id, wid) => write((db) => repo.removeFromRoutine(db, id, wid)),
      deleteRoutine: (id) => write((db) => repo.deleteRoutine(db, id, todayKey())),
      addRoutineToDay: (date, id, repeat) => write((db) => repo.addRoutineToDay(db, date, id, repeat)),
      stopSchedule: (id) => write((db) => repo.stopSchedule(db, id, todayKey())),
    }),
    [write]
  );

  // Dev builds only: `globalThis.gymtrackrSeed()` (e.g. from the browser console)
  // replaces all data with sample history for trying out screens.
  useEffect(() => {
    if (!__DEV__ || !ready) return;
    const g = globalThis as { gymtrackrSeed?: () => Promise<void> };
    g.gymtrackrSeed = () => write((db) => require('@/lib/sampleData').seedSampleData(db));
    return () => {
      delete g.gymtrackrSeed;
    };
  }, [ready, write]);

  const value = useMemo(() => ({ ...data, ...actions, ready, error }), [data, actions, ready, error]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}
