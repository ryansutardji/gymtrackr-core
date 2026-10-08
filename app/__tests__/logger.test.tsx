import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithData } from '@/test-utils/renderWithData';
import * as repo from '@/lib/repo';
import type { SqlDb } from '@/lib/db';
import LoggerScreen from '../logger';

const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

beforeEach(() => mockBack.mockClear());

const DATE = '2026-10-07';

async function setup(seedLogs?: (db: SqlDb, id: string) => Promise<void>) {
  let id = '';
  const result = await renderWithData(<LoggerScreen />, async (db) => {
    id = (await repo.createWorkout(db, { name: 'Bench press', group: 'chest', sets: 3, reps: 8 })).id;
    await seedLogs?.(db, id);
    mockParams = { date: DATE, workoutId: id };
  });
  return { ...result, id };
}

const weight = () => screen.getByLabelText('Weight in lb');
const press = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
  });
};

describe('Logger', () => {
  it('starts at 45 on a first-ever session and shows the header', async () => {
    await setup();
    expect(screen.getByText('Bench press')).toBeTruthy();
    expect(screen.getByText('Wed, Oct 7 · chest')).toBeTruthy();
    expect(screen.getByText('Set 1 of 3')).toBeTruthy();
    expect(screen.getByText('Target 8 reps')).toBeTruthy();
    expect(weight().props.value).toBe('45');
    expect(screen.getByText('lb · first time')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log set' })).toBeTruthy();
  });

  it('steps by ±5 and ±2.5, never below 0', async () => {
    await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Add 5 lb' }));
    fireEvent.press(screen.getByRole('button', { name: 'Add 2.5 lb' }));
    expect(weight().props.value).toBe('52.5');
    for (let i = 0; i < 12; i++) fireEvent.press(screen.getByRole('button', { name: 'Subtract 5 lb' }));
    expect(weight().props.value).toBe('0');
  });

  it('accepts typed digits and a dot only', async () => {
    await setup();
    fireEvent.changeText(weight(), '1x3,7.5');
    expect(weight().props.value).toBe('137.5');
    fireEvent.changeText(weight(), '');
    expect(screen.getByRole('button', { name: 'Log set' })).toBeDisabled();
  });

  it('pre-fills from the last session and walks through every set to finish', async () => {
    const { db, id } = await setup(async (db, id) => {
      await repo.logSet(db, '2026-10-01', id, 0, 135);
      await repo.logSet(db, '2026-10-01', id, 1, 140);
    });
    expect(weight().props.value).toBe('135');
    expect(screen.getByText('lb · last time 135')).toBeTruthy();

    await press('Log set');
    expect(screen.getByText('Set 2 of 3')).toBeTruthy();
    expect(weight().props.value).toBe('140'); // same set last session
    expect(screen.getByText('S1 135')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Add 5 lb' }));
    await press('Log set');
    expect(screen.getByText('Set 3 of 3')).toBeTruthy();
    expect(weight().props.value).toBe('145'); // no set 3 last time → previous set today
    expect(screen.getByRole('button', { name: 'Log set & finish' })).toBeTruthy();

    await press('Log set & finish');
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));

    const data = await repo.loadAll(db);
    expect(data.logs[DATE][id]).toEqual([135, 145, 145]);
    expect(data.plans[DATE]).toEqual([id]); // logging an unplanned workout plans it
  });

  it('opens on the first unlogged set and lets you edit a logged one', async () => {
    const { db, id } = await setup(async (db, id) => {
      await repo.logSet(db, DATE, id, 0, 100);
    });
    expect(screen.getByText('Set 2 of 3')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Set 1, logged 100 lb' }));
    expect(screen.getByText('Set 1 of 3')).toBeTruthy();
    expect(weight().props.value).toBe('100');
    fireEvent.press(screen.getByRole('button', { name: 'Subtract 2.5 lb' }));
    await press('Update set');

    expect(screen.getByText('Set 2 of 3')).toBeTruthy();
    expect((await repo.loadAll(db)).logs[DATE][id]).toEqual([97.5]);
  });

  it('opens on the last set when every set is logged', async () => {
    await setup(async (db, id) => {
      for (const i of [0, 1, 2]) await repo.logSet(db, DATE, id, i, 100 + i);
    });
    expect(screen.getByText('Set 3 of 3')).toBeTruthy();
    expect(weight().props.value).toBe('102');
    expect(screen.getByRole('button', { name: 'Update set' })).toBeTruthy();
  });

  it('closes with ✕ without saving', async () => {
    const { db } = await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect((await repo.loadAll(db)).logs).toEqual({});
  });
});
