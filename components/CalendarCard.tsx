import type { ReactNode } from 'react';
import { Pressable, Text, View, StyleSheet, type TextStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type Props = {
  title: string;
  titleStyle?: TextStyle;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
};

/** Surface card with a title row and ‹ › buttons — shared by the week strip and month grid. */
export function CalendarCard({ title, titleStyle, prevLabel, nextLabel, onPrev, onNext, children }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        <View style={styles.nav}>
          <NavButton symbol="‹" label={prevLabel} onPress={onPrev} />
          <NavButton symbol="›" label={nextLabel} onPress={onNext} />
        </View>
      </View>
      {children}
    </View>
  );
}

function NavButton({ symbol, label, onPress }: { symbol: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.navButton, pressed && { backgroundColor: colors.line }]}
    >
      <Text style={styles.navSymbol}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  title: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  nav: { flexDirection: 'row', gap: 6 },
  navButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navSymbol: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 18, color: colors.text },
});
