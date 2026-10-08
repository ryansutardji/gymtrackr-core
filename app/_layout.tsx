import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import {
  useFonts,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { AppDataProvider, useAppData } from '@/hooks/useAppData';
import { SelectedDateProvider } from '@/hooks/useSelectedDate';
import { colors, fonts } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  useEffect(() => {
    // Root view color shows briefly during screen transitions and keyboard moves.
    SystemUI.setBackgroundColorAsync(colors.bg);
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppDataProvider>
      <SelectedDateProvider>
        <AppShell />
      </SelectedDateProvider>
    </AppDataProvider>
  );
}

// Keeps the splash screen up until saved data has loaded, so the first frame isn't empty.
function AppShell() {
  const { ready, error } = useAppData();

  useEffect(() => {
    if (ready || error) SplashScreen.hideAsync();
  }, [ready, error]);

  if (!ready && !error) return null;

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 32 }}>
        <StatusBar style="light" />
        <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 18, textAlign: 'center' }}>
          Couldn't open your saved workouts
        </Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
          Close the app completely and open it again. Your data hasn't been changed.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout-edit" />
        <Stack.Screen name="logger" />
      </Stack>
    </GestureHandlerRootView>
  );
}
