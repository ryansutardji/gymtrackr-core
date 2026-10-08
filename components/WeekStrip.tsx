import { View, StyleSheet } from 'react-native';
import { CalendarCard } from './CalendarCard';
import { DayCell } from './DayCell';
import { addDays, formatMonthDay, weekDays } from '@/lib/dates';
import type { DateKey, DayStatus } from '@/lib/types';

const LETTERS = 'MTWTFSS';

type Props = {
  selected: DateKey;
  today: DateKey;
  statusOf: (d: DateKey) => DayStatus;
  onSelect: (d: DateKey) => void;
};

/** Monday-first week containing the selected date. ‹ › move the selection by a week. */
export function WeekStrip({ selected, today, statusOf, onSelect }: Props) {
  const days = weekDays(selected);
  return (
    <CalendarCard
      title={`${formatMonthDay(days[0])} – ${formatMonthDay(days[6])}`}
      prevLabel="Previous week"
      nextLabel="Next week"
      onPrev={() => onSelect(addDays(selected, -7))}
      onNext={() => onSelect(addDays(selected, 7))}
    >
      <View style={styles.row}>
        {days.map((d, i) => (
          <DayCell
            key={d}
            variant="week"
            date={d}
            weekday={LETTERS[i]}
            selected={d === selected}
            isToday={d === today}
            status={statusOf(d)}
            onPress={() => onSelect(d)}
          />
        ))}
      </View>
    </CalendarCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
