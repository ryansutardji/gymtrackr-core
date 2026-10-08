import { Text } from 'react-native';
import { Screen, ScreenTitle } from '@/components/Screen';

// Calendar (home) — placeholder until Milestone 3.
export default function CalendarScreen() {
  const subtitle = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <Screen>
      <ScreenTitle title="Today" subtitle={subtitle} />
      <Text className="font-figtree text-muted text-sm mt-6">Calendar coming soon.</Text>
    </Screen>
  );
}
