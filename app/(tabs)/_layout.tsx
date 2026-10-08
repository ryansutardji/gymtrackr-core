import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { CalendarIcon, ListIcon, TrendIcon } from '@/components/icons';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Calendar', tabBarIcon: ({ color }) => <CalendarIcon color={color} /> }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts', tabBarIcon: ({ color }) => <ListIcon color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: ({ color }) => <TrendIcon color={color} /> }} />
    </Tabs>
  );
}
