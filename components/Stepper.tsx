import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** Spoken name, e.g. "Sets per session". */
  label: string;
};

/** − / big number / + card used on the Create workout screen. */
export function Stepper({ value, min, max, onChange, label }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  return (
    <View style={styles.card}>
      <StepButton symbol="−" label={`Decrease ${label}`} disabled={value <= min} onPress={() => set(value - 1)} />
      <Text style={styles.value} accessibilityLabel={`${label}: ${value}`}>
        {value}
      </Text>
      <StepButton symbol="+" label={`Increase ${label}`} disabled={value >= max} onPress={() => set(value + 1)} />
    </View>
  );
}

function StepButton({ symbol, label, disabled, onPress }: { symbol: string; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && { backgroundColor: colors.line }, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.symbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 8,
  },
  button: {
    width: 64,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontFamily: fonts.regular, fontSize: 26, color: colors.text },
  value: { fontFamily: fonts.semibold, fontSize: 40, color: colors.text },
});
