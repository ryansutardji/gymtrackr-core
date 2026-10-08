import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { WorkoutCard } from '@/components/WorkoutCard';
import { AddWorkoutSheet, type SheetFilter } from '@/components/AddWorkoutSheet';
import { DeletePlanSheet } from '@/components/DeletePlanSheet';
import { useAppData } from '@/hooks/useAppData';
import { activeSchedules, activeWorkouts, routineMeta, routineWorkouts } from '@/lib/derive';
import { weekdayName } from '@/lib/dates';
import { confirmFeedback } from '@/lib/haptics';
import { colors, fonts } from '@/lib/theme';
import type { Routine } from '@/lib/types';

/** A plan's page: its workouts (add / press-and-hold to remove), weekly repeats, rename and delete. */
export default function PlanScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useAppData();
  const { workouts, logs, routines, addToRoutine, removeFromRoutine, stopSchedule } = app;
  const routine = routines.find((r) => r.id === id && !r.deletedAt);

  const [heldId, setHeldId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [filter, setFilter] = useState<SheetFilter>('all');
  const pendingCreate = useRef(false);
  const createSnapshot = useRef<Set<string> | null>(null);
  const latestWorkouts = useRef(workouts);
  latestWorkouts.current = workouts;

  // Gone (deleted here or elsewhere): back to the list.
  const left = useRef(false);
  useEffect(() => {
    if (!routine && !left.current) {
      left.current = true;
      router.back();
    }
  }, [routine, router]);

  useFocusEffect(useCallback(() => () => setHeldId(null), []));

  // Back from "Create new workout": reopen the sheet with the new workout ticked.
  useFocusEffect(
    useCallback(() => {
      const before = createSnapshot.current;
      if (!before) return;
      createSnapshot.current = null;
      const created = activeWorkouts(latestWorkouts.current)
        .map((w) => w.id)
        .filter((wid) => !before.has(wid));
      setSelection((sel) => [...sel, ...created.filter((wid) => !sel.includes(wid))]);
      setFilter('all');
      setSheetOpen(true);
    }, [])
  );

  if (!routine) return null;

  const members = routineWorkouts(routine, workouts);
  const canRemove = members.length > 1;
  const repeats = activeSchedules(app, routine.id).sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));

  const openSheet = () => {
    setHeldId(null);
    setSelection([]);
    setFilter('all');
    setSheetOpen(true);
  };

  const addSelected = async () => {
    if (!selection.length) return;
    setSheetOpen(false);
    confirmFeedback();
    await addToRoutine(routine.id, selection);
    setSelection([]);
  };

  const onSheetClosed = () => {
    if (!pendingCreate.current) return;
    pendingCreate.current = false;
    createSnapshot.current = new Set(workouts.map((w) => w.id));
    router.push('/workout-edit');
  };

  const onRemove = async (workoutId: string) => {
    setHeldId(null);
    try {
      await removeFromRoutine(routine.id, workoutId);
    } catch (e) {
      console.error('Failed to remove from plan', e);
    }
  };

  return (
    <Screen onBackgroundPress={() => setHeldId(null)}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.back}>
        <Text style={styles.backText}>‹ Plans</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.title}>{routine.name}</Text>
          <Text style={styles.meta}>{routineMeta(routine, workouts)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rename plan"
          onPress={() => router.push({ pathname: '/plan-edit', params: { id: routine.id } })}
          hitSlop={4}
          style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.row }]}
        >
          <Text style={styles.headerButtonText}>Rename</Text>
        </Pressable>
      </View>

      <SectionLabel style={{ marginTop: 24 }}>Workouts</SectionLabel>
      <View style={styles.cards}>
        {members.map((w) => (
          <WorkoutCard
            key={w.id}
            workout={w}
            held={heldId === w.id}
            onPress={() => setHeldId(null)}
            onLongPress={
              canRemove
                ? () => {
                    confirmFeedback();
                    setHeldId(w.id);
                  }
                : undefined
            }
            onDelete={() => onRemove(w.id)}
            deleteLabel="Remove"
            deleteA11yLabel={`Remove ${w.name} from ${routine.name}`}
            a11yHint={canRemove ? 'Press and hold to remove from this plan.' : undefined}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={openSheet}
          style={({ pressed }) => [styles.dashed, pressed && { backgroundColor: colors.surface }]}
        >
          <Text style={styles.dashedText}>+ Add workout</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {canRemove ? 'Press and hold to remove' : 'A plan needs at least one workout'}
      </Text>

      {repeats.length > 0 && (
        <>
          <SectionLabel style={{ marginTop: 24 }}>Repeats</SectionLabel>
          <View style={styles.cards}>
            {repeats.map((s) => (
              <View key={s.id} style={styles.repeatRow}>
                <Text style={styles.repeatText}>Every {weekdayName(s.weekday)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Stop repeating every ${weekdayName(s.weekday)}`}
                  onPress={() => stopSchedule(s.id)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.stop, pressed && { backgroundColor: colors.line }]}
                >
                  <Text style={styles.stopText}>Stop</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={styles.hint}>Stopping keeps days up to today.</Text>
        </>
      )}

      <View style={{ flex: 1, minHeight: 28 }} />
      <Pressable
        accessibilityRole="button"
        onPress={() => setDeleting(routine)}
        style={({ pressed }) => [styles.delete, pressed && { backgroundColor: 'rgba(232,162,154,0.12)' }]}
      >
        <Text style={styles.deleteText}>Delete plan</Text>
      </Pressable>

      <AddWorkoutSheet
        visible={sheetOpen}
        title={`Add to ${routine.name}`}
        workouts={workouts}
        logs={logs}
        plannedIds={members.map((w) => w.id)}
        plannedLabel="Already in plan"
        selection={selection}
        filter={filter}
        onToggle={(wid) => setSelection((sel) => (sel.includes(wid) ? sel.filter((x) => x !== wid) : [...sel, wid]))}
        onFilter={setFilter}
        onAdd={addSelected}
        onCreateNew={() => {
          pendingCreate.current = true;
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
        onClosed={onSheetClosed}
      />
      <DeletePlanSheet routine={deleting} onClose={() => setDeleting(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sage },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 8 },
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
  headerButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  headerButtonText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  cards: { gap: 10, marginTop: 10 },
  dashed: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sage },
  hint: { marginTop: 12, fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
  },
  repeatText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  stop: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.raised, justifyContent: 'center' },
  stopText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  delete: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.destructive },
});
