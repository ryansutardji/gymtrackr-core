import { chartTicks, type Session } from './derive';
import { addDays, formatMonthDay, parseKey, toKey } from './dates';
import { colors } from './theme';
import type { DateKey } from './types';

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
export type ChartDot = { set: number; x: number; y: number; r: number; fill: string; stroke: string };

export type Chart = {
  yTicks: { y: number; label: number }[];
  xLabels: { x: number; anchor: 'start' | 'middle' | 'end'; label: string }[];
  /** Highlighted line last, so it draws on top. */
  lines: ChartLine[];
  dots: ChartDot[];
  /** x of the dashed marker for the selected session. */
  selectedX: number;
  /** x position of each session, for tap-to-select. */
  sessionX: { date: DateKey; x: number }[];
};

/**
 * @param sessions oldest first, non-empty
 * @param highlighted set index drawn in sage, or null for all-equal grey lines
 * @param selected the session whose points get markers
 */
export function buildChart(sessions: Session[], highlighted: number | null, selected: Session): Chart {
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
    stroke: highlighted == null ? colors.muted : i === highlighted ? colors.sage : colors.dimLine,
    width: highlighted == null ? 2 : i === highlighted ? 3.5 : 1.75,
  }));

  const dots = Array.from({ length: n }, (_, i) => i)
    .filter((i) => selected.weights[i] != null)
    .map((i) => ({
      set: i,
      x: xOf(selected.date),
      y: yOf(selected.weights[i]!),
      r: highlighted === i ? 5.5 : highlighted == null ? 3.5 : 3,
      fill: highlighted === i ? colors.bg : highlighted == null ? colors.muted : colors.dimLine,
      stroke: highlighted === i ? colors.sage : 'transparent',
    }));
  // Highlighted marker on top.
  dots.sort((a, b) => Number(a.set === highlighted) - Number(b.set === highlighted));

  const xLabels = [0, 1, 2, 3].map((i) => ({
    x: i === 0 ? L : i === 3 ? L + PW : L + (PW * i) / 3,
    anchor: (i === 0 ? 'start' : i === 3 ? 'end' : 'middle') as 'start' | 'middle' | 'end',
    label: formatMonthDay(toKey(new Date(t0 + ((t1 - t0) * i) / 3 + 36e5))),
  }));

  return {
    yTicks: ticks.map((v) => ({ y: yOf(v), label: v })),
    xLabels,
    lines,
    dots,
    selectedX: xOf(selected.date),
    sessionX: sessions.map((s) => ({ date: s.date, x: xOf(s.date) })),
  };
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
