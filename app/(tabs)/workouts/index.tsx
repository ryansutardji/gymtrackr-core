import { useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenTitle } from '@/components/Screen';
import { Chip } from '@/components/Chip';
import { Segmented } from '@/components/Segmented';
import { DeletePlanSheet } from '@/components/DeletePlanSheet';
import { HOLD_DELAY_MS } from '@/components/WorkoutCard';
import { useAppData } from '@/hooks/useAppData';
import { activeRoutines, activeWorkouts, lastTopSet, routineMeta } from '@/lib/derive';
import { formatWeight, workoutMeta } from '@/lib/format';
import { confirmFeedback } from '@/lib/haptics';
import { colors, fonts } from '@/lib/theme';
import { MUSCLE_GROUPS, type MuscleGroup, type Routine } from '@/lib/types';

type Filter = 'all' | MuscleGroup;
type ListKind = 'Plans' | 'Workouts';
const VIEWS: ListKind[] = ['Plans', 'Workouts'];

export default function WorkoutsScreen() {
  const router = useRouter();
  const { workouts, logs, routines } = useAppData();
  const [view, setView] = useState<ListKind>('Plans');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleting, setDeleting] = useState<Routine | null>(null);

  const list = useMemo(
    () => activeWorkouts(workouts).filter((w) => filter === 'all' || w.group === filter),
    [workouts, filter]
  );
  const plans = useMemo(() => activeRoutines(routines), [routines]);

  return (
    <Screen>
      <ScreenTitle
        title="Workouts"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={view === 'Plans' ? 'New plan' : 'New workout'}
            onPress={() => router.push(view === 'Plans' ? '/plan-edit' : '/workout-edit')}
            hitSlop={4}
            style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.sagePressed }]}
          >
            <Text style={styles.addPlus}>+</Text>
          </Pressable>
        }
      />

      <Segmented options={VIEWS} value={view} onChange={setView} style={{ marginTop: 14 }} />

      {view === 'Plans' ? (
        <>
          <View style={styles.list}>
            {plans.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}, ${routineMeta(r, workouts)}`}
                accessibilityHint="Opens the plan. Press and hold to delete."
                onPress={() => router.push({ pathname: '/workouts/plan/[id]', params: { id: r.id } })}
                onLongPress={() => {
                  confirmFeedback();
                  setDeleting(r);
                }}
                delayLongPress={HOLD_DELAY_MS}
                style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.row }]}
              >
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.name}>{r.name}</Text>
                  <Text style={styles.meta}>{routineMeta(r, workouts)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
          {!plans.length && <Text style={styles.empty}>No plans yet. Tap + to create one.</Text>}
        </>
      ) : (
        <>
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
        </>
      )}

      <DeletePlanSheet routine={deleting} onClose={() => setDeleting(null)} />
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
  chevron: { fontFamily: fonts.medium, fontSize: 22, color: colors.muted },
  topLabel: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  topValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 40 },
});
