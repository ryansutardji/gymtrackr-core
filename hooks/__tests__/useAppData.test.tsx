import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createMigratedDb } from '@/test-utils/nodeDb';
import { AppDataProvider, useAppData } from '../useAppData';

describe('useAppData', () => {
  it('loads from the database and refreshes after each change', async () => {
    const openDb = () => createMigratedDb();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AppDataProvider openDb={openDb}>{children}</AppDataProvider>
    );
    const { result } = renderHook(() => useAppData(), { wrapper });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.workouts).toEqual([]);

    let id = '';
    await act(async () => {
      id = (await result.current.createWorkout({ name: 'Squat', group: 'legs', sets: 4, reps: 6 })).id;
    });
    await act(async () => {
      await result.current.logSet('2026-10-07', id, 0, 185);
    });

    expect(result.current.workouts.map((w) => w.name)).toEqual(['Squat']);
    expect(result.current.plans).toEqual({ '2026-10-07': [id] });
    expect(result.current.logs).toEqual({ '2026-10-07': { [id]: [185] } });
  });

  it('reports a database that fails to open', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const openDb = () => Promise.reject(new Error('disk full'));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AppDataProvider openDb={openDb}>{children}</AppDataProvider>
    );
    const { result } = renderHook(() => useAppData(), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe('disk full'));
    expect(result.current.ready).toBe(false);
  });
});
