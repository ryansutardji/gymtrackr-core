import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Logger uses 60 tall / 17pt; forms use 58 / 16pt. */
  height?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
};

/** Full-width sage button; grey (#2c3238) with muted text when disabled. */
export function PrimaryButton({ label, onPress, disabled, height = 58, fontSize = 16, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height, backgroundColor: disabled ? colors.raised : pressed ? colors.sagePressed : colors.sage },
        style,
      ]}
    >
      <Text style={[styles.label, { fontSize, color: disabled ? colors.muted : colors.onSage }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bold },
});
