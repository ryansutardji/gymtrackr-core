import { buildChart, nearestSession, sessionsInRange, setCount } from '../chart';
import type { Session } from '../derive';
import { colors } from '../theme';

const S = (date: string, weights: (number | null)[]): Session => ({ date, weights });

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

  it('highlighting moves that line on top in sage and dims the rest', () => {
    const c = buildChart(sessions, 0, sessions[1]);
    expect(c.lines.map((l) => l.set)).toEqual([1, 2, 0]);
    expect(c.lines[2]).toMatchObject({ stroke: colors.sage, width: 3.5 });
    expect(c.lines[0]).toMatchObject({ stroke: colors.dimLine, width: 1.75 });
    // Markers at the selected session; highlighted one is the big ringed dot, drawn last.
    expect(c.dots).toHaveLength(3);
    expect(c.dots[2]).toMatchObject({ set: 0, r: 5.5, stroke: colors.sage });
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
