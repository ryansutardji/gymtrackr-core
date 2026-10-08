import { Text, View, StyleSheet } from 'react-native';
import { CalendarCard } from './CalendarCard';
import { DayCell, EmptyDayCell } from './DayCell';
import { formatMonthYear, monthGrid } from '@/lib/dates';
import { colors, fonts } from '@/lib/theme';
import type { DateKey, DayStatus } from '@/lib/types';

type Props = {
  year: number;
  /** 0-based. */
  month: number;
  selected: DateKey;
  today: DateKey;
  statusOf: (d: DateKey) => DayStatus;
  onSelect: (d: DateKey) => void;
  onChangeMonth: (delta: -1 | 1) => void;
};

export function MonthGrid({ year, month, selected, today, statusOf, onSelect, onChangeMonth }: Props) {
  const cells = monthGrid(year, month);
  return (
    <CalendarCard
      title={formatMonthYear(year, month)}
      titleStyle={styles.title}
      prevLabel="Previous month"
      nextLabel="Next month"
      onPrev={() => onChangeMonth(-1)}
      onNext={() => onChangeMonth(1)}
    >
      <View style={styles.weekdays}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
          <Text key={i} style={styles.weekday}>
            {l}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) =>
          d ? (
            <DayCell
              key={d}
              variant="month"
              date={d}
              selected={d === selected}
              isToday={d === today}
              status={statusOf(d)}
              onPress={() => onSelect(d)}
            />
          ) : (
            <EmptyDayCell key={`e${i}`} />
          )
        )}
      </View>
    </CalendarCard>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  weekdays: { flexDirection: 'row', paddingBottom: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 },
});
