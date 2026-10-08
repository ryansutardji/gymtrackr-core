import * as d from '../derive';
import { EMPTY_DATA, type AppData, type Workout } from '../types';

const W = (id: string, sets: number, extra: Partial<Workout> = {}): Workout => ({
  id, name: id, group: 'chest', sets, reps: 8, deletedAt: null, ...extra,
});

const bench = W('bench', 3);
const row = W('row', 2);

function data(partial: Partial<AppData> = {}): AppData {
  return { ...EMPTY_DATA, workouts: [bench, row], ...partial };
}

describe('dayStatus', () => {
  it('is none when nothing is planned', () => {
    expect(d.dayStatus(data(), '2026-10-07')).toBe('none');
  });

  it('is planned until every planned workout has all sets logged', () => {
    const base = data({ plans: { '2026-10-07': ['bench', 'row'] } });
    expect(d.dayStatus(base, '2026-10-07')).toBe('planned');

    const partial = { ...base, logs: { '2026-10-07': { bench: [1, 2, 3], row: [1, null] } } };
    expect(d.dayStatus(partial, '2026-10-07')).toBe('planned');

    const full = { ...base, logs: { '2026-10-07': { bench: [1, 2, 3], row: [1, 2] } } };
    expect(d.dayStatus(full, '2026-10-07')).toBe('done');
  });

  it('ignores deleted workouts', () => {
    const gone = data({ workouts: [W('bench', 3, { deletedAt: 'x' })], plans: { '2026-10-07': ['bench'] } });
    expect(d.dayStatus(gone, '2026-10-07')).toBe('none');
  });
});

describe('sessions / lastTopSet', () => {
  const logs = {
    '2026-10-05': { bench: [135, 140, 145] },
    '2026-10-01': { bench: [130, null, 150] },
    '2026-10-03': { bench: [null, null, null], row: [95] },
  };

  it('lists dates with ≥1 logged set, oldest first', () => {
    expect(d.sessions(logs, 'bench').map((s) => s.date)).toEqual(['2026-10-01', '2026-10-05']);
  });

  it('last top set is the heaviest set of the most recent session', () => {
    expect(d.lastTopSet(logs, 'bench')).toBe(145);
    expect(d.lastTopSet(logs, 'row')).toBe(95);
    expect(d.lastTopSet(logs, 'nope')).toBeNull();
  });
});

describe('doneCount', () => {
  it('ignores sets beyond the current plan', () => {
    const logs = { '2026-10-07': { row: [100, 100, 100, 100, 100] } }; // row now has 2 sets
    expect(d.doneCount(logs, '2026-10-07', row)).toBe(2);
    expect(d.isComplete(logs, '2026-10-07', row)).toBe(true);
  });
});

describe('firstOpenSet', () => {
  it('opens on the first unlogged set, or the last set when all are logged', () => {
    expect(d.firstOpenSet({}, '2026-10-07', bench)).toBe(0);
    expect(d.firstOpenSet({ '2026-10-07': { bench: [1, null, 3] } }, '2026-10-07', bench)).toBe(1);
    expect(d.firstOpenSet({ '2026-10-07': { bench: [1, 2, 3] } }, '2026-10-07', bench)).toBe(2);
  });
});

describe('prefillWeight', () => {
  const logs = {
    '2026-10-01': { bench: [130, 135] },
    '2026-10-07': { bench: [140, null, null] },
    '2026-10-09': { bench: [999] },
  };

  it('uses the value already logged for that set today', () => {
    expect(d.prefillWeight(logs, '2026-10-07', 'bench', 0)).toBe(140);
  });
  it('then the same set from the previous session (never a later one)', () => {
    expect(d.prefillWeight(logs, '2026-10-07', 'bench', 1)).toBe(135);
  });
  it('then the previous set logged today', () => {
    expect(d.prefillWeight(logs, '2026-10-07', 'bench', 2)).toBe(140);
  });
  it('falls back to 45', () => {
    expect(d.prefillWeight({}, '2026-10-07', 'bench', 0)).toBe(45);
  });
});

describe('stepWeight', () => {
  it('steps by 5 and 2.5 without float drift and never below 0', () => {
    expect(d.stepWeight(135, 5)).toBe(140);
    expect(d.stepWeight(135, -2.5)).toBe(132.5);
    expect(d.stepWeight(0.1 + 0.2, 2.5)).toBe(2.8);
    expect(d.stepWeight(2.5, -5)).toBe(0);
  });
});

describe('chartTicks', () => {
  it('pads by 5 and uses 4 ticks at multiples of 5', () => {
    expect(d.chartTicks([115, 145])).toEqual({ min: 110, max: 155, ticks: [110, 125, 140, 155] });
  });
  it('keeps a minimum step of 5 for flat data', () => {
    expect(d.chartTicks([100, 100])).toEqual({ min: 95, max: 110, ticks: [95, 100, 105, 110] });
  });
});

describe('loggedWorkouts', () => {
  it('includes deleted workouts that have history', () => {
    const gone = W('old', 3, { deletedAt: 'x' });
    const app = data({ workouts: [bench, row, gone], logs: { '2026-10-01': { old: [100] } } });
    expect(d.loggedWorkouts(app).map((w) => w.id)).toEqual(['old']);
  });
});
