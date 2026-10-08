// Weights are stored as raw numbers; the unit is display-only (lb for now, kg later).
export const UNIT = 'lb';

/** 145 → "145 lb", 137.5 → "137.5 lb", null → "—" */
export function formatWeight(w: number | null): string {
  return w == null ? '—' : `${w} ${UNIT}`;
}

/** "chest · 4 × 8" */
export function workoutMeta(w: { group: string; sets: number; reps: number }): string {
  return `${w.group} · ${w.sets} × ${w.reps}`;
}
