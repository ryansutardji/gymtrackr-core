import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithData } from '@/test-utils/renderWithData';
import { SelectedDateProvider, useSelectedDate } from '@/hooks/useSelectedDate';
import * as repo from '@/lib/repo';
import StatsScreen from '../(tabs)/stats';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: mockNavigate }),
}));
jest.mock('@/lib/dates', () => ({
  ...jest.requireActual('@/lib/dates'),
  todayKey: () => '2026-10-07',
}));

let seenDate = '';
function DateSpy() {
  seenDate = useSelectedDate().selectedDate;
  return null;
}

async function setup() {
  return renderWithData(
    <SelectedDateProvider initial="2026-10-07">
      <StatsScreen />
      <DateSpy />
    </SelectedDateProvider>,
    async (db) => {
      const bench = await repo.createWorkout(db, { name: 'Bench press', group: 'chest', sets: 2, reps: 8 });
      const squat = await repo.createWorkout(db, { name: 'Back squat', group: 'legs', sets: 2, reps: 5 });
      await repo.createWorkout(db, { name: 'Never logged', group: 'abs', sets: 3, reps: 15 });
      for (const [d, a, b] of [
        ['2026-06-01', 90, 95],
        ['2026-09-20', 100, 105],
        ['2026-10-01', 105, 110],
      ] as const) {
        await repo.logSet(db, d, bench.id, 0, a);
        await repo.logSet(db, d, bench.id, 1, b);
      }
      await repo.logSet(db, '2026-10-06', squat.id, 0, 185); // most recent → default
    }
  );
}

describe('Stats', () => {
  it('defaults to the most recently trained workout and lists only logged ones', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Workout: Back squat' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Workout: Back squat' }));
    expect(screen.getByText('Bench press')).toBeTruthy();
    expect(screen.queryByText('Never logged')).toBeNull();
  });

  it('shows the latest session, deltas, and summary for the range', async () => {
    await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Workout: Back squat' }));
    fireEvent.press(screen.getByText('Bench press'));

    expect(screen.getByText('All 2 sets')).toBeTruthy();
    expect(screen.getByText('· 2 sessions since Sep 20')).toBeTruthy(); // 3M hides June
    expect(screen.getByText('Thu, Oct 1')).toBeTruthy();
    expect(screen.getByText('105 lb')).toBeTruthy();
    expect(screen.getAllByText('+5')).toHaveLength(2);

    fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('· 3 sessions since Jun 1')).toBeTruthy();
  });

  it('highlights a set and toggles it off', async () => {
    await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Workout: Back squat' }));
    fireEvent.press(screen.getByText('Bench press'));
    fireEvent.press(screen.getByRole('button', { name: 'Highlight set 2' }));
    expect(screen.getByText('Set 2 · 110 lb now')).toBeTruthy();
    expect(screen.getByText('· +5 since Sep 20 · best 110')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Highlight set 2' }));
    expect(screen.getByText('All 2 sets')).toBeTruthy();
  });

  it('tapping the chart selects the nearest session; Open day jumps the Calendar', async () => {
    await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Workout: Back squat' }));
    fireEvent.press(screen.getByText('Bench press'));
    const chart = screen.getByRole('image');
    fireEvent(chart.parent!, 'layout', { nativeEvent: { layout: { width: 320, height: 200 } } });
    fireEvent.press(chart, { nativeEvent: { locationX: 5 } });
    expect(screen.getByText('Sun, Sep 20')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Open day ›' }));
    expect(seenDate).toBe('2026-09-20');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows the empty state when nothing is in range', async () => {
    await setup();
    fireEvent.press(screen.getByRole('button', { name: 'Workout: Back squat' }));
    fireEvent.press(screen.getByText('Bench press'));
    fireEvent.press(screen.getByRole('button', { name: '1M' }));
    expect(screen.getByText('Thu, Oct 1')).toBeTruthy(); // Oct 1 is within 30 days
    fireEvent.press(screen.getByRole('button', { name: 'Workout: Bench press' }));
    fireEvent.press(screen.getByText('Back squat'));
    expect(screen.getByText('Tue, Oct 6')).toBeTruthy();
  });

  it('says so when nothing has been logged yet', async () => {
    await renderWithData(
      <SelectedDateProvider>
        <StatsScreen />
      </SelectedDateProvider>
    );
    expect(screen.getByRole('button', { name: 'No logged workouts' })).toBeDisabled();
    expect(screen.getByText(/No logged sessions in this range\./)).toBeTruthy();
  });
});
