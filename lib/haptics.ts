import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Small wrappers so screens don't care about platform support. Haptics are a
// nicety: failures (web, simulators, devices without a motor) are ignored.

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tick for stepper presses and segment taps. */
export function tapFeedback() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

/** Firmer bump when a set is logged or a card enters the hold state. */
export function confirmFeedback() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
