import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Text, View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import { confirmFeedback, tapFeedback } from '@/lib/haptics';
import { colors, fonts } from '@/lib/theme';

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  /** Spoken name for the item's drag handle, e.g. the workout name. */
  labelOf: (item: T) => string;
  /** Render one row; place `handle` where the ≡ grip should go (or omit it to hide the grip). */
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  onReorder: (items: T[]) => void;
  /** While a drag is in progress (disable the screen's scrolling meanwhile). */
  onDragActive?: (active: boolean) => void;
  gap?: number;
};

/**
 * A short vertical list reordered by dragging each row's ≡ handle. Rows can
 * differ in height. Screen readers get "Move up" / "Move down" actions instead.
 */
export function SortableList<T>({ items, keyOf, labelOf, renderItem, onReorder, onDragActive, gap = 10 }: Props<T>) {
  // After a drop, show the new order right away until the saved data catches up.
  const [pending, setPending] = useState<string[] | null>(null);
  const itemKeys = items.map(keyOf).join('|');
  useEffect(() => {
    if (!pending) return;
    // Saved (same order), or the rows themselves changed (added / removed): drop the stand-in.
    const same = pending.join('|') === itemKeys;
    const sameSet = [...pending].sort().join('|') === itemKeys.split('|').sort().join('|');
    if (same || !sameSet) setPending(null);
  }, [pending, itemKeys]);
  const order = pending
    ? pending.map((k) => items.find((it) => keyOf(it) === k)).filter((it): it is T => it !== undefined)
    : items;

  // Gestures are created once per row and read the latest values through refs,
  // so re-renders during a drag never replace (and cancel) the active gesture.
  const latest = useRef({ order, keyOf, onReorder, onDragActive, gap });
  latest.current = { order, keyOf, onReorder, onDragActive, gap };
  const gestures = useRef(new Map<string, PanGesture>());

  const heights = useRef(new Map<string, number>());
  const shifts = useRef(new Map<string, Animated.Value>());
  const shiftOf = (key: string) => {
    let v = shifts.current.get(key);
    if (!v) shifts.current.set(key, (v = new Animated.Value(0)));
    return v;
  };
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const target = useRef(0);

  const commit = (next: T[]) => {
    setPending(next.map(latest.current.keyOf));
    latest.current.onReorder(next);
  };

  const indexOf = (key: string) => latest.current.order.findIndex((it) => latest.current.keyOf(it) === key);
  const keys = () => latest.current.order.map(latest.current.keyOf);

  /** Where the dragged row would land for a finger movement of `dy`. */
  const targetIndex = (from: number, dy: number) => {
    const ks = keys();
    const h = (k: string) => (heights.current.get(k) ?? 0) + latest.current.gap;
    let i = from;
    let moved = dy;
    while (moved > 0 && i < ks.length - 1 && moved > h(ks[i + 1]) / 2) {
      moved -= h(ks[i + 1]);
      i++;
    }
    while (moved < 0 && i > 0 && -moved > h(ks[i - 1]) / 2) {
      moved += h(ks[i - 1]);
      i--;
    }
    return i;
  };

  const layoutOthers = (from: number, to: number) => {
    const ks = keys();
    const size = (heights.current.get(ks[from]) ?? 0) + latest.current.gap;
    ks.forEach((k, i) => {
      if (i === from) return;
      const offset = from < to && i > from && i <= to ? -size : to < from && i >= to && i < from ? size : 0;
      Animated.timing(shiftOf(k), { toValue: offset, duration: 150, useNativeDriver: false }).start();
    });
  };

  const resetShifts = () => keys().forEach((k) => shiftOf(k).setValue(0));

  const gestureFor = (key: string) => {
    let g = gestures.current.get(key);
    if (!g) gestures.current.set(key, (g = makeGesture(key)));
    return g;
  };

  const makeGesture = (key: string) =>
    Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin(() => {
        // Stop the screen scrolling as soon as the grip is touched.
        latest.current.onDragActive?.(true);
      })
      .onStart(() => {
        tapFeedback();
        target.current = indexOf(key);
        setActiveKey(key);
      })
      .onUpdate((e) => {
        const from = indexOf(key);
        shiftOf(key).setValue(e.translationY);
        const to = targetIndex(from, e.translationY);
        if (to !== target.current) {
          target.current = to;
          tapFeedback();
          layoutOthers(from, to);
        }
      })
      .onEnd(() => {
        const from = indexOf(key);
        const to = target.current;
        resetShifts();
        if (to !== from) {
          const next = [...latest.current.order];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          confirmFeedback();
          commit(next);
        }
      })
      .onFinalize(() => {
        resetShifts();
        setActiveKey(null);
        latest.current.onDragActive?.(false);
      });

  const move = (key: string, delta: -1 | 1) => {
    const from = indexOf(key);
    const to = from + delta;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    commit(next);
  };

  return (
    <View style={{ gap }}>
      {order.map((item) => {
        const key = keyOf(item);
        const handle = (
          <GestureDetector gesture={gestureFor(key)}>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={`Reorder ${labelOf(item)}`}
              accessibilityHint="Drag up or down to move"
              accessibilityActions={[
                { name: 'moveUp', label: 'Move up' },
                { name: 'moveDown', label: 'Move down' },
              ]}
              onAccessibilityAction={(e) => move(key, e.nativeEvent.actionName === 'moveUp' ? -1 : 1)}
              hitSlop={6}
              style={styles.handle}
            >
              <Text style={styles.grip}>≡</Text>
            </View>
          </GestureDetector>
        );
        const active = activeKey === key;
        return (
          <Animated.View
            key={key}
            onLayout={(e: LayoutChangeEvent) => heights.current.set(key, e.nativeEvent.layout.height)}
            style={[
              { transform: [{ translateY: shiftOf(key) }] },
              active && styles.active,
            ]}
          >
            {renderItem(item, handle)}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  grip: { fontFamily: fonts.semibold, fontSize: 20, color: colors.muted },
  // Lifted row: drawn above its neighbours with a soft shadow.
  active: {
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    opacity: 0.95,
  },
});
