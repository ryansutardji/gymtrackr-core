export const MUSCLE_GROUPS = ['chest', 'triceps', 'biceps', 'shoulders', 'back', 'legs', 'abs'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Local calendar date, 'YYYY-MM-DD'. */
export type DateKey = string;

export type Workout = {
  id: string;
  name: string;
  group: MuscleGroup;
  sets: number;
  reps: number;
  /** Set when the workout is deleted. Its log history is kept for Stats. */
  deletedAt: string | null;
};

export type WorkoutDraft = Pick<Workout, 'name' | 'group' | 'sets' | 'reps'>;

/** Per date, the workout ids planned that day. Unordered by design (no reordering). */
export type Plans = Record<DateKey, string[]>;

/** Per date, per workout: one weight per set index, null = not logged. Weights are raw numbers (lb). */
export type Logs = Record<DateKey, Record<string, (number | null)[]>>;

/**
 * A saved group of workouts that can be dropped onto a day at once. The app
 * shows these as "Plans"; in code they're routines, because `Plans` already
 * means "what's on each day".
 */
export type Routine = {
  id: string;
  name: string;
  /** In plan order. May include deleted workouts — filter with activeWorkouts. */
  workoutIds: string[];
  deletedAt: string | null;
};

/** "Repeat every {weekday}" for a routine. */
export type RoutineSchedule = {
  id: string;
  routineId: string;
  /** 0 = Sunday … 6 = Saturday, like Date.getDay(). */
  weekday: number;
  startDate: DateKey;
  /** Last day the repeat applies; null while it's on. */
  endedOn: DateKey | null;
  /** Days up to here have been copied into the day plans and no longer follow routine edits. */
  materializedThrough: DateKey | null;
};

export type AppData = {
  workouts: Workout[];
  plans: Plans;
  logs: Logs;
  routines: Routine[];
  schedules: RoutineSchedule[];
  /** Per date, workout ids removed from that day only (hides them from repeats). */
  exclusions: Record<DateKey, string[]>;
  /** Per date, workout id → routine id that put it there (for the plan label). */
  planSources: Record<DateKey, Record<string, string>>;
};

export const EMPTY_DATA: AppData = {
  workouts: [],
  plans: {},
  logs: {},
  routines: [],
  schedules: [],
  exclusions: {},
  planSources: {},
};

export type DayStatus = 'none' | 'planned' | 'done';
