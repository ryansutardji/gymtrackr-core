import * as dt from '../dates';

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(dt.addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dt.addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('survives daylight-saving changes', () => {
    expect(dt.addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(dt.addDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('weeks start on Monday', () => {
    // Oct 7 2026 is a Wednesday; Oct 11 a Sunday.
    expect(dt.startOfWeek('2026-10-07')).toBe('2026-10-05');
    expect(dt.startOfWeek('2026-10-11')).toBe('2026-10-05');
    expect(dt.weekDays('2026-10-07')).toEqual([
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11',
    ]);
  });

  it('month grid pads to whole Monday-first weeks', () => {
    const grid = dt.monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid.length % 7).toBe(0);
    expect(grid.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it('formats like the design', () => {
    expect(dt.formatShortDay('2026-10-08')).toBe('Thu, Oct 8');
    expect(dt.formatMonthDay('2026-10-05')).toBe('Oct 5');
    expect(dt.formatLongDay('2026-10-07')).toBe('Wednesday, October 7');
    expect(dt.formatMonthYear(2026, 9)).toBe('October 2026');
  });
});
