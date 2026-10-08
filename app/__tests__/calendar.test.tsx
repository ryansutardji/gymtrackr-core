import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithData } from '@/test-utils/renderWithData';
import { SelectedDateProvider } from '@/hooks/useSelectedDate';
import * as repo from '@/lib/repo';
import CalendarScreen from '../(tabs)/index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, []),
}));

// "Today" is Wed Oct 7 2026.
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual('@/lib/dates'),
  todayKey: () => '2026-10-07',
}));

async function setup(initial = '2026-10-07') {
  let ids: Record<string, string> = {};
  const result = await renderWithData(
    <SelectedDateProvider initial={initial}>
      <CalendarScreen />
    </SelectedDateProvider>,
    async (db) => {
      const bench = await repo.createWorkout(db, { name: 'Bench press', group: 'chest', sets: 2, reps: 8 });
      const row = await repo.createWorkout(db, { name: 'Barbell row', group: 'back', sets: 3, reps: 8 });
      ids = { bench: bench.id, row: row.id };
      // Mon Oct 5: done. Wed Oct 7: bench half, row untouched. Thu Oct 8: planned.
      await repo.logSet(db, '2026-10-05', bench.id, 0, 135);
      await repo.logSet(db, '2026-10-05', bench.id, 1, 140);
      await repo.addToPlan(db, '2026-10-07', [bench.id, row.id]);
      await repo.logSet(db, '2026-10-07', bench.id, 0, 140);
      await repo.addToPlan(db, '2026-10-08', [row.id]);
    }
  );
  return { ...result, ids };
}

describe('Calendar', () => {
  it("shows today's plan with progress", async () => {
    await setup();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Wednesday, October 7')).toBeTruthy();
    expect(screen.getByText('Oct 5 – Oct 11')).toBeTruthy();
    expect(screen.getByText('0 of 2 done')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bench press, 1 of 2 sets logged' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Barbell row, 0 of 3 sets logged' })).toBeTruthy();
    // No "Today" jump button when already on today.
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
  });

  it('labels each day with its status', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Monday, October 5, all sets logged' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wednesday, October 7, today, planned' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thursday, October 8, planned' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Friday, October 9' })).toBeTruthy();
  });

  it('selects other days, moves by week, and jumps back to today', async () => {
    await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Monday, October 5, all sets logged' }));
    expect(screen.getByText('Mon, Oct 5')).toBeTruthy();
    expect(screen.getByText('1 of 1 done')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('Mon, Oct 12')).toBeTruthy();
    expect(screen.getByText('Oct 12 – Oct 18')).toBeTruthy();
    expect(screen.getByText('Nothing planned')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByText('Wednesday, October 7')).toBeTruthy();
  });

  it('month view opens on the selected month and collapses when a day is picked', async () => {
    await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByText('October 2026')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('November 2026')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Tuesday, November 3' }));
    expect(screen.getByText('Tue, Nov 3')).toBeTruthy();
    expect(screen.queryByText('November 2026')).toBeNull(); // back to the week strip
    expect(screen.getByRole('button', { name: 'Month' })).toBeTruthy();
  });

  it('press and hold reveals Delete; deleting clears that day only', async () => {
    const { db, ids } = await setup();
    const bench = screen.getByRole('button', { name: 'Bench press, 1 of 2 sets logged' });
    fireEvent(bench, 'longPress');
    expect(screen.getByRole('button', { name: 'Remove Bench press from this day' })).toBeTruthy();

    // A tap on the card while held only cancels the hold.
    fireEvent.press(bench);
    expect(screen.queryByRole('button', { name: 'Remove Bench press from this day' })).toBeNull();

    fireEvent(bench, 'longPress');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Remove Bench press from this day' }));
    });
    expect(screen.queryByRole('button', { name: /^Bench press/ })).toBeNull();
    expect(screen.getByText('0 of 1 done')).toBeTruthy();

    const data = await repo.loadAll(db);
    expect(data.plans['2026-10-07']).toEqual([ids.row]);
    expect(data.logs['2026-10-07']).toBeUndefined();
    expect(data.logs['2026-10-05'][ids.bench]).toEqual([135, 140]); // other days untouched
  });

  it('tapping a card opens the logger for that day', async () => {
    mockPush.mockClear();
    const { ids } = await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Barbell row, 0 of 3 sets logged' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/logger', params: { date: '2026-10-07', workoutId: ids.row } });
  });

  it('changing day drops the hold state', async () => {
    await setup();
    fireEvent(screen.getByRole('button', { name: 'Bench press, 1 of 2 sets logged' }), 'longPress');
    fireEvent.press(screen.getByRole('button', { name: 'Thursday, October 8, planned' }));
    fireEvent.press(screen.getByRole('button', { name: 'Wednesday, October 7, today, planned' }));
    expect(screen.queryByRole('button', { name: 'Remove Bench press from this day' })).toBeNull();
  });

  describe('add-workout sheet', () => {
    it('adds the selected workouts to the day', async () => {
      const { db, ids } = await setup('2026-10-09'); // Friday, nothing planned
      fireEvent.press(screen.getByRole('button', { name: '+ Add workout' }));
      expect(await screen.findByText('Add to Fri, Oct 9')).toBeTruthy();

      const add = screen.getByRole('button', { name: 'Select workouts' });
      expect(add).toBeDisabled();
      fireEvent.press(screen.getByRole('checkbox', { name: /^Bench press, 2 × 8 · last top 140 lb/ }));
      fireEvent.press(screen.getByRole('checkbox', { name: /^Barbell row, 3 × 8$/ }));
      expect(screen.getByRole('button', { name: 'Add 2 workouts' })).toBeEnabled();

      // Filtering hides rows but keeps the selection.
      fireEvent.press(screen.getByRole('button', { name: 'back' }));
      expect(screen.queryByRole('checkbox', { name: /^Bench press/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Add 2 workouts' })).toBeTruthy();

      // Untick one.
      fireEvent.press(screen.getByRole('checkbox', { name: /^Barbell row/ }));
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Add 1 workout' }));
      });

      expect(await screen.findByRole('button', { name: 'Bench press, 0 of 2 sets logged' })).toBeTruthy();
      expect(screen.getByText('0 of 1 done')).toBeTruthy();
      expect((await repo.loadAll(db)).plans['2026-10-09']).toEqual([ids.bench]);
    });

    it("dims workouts already on the day and can't select them", async () => {
      await setup(); // today: bench + row planned
      fireEvent.press(screen.getByRole('button', { name: '+ Add workout' }));
      expect(await screen.findByText('Add to today')).toBeTruthy();
      const bench = screen.getByRole('checkbox', { name: 'Bench press, Already on this day' });
      expect(bench).toBeDisabled();
      expect(bench).toBeChecked();
      fireEvent.press(bench);
      expect(screen.getByRole('button', { name: 'Select workouts' })).toBeDisabled();
    });

    it('opens Create after the sheet closes', async () => {
      mockPush.mockClear();
      await setup();
      fireEvent.press(screen.getByRole('button', { name: '+ Add workout' }));
      fireEvent.press(await screen.findByRole('button', { name: '+ Create new workout' }));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/workout-edit'));
      expect(screen.queryByText('Add to today')).toBeNull();
    });
  });
});
