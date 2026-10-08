import { Pressable, Text, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { colors, fonts } from '@/lib/theme';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  onClosed?: () => void;
};

/** Short "are you sure?" sheet: destructive outline button, then Cancel. */
export function ConfirmSheet({ visible, title, body, confirmLabel, onConfirm, onClose, onClosed }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onConfirm}
        style={({ pressed }) => [styles.button, styles.destructive, pressed && { backgroundColor: 'rgba(232,162,154,0.12)' }]}
      >
        <Text style={[styles.label, { color: colors.destructive }]}>{confirmLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.button, { backgroundColor: pressed ? colors.line : colors.raised }]}
      >
        <Text style={[styles.label, { color: colors.text }]}>Cancel</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginTop: 16 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 8, marginBottom: 18 },
  button: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  destructive: { borderWidth: 1.5, borderColor: colors.destructive },
  label: { fontFamily: fonts.semibold, fontSize: 15 },
});
