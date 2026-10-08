import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Small wrappers so screens don't care about platform support. Haptics are a
// nicety: failures (web, simulators, devices without a motor) never break a
// tap, but are reported in dev so they can be diagnosed.
//
// Android uses the system haptic engine (same feel as the phone's own
// buttons). It follows the phone's "Touch feedback" setting — and Android
// files any short app vibration under that setting anyway, so if it's off
// there's no buzz by design.

function report(e: unknown) {
  if (__DEV__) console.warn('[haptics]', e);
}

/** Light tick for stepper presses and segment taps. */
export function tapFeedback() {
  if (Platform.OS === 'ios') Haptics.selectionAsync().catch(report);
  else if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key).catch(report);
}

/** Firmer bump when a set is logged or a card enters the hold state. */
export function confirmFeedback() {
  if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(report);
  else if (Platform.OS === 'android') Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press).catch(report);
}
