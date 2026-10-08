import { Text } from 'react-native';
import { Screen, ScreenTitle } from '@/components/Screen';

// Workouts library — placeholder until Milestone 2.
export default function WorkoutsScreen() {
  return (
    <Screen>
      <ScreenTitle title="Workouts" />
      <Text className="font-figtree text-muted text-sm mt-6">Workout library coming soon.</Text>
    </Screen>
  );
}
