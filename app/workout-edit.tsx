import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { Stepper } from '@/components/Stepper';
import { useAppData } from '@/hooks/useAppData';
import { colors, fonts, layout } from '@/lib/theme';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/lib/types';

type Draft = { name: string; group: MuscleGroup | null; sets: number; reps: number };

const NEW_DRAFT: Draft = { name: '', group: null, sets: 3, reps: 10 };

/**
 * Create (no `id`) or edit (`?id=`) a workout in two steps:
 * 1) name + muscle group, 2) sets + reps. Edits only affect future sessions.
 */
export default function WorkoutEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { workouts, createWorkout, updateWorkout, deleteWorkout } = useAppData();

  const existing = id ? workouts.find((w) => w.id === id && !w.deletedAt) : undefined;
  // Fixed on open, so the title doesn't flip while closing after a delete.
  const [isNew] = useState(!existing);

  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<Draft>(() =>
    existing ? { name: existing.name, group: existing.group, sets: existing.sets, reps: existing.reps } : NEW_DRAFT
  );
  const [saving, setSaving] = useState(false);

  // An edit link to a workout that no longer exists has nothing to show.
  useEffect(() => {
    if (id && !existing && !saving) router.back();
  }, [id, existing, saving, router]);

  const canContinue = draft.name.trim().length > 0 && draft.group != null;
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const onSave = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    const values = { name: draft.name, group: draft.group!, sets: draft.sets, reps: draft.reps };
    try {
      if (existing) await updateWorkout(existing.id, values);
      else await createWorkout(values);
      router.back();
    } catch (e) {
      console.error('Failed to save workout', e);
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!existing || saving) return;
    setSaving(true);
    try {
      await deleteWorkout(existing.id);
      router.back();
    } catch (e) {
      console.error('Failed to delete workout', e);
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 20) }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => (step === 2 ? setStep(1) : router.back())}
          hitSlop={10}
          style={styles.headerSide}
        >
          <Text style={styles.back}>{step === 2 ? '‹ Back' : 'Cancel'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isNew ? 'New workout' : 'Edit workout'}</Text>
        <View style={styles.headerSide} />
      </View>

      {step === 1 ? (
        <>
          <SectionLabel style={{ marginTop: 28 }}>Name</SectionLabel>
          <View style={styles.inputBox}>
            <TextInput
              value={draft.name}
              onChangeText={(name) => update({ name })}
              placeholder="e.g. Incline DB press"
              placeholderTextColor={colors.muted}
              autoFocus={isNew}
              autoCapitalize="sentences"
              returnKeyType="done"
              maxLength={60}
              style={styles.input}
              accessibilityLabel="Workout name"
            />
          </View>

          <SectionLabel style={{ marginTop: 28 }}>Muscle group</SectionLabel>
          <View style={styles.groups}>
            {MUSCLE_GROUPS.map((g) => (
              <Chip key={g} size="lg" label={g} selected={draft.group === g} onPress={() => update({ group: g })} />
            ))}
          </View>

          {!isNew && (
            <Pressable accessibilityRole="button" onPress={onDelete} hitSlop={8} style={styles.deleteLink}>
              <Text style={styles.deleteText}>Delete workout</Text>
            </Pressable>
          )}

          <View style={{ flex: 1 }} />
          <PrimaryButton label="Next" disabled={!canContinue} onPress={() => canContinue && setStep(2)} />
        </>
      ) : (
        <>
          <View style={{ marginTop: 26, alignItems: 'flex-start' }}>
            <Text style={styles.draftName}>{draft.name.trim()}</Text>
            <Text style={styles.groupPill}>{draft.group}</Text>
          </View>

          <SectionLabel style={{ marginTop: 30, marginBottom: 8 }}>Sets per session</SectionLabel>
          <Stepper label="Sets per session" value={draft.sets} min={1} max={10} onChange={(sets) => update({ sets })} />

          <SectionLabel style={{ marginTop: 22, marginBottom: 8 }}>Reps per set</SectionLabel>
          <Stepper label="Reps per set" value={draft.reps} min={1} max={30} onChange={(reps) => update({ reps })} />

          <SectionLabel style={{ marginTop: 22 }}>Plan</SectionLabel>
          <View style={styles.plan}>
            {Array.from({ length: draft.sets }, (_, i) => (
              <View key={i} style={styles.planChip}>
                <Text style={styles.planSet}>S{i + 1}</Text>
                <Text style={styles.planReps} numberOfLines={1} adjustsFontSizeToFit>
                  {draft.reps} reps
                </Text>
              </View>
            ))}
          </View>

          <View style={{ flex: 1 }} />
          <PrimaryButton label="Save workout" disabled={saving} onPress={onSave} />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: layout.screenPadding },
  header: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSide: { width: 70 },
  back: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  inputBox: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 16, marginTop: 8 },
  input: { height: 56, fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  deleteLink: { marginTop: 36, alignSelf: 'flex-start', paddingVertical: 8 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.destructive },
  draftName: { fontFamily: fonts.semibold, fontSize: 26, letterSpacing: -0.52, color: colors.text },
  groupPill: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.muted,
  },
  plan: { flexDirection: 'row', gap: 6, marginTop: 8 },
  planChip: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planSet: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  planReps: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted },
});
