import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, layout } from '@/lib/theme';

type ScreenProps = {
  children: ReactNode;
  /** Called when empty space (not a control) is tapped. */
  onBackgroundPress?: () => void;
};

// Scrollable tab screen: 20 side padding, 120 bottom padding to clear the tab bar.
export function Screen({ children, onBackgroundPress }: ScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {onBackgroundPress ? (
          <Pressable accessible={false} onPress={onBackgroundPress} style={styles.content}>
            {children}
          </Pressable>
        ) : (
          <View style={styles.content}>{children}</View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    paddingTop: 6,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarClearance,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 2,
  },
});
