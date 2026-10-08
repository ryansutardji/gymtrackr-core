import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppData } from '@/hooks/useAppData';
import { firstOpenSet, prefillWeight, previousSession, setsFor, stepWeight } from '@/lib/derive';
import { formatShortDay } from '@/lib/dates';
import { UNIT } from '@/lib/format';
import { confirmFeedback, tapFeedback } from '@/lib/haptics';
import { colors, fonts, layout, steps } from '@/lib/theme';
import type { Logs } from '@/lib/types';

/**
 * Full-screen set logger for one workout on one date (`?date=&workoutId=`).
 * Opens on the first unlogged set; logging advances to the next set and the
 * last set closes back to the Calendar.
 */
export default function LoggerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { date, workoutId } = useLocalSearchParams<{ date: string; workoutId: string }>();
  const { workouts, logs, logSet } = useAppData();
  const workout = workouts.find((w) => w.id === workoutId && !w.deletedAt);

  const [setIndex, setSetIndex] = useState(() => (workout ? firstOpenSet(logs, date, workout) : 0));
  const [value, setValue] = useState(() => String(prefillWeight(logs, date, workoutId, setIndex)));
  const [saving, setSaving] = useState(false);

  // Nothing to log for a workout that no longer exists.
  useEffect(() => {
    if (!workout) router.back();
  }, [workout, router]);
  if (!workout) return null;

  const current = setsFor(logs, date, workout.id);
  const prev = previousSession(logs, workout.id, date);
  const lastTime = prev?.weights[setIndex];
  const isLast = setIndex === workout.sets - 1;
  const alreadyLogged = current[setIndex] != null;
  const parsed = Number(value);
  const canLog = value !== '' && !isNaN(parsed) && !saving;

  const others = current
    .map((v, i) => (v != null && i !== setIndex ? `S${i + 1} ${v}` : null))
    .filter(Boolean)
    .join(' · ');

  const goToSet = (i: number, fromLogs: Logs = logs) => {
    setSetIndex(i);
    setValue(String(prefillWeight(fromLogs, date, workout.id, i)));
  };

  const nudge = (delta: number) => {
    Keyboard.dismiss();
    tapFeedback();
    setValue((v) => String(stepWeight(Number(v) || 0, delta)));
  };

  const onLog = async () => {
    if (!canLog) return;
    const weight = Math.round(Math.max(0, parsed) * 10) / 10;
    setSaving(true);
    try {
      await logSet(date, workout.id, setIndex, weight);
    } catch (e) {
      console.error('Failed to log set', e);
      setSaving(false);
      return;
    }
    confirmFeedback();
    setSaving(false);
    if (isLast) {
      router.back();
      return;
    }
    // Pre-fill the next set as if this one is already stored (the shared
    // copy may not have re-rendered yet).
    const day = [...current];
    day[setIndex] = weight;
    goToSet(setIndex + 1, { ...logs, [date]: { ...logs[date], [workout.id]: day } });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 20) }]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.row }]}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.name} numberOfLines={1}>
            {workout.name}
          </Text>
          <Text style={styles.sub}>
            {formatShortDay(date)} · {workout.group}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.segments}>
        {Array.from({ length: workout.sets }, (_, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Set ${i + 1}${current[i] != null ? `, logged ${current[i]} ${UNIT}` : ''}`}
            aria-selected={i === setIndex}
            onPress={() => {
              tapFeedback();
              goToSet(i);
            }}
            style={styles.segmentHit}
          >
            <View
              style={[
                styles.segment,
                { backgroundColor: i === setIndex ? colors.text : current[i] != null ? colors.sage : colors.raised },
              ]}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.setRow}>
        <Text style={styles.setLabel}>
          Set {setIndex + 1} of {workout.sets}
        </Text>
        <Text style={styles.target}>Target {workout.reps} reps</Text>
      </View>

      <View style={styles.weightCard}>
        <TextInput
          value={value}
          onChangeText={(t) => setValue(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          maxLength={6}
          style={styles.weight}
          accessibilityLabel={`Weight in ${UNIT}`}
        />
        <Text style={styles.weightSub}>
          {UNIT} · {lastTime != null ? `last time ${lastTime}` : 'first time'}
        </Text>
      </View>

      <View style={styles.stepRow}>
        <StepButton label={`−${steps.big}`} big onPress={() => nudge(-steps.big)} />
        <StepButton label={`+${steps.big}`} big onPress={() => nudge(steps.big)} />
      </View>
      <View style={[styles.stepRow, { marginTop: 10 }]}>
        <StepButton label={`−${steps.small}`} onPress={() => nudge(-steps.small)} />
        <StepButton label={`+${steps.small}`} onPress={() => nudge(steps.small)} />
      </View>

      <Text style={styles.others}>{others}</Text>

      <View style={{ flex: 1 }} />
      <PrimaryButton
        label={alreadyLogged ? 'Update set' : isLast ? 'Log set & finish' : 'Log set'}
        disabled={!canLog}
        onPress={onLog}
        height={60}
        fontSize={17}
      />
    </KeyboardAvoidingView>
  );
}

/** Big ±5 (76 tall) and the smaller ±2.5 row beneath (52 tall). */
function StepButton({ label, big, onPress }: { label: string; big?: boolean; onPress: () => void }) {
  const spoken = `${label.startsWith('+') ? 'Add' : 'Subtract'} ${label.slice(1)} ${UNIT}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [
        big ? styles.stepBig : styles.stepSmall,
        { backgroundColor: pressed ? colors.line : colors.raised },
      ]}
    >
      <Text style={big ? styles.stepBigText : styles.stepSmallText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: layout.screenPadding },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 15, color: colors.text },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  segments: { flexDirection: 'row', gap: 6, marginTop: 22 },
  segmentHit: { flex: 1, paddingVertical: 10 },
  segment: { height: 6, borderRadius: 3 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  setLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  target: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  weightCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    marginTop: 18,
    paddingTop: 30,
    paddingBottom: 22,
    alignItems: 'center',
  },
  weight: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 84,
    lineHeight: 90,
    letterSpacing: -2.5,
    color: colors.text,
    padding: 0,
  },
  weightSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 8 },
  stepRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  stepBig: { flex: 1, height: 76, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepBigText: { fontFamily: fonts.semibold, fontSize: 26, color: colors.text },
  stepSmall: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepSmallText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  others: { marginTop: 16, minHeight: 18, fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
