import { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { PLOT, VIEW_H, VIEW_W, type Chart, type MarkMode } from '@/lib/chart';
import { colors, fonts, ratingColors } from '@/lib/theme';

type Props = {
  chart: Chart;
  /** For the legend's second line. */
  mode: MarkMode;
  highlighted: number | null;
  /** Called with the tap position in viewBox units (0–320). */
  onTapX: (x: number) => void;
  accessibilityLabel: string;
};

/** Per-set line chart with rating marks. Tapping anywhere selects the nearest session. */
export function ProgressChart({ chart, mode, highlighted, onTapX, accessibilityLabel }: Props) {
  const [width, setWidth] = useState(0);
  return (
    <View style={styles.card}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Svg width="100%" style={{ aspectRatio: VIEW_W / VIEW_H }} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {chart.yTicks.map((t) => (
            <Line key={`g${t.label}`} x1={PLOT.left} x2={PLOT.right} y1={t.y} y2={t.y} stroke={colors.raised} strokeWidth={1} />
          ))}
          {chart.yTicks.map((t) => (
            <SvgText key={`y${t.label}`} x={30} y={t.y + 3} textAnchor="end" fontSize={10} fill={colors.muted} fontFamily={fonts.regular}>
              {String(t.label)}
            </SvgText>
          ))}
          {chart.xLabels.map((t, i) => (
            <SvgText key={`x${i}`} x={t.x} y={196} textAnchor={t.anchor} fontSize={10} fill={colors.muted} fontFamily={fonts.regular}>
              {t.label}
            </SvgText>
          ))}
          <Line
            x1={chart.selectedX}
            x2={chart.selectedX}
            y1={PLOT.top}
            y2={PLOT.bottom}
            stroke={colors.muted}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          {chart.lines.map((l) => (
            <Polyline
              key={`l${l.set}`}
              points={l.points}
              fill="none"
              stroke={l.stroke}
              strokeWidth={l.width}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {chart.marks.map((m) =>
            m.type === 'circle' ? (
              <Circle key={m.key} cx={m.cx} cy={m.cy} r={m.r} fill={m.fill} stroke={m.stroke} strokeWidth={m.strokeWidth} />
            ) : (
              <Rect key={m.key} x={m.x} y={m.y} width={m.width} height={m.height} rx={m.rx} fill={m.fill} />
            )
          )}
        </Svg>
        {/* Empty tap layer on top, so locationX is always measured from the chart's left edge
            (touches on the SVG's own lines would report positions relative to that line). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          onPress={(e) => {
            // Phones report `locationX`; React Native Web passes the DOM click, which has `offsetX`.
            const ne = e.nativeEvent as { locationX?: number; offsetX?: number };
            const x = ne.locationX ?? ne.offsetX;
            if (width && x != null) onTapX((x / width) * VIEW_W);
          }}
        />
      </View>
      <Legend mode={mode} highlighted={highlighted} />
    </View>
  );
}

function Legend({ mode, highlighted }: { mode: MarkMode; highlighted: number | null }) {
  return (
    <View accessible accessibilityLabel={`Easy, Medium, Hard. ${legendNote(mode, highlighted)}`}>
      <View style={styles.legendRow}>
        {(['easy', 'medium', 'hard'] as const).map((d) => (
          <View key={d} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ratingColors[d] }]} />
            <Text style={styles.legendText}>{d[0].toUpperCase() + d.slice(1)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.legendNote}>
        {highlighted == null && mode === 'stacked' && (
          <View style={styles.miniPill}>
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <View key={d} style={[styles.miniSeg, { backgroundColor: ratingColors[d] }]} />
            ))}
          </View>
        )}
        {highlighted == null && mode === 'hardest' && (
          <View style={styles.miniRing}>
            <View style={styles.miniRingDot} />
          </View>
        )}
        <Text style={styles.legendNoteText}>{legendNote(mode, highlighted)}</Text>
      </View>
    </View>
  );
}

function legendNote(mode: MarkMode, highlighted: number | null): string {
  if (highlighted != null) return `Showing Set ${highlighted + 1} only`;
  return mode === 'stacked' ? 'Sets at the same weight · S1 on top' : 'Sets at the same weight · hardest shown';
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 14, rowGap: 6, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  legendNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 16 },
  legendNoteText: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  miniPill: { gap: 1, padding: 1.5, borderRadius: 4, backgroundColor: colors.raised },
  miniSeg: { width: 6, height: 4, borderRadius: 1 },
  miniRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.checkRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniRingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.destructive },
});
