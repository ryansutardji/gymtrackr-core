import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

// A plan's page opened directly (e.g. right after creating it) still has the list under it, so "‹ Plans" works.
export const unstable_settings = { initialRouteName: 'index' };

// Workouts tab: the Plans / Workouts lists, with a plan's page pushed on top (tab bar stays visible).
export default function WorkoutsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
