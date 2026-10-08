import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'sm' = filter chips (32 tall, 13pt); 'lg' = muscle-group picker (42 tall, 15pt). */
  size?: 'sm' | 'lg';
  /** Background when not selected. */
  inactiveBg?: string;
  style?: StyleProp<ViewStyle>;
};

/** Pill chip: sage when selected, muted text otherwise. */
export function Chip({ label, selected, onPress, size = 'sm', inactiveBg = colors.surface, style }: Props) {
  const s = size === 'lg' ? lg : sm;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={size === 'sm' ? 6 : 0}
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

const sm = StyleSheet.create({
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 13 },
});

const lg = StyleSheet.create({
  chip: { height: 42, paddingHorizontal: 18, borderRadius: 21, justifyContent: 'center' },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
});
