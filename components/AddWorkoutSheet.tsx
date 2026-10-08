import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Chip } from './Chip';
import { PrimaryButton } from './PrimaryButton';
import { activeWorkouts, lastTopSet } from '@/lib/derive';
import { formatWeight } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import { MUSCLE_GROUPS, type Logs, type MuscleGroup, type Workout } from '@/lib/types';

export type SheetFilter = 'all' | MuscleGroup;

type Props = {
  visible: boolean;
  /** "Add to today" / "Add to Thu, Oct 8" */
  title: string;
  workouts: Workout[];
  logs: Logs;
  /** Workout ids already planned on the day — shown dimmed and not selectable. */
  plannedIds: string[];
  selection: string[];
  filter: SheetFilter;
  onToggle: (id: string) => void;
  onFilter: (f: SheetFilter) => void;
  onAdd: () => void;
  onCreateNew: () => void;
  onClose: () => void;
  onClosed?: () => void;
};

/** Multi-select list of workouts to add to the selected day. State lives with the caller. */
export function AddWorkoutSheet(props: Props) {
  const { visible, title, workouts, logs, plannedIds, selection, filter } = props;
  const list = activeWorkouts(workouts).filter((w) => filter === 'all' || w.group === filter);
  const n = selection.length;

  return (
    <BottomSheet visible={visible} onClose={props.onClose} onClosed={props.onClosed}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={props.onClose}
          hitSlop={6}
          style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.line }]}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {(['all', ...MUSCLE_GROUPS] as SheetFilter[]).map((g) => (
          <Chip
            key={g}
            size="xs"
            label={g}
            selected={filter === g}
            inactiveBg={colors.raised}
            onPress={() => props.onFilter(g)}
          />
        ))}
      </View>

      <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
        {list.map((w) => {
          const inPlan = plannedIds.includes(w.id);
          const checked = inPlan || selection.includes(w.id);
          const top = lastTopSet(logs, w.id);
          const meta = inPlan
            ? 'Already on this day'
            : `${w.sets} × ${w.reps}${top != null ? ` · last top ${formatWeight(top)}` : ''}`;
          return (
            <Pressable
              key={w.id}
              accessibilityRole="checkbox"
              aria-checked={checked}
              aria-disabled={inPlan}
              accessibilityLabel={`${w.name}, ${meta}`}
              disabled={inPlan}
              onPress={() => props.onToggle(w.id)}
              style={({ pressed }) => [styles.row, inPlan && { opacity: 0.5 }, pressed && { backgroundColor: colors.raised }]}
            >
              <View style={[styles.box, checked ? styles.boxOn : styles.boxOff]}>
                {checked && <Text style={styles.check}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{w.name}</Text>
                <Text style={styles.meta}>{meta}</Text>
              </View>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={props.onCreateNew}
          style={({ pressed }) => [styles.create, pressed && { backgroundColor: colors.row }]}
        >
          <Text style={styles.createText}>+ Create new workout</Text>
        </Pressable>
      </ScrollView>

      <PrimaryButton
        label={n ? `Add ${n} ${n === 1 ? 'workout' : 'workouts'}` : 'Select workouts'}
        disabled={!n}
        onPress={props.onAdd}
        height={54}
        style={{ marginTop: 14, borderRadius: 18 }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  title: { fontFamily: fonts.semibold, fontSize: 20, color: colors.text, flexShrink: 1 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 14, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  listScroll: { flexShrink: 1, minHeight: 120, marginTop: 12 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.row,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  box: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  boxOn: { backgroundColor: colors.sage, borderColor: colors.sage },
  boxOff: { borderColor: colors.checkRing },
  check: { fontFamily: fonts.bold, fontSize: 13, color: colors.onSage, lineHeight: 15 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  create: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sage },
});
