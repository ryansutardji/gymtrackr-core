import type { AppData, DateKey, DayStatus, Logs, Workout } from './types';

// Pure calculations over the in-memory data. Rules mirror the logic class in
// resources/reference/Workout Tracker.dc.html.

export const DEFAULT_START_WEIGHT = 45;

export type Session = { date: DateKey; weights: (number | null)[] };

export function activeWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter((w) => !w.deletedAt);
}

export function setsFor(logs: Logs, date: DateKey, workoutId: string): (number | null)[] {
  return logs[date]?.[workoutId] ?? [];
}

/** Number of sets with a logged weight. */
export function doneCount(logs: Logs, date: DateKey, workoutId: string): number {
  return setsFor(logs, date, workoutId).filter((v) => v != null).length;
}

export function isComplete(logs: Logs, date: DateKey, w: Workout): boolean {
  return doneCount(logs, date, w.id) >= w.sets;
}

/** The (non-deleted) workouts planned on a date. */
export function dayWorkouts(data: AppData, date: DateKey): Workout[] {
  const byId = new Map(activeWorkouts(data.workouts).map((w) => [w.id, w]));
  return (data.plans[date] ?? []).map((id) => byId.get(id)).filter((w): w is Workout => !!w);
}

/** Calendar dot: nothing planned / planned / every planned workout fully logged. */
export function dayStatus(data: AppData, date: DateKey): DayStatus {
  const planned = dayWorkouts(data, date);
  if (!planned.length) return 'none';
  return planned.every((w) => isComplete(data.logs, date, w)) ? 'done' : 'planned';
}

/** Dates with at least one logged set for the workout, oldest first. */
export function sessions(logs: Logs, workoutId: string): Session[] {
  return Object.keys(logs)
    .sort()
    .filter((date) => logs[date][workoutId]?.some((v) => v != null))
    .map((date) => ({ date, weights: logs[date][workoutId] }));
}

/** Most recent session strictly before `date`. */
export function previousSession(logs: Logs, workoutId: string, date: DateKey): Session | undefined {
  return sessions(logs, workoutId)
    .filter((s) => s.date < date)
    .pop();
}

/** Heaviest set of the workout's most recent session, or null if never logged. */
export function lastTopSet(logs: Logs, workoutId: string): number | null {
  const s = sessions(logs, workoutId).pop();
  if (!s) return null;
  return Math.max(...s.weights.filter((v): v is number => v != null));
}

/** Logger opens on the first unlogged set, or the last set if all are logged. */
export function firstOpenSet(logs: Logs, date: DateKey, w: Workout): number {
  const cur = setsFor(logs, date, w.id);
  let i = 0;
  while (i < w.sets - 1 && cur[i] != null) i++;
  return i;
}

/**
 * Starting weight shown in the logger for a set:
 * already logged for this set today → same set last session → previous set today → 45.
 */
export function prefillWeight(logs: Logs, date: DateKey, workoutId: string, setIndex: number): number {
  const cur = setsFor(logs, date, workoutId);
  if (cur[setIndex] != null) return cur[setIndex]!;
  const prev = previousSession(logs, workoutId, date);
  if (prev?.weights[setIndex] != null) return prev.weights[setIndex]!;
  for (let i = setIndex - 1; i >= 0; i--) if (cur[i] != null) return cur[i]!;
  return DEFAULT_START_WEIGHT;
}

/** Apply a stepper press; never below 0, rounded to 0.1 to avoid float drift (e.g. 2.5 steps). */
export function stepWeight(value: number, delta: number): number {
  return Math.max(0, Math.round((value + delta) * 10) / 10);
}

/**
 * Y axis for the stats chart: 4 ticks at multiples of 5, step ≥ 5, with at
 * least 5 of padding below the lowest and above the highest value.
 */
export function chartTicks(values: number[]): { min: number; max: number; ticks: number[] } {
  const vmin = values.length ? Math.min(...values) : 0;
  const vmax = values.length ? Math.max(...values) : 10;
  const min = Math.floor((vmin - 5) / 5) * 5;
  const step = Math.max(5, Math.ceil((vmax + 5 - min) / 3 / 5) * 5);
  const ticks = [0, 1, 2, 3].map((i) => min + i * step);
  return { min, max: ticks[3], ticks };
}

/** Workouts that have any logged history (Stats dropdown), deleted ones included. */
export function loggedWorkouts(data: AppData): Workout[] {
  return data.workouts.filter((w) => sessions(data.logs, w.id).length > 0);
}
