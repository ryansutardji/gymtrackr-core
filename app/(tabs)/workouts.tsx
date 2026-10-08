import { useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenTitle } from '@/components/Screen';
import { Chip } from '@/components/Chip';
import { useAppData } from '@/hooks/useAppData';
import { activeWorkouts, lastTopSet } from '@/lib/derive';
import { formatWeight, workoutMeta } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/lib/types';

type Filter = 'all' | MuscleGroup;

export default function WorkoutsScreen() {
  const router = useRouter();
  const { workouts, logs } = useAppData();
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(
    () => activeWorkouts(workouts).filter((w) => filter === 'all' || w.group === filter),
    [workouts, filter]
  );

  return (
    <Screen>
      <ScreenTitle
        title="Workouts"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New workout"
            onPress={() => router.push('/workout-edit')}
            hitSlop={4}
            style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.sagePressed }]}
          >
            <Text style={styles.addPlus}>+</Text>
          </Pressable>
        }
      />

      <View style={styles.chips}>
        {(['all', ...MUSCLE_GROUPS] as Filter[]).map((g) => (
          <Chip key={g} label={g} selected={filter === g} onPress={() => setFilter(g)} />
        ))}
      </View>

      <View style={styles.list}>
        {list.map((w) => (
          <Pressable
            key={w.id}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${w.name}`}
            onPress={() => router.push({ pathname: '/workout-edit', params: { id: w.id } })}
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.row }]}
          >
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.name}>{w.name}</Text>
              <Text style={styles.meta}>{workoutMeta(w)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.topLabel}>Last top set</Text>
              <Text style={styles.topValue}>{formatWeight(lastTopSet(logs, w.id))}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {!list.length && (
        <Text style={styles.empty}>
          {filter === 'all' ? 'No workouts yet. Tap + to create one.' : 'No workouts in this group yet.'}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 26, color: colors.onSage },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  list: { gap: 10, marginTop: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  topLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  topValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 40 },
});
