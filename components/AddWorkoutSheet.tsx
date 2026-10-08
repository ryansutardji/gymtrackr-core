import { Pressable, ScrollView, Switch, Text, View, StyleSheet } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';
import { Segmented } from './Segmented';
import { PickFilterChips, WorkoutPickList, pickStyles, type PickFilter } from './WorkoutPickList';
import { activeWorkouts, routineWorkouts } from '@/lib/derive';
import { colors, fonts } from '@/lib/theme';
import type { Logs, Routine, Workout } from '@/lib/types';

export type SheetFilter = PickFilter;
export type SheetMode = 'Workouts' | 'Plans';
const MODES: SheetMode[] = ['Workouts', 'Plans'];

/** Calendar only: the Plans tab of the sheet. State lives with the caller. */
export type SheetPlans = {
  mode: SheetMode;
  onMode: (m: SheetMode) => void;
  /** Active (non-deleted) plans. */
  routines: Routine[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  repeat: boolean;
  onRepeat: (on: boolean) => void;
  /** "Thursday" — the selected day's weekday. */
  weekday: string;
  onAddPlan: () => void;
};

type Props = {
  visible: boolean;
  /** "Add to today" / "Add to Thu, Oct 8" / "Add to Push day" */
  title: string;
  workouts: Workout[];
  logs: Logs;
  /** Workout ids already on the day (or in the plan) — shown ticked, dimmed and not selectable. */
  plannedIds: string[];
  plannedLabel?: string;
  selection: string[];
  filter: SheetFilter;
  onToggle: (id: string) => void;
  onFilter: (f: SheetFilter) => void;
  onAdd: () => void;
  onCreateNew: () => void;
  onClose: () => void;
  onClosed?: () => void;
  plans?: SheetPlans;
};

/** Multi-select list of workouts to add to a day or a plan; on the Calendar it can add a whole plan instead. */
export function AddWorkoutSheet(props: Props) {
  const { visible, title, workouts, logs, plannedIds, selection, filter, plans } = props;
  const list = activeWorkouts(workouts).filter((w) => filter === 'all' || w.group === filter);
  const n = selection.length;
  const showPlans = plans?.mode === 'Plans';

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

      {plans && (
        <Segmented
          options={MODES}
          value={plans.mode}
          onChange={plans.onMode}
          bg={colors.row}
          activeBg={colors.line}
          style={{ marginTop: 12 }}
        />
      )}

      {showPlans ? (
        <PlansTab plans={plans} workouts={workouts} plannedIds={plannedIds} />
      ) : (
        <>
          <PickFilterChips filter={filter} onFilter={props.onFilter} />
          <ScrollView style={styles.listScroll}>
            <WorkoutPickList
              workouts={list}
              logs={logs}
              lockedIds={plannedIds}
              lockedLabel={props.plannedLabel ?? 'Already on this day'}
              selection={selection}
              onToggle={props.onToggle}
              onCreateNew={props.onCreateNew}
            />
          </ScrollView>
          <PrimaryButton
            label={n ? `Add ${n} ${n === 1 ? 'workout' : 'workouts'}` : 'Select workouts'}
            disabled={!n}
            onPress={props.onAdd}
            height={54}
            style={styles.button}
          />
        </>
      )}
    </BottomSheet>
  );
}

function PlansTab({ plans, workouts, plannedIds }: { plans: SheetPlans; workouts: Workout[]; plannedIds: string[] }) {
  const selected = plans.routines.find((r) => r.id === plans.selectedId);
  const members = selected ? routineWorkouts(selected, workouts) : [];
  const newCount = members.filter((w) => !plannedIds.includes(w.id)).length;

  let label = 'Select a plan';
  let enabled = false;
  if (selected) {
    if (newCount) {
      label = `Add ${selected.name} · ${newCount} ${newCount === 1 ? 'workout' : 'workouts'}`;
      enabled = true;
    } else if (plans.repeat) {
      label = `Repeat ${selected.name} every ${plans.weekday}`;
      enabled = true;
    } else {
      label = 'Already on this day';
    }
  }

  return (
    <>
      <ScrollView style={styles.listScroll}>
        <View style={{ gap: 8 }}>
          {plans.routines.map((r) => {
            const on = r.id === plans.selectedId;
            const ws = routineWorkouts(r, workouts);
            const meta = on ? ws.map((w) => w.name).join(' · ') : `${ws.length} ${ws.length === 1 ? 'workout' : 'workouts'}`;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="radio"
                aria-checked={on}
                accessibilityLabel={`${r.name}, ${meta}`}
                onPress={() => plans.onSelect(r.id)}
                style={({ pressed }) => [
                  pickStyles.row,
                  styles.planRow,
                  on && { borderColor: colors.sage },
                  pressed && { backgroundColor: colors.raised },
                ]}
              >
                <View style={[styles.radio, on ? styles.radioOn : styles.radioOff]}>
                  {on && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pickStyles.name}>{r.name}</Text>
                  <Text style={pickStyles.meta}>{meta}</Text>
                </View>
              </Pressable>
            );
          })}
          {!plans.routines.length && (
            <Text style={styles.empty}>No plans yet. Make one in the Workouts tab.</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.repeat}>
        <View style={{ flex: 1 }}>
          <Text style={styles.repeatTitle}>Repeat every {plans.weekday}</Text>
          <Text style={styles.repeatSub}>Until you turn it off</Text>
        </View>
        <Switch
          accessibilityLabel={`Repeat every ${plans.weekday}`}
          value={plans.repeat}
          onValueChange={plans.onRepeat}
          trackColor={{ false: colors.line, true: colors.sage }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.line}
        />
      </View>

      <PrimaryButton label={label} disabled={!enabled} onPress={plans.onAddPlan} height={54} style={styles.button} />
    </>
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
  listScroll: { flexShrink: 1, minHeight: 120, marginTop: 12 },
  button: { marginTop: 14, borderRadius: 18 },
  planRow: { borderWidth: 1.5, borderColor: 'transparent' },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  radioOn: { borderColor: colors.sage },
  radioOff: { borderColor: colors.checkRing },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sage },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 24 },
  repeat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.row,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  repeatTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  repeatSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 1 },
});
