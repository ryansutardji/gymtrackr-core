import { Pressable, Text, View, StyleSheet } from 'react-native';
import { CheckIcon } from './icons';
import { workoutMeta } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import type { Workout } from '@/lib/types';

type Props = {
  workout: Workout;
  done: number;
  /** In the press-and-hold state: sage ring and a Delete button instead of progress. */
  held: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
};

export const HOLD_DELAY_MS = 500;

/** A planned workout on the Calendar. Tap → log; press and hold (500 ms) → remove from this day. */
export function WorkoutCard({ workout, done, held, onPress, onLongPress, onDelete }: Props) {
  const complete = done >= workout.sets;
  return (
    // The card body and the Delete button are siblings, never nested buttons.
    <View style={[styles.card, held && styles.held]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${workout.name}, ${done} of ${workout.sets} sets logged`}
        accessibilityHint="Tap to log. Press and hold to remove from this day."
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={HOLD_DELAY_MS}
        style={({ pressed }) => [styles.body, pressed && !held && { backgroundColor: colors.row }]}
      >
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.name}>{workout.name}</Text>
          <Text style={styles.meta}>{workoutMeta(workout)}</Text>
        </View>
        {!held && (
          <View style={styles.progress}>
            {complete && <CheckIcon color={colors.sage} />}
            <Text style={[styles.progressText, { color: complete ? colors.sage : colors.muted }]}>
              {done}/{workout.sets}
            </Text>
          </View>
        )}
      </Pressable>
      {held && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${workout.name} from this day`}
          onPress={onDelete}
          style={({ pressed }) => [styles.delete, pressed && { backgroundColor: 'rgba(232,162,154,0.12)' }]}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    // 14×16 padding from the spec, minus the 1.5 ring that's always reserved.
    paddingVertical: 12.5,
    paddingHorizontal: 14.5,
  },
  held: { backgroundColor: colors.row, borderColor: colors.sage },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressText: { fontFamily: fonts.semibold, fontSize: 13 },
  delete: {
    marginRight: 14.5,
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.destructive,
    justifyContent: 'center',
  },
  deleteText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.destructive },
});
