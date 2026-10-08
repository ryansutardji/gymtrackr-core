import { weekdayOf } from './dates';
import type { AppData, DateKey, DayStatus, Logs, Routine, RoutineSchedule, Workout } from './types';

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

/**
 * Logged sets among the workout's current plan. Sets beyond the plan (logged
 * before the set count was lowered) don't count, so progress never reads "5/4".
 */
export function doneCount(logs: Logs, date: DateKey, w: Workout): number {
  return setsFor(logs, date, w.id)
    .slice(0, w.sets)
    .filter((v) => v != null).length;
}

export function isComplete(logs: Logs, date: DateKey, w: Workout): boolean {
  return doneCount(logs, date, w) >= w.sets;
}

/** Whether a weekly repeat puts its plan on `date` (before that day has been copied in). */
export function scheduleCovers(s: RoutineSchedule, date: DateKey): boolean {
  return (
    weekdayOf(date) === s.weekday &&
    date >= s.startDate &&
    (s.endedOn == null || date <= s.endedOn) &&
    (s.materializedThrough == null || date > s.materializedThrough)
  );
}

/** Workout id → routine id for workouts that weekly repeats put on `date`. */
function repeatEntries(data: AppData, date: DateKey): Map<string, string> {
  const out = new Map<string, string>();
  const excluded = new Set(data.exclusions[date] ?? []);
  for (const s of data.schedules) {
    if (!scheduleCovers(s, date)) continue;
    const r = data.routines.find((x) => x.id === s.routineId);
    for (const id of r?.workoutIds ?? []) if (!excluded.has(id) && !out.has(id)) out.set(id, s.routineId);
  }
  return out;
}

export type DayGroup = {
  /** The plan that put these workouts on the day; absent for individually added ones. */
  routine?: Routine;
  /** Set when that plan currently repeats on this weekday. */
  repeatWeekday?: number;
  workouts: Workout[];
};

/**
 * The day's workouts grouped by the plan that put them there, groups in order
 * of first appearance. Inside a plan's group, workouts keep the plan's order,
 * so logging one (which saves it to the day) never moves its card.
 */
export function dayGroups(data: AppData, date: DateKey): DayGroup[] {
  const byId = new Map(activeWorkouts(data.workouts).map((w) => [w.id, w]));
  const repeats = repeatEntries(data, date);
  const sources = data.planSources[date] ?? {};
  const ids = [...(data.plans[date] ?? [])];
  for (const id of repeats.keys()) if (!ids.includes(id)) ids.push(id);

  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();
  for (const id of ids) {
    const w = byId.get(id);
    if (!w) continue;
    const rid = sources[id] ?? repeats.get(id) ?? '';
    let g = byKey.get(rid);
    if (!g) {
      const routine = rid ? data.routines.find((r) => r.id === rid) : undefined;
      const repeating =
        routine &&
        data.schedules.some((s) => s.routineId === rid && s.endedOn == null && s.weekday === weekdayOf(date));
      g = { routine, repeatWeekday: repeating ? weekdayOf(date) : undefined, workouts: [] };
      byKey.set(rid, g);
      groups.push(g);
    }
    g.workouts.push(w);
  }
  for (const g of groups) {
    if (!g.routine) continue;
    const pos = (w: Workout) => {
      const i = g.routine!.workoutIds.indexOf(w.id);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    g.workouts.sort((x, y) => pos(x) - pos(y));
  }
  return groups;
}

/** The (non-deleted) workouts planned on a date, including weekly repeats. */
export function dayWorkouts(data: AppData, date: DateKey): Workout[] {
  return dayGroups(data, date).flatMap((g) => g.workouts);
}

export function activeRoutines(routines: Routine[]): Routine[] {
  return routines.filter((r) => !r.deletedAt);
}

/** The plan's (non-deleted) workouts, in plan order. */
export function routineWorkouts(routine: Routine, workouts: Workout[]): Workout[] {
  const byId = new Map(activeWorkouts(workouts).map((w) => [w.id, w]));
  return routine.workoutIds.map((id) => byId.get(id)).filter((w): w is Workout => !!w);
}

/** "4 workouts · chest · shoulders" */
export function routineMeta(routine: Routine, workouts: Workout[]): string {
  const list = routineWorkouts(routine, workouts);
  const groups = [...new Set(list.map((w) => w.group))];
  return [`${list.length} ${list.length === 1 ? 'workout' : 'workouts'}`, ...groups].join(' · ');
}

/** The plan's weekly repeats that are still on. */
export function activeSchedules(data: AppData, routineId: string): RoutineSchedule[] {
  return data.schedules.filter((s) => s.routineId === routineId && s.endedOn == null);
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
export function loggedWorkouts(data: Pick<AppData, 'workouts' | 'logs'>): Workout[] {
  return data.workouts.filter((w) => sessions(data.logs, w.id).length > 0);
}
