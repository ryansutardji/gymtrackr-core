import { buildChart, hasSharedWeight, markMode, nearestSession, sessionsInRange, setCount } from '../chart';
import type { Session } from '../derive';
import { colors, ratingColors } from '../theme';
import type { Difficulty } from '../types';

const S = (date: string, weights: (number | null)[], ratings?: (Difficulty | null)[]): Session => ({ date, weights, ratings });

const sessions = [
  S('2026-07-06', [100, 110]),
  S('2026-08-06', [105, 115, 120]), // an old 3rd set
  S('2026-10-05', [110, 120]),
];

describe('sessionsInRange', () => {
  it('keeps sessions on or after the cutoff', () => {
    expect(sessionsInRange(sessions, '1M', '2026-10-07').map((s) => s.date)).toEqual(['2026-10-05']);
    // 3M = 91 days back → Jul 8, so Jul 6 is out.
    expect(sessionsInRange(sessions, '3M', '2026-10-07').map((s) => s.date)).toEqual(['2026-08-06', '2026-10-05']);
    expect(sessionsInRange(sessions, 'All', '2026-10-07')).toHaveLength(3);
  });
});

describe('buildChart', () => {
  it('draws one line per set seen in the data, spanning the plot', () => {
    expect(setCount(sessions)).toBe(3);
    const c = buildChart(sessions, null, sessions[2]);
    expect(c.lines.map((l) => l.set)).toEqual([0, 1, 2]);
    expect(c.lines.every((l) => l.stroke === colors.muted && l.width === 2)).toBe(true);
    // First/last sessions sit 10 in from the plot edges (36+10, 312-10).
    expect(c.sessionX[0].x).toBeCloseTo(46);
    expect(c.sessionX[2].x).toBeCloseTo(302);
    expect(c.selectedX).toBeCloseTo(302);
    // Set 3 only has one point.
    expect(c.lines[2].points.split(' ')).toHaveLength(1);
  });

  it('y axis: 4 ticks, top tick at the top of the plot', () => {
    const c = buildChart(sessions, null, sessions[2]);
    // 100–120 → floor(95) with a step of 10.
    expect(c.yTicks.map((t) => t.label)).toEqual([95, 105, 115, 125]);
    expect(c.yTicks[3].y).toBeCloseTo(12);
    expect(c.yTicks[0].y).toBeCloseTo(176);
  });

  it('x labels: 4 dates, first and last anchored to the edges', () => {
    const c = buildChart(sessions, null, sessions[2]);
    expect(c.xLabels.map((l) => l.anchor)).toEqual(['start', 'middle', 'middle', 'end']);
    expect(c.xLabels[0].label).toBe('Jul 6');
    expect(c.xLabels[3].label).toBe('Oct 5');
  });

  it('highlighting moves that line on top in light grey and dims the rest', () => {
    const c = buildChart(sessions, 0, sessions[1]);
    expect(c.lines.map((l) => l.set)).toEqual([1, 2, 0]);
    expect(c.lines[2]).toMatchObject({ stroke: colors.text, width: 3 });
    expect(c.lines[0]).toMatchObject({ stroke: colors.dimLine, width: 1.75 });
  });

  it('a single session sits in the middle', () => {
    const one = [S('2026-10-05', [100])];
    const c = buildChart(one, null, one[0]);
    expect(c.selectedX).toBeCloseTo(36 + 276 / 2);
  });
});

describe('nearestSession', () => {
  it('picks the closest x', () => {
    const c = buildChart(sessions, null, sessions[2]);
    expect(nearestSession(c.sessionX, 0)).toBe('2026-07-06');
    expect(nearestSession(c.sessionX, 150)).toBe('2026-08-06');
    expect(nearestSession(c.sessionX, 320)).toBe('2026-10-05');
    expect(nearestSession([], 100)).toBeNull();
  });
});

describe('rating marks', () => {
  // Two sessions → sp = 256, so r = 3.8 and pill width = 8.
  const rated = [
    S('2026-10-01', [100, 110, 120], ['easy', null, 'hard']),
    S('2026-10-08', [145, 145, 145], ['easy', 'medium', 'hard']),
  ];
  const circles = (c: ReturnType<typeof buildChart>) => c.marks.filter((m) => m.type === 'circle');

  it('unrated data draws no marks', () => {
    expect(buildChart(sessions, null, sessions[2]).marks).toEqual([]);
  });

  it('one dot per rated set at its own weight, in its rating colour', () => {
    const c = buildChart([rated[0]], null, rated[0]);
    expect(circles(c).map((m) => m.type === 'circle' && [m.fill, m.r])).toEqual([
      [ratingColors.easy, 3.8],
      [ratingColors.hard, 3.8],
    ]);
  });

  it('stacked mode: sets sharing a weight become one pill, S1 on top', () => {
    const c = buildChart(rated, null, rated[1], 'stacked');
    const pill = c.marks.filter((m) => m.key.startsWith('m1_145'));
    expect(pill.map((m) => m.type)).toEqual(['rect', 'rect', 'rect', 'rect']); // backing + 3 slices
    const slices = pill.slice(1);
    expect(slices.map((m) => m.type === 'rect' && m.fill)).toEqual([ratingColors.easy, ratingColors.medium, ratingColors.hard]);
    const ys = slices.map((m) => (m.type === 'rect' ? m.y : 0));
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(slices[0]).toMatchObject({ width: 8 });
  });

  it('stacked mode shows unrated slices in a neutral grey', () => {
    const s = [S('2026-10-08', [145, 145], [null, 'hard'])];
    const c = buildChart(s, null, s[0], 'stacked');
    expect(c.marks.slice(1).map((m) => m.type === 'rect' && m.fill)).toEqual([colors.line, ratingColors.hard]);
  });

  it('hardest mode: one dot in the hardest rating, with a ring when there is room', () => {
    const c = buildChart(rated, null, rated[1], 'hardest');
    const shared = c.marks.filter((m) => m.key.startsWith('m1_145'));
    expect(shared).toHaveLength(2);
    expect(shared[0]).toMatchObject({ type: 'circle', stroke: colors.checkRing, r: 3.8 + 2.6 });
    expect(shared[1]).toMatchObject({ type: 'circle', fill: ratingColors.hard });
  });

  it('a highlighted set shows only its own marks, slightly bigger', () => {
    const c = buildChart(rated, 1, rated[1], 'stacked');
    expect(c.marks).toHaveLength(1); // set 2 is unrated on Oct 1
    expect(c.marks[0]).toMatchObject({ type: 'circle', fill: ratingColors.medium, r: 3.8 + 0.6 });
  });

  it('mode by range and the shared-weight check', () => {
    expect(['1M', '3M', '1Y', 'All'].map((r) => markMode(r as never))).toEqual(['stacked', 'stacked', 'hardest', 'hardest']);
    expect(hasSharedWeight(rated[1])).toBe(true);
    expect(hasSharedWeight(rated[0])).toBe(false);
  });
});
