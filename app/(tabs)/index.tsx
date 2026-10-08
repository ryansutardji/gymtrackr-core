import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, ScreenTitle } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { WeekStrip } from '@/components/WeekStrip';
import { MonthGrid } from '@/components/MonthGrid';
import { WorkoutCard } from '@/components/WorkoutCard';
import { useAppData } from '@/hooks/useAppData';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import { dayStatus, dayWorkouts, doneCount, isComplete } from '@/lib/derive';
import { formatLongDay, formatShortDay, parseKey, todayKey } from '@/lib/dates';
import { colors, fonts } from '@/lib/theme';
import type { DateKey } from '@/lib/types';

export default function CalendarScreen() {
  const { workouts, plans, logs, removeFromDay } = useAppData();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const today = todayKey();
  const isToday = selectedDate === today;

  const [monthOpen, setMonthOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => monthOf(selectedDate));
  // Workout id in the press-and-hold (delete) state, if any.
  const [heldId, setHeldId] = useState<string | null>(null);

  const data = useMemo(() => ({ workouts, plans, logs }), [workouts, plans, logs]);
  const statusOf = useCallback((d: DateKey) => dayStatus(data, d), [data]);
  const planned = dayWorkouts(data, selectedDate);
  const completeCount = planned.filter((w) => isComplete(logs, selectedDate, w)).length;

  // The hold state belongs to one card on one day — drop it when either changes.
  useEffect(() => setHeldId(null), [selectedDate]);
  useFocusEffect(useCallback(() => () => setHeldId(null), []));

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

  const onCardPress = (_workoutId: string) => {
    if (heldId) {
      setHeldId(null);
      return;
    }
    // Opening the logger arrives in Milestone 5.
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
        {planned.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            done={doneCount(logs, selectedDate, w.id)}
            held={heldId === w.id}
            onPress={() => onCardPress(w.id)}
            onLongPress={() => setHeldId(w.id)}
            onDelete={() => onDelete(w.id)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          // Opens the add-workout sheet in Milestone 4.
          onPress={() => setHeldId(null)}
          style={({ pressed }) => [styles.addButton, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={styles.addText}>+ Add workout</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>Tap to log · press and hold to remove</Text>
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
