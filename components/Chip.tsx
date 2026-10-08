import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'xs' = add-workout sheet (30 tall, 12pt); 'sm' = filter chips (32, 13pt); 'lg' = muscle-group picker (42, 15pt). */
  size?: 'xs' | 'sm' | 'lg';
  /** Background when not selected. */
  inactiveBg?: string;
  style?: StyleProp<ViewStyle>;
};

/** Pill chip: sage when selected, muted text otherwise. */
export function Chip({ label, selected, onPress, size = 'sm', inactiveBg = colors.surface, style }: Props) {
  const s = size === 'lg' ? lg : size === 'xs' ? xs : sm;
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      onPress={onPress}
      hitSlop={size === 'lg' ? 0 : 6}
      style={({ pressed }) => [
        s.chip,
        { backgroundColor: selected ? colors.sage : inactiveBg },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text style={[s.label, { color: selected ? colors.onSage : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const xs = StyleSheet.create({
  chip: { height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 12 },
});

const sm = StyleSheet.create({
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 13 },
});

const lg = StyleSheet.create({
  chip: { height: 42, paddingHorizontal: 18, borderRadius: 21, justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
});
