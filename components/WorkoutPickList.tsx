import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Chip } from './Chip';
import { lastTopSet } from '@/lib/derive';
import { formatWeight } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import { MUSCLE_GROUPS, type Logs, type MuscleGroup, type Workout } from '@/lib/types';

export type PickFilter = 'all' | MuscleGroup;

/** Muscle-group chips above a pick list. */
export function PickFilterChips({
  filter,
  onFilter,
  inactiveBg = colors.raised,
}: {
  filter: PickFilter;
  onFilter: (f: PickFilter) => void;
  inactiveBg?: string;
}) {
  return (
    <View style={styles.chips}>
      {(['all', ...MUSCLE_GROUPS] as PickFilter[]).map((g) => (
        <Chip key={g} size="xs" label={g} selected={filter === g} inactiveBg={inactiveBg} onPress={() => onFilter(g)} />
      ))}
    </View>
  );
}

type Props = {
  /** Already filtered. */
  workouts: Workout[];
  logs: Logs;
  /** Shown ticked, dimmed and not selectable (e.g. already on the day / in the plan). */
  lockedIds: string[];
  lockedLabel: string;
  selection: string[];
  onToggle: (id: string) => void;
  onCreateNew: () => void;
};

/** Checklist rows of workouts plus a dashed "+ Create new workout" row. */
export function WorkoutPickList({ workouts, logs, lockedIds, lockedLabel, selection, onToggle, onCreateNew }: Props) {
  return (
    <View style={styles.list}>
      {workouts.map((w) => {
        const locked = lockedIds.includes(w.id);
        const checked = locked || selection.includes(w.id);
        const top = lastTopSet(logs, w.id);
        const meta = locked ? lockedLabel : `${w.sets} × ${w.reps}${top != null ? ` · last top ${formatWeight(top)}` : ''}`;
        return (
          <Pressable
            key={w.id}
            accessibilityRole="checkbox"
            aria-checked={checked}
            aria-disabled={locked}
            accessibilityLabel={`${w.name}, ${meta}`}
            disabled={locked}
            onPress={() => onToggle(w.id)}
            style={({ pressed }) => [styles.row, locked && { opacity: 0.5 }, pressed && { backgroundColor: colors.raised }]}
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
        onPress={onCreateNew}
        style={({ pressed }) => [styles.create, pressed && { backgroundColor: colors.row }]}
      >
        <Text style={styles.createText}>+ Create new workout</Text>
      </Pressable>
    </View>
  );
}

export const pickStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.row,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
});

const styles = StyleSheet.create({
  ...pickStyles,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  list: { gap: 8 },
  box: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  boxOn: { backgroundColor: colors.sage, borderColor: colors.sage },
  boxOff: { borderColor: colors.checkRing },
  check: { fontFamily: fonts.bold, fontSize: 13, color: colors.onSage, lineHeight: 15 },
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
