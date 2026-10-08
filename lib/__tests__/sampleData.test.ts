import { createMigratedDb } from '@/test-utils/nodeDb';
import { dayStatus } from '../derive';
import { loadAll } from '../repo';
import { seedSampleData } from '../sampleData';

describe('seedSampleData (dev only)', () => {
  it('fills ~3 months of history ending yesterday, and replaces existing data', async () => {
    const db = await createMigratedDb();
    await seedSampleData(db, '2026-10-07');
    await seedSampleData(db, '2026-10-07'); // re-running doesn't duplicate
    const data = await loadAll(db);

    expect(data.workouts).toHaveLength(8);
    expect(dayStatus(data, '2026-10-05')).toBe('done'); // Monday, past
    expect(dayStatus(data, '2026-10-07')).toBe('planned'); // today, skull 2/4
    expect(dayStatus(data, '2026-10-08')).toBe('planned'); // future
    expect(data.logs['2026-10-07']).toEqual({ skull: [50, 50] });
    expect(Object.keys(data.logs).every((d) => d <= '2026-10-07')).toBe(true);
  });
});
