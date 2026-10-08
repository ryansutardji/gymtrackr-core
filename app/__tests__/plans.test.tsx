import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithData } from '@/test-utils/renderWithData';
import { SelectedDateProvider } from '@/hooks/useSelectedDate';
import type { SqlDb } from '@/lib/db';
import * as repo from '@/lib/repo';
import WorkoutsScreen from '../(tabs)/workouts';
import PlanScreen from '../(tabs)/workouts/plan/[id]';
import PlanEditScreen from '../plan-edit';
import CalendarScreen from '../(tabs)/index';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDismissTo = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, []),
}));

// "Today" is Wed Oct 7 2026.
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual('@/lib/dates'),
  todayKey: () => '2026-10-07',
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockParams = {};
});

// Lets a sheet finish its 250 ms slide-out inside act().
const sheetClosed = () => act(() => new Promise((r) => setTimeout(r, 350)));

let ids: Record<string, string> = {};
async function seed(db: SqlDb, withPlan = true) {
  const bench = await repo.createWorkout(db, { name: 'Bench press', group: 'chest', sets: 4, reps: 8 });
  const ohp = await repo.createWorkout(db, { name: 'Overhead press', group: 'shoulders', sets: 3, reps: 8 });
  const fly = await repo.createWorkout(db, { name: 'Cable fly', group: 'chest', sets: 3, reps: 12 });
  ids = { bench: bench.id, ohp: ohp.id, fly: fly.id };
  if (withPlan) ids.push = (await repo.createRoutine(db, 'Push day', [bench.id, ohp.id])).id;
}

describe('Plans list', () => {
  it('opens on Plans, lists plans, and opens one', async () => {
    await renderWithData(<WorkoutsScreen />, (db) => seed(db));
    const card = await screen.findByRole('button', { name: 'Push day, 2 workouts · chest · shoulders' });
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/workouts/plan/[id]', params: { id: ids.push } });
  });

  it('press and hold asks before deleting, and keeps the workouts', async () => {
    const { db } = await renderWithData(<WorkoutsScreen />, (db) => seed(db));
    fireEvent(await screen.findByRole('button', { name: /^Push day/ }), 'longPress');
    expect(await screen.findByText('Delete Push day?')).toBeTruthy();
    expect(screen.getByText(/Its 2 workouts stay in your library/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Delete plan' }));
    });
    await waitFor(() => expect(screen.getByText('No plans yet. Tap + to create one.')).toBeTruthy());
    const data = await repo.loadAll(db);
    expect(data.routines[0].deletedAt).not.toBeNull();
    expect(data.workouts.filter((w) => !w.deletedAt)).toHaveLength(3);
    await sheetClosed();
    expect(screen.queryByText('Delete Push day?')).toBeNull();
  });
});

describe('New plan', () => {
  it('names it, picks workouts in order, and saves', async () => {
    const { db } = await renderWithData(<PlanEditScreen />, (db) => seed(db, false));
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    const next = screen.getByRole('button', { name: 'Next · choose workouts' });
    expect(next).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Plan name'), ' Upper A ');
    fireEvent.press(next);

    expect(screen.getByText('Choose workouts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select workouts' })).toBeDisabled();
    fireEvent.press(screen.getByRole('checkbox', { name: /^Overhead press/ }));
    fireEvent.press(screen.getByRole('checkbox', { name: /^Bench press/ }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save plan · 2 workouts' }));
    });

    await waitFor(() => expect(mockDismissTo).toHaveBeenCalled());
    const [r] = (await repo.loadAll(db)).routines;
    expect(r).toMatchObject({ name: 'Upper A', workoutIds: [ids.ohp, ids.bench] });
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: '/workouts/plan/[id]', params: { id: r.id } });
  });

  it('back from step 2 keeps the name', async () => {
    await renderWithData(<PlanEditScreen />, (db) => seed(db, false));
    fireEvent.changeText(screen.getByLabelText('Plan name'), 'Legs');
    fireEvent.press(screen.getByRole('button', { name: 'Next · choose workouts' }));
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Plan name').props.value).toBe('Legs');
  });

  it('renames an existing plan', async () => {
    const { db } = await renderWithData(<PlanEditScreen />, async (db) => {
      await seed(db);
      mockParams = { id: ids.push };
    });
    expect(screen.getByText('Rename plan')).toBeTruthy();
    expect(screen.queryByText('Step 1 of 2')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Plan name'), 'Push A');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await repo.loadAll(db)).routines[0].name).toBe('Push A');
  });
});

describe('Plan page', () => {
  async function open() {
    const result = await renderWithData(<PlanScreen />, async (db) => {
      await seed(db);
      mockParams = { id: ids.push };
    });
    await screen.findByText('Push day');
    return result;
  }

  it('shows the plan, adds a workout, and removes one by press and hold', async () => {
    const { db } = await open();
    expect(screen.getByText('2 workouts · chest · shoulders')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: '+ Add workout' }));
    expect(await screen.findByText('Add to Push day')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bench press, Already in plan' })).toBeDisabled();
    fireEvent.press(screen.getByRole('checkbox', { name: /^Cable fly/ }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Add 1 workout' }));
    });
    expect(await screen.findByText('3 workouts · chest · shoulders')).toBeTruthy();
    await sheetClosed();
    expect(screen.queryByText('Add to Push day')).toBeNull();

    fireEvent(screen.getByRole('button', { name: 'Overhead press' }), 'longPress');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Remove Overhead press from Push day' }));
    });
    expect(await screen.findByText('2 workouts · chest')).toBeTruthy();
    expect((await repo.loadAll(db)).routines[0].workoutIds).toEqual([ids.bench, ids.fly]);
  });

  it("won't remove the last workout", async () => {
    await open();
    fireEvent(screen.getByRole('button', { name: 'Overhead press' }), 'longPress');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Remove Overhead press from Push day' }));
    });
    await screen.findByText('A plan needs at least one workout');
    fireEvent(screen.getByRole('button', { name: 'Bench press' }), 'longPress');
    expect(screen.queryByRole('button', { name: 'Remove Bench press from Push day' })).toBeNull();
  });

  it('lists weekly repeats and stops one', async () => {
    const { db } = await renderWithData(<PlanScreen />, async (db) => {
      await seed(db);
      await repo.addRoutineToDay(db, '2026-10-08', ids.push, true);
      mockParams = { id: ids.push };
    });
    expect(await screen.findByText('Every Thursday')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Stop repeating every Thursday' }));
    });
    await waitFor(() => expect(screen.queryByText('Every Thursday')).toBeNull());
    expect((await repo.loadAll(db)).schedules[0].endedOn).not.toBeNull();
  });

  it('rename and delete', async () => {
    const { db } = await open();
    fireEvent.press(screen.getByRole('button', { name: 'Rename plan' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/plan-edit', params: { id: ids.push } });

    fireEvent.press(screen.getByRole('button', { name: 'Delete plan' }));
    expect(await screen.findByText('Delete Push day?')).toBeTruthy();
    await act(async () => {
      // The sheet's button (the page's own Delete plan button is first).
      const buttons = screen.getAllByRole('button', { name: 'Delete plan' });
      fireEvent.press(buttons[buttons.length - 1]);
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect((await repo.loadAll(db)).routines[0].deletedAt).not.toBeNull();
    await sheetClosed();
    expect(screen.queryByText('Delete Push day?')).toBeNull();
  });
});

describe('Calendar: add a plan to a day', () => {
  it('adds the plan, skips workouts already there, and labels the repeat', async () => {
    const { db } = await renderWithData(
      <SelectedDateProvider initial="2026-10-07">
        <CalendarScreen />
      </SelectedDateProvider>,
      async (db) => {
        await seed(db);
        await repo.addToPlan(db, '2026-10-07', [ids.bench]);
      }
    );

    fireEvent.press(screen.getByRole('button', { name: '+ Add workout or plan' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Plans' }));
    expect(screen.getByRole('button', { name: 'Select a plan' })).toBeDisabled();
    fireEvent.press(screen.getByRole('radio', { name: 'Push day, 2 workouts' }));
    expect(screen.getByRole('radio', { name: 'Push day, Bench press · Overhead press' })).toBeChecked();
    fireEvent(screen.getByLabelText('Repeat every Wednesday'), 'valueChange', true);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Add Push day · 1 workout' }));
    });

    expect(await screen.findByText('Overhead press')).toBeTruthy();
    await sheetClosed();
    expect(screen.queryByText('Add to today')).toBeNull();
    expect(screen.getByText('0 of 2 done')).toBeTruthy();
    expect(screen.getByText(/repeats Wednesdays/)).toBeTruthy();

    const data = await repo.loadAll(db);
    expect(data.plans['2026-10-07']).toEqual([ids.bench, ids.ohp]);
    expect(data.schedules).toMatchObject([{ routineId: ids.push, weekday: 3, startDate: '2026-10-07' }]);

    // Next Wednesday is planned too.
    expect(screen.getByRole('button', { name: 'Wednesday, October 7, today, planned' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('button', { name: /October 14, planned/ })).toBeTruthy();
  });
});
