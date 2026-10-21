import { useMemo, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenTitle } from '@/components/Screen';
import { SectionLabel } from '@/components/SectionLabel';
import { Segmented } from '@/components/Segmented';
import { ProgressChart } from '@/components/ProgressChart';
import { useAppData } from '@/hooks/useAppData';
import { useSelectedDate } from '@/hooks/useSelectedDate';
import {
  buildChart,
  hasSharedWeight,
  markMode,
  nearestSession,
  RANGES,
  sessionsInRange,
  setCount,
  type Range,
} from '@/lib/chart';
import { loggedWorkouts, ratingCounts, sessions as allSessions } from '@/lib/derive';
import { formatMonthDay, formatShortDay, todayKey } from '@/lib/dates';
import { formatWeight, UNIT } from '@/lib/format';
import { tapFeedback } from '@/lib/haptics';
import { colors, fonts, ratingColors } from '@/lib/theme';
import { DIFFICULTIES, type DateKey, type Difficulty } from '@/lib/types';

const LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export default function StatsScreen() {
  const router = useRouter();
  const { workouts, logs, ratings } = useAppData();
  const { setSelectedDate } = useSelectedDate();

  const logged = useMemo(() => {
    const list = loggedWorkouts({ workouts, logs });
    // Most recently trained first, so the default is what you just did.
    const last = (id: string) => allSessions(logs, id).at(-1)?.date ?? '';
    return list.sort((a, b) => last(b.id).localeCompare(last(a.id)));
  }, [workouts, logs]);

  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [range, setRange] = useState<Range>('3M');
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<DateKey | null>(null);

  const workout = logged.find((w) => w.id === workoutId) ?? logged[0];
  const ses = useMemo(
    () => (workout ? sessionsInRange(allSessions(logs, workout.id, ratings), range, todayKey()) : []),
    [workout, logs, ratings, range]
  );
  const nSets = setCount(ses);
  const hi = highlighted != null && highlighted < nSets ? highlighted : null;
  // Tapped session if it's still in range, otherwise the latest.
  const tappedIdx = ses.findIndex((s) => s.date === selectedSession);
  const selIdx = tappedIdx >= 0 ? tappedIdx : ses.length - 1;
  const selected = ses[selIdx];
  const previous = selIdx > 0 ? ses[selIdx - 1] : undefined;
  const mode = markMode(range);
  const chart = useMemo(() => (selected ? buildChart(ses, hi, selected, mode) : null), [ses, hi, selected, mode]);

  const pickWorkout = (id: string) => {
    setWorkoutId(id);
    setPickerOpen(false);
    setHighlighted(null);
    setSelectedSession(null);
  };

  const openDay = () => {
    if (!selected) return;
    setSelectedDate(selected.date);
    router.navigate('/');
  };

  return (
    <Screen>
      <ScreenTitle title="Stats" />

      {/* Workout picker */}
      <View style={{ marginTop: 14 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={workout ? `Workout: ${workout.name}` : 'No logged workouts'}
          aria-expanded={pickerOpen}
          disabled={!logged.length}
          onPress={() => setPickerOpen((o) => !o)}
          style={({ pressed }) => [styles.picker, pressed && { backgroundColor: colors.row }]}
        >
          <Text style={styles.pickerText}>{workout ? workout.name : 'No logged workouts'}</Text>
          <Text style={styles.caret}>{pickerOpen ? '▴' : '▾'}</Text>
        </Pressable>
        {pickerOpen && (
          <View style={styles.menu}>
            {logged.map((w) => {
              const on = w.id === workout?.id;
              return (
                <Pressable
                  key={w.id}
                  accessibilityRole="button"
                  aria-selected={on}
                  onPress={() => pickWorkout(w.id)}
                  style={({ pressed }) => [styles.menuRow, (on || pressed) && { backgroundColor: colors.row }]}
                >
                  <Text style={[styles.menuName, on && { color: colors.sage }]}>{w.name}</Text>
                  <Text style={styles.menuGroup}>{w.group}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Range */}
      <Segmented
        options={RANGES}
        value={range}
        onChange={(r) => {
          setRange(r);
          setSelectedSession(null);
        }}
        height={30}
        fontSize={12}
        style={{ marginTop: 10 }}
      />

      {chart && selected && workout ? (
        <>
          <ProgressChart
            chart={chart}
            mode={mode}
            highlighted={hi}
            accessibilityLabel={`${workout.name} progress chart, ${ses.length} sessions. Tap to select a session.`}
            onTapX={(x) => {
              const d = nearestSession(chart.sessionX, x);
              if (d) {
                tapFeedback();
                setSelectedSession(d);
              }
            }}
          />

          <SectionLabel style={{ marginTop: 14 }}>Highlight a set</SectionLabel>
          <View style={styles.setChips}>
            {Array.from({ length: nSets }, (_, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Highlight set ${i + 1}`}
                aria-selected={hi === i}
                onPress={() => setHighlighted(hi === i ? null : i)}
                style={[styles.setChip, { backgroundColor: hi === i ? colors.sage : colors.surface }]}
              >
                <Text style={[styles.setChipText, { color: hi === i ? colors.onSage : colors.muted }]}>S{i + 1}</Text>
              </Pressable>
            ))}
          </View>

          <Summary sessions={ses} highlighted={hi} nSets={nSets} />

          {/* Selected session detail */}
          <View style={styles.detail}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailDate}>{formatShortDay(selected.date)}</Text>
              <Pressable accessibilityRole="button" onPress={openDay} hitSlop={8}>
                <Text style={styles.openDay}>Open day ›</Text>
              </Pressable>
            </View>
            {hi == null && hasSharedWeight(selected) && (
              <Text style={styles.detailNote}>
                {mode === 'stacked' ? 'Same weight · stacked' : 'Same weight · hardest shown'}
              </Text>
            )}
            <View style={{ marginTop: 6, gap: 2 }}>
              {Array.from({ length: nSets }, (_, i) => {
                const v = selected.weights[i] ?? null;
                const pv = previous?.weights[i] ?? null;
                const d = v != null && pv != null ? Math.round((v - pv) * 10) / 10 : 0;
                const on = hi === i;
                const rt = selected.ratings?.[i] ?? null;
                const textStyle = [styles.detailText, on && { fontFamily: fonts.bold }];
                return (
                  <View key={i} style={styles.detailRow}>
                    <Text style={textStyle}>Set {i + 1}</Text>
                    <View style={styles.detailValue}>
                      <Text style={textStyle}>{formatWeight(v)}</Text>
                      <Text style={styles.delta}>{d ? `${d > 0 ? '+' : '−'}${Math.abs(d)}` : ''}</Text>
                      <View style={styles.tag} accessibilityLabel={rt ? `felt ${LABEL[rt]}` : 'not rated'}>
                        {rt && <View style={[styles.tagDot, { backgroundColor: ratingColors[rt] }]} />}
                        <Text style={[styles.tagText, { color: rt ? ratingColors[rt] : colors.muted }]}>
                          {rt ? LABEL[rt] : '—'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.empty}>No logged sessions in this range.{'\n'}Log a workout from the Calendar tab.</Text>
      )}
    </Screen>
  );
}

function Summary({
  sessions,
  highlighted,
  nSets,
}: {
  sessions: ReturnType<typeof sessionsInRange>;
  highlighted: number | null;
  nSets: number;
}) {
  const since = formatMonthDay(sessions[0].date);
  let head: string;
  let tail: string;
  let effort = '';
  if (highlighted != null) {
    const vals = sessions.map((s) => s.weights[highlighted]).filter((v): v is number => v != null);
    const first = vals[0];
    const last = vals[vals.length - 1];
    const d = Math.round((last - first) * 10) / 10;
    head = `Set ${highlighted + 1} · ${last} ${UNIT} now`;
    tail = `· ${d >= 0 ? '+' : '−'}${Math.abs(d)} since ${since} · best ${Math.max(...vals)}`;
    const counts = ratingCounts(sessions, highlighted);
    const rated = DIFFICULTIES.reduce((n, k) => n + counts[k], 0);
    if (rated) {
      effort = `Last ${rated} rated · ${DIFFICULTIES.filter((k) => counts[k])
        .map((k) => `${LABEL[k]} ${counts[k]}`)
        .join(' · ')}`;
    }
  } else {
    head = `All ${nSets} ${nSets === 1 ? 'set' : 'sets'}`;
    tail = `· ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} since ${since}`;
  }
  return (
    <>
      <Text style={styles.summary}>
        <Text style={{ fontFamily: fonts.bold, color: colors.text }}>{head}</Text>{' '}
        <Text style={{ color: colors.muted }}>{tail}</Text>
      </Text>
      {effort ? <Text style={styles.effort}>{effort}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  picker: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  caret: { fontSize: 12, color: colors.muted },
  menu: {
    marginTop: 6,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  menuName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  menuGroup: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  setChips: { flexDirection: 'row', gap: 6, marginTop: 8 },
  setChip: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  setChipText: { fontFamily: fonts.bold, fontSize: 13 },
  summary: { marginTop: 12, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  detail: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailDate: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  openDay: { fontFamily: fonts.semibold, fontSize: 13, color: colors.sage, paddingVertical: 6 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: colors.raised,
  },
  detailText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  detailValue: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  tag: { width: 70, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  tagText: { fontFamily: fonts.semibold, fontSize: 12 },
  effort: { marginTop: 2, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  delta: { minWidth: 26, textAlign: 'right', fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  empty: { marginTop: 40, textAlign: 'center', fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted },
});
