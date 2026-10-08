import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithData } from '@/test-utils/renderWithData';
import * as repo from '@/lib/repo';
import WorkoutsScreen from '../(tabs)/workouts';
import WorkoutEditScreen from '../workout-edit';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockParams = {};
});

describe('Workouts tab', () => {
  it('lists active workouts with their last top set and filters by group', async () => {
    await renderWithData(<WorkoutsScreen />, async (db) => {
      const bench = await repo.createWorkout(db, { name: 'Bench press', group: 'chest', sets: 3, reps: 8 });
      await repo.createWorkout(db, { name: 'Back squat', group: 'legs', sets: 4, reps: 6 });
      const gone = await repo.createWorkout(db, { name: 'Old move', group: 'chest', sets: 3, reps: 8 });
      await repo.deleteWorkout(db, gone.id);
      await repo.logSet(db, '2026-10-01', bench.id, 0, 135);
      await repo.logSet(db, '2026-10-01', bench.id, 1, 145);
    });

    expect(await screen.findByText('Bench press')).toBeTruthy();
    expect(screen.getByText('chest · 3 × 8')).toBeTruthy();
    expect(screen.getByText('145 lb')).toBeTruthy();
    expect(screen.getByText('Back squat')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('Old move')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'legs' }));
    expect(screen.queryByText('Bench press')).toBeNull();
    expect(screen.getByText('Back squat')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'abs' }));
    expect(screen.getByText('No workouts in this group yet.')).toBeTruthy();
  });

  it('shows a first-run hint when there are no workouts at all', async () => {
    await renderWithData(<WorkoutsScreen />);
    expect(await screen.findByText('No workouts yet. Tap + to create one.')).toBeTruthy();
  });

  it('opens create and edit', async () => {
    let id = '';
    await renderWithData(<WorkoutsScreen />, async (db) => {
      id = (await repo.createWorkout(db, { name: 'Bench press', group: 'chest', sets: 3, reps: 8 })).id;
    });
    fireEvent.press(screen.getByRole('button', { name: 'New workout' }));
    expect(mockPush).toHaveBeenLastCalledWith('/workout-edit');
    fireEvent.press(await screen.findByRole('button', { name: 'Edit Bench press' }));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/workout-edit', params: { id } });
  });
});

describe('Create / edit workout', () => {
  it('creates a workout through both steps', async () => {
    const { db } = await renderWithData(<WorkoutEditScreen />);

    expect(screen.getByText('New workout')).toBeTruthy();
    expect(screen.queryByText('Delete workout')).toBeNull();
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText('Workout name'), '  Incline DB press ');
    expect(next).toBeDisabled(); // still needs a group
    fireEvent.press(screen.getByRole('button', { name: 'chest' }));
    expect(next).toBeEnabled();
    fireEvent.press(next);

    expect(screen.getByText('Incline DB press')).toBeTruthy();
    expect(screen.getAllByText('10 reps')).toHaveLength(3); // defaults: 3 × 10
    fireEvent.press(screen.getByRole('button', { name: 'Increase Sets per session' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Reps per set' }));
    expect(screen.getAllByText('9 reps')).toHaveLength(4);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const { workouts } = await repo.loadAll(db);
    expect(workouts).toEqual([
      expect.objectContaining({ name: 'Incline DB press', group: 'chest', sets: 4, reps: 9 }),
    ]);
  });

  it('keeps sets within 1–10', async () => {
    await renderWithData(<WorkoutEditScreen />);
    fireEvent.changeText(screen.getByLabelText('Workout name'), 'Plank');
    fireEvent.press(screen.getByRole('button', { name: 'abs' }));
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    const dec = screen.getByRole('button', { name: 'Decrease Sets per session' });
    fireEvent.press(dec);
    fireEvent.press(dec);
    expect(screen.getByLabelText('Sets per session: 1')).toBeTruthy();
    expect(dec).toBeDisabled();
  });

  it('edits an existing workout without touching its history', async () => {
    let id = '';
    const { db } = await renderWithData(<WorkoutEditScreen />, async (db) => {
      id = (await repo.createWorkout(db, { name: 'Bench', group: 'chest', sets: 5, reps: 8 })).id;
      await repo.logSet(db, '2026-10-01', id, 4, 150);
      mockParams = { id };
    });

    expect(await screen.findByText('Edit workout')).toBeTruthy();
    expect(screen.getByLabelText('Workout name').props.value).toBe('Bench');
    fireEvent.changeText(screen.getByLabelText('Workout name'), 'Bench press');
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    fireEvent.press(screen.getByRole('button', { name: 'Decrease Sets per session' }));

    // Back keeps the draft.
    fireEvent.press(screen.getByRole('button', { name: '‹ Back' }));
    expect(screen.getByLabelText('Workout name').props.value).toBe('Bench press');
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Save workout' }));
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const data = await repo.loadAll(db);
    expect(data.workouts[0]).toMatchObject({ name: 'Bench press', sets: 4 });
    expect(data.logs['2026-10-01'][id][4]).toBe(150);
  });

  it('deletes a workout but keeps its logs', async () => {
    let id = '';
    const { db } = await renderWithData(<WorkoutEditScreen />, async (db) => {
      id = (await repo.createWorkout(db, { name: 'Bench', group: 'chest', sets: 3, reps: 8 })).id;
      await repo.logSet(db, '2026-10-01', id, 0, 135);
      mockParams = { id };
    });

    await act(async () => {
      fireEvent.press(await screen.findByRole('button', { name: 'Delete workout' }));
    });
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    const data = await repo.loadAll(db);
    expect(data.workouts[0].deletedAt).not.toBeNull();
    expect(data.logs['2026-10-01'][id]).toEqual([135]);
  });
});
