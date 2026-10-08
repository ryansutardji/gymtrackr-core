import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { PickFilterChips, WorkoutPickList, type PickFilter } from '@/components/WorkoutPickList';
import { useAppData } from '@/hooks/useAppData';
import { activeWorkouts } from '@/lib/derive';
import { confirmFeedback } from '@/lib/haptics';
import { colors, fonts, layout } from '@/lib/theme';

/**
 * New plan in two steps: 1) name, 2) choose workouts (selection order = plan
 * order). With `?id=` it only renames that plan.
 */
export default function PlanEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { workouts, logs, routines, createRoutine, renameRoutine } = useAppData();

  const existing = id ? routines.find((r) => r.id === id && !r.deletedAt) : undefined;
  const [isRename] = useState(!!existing);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(existing?.name ?? '');
  const [selection, setSelection] = useState<string[]>([]);
  const [filter, setFilter] = useState<PickFilter>('all');
  const [saving, setSaving] = useState(false);

  // Set while Create workout is open: the workout ids that existed before.
  const createSnapshot = useRef<Set<string> | null>(null);
  const latestWorkouts = useRef(workouts);
  latestWorkouts.current = workouts;

  useEffect(() => {
    if (id && !existing && !saving) router.back();
  }, [id, existing, saving, router]);

  // Back from "Create new workout": tick the new workout.
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
    }, [])
  );

  const hasName = name.trim().length > 0;
  const n = selection.length;
  const list = activeWorkouts(workouts).filter((w) => filter === 'all' || w.group === filter);

  const toggle = (wid: string) =>
    setSelection((sel) => (sel.includes(wid) ? sel.filter((x) => x !== wid) : [...sel, wid]));

  const createWorkout = () => {
    createSnapshot.current = new Set(workouts.map((w) => w.id));
    router.push('/workout-edit');
  };

  const onRename = async () => {
    if (!existing || !hasName || saving) return;
    setSaving(true);
    try {
      await renameRoutine(existing.id, name);
      router.back();
    } catch (e) {
      console.error('Failed to rename plan', e);
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!hasName || !n || saving) return;
    setSaving(true);
    try {
      const r = await createRoutine(name, selection);
      confirmFeedback();
      // Close this screen and land on the new plan's page inside the Workouts tab.
      router.dismissTo({ pathname: '/workouts/plan/[id]', params: { id: r.id } });
    } catch (e) {
      console.error('Failed to save plan', e);
      setSaving(false);
    }
  };

  const onBack = () => (step === 2 ? setStep(1) : router.back());

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 20) }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step === 2 ? 'Back' : 'Close'}
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.row }]}
        >
          <Text style={styles.headerGlyph}>{step === 2 ? '‹' : '✕'}</Text>
        </Pressable>
        {!isRename && <Text style={styles.stepText}>Step {step} of 2</Text>}
      </View>

      {step === 1 ? (
        <>
          <Text style={styles.draftTitle}>{isRename ? 'Rename plan' : 'New plan'}</Text>
          <SectionLabel style={{ marginTop: 24 }}>Name</SectionLabel>
          <View style={styles.inputBox}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Plan name"
              placeholderTextColor={colors.muted}
              autoFocus
              autoCapitalize="sentences"
              returnKeyType="done"
              maxLength={60}
              style={styles.input}
              accessibilityLabel="Plan name"
            />
          </View>
          {!isRename && <Text style={styles.hint}>e.g. Push day, Mon / Thu full body</Text>}
          <View style={{ flex: 1 }} />
          {isRename ? (
            <PrimaryButton label="Save" disabled={!hasName || saving} onPress={onRename} height={54} style={styles.button} />
          ) : (
            <PrimaryButton
              label="Next · choose workouts"
              disabled={!hasName}
              onPress={() => hasName && setStep(2)}
              height={54}
              style={styles.button}
            />
          )}
        </>
      ) : (
        <>
          <Text style={styles.draftTitle}>Choose workouts</Text>
          <PickFilterChips filter={filter} onFilter={setFilter} inactiveBg={colors.surface} />
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 12 }}>
            <WorkoutPickList
              workouts={list}
              logs={logs}
              lockedIds={[]}
              lockedLabel=""
              selection={selection}
              onToggle={toggle}
              onCreateNew={createWorkout}
            />
          </ScrollView>
          <PrimaryButton
            label={n ? `Save plan · ${n} ${n === 1 ? 'workout' : 'workouts'}` : 'Select workouts'}
            disabled={!n || saving}
            onPress={onSave}
            height={54}
            style={styles.button}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: layout.screenPadding },
  header: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGlyph: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  stepText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  draftTitle: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.52, color: colors.text, marginTop: 18 },
  inputBox: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, marginTop: 8 },
  input: { height: 56, fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 8 },
  scroll: { flex: 1, marginTop: 12 },
  button: { borderRadius: 18, marginTop: 12 },
});
