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

export type AppData = {
  workouts: Workout[];
  plans: Plans;
  logs: Logs;
};

export type DayStatus = 'none' | 'planned' | 'done';
