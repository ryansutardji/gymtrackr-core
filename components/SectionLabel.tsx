import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { colors, fonts } from '@/lib/theme';

/** Small uppercase muted label, e.g. "MUSCLE GROUP". */
export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.2, color: colors.muted },
});
