import { useRef } from 'react';
import { ConfirmSheet } from './ConfirmSheet';
import { useAppData } from '@/hooks/useAppData';
import { activeSchedules, routineWorkouts } from '@/lib/derive';
import { confirmFeedback } from '@/lib/haptics';
import type { Routine } from '@/lib/types';

type Props = {
  /** The plan to delete; the sheet is open while this is set. */
  routine: Routine | null;
  onClose: () => void;
  onDeleted?: () => void;
};

/** "Delete Push day?" — says plainly what stays and what stops. */
export function DeletePlanSheet({ routine, onClose, onDeleted }: Props) {
  const app = useAppData();
  // Keep showing the last plan's text while the sheet slides away.
  const shown = useRef(routine);
  if (routine) shown.current = routine;
  const r = shown.current;
  const n = r ? routineWorkouts(r, app.workouts).length : 0;
  const repeats = r ? activeSchedules(app, r.id).length > 0 : false;
  const body =
    `${n === 1 ? 'Its workout stays' : `Its ${n} workouts stay`} in your library. ` +
    'Days already on the calendar keep their workouts and logs.' +
    (repeats ? ' Weekly repeats stop.' : '');

  const onConfirm = async () => {
    if (!routine) return;
    confirmFeedback();
    onClose();
    try {
      await app.deleteRoutine(routine.id);
      onDeleted?.();
    } catch (e) {
      console.error('Failed to delete plan', e);
    }
  };

  return (
    <ConfirmSheet
      visible={!!routine}
      title={r ? `Delete ${r.name}?` : ''}
      body={body}
      confirmLabel="Delete plan"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
