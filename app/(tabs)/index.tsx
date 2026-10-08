import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, ScreenTitle } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { WeekStrip } from '@/components/WeekStrip';
import { MonthGrid } from '@/components/MonthGrid';
import { WorkoutCard } from '@/components/WorkoutCard';
import { AddWorkoutSheet, type SheetFilter, type SheetMode } from '@/components/AddWorkoutSheet';
import { useAppData } from '@/hooks/useAppData';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { activeRoutines, activeWorkouts, dayGroups, dayStatus, doneCount, isComplete } from '@/lib/derive';
import { formatLongDay, formatShortDay, parseKey, todayKey, weekdayName, weekdayOf } from '@/lib/dates';
import { confirmFeedback } from '@/lib/haptics';
import { colors, fonts } from '@/lib/theme';
import type { DateKey } from '@/lib/types';

export default function CalendarScreen() {
  const router = useRouter();
  const app = useAppData();
  const { workouts, logs, removeFromDay, addToPlan, addRoutineToDay } = app;
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const today = todayKey();
  const isToday = selectedDate === today;

  const [monthOpen, setMonthOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => monthOf(selectedDate));
  // Workout id in the press-and-hold (delete) state, if any.
  const [heldId, setHeldId] = useState<string | null>(null);

  // Add-workout sheet. Selection lives here so it survives a trip to the Create screen.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSelection, setSheetSelection] = useState<string[]>([]);
  const [sheetFilter, setSheetFilter] = useState<SheetFilter>('all');
  const [sheetMode, setSheetMode] = useState<SheetMode>('Workouts');
  const [sheetPlanId, setSheetPlanId] = useState<string | null>(null);
  const [sheetRepeat, setSheetRepeat] = useState(false);
  // Set while the Create screen is open from the sheet: the workout ids that existed before.
  const createSnapshot = useRef<Set<string> | null>(null);
  const pendingCreate = useRef(false);
  const latestWorkouts = useRef(workouts);
  latestWorkouts.current = workouts;

  const { plans, routines, schedules, exclusions, planSources } = app;
  const data = useMemo(
    () => ({ workouts, plans, logs, routines, schedules, exclusions, planSources }),
    [workouts, plans, logs, routines, schedules, exclusions, planSources]
  );
  const statusOf = useCallback((d: DateKey) => dayStatus(data, d), [data]);
  const groups = dayGroups(data, selectedDate);
  const planned = groups.flatMap((g) => g.workouts);
  const completeCount = planned.filter((w) => isComplete(logs, selectedDate, w)).length;

  // The hold state belongs to one card on one day — drop it when either changes.
  useEffect(() => setHeldId(null), [selectedDate]);
  useFocusEffect(useCallback(() => () => setHeldId(null), []));

  // Back from "Create new workout": reopen the sheet with the new workout ticked.
  useFocusEffect(
    useCallback(() => {
      const before = createSnapshot.current;
      if (!before) return;
      createSnapshot.current = null;
      const created = activeWorkouts(latestWorkouts.current)
        .map((w) => w.id)
        .filter((id) => !before.has(id));
      setSheetSelection((sel) => [...sel, ...created.filter((id) => !sel.includes(id))]);
      setSheetFilter('all');
      setSheetOpen(true);
    }, [])
  );

  const selectDay = (d: DateKey) => {
    setSelectedDate(d);
    setMonthOpen(false);
  };

  const toggleMonth = () => {
    if (!monthOpen) setViewMonth(monthOf(selectedDate));
    setMonthOpen(!monthOpen);
  };

  const shiftMonth = (delta: -1 | 1) => {
    const d = new Date(viewMonth.year, viewMonth.month + delta, 1);
    setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  const onCardPress = (workoutId: string) => {
    if (heldId) {
      setHeldId(null);
      return;
    }
    router.push({ pathname: '/logger', params: { date: selectedDate, workoutId } });
  };

  const onCardLongPress = (workoutId: string) => {
    confirmFeedback();
    setHeldId(workoutId);
  };

  const openSheet = () => {
    setHeldId(null);
    setSheetSelection([]);
    setSheetFilter('all');
    setSheetMode('Workouts');
    setSheetPlanId(null);
    setSheetRepeat(false);
    setSheetOpen(true);
  };

  const toggleInSheet = (id: string) =>
    setSheetSelection((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const addSelected = async () => {
    if (!sheetSelection.length) return;
    setSheetOpen(false);
    confirmFeedback();
    await addToPlan(selectedDate, sheetSelection);
    setSheetSelection([]);
  };

  const addPlan = async () => {
    if (!sheetPlanId) return;
    setSheetOpen(false);
    confirmFeedback();
    await addRoutineToDay(selectedDate, sheetPlanId, sheetRepeat);
  };

  // Close the sheet first; open Create once it has slid away (onSheetClosed).
  const createFromSheet = () => {
    pendingCreate.current = true;
    setSheetOpen(false);
  };

  const onSheetClosed = () => {
    if (!pendingCreate.current) return;
    pendingCreate.current = false;
    createSnapshot.current = new Set(workouts.map((w) => w.id));
    router.push('/workout-edit');
  };

  const onDelete = async (workoutId: string) => {
    setHeldId(null);
    await removeFromDay(selectedDate, workoutId);
  };

  return (
    <Screen onBackgroundPress={() => setHeldId(null)}>
      <ScreenTitle
        title={isToday ? 'Today' : formatShortDay(selectedDate)}
        subtitle={formatLongDay(selectedDate)}
        right={
          <View style={styles.headerButtons}>
            {!isToday && (
              <HeaderButton label="Today" color={colors.sage} onPress={() => selectDay(today)} />
            )}
            <HeaderButton label={monthOpen ? 'Week' : 'Month'} color={colors.text} onPress={toggleMonth} />
          </View>
        }
      />

      {monthOpen ? (
        <MonthGrid
          year={viewMonth.year}
          month={viewMonth.month}
          selected={selectedDate}
          today={today}
          statusOf={statusOf}
          onSelect={selectDay}
          onChangeMonth={shiftMonth}
        />
      ) : (
        <WeekStrip selected={selectedDate} today={today} statusOf={statusOf} onSelect={setSelectedDate} />
      )}

      <View style={styles.sectionHeader}>
        <SectionLabel>Workouts</SectionLabel>
        <Text style={styles.summary}>
          {planned.length ? `${completeCount} of ${planned.length} done` : 'Nothing planned'}
        </Text>
      </View>

      <View style={styles.cards}>
        {groups.map((g) => (
          <View key={g.routine?.id ?? 'single'} style={styles.group}>
            {g.routine && (
              <Text style={styles.groupLabel} numberOfLines={1}>
                <Text style={{ color: colors.sage }}>{g.routine.name}</Text>
                {g.repeatWeekday != null && ` · repeats ${weekdayName(g.repeatWeekday)}s`}
              </Text>
            )}
            {g.workouts.map((w) => (
              <WorkoutCard
                key={w.id}
                workout={w}
                done={doneCount(logs, selectedDate, w)}
                held={heldId === w.id}
                onPress={() => onCardPress(w.id)}
                onLongPress={() => onCardLongPress(w.id)}
                onDelete={() => onDelete(w.id)}
              />
            ))}
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={openSheet}
          style={({ pressed }) => [styles.addButton, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={styles.addText}>+ Add workout or plan</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>Tap to log · press and hold to remove</Text>

      <AddWorkoutSheet
        visible={sheetOpen}
        title={`Add to ${isToday ? 'today' : formatShortDay(selectedDate)}`}
        workouts={workouts}
        logs={logs}
        plannedIds={planned.map((w) => w.id)}
        selection={sheetSelection}
        filter={sheetFilter}
        onToggle={toggleInSheet}
        onFilter={setSheetFilter}
        onAdd={addSelected}
        onCreateNew={createFromSheet}
        onClose={() => setSheetOpen(false)}
        onClosed={onSheetClosed}
        plans={{
          mode: sheetMode,
          onMode: setSheetMode,
          routines: activeRoutines(app.routines),
          selectedId: sheetPlanId,
          onSelect: setSheetPlanId,
          repeat: sheetRepeat,
          onRepeat: setSheetRepeat,
          weekday: weekdayName(weekdayOf(selectedDate)),
          onAddPlan: addPlan,
        }}
      />
    </Screen>
  );
}

function monthOf(d: DateKey) {
  const date = parseKey(d);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function HeaderButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.row }]}
    >
      <Text style={[styles.headerButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  headerButtonText: { fontFamily: fonts.semibold, fontSize: 13 },
  sectionHeader: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  summary: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  cards: { gap: 10, marginTop: 10 },
  group: { gap: 10 },
  groupLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginBottom: -2 },
  addButton: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sage },
  hint: { marginTop: 14, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
