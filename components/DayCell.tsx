import { Pressable, Text, View, StyleSheet } from 'react-native';
import { formatLongDay, parseKey } from '@/lib/dates';
import { colors, fonts } from '@/lib/theme';
import type { DateKey, DayStatus } from '@/lib/types';

type Props = {
  date: DateKey;
  selected: boolean;
  isToday: boolean;
  status: DayStatus;
  onPress: () => void;
  /** 'week' = 38×38 pill, 6px dot; 'month' = 36×34 pill, 5px dot. */
  variant: 'week' | 'month';
  /** Weekday letter above the pill (week strip only). */
  weekday?: string;
};

const STATUS_LABEL: Record<DayStatus, string> = { none: '', planned: ', planned', done: ', all sets logged' };

/**
 * One calendar day: number pill (sage when selected, sage ring when today)
 * and a status dot below (hidden / hollow = planned / filled = done).
 */
export function DayCell({ date, selected, isToday, status, onPress, variant, weekday }: Props) {
  const s = variant === 'week' ? week : month;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${formatLongDay(date)}${isToday ? ', today' : ''}${STATUS_LABEL[status]}`}
      onPress={onPress}
      style={s.cell}
    >
      {weekday ? <Text style={styles.weekday}>{weekday}</Text> : null}
      <View
        style={[
          s.pill,
          selected && { backgroundColor: colors.sage },
          !selected && isToday && { borderWidth: 1.5, borderColor: colors.sage },
        ]}
      >
        <Text style={[s.num, { color: selected ? colors.onSage : colors.text }]}>{parseKey(date).getDate()}</Text>
      </View>
      <View
        style={[
          s.dot,
          status === 'planned' && { borderWidth: 1.5, borderColor: colors.muted },
          status === 'done' && { backgroundColor: colors.sage },
        ]}
      />
    </Pressable>
  );
}

/** Same footprint as a DayCell, for padding days outside the month. */
export function EmptyDayCell() {
  return (
    <View style={month.cell}>
      <View style={month.pill} />
      <View style={month.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  weekday: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
});

const week = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  pill: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: fonts.semibold, fontSize: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

const month = StyleSheet.create({
  cell: { width: `${100 / 7}%`, alignItems: 'center', gap: 2, paddingVertical: 2 },
  pill: { width: 36, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: fonts.semibold, fontSize: 15 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
