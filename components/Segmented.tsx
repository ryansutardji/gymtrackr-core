import { Pressable, Text, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Track colour; the active segment uses `activeBg`. Screens: surface/raised. Sheets: row/line. */
  bg?: string;
  activeBg?: string;
  /** Stats ranges: 30 / 12pt. Workouts tab: 32 / 13pt. */
  height?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pill segmented control (Stats ranges, Plans | Workouts). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  bg = colors.surface,
  activeBg = colors.raised,
  height = 32,
  fontSize = 13,
  style,
}: Props<T>) {
  return (
    <View style={[styles.track, { backgroundColor: bg }, style]}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            aria-selected={on}
            onPress={() => onChange(o)}
            style={[styles.segment, { height }, on && { backgroundColor: activeBg }]}
          >
            <Text style={[styles.label, { fontSize, color: on ? colors.text : colors.muted }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 4, borderRadius: 12, padding: 3 },
  segment: { flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semibold },
});
