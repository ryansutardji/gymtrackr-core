import { chartTicks, difficultyRank, type Session } from './derive';
import { addDays, formatMonthDay, parseKey, toKey } from './dates';
import { colors, ratingColors } from './theme';
import type { DateKey, Difficulty } from './types';

// Geometry for the Stats chart, ported from the prototype. Everything is in
// the SVG's 320×200 viewBox; the plot area is 276×164 starting at (36, 12).

export const VIEW_W = 320;
export const VIEW_H = 200;
const L = 36;
const T = 12;
const PW = 276;
const PH = 164;
const DAY_MS = 864e5;

export type Range = '1M' | '3M' | '1Y' | 'All';
export const RANGES: Range[] = ['1M', '3M', '1Y', 'All'];
const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 91, '1Y': 365, All: Infinity };

/** Sessions on or after the range's cutoff, counted back from `today`. */
export function sessionsInRange(all: Session[], range: Range, today: DateKey): Session[] {
  const days = RANGE_DAYS[range];
  if (!isFinite(days)) return all;
  const cutoff = addDays(today, -days);
  return all.filter((s) => s.date >= cutoff);
}

/** Number of set lines = most sets in any session (old set-5 history persists if the plan drops to 4). */
export function setCount(sessions: Session[]): number {
  return sessions.length ? Math.max(...sessions.map((s) => s.weights.length)) : 0;
}

export type ChartLine = { set: number; points: string; stroke: string; width: number };

/**
 * How sets that share a weight in one session are drawn: a stacked pill
 * (S1 on top) on short ranges, or one dot in the hardest rating on long ones.
 */
export type MarkMode = 'stacked' | 'hardest';
export const markMode = (range: Range): MarkMode => (range === '1Y' || range === 'All' ? 'hardest' : 'stacked');

/** A rating mark, drawn after the lines in array order. */
export type ChartShape =
  | { type: 'circle'; key: string; cx: number; cy: number; r: number; fill: string; stroke: string; strokeWidth: number }
  | { type: 'rect'; key: string; x: number; y: number; width: number; height: number; rx: number; fill: string };

export type Chart = {
  yTicks: { y: number; label: number }[];
  xLabels: { x: number; anchor: 'start' | 'middle' | 'end'; label: string }[];
  /** Highlighted line last, so it draws on top. */
  lines: ChartLine[];
  /** Rating marks per session (unrated sets get none). */
  marks: ChartShape[];
  /** x of the dashed marker for the selected session. */
  selectedX: number;
  /** x position of each session, for tap-to-select. */
  sessionX: { date: DateKey; x: number }[];
};

/**
 * @param sessions oldest first, non-empty
 * @param highlighted set index drawn bright on top, or null for all-equal grey lines
 * @param selected the session with the dashed marker
 * @param mode how sets sharing a weight are marked
 */
export function buildChart(
  sessions: Session[],
  highlighted: number | null,
  selected: Session,
  mode: MarkMode = 'stacked'
): Chart {
  const time = (d: DateKey) => parseKey(d).getTime();
  const t0 = time(sessions[0].date);
  const t1raw = time(sessions[sessions.length - 1].date);
  const t1 = t1raw === t0 ? t0 + DAY_MS : t1raw;
  const xOf = (d: DateKey) => (sessions.length < 2 ? L + PW / 2 : L + 10 + ((time(d) - t0) / (t1 - t0)) * (PW - 20));

  const values = sessions.flatMap((s) => s.weights.filter((v): v is number => v != null));
  const { min, max, ticks } = chartTicks(values);
  const yOf = (v: number) => T + PH * (1 - (v - min) / (max - min));

  const n = setCount(sessions);
  const order = Array.from({ length: n }, (_, i) => i).filter((i) => i !== highlighted);
  if (highlighted != null) order.push(highlighted);

  const lines = order.map((i) => ({
    set: i,
    points: sessions
      .filter((s) => s.weights[i] != null)
      .map((s) => `${xOf(s.date).toFixed(1)},${yOf(s.weights[i]!).toFixed(1)}`)
      .join(' '),
    // Light, not sage, so the highlighted line isn't mistaken for "Easy" marks.
    stroke: highlighted == null ? colors.muted : i === highlighted ? colors.text : colors.dimLine,
    width: highlighted == null ? 2 : i === highlighted ? 3 : 1.75,
  }));

  const marks = buildMarks(sessions, highlighted, mode, xOf, yOf);

  const xLabels = [0, 1, 2, 3].map((i) => ({
    x: i === 0 ? L : i === 3 ? L + PW : L + (PW * i) / 3,
    anchor: (i === 0 ? 'start' : i === 3 ? 'end' : 'middle') as 'start' | 'middle' | 'end',
    label: formatMonthDay(toKey(new Date(t0 + ((t1 - t0) * i) / 3 + 36e5))),
  }));

  return {
    yTicks: ticks.map((v) => ({ y: yOf(v), label: v })),
    xLabels,
    lines,
    marks,
    selectedX: xOf(selected.date),
    sessionX: sessions.map((s) => ({ date: s.date, x: xOf(s.date) })),
  };
}

const dot = (key: string, cx: number, cy: number, r: number, rating: Difficulty): ChartShape => ({
  type: 'circle',
  key,
  cx,
  cy,
  r,
  fill: ratingColors[rating],
  stroke: colors.surface, // card colour: separates the dot from the lines
  strokeWidth: 1.4,
});

/** Rating marks, following the design handoff's geometry. */
function buildMarks(
  sessions: Session[],
  highlighted: number | null,
  mode: MarkMode,
  xOf: (d: DateKey) => number,
  yOf: (v: number) => number
): ChartShape[] {
  // Gap between sessions sets the mark size, so dense ranges get smaller marks.
  const sp = sessions.length < 2 ? 20 : (PW - 20) / (sessions.length - 1);
  const r = Math.max(2.2, Math.min(3.8, sp * 0.42));
  const out: ChartShape[] = [];

  sessions.forEach((s, k) => {
    const cx = xOf(s.date);
    const rating = (i: number) => s.ratings?.[i] ?? null;

    if (highlighted != null) {
      const v = s.weights[highlighted];
      const rt = rating(highlighted);
      if (v != null && rt) out.push(dot(`m${k}`, cx, yOf(v), r + 0.6, rt));
      return;
    }

    // Sets at the same weight sit on the same point.
    const groups = new Map<number, number[]>();
    s.weights.forEach((v, i) => {
      if (v != null) groups.set(v, [...(groups.get(v) ?? []), i]);
    });
    for (const [v, idx] of groups) {
      const rs = idx.map(rating);
      if (rs.every((x) => !x)) continue;
      const key = `m${k}_${v}`;
      const cy = yOf(v);

      if (idx.length === 1) {
        out.push(dot(key, cx, cy, r, rs[0]!));
      } else if (mode === 'hardest') {
        const hardest = rs.reduce((a, b) => (difficultyRank(b) > difficultyRank(a) ? b : a), null);
        // Ring signals "several sets here", when there's room for it.
        if (sp >= 7) {
          out.push({ type: 'circle', key: `${key}h`, cx, cy, r: r + 2.6, fill: colors.surface, stroke: colors.checkRing, strokeWidth: 1.1 });
        }
        out.push(dot(key, cx, cy, r, hardest!));
      } else {
        const w = Math.max(4, Math.min(8, sp - 2));
        const sh = Math.max(3, w * 0.78);
        const tot = idx.length * sh + (idx.length - 1);
        const top = cy - tot / 2;
        out.push({ type: 'rect', key: `${key}b`, x: cx - w / 2 - 1.5, y: top - 1.5, width: w + 3, height: tot + 3, rx: (w + 3) / 2, fill: colors.surface });
        rs.forEach((rt, j) =>
          out.push({
            type: 'rect',
            key: `${key}s${j}`,
            x: cx - w / 2,
            y: top + j * (sh + 1),
            width: w,
            height: sh,
            rx: Math.min(2, sh / 3),
            fill: rt ? ratingColors[rt] : colors.line,
          })
        );
      }
    }
  });
  return out;
}

/** Whether the session has 2+ sets at the same weight (drawn stacked or hardest-wins). */
export function hasSharedWeight(s: Session): boolean {
  const seen = new Set<number>();
  for (const v of s.weights) {
    if (v == null) continue;
    if (seen.has(v)) return true;
    seen.add(v);
  }
  return false;
}

/** Session closest to a tap at viewBox x. */
export function nearestSession(sessionX: { date: DateKey; x: number }[], x: number): DateKey | null {
  let best: DateKey | null = null;
  let bestD = Infinity;
  for (const s of sessionX) {
    const d = Math.abs(s.x - x);
    if (d < bestD) {
      bestD = d;
      best = s.date;
    }
  }
  return best;
}

export const PLOT = { left: L, top: T, width: PW, height: PH, right: L + PW, bottom: T + PH };
