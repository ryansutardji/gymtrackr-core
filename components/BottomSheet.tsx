import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Fires once the closing animation has finished and the sheet is gone. */
  onClosed?: () => void;
  children: ReactNode;
};

const DURATION = 250;

/**
 * Sheet that slides up over a dimmed backdrop. Tapping the backdrop or the
 * Android back button closes it. Max height 78% of the screen.
 */
export function BottomSheet({ visible, onClose, onClosed, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Stays mounted through the closing animation.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;

  const wasOpen = useRef(false);

  useEffect(() => {
    if (!visible && !wasOpen.current) return; // never opened yet — nothing to close
    wasOpen.current = visible;
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: DURATION,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
        onClosedRef.current?.();
      }
    });
  }, [visible, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { maxHeight: height * 0.78, paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 24 },
            { transform: [{ translateY }] },
          ]}
        >
          <View style={styles.grabber} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center' },
});
