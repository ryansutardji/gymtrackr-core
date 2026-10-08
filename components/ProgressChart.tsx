import { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { PLOT, VIEW_H, VIEW_W, type Chart } from '@/lib/chart';
import { colors, fonts } from '@/lib/theme';

type Props = {
  chart: Chart;
  /** Called with the tap position in viewBox units (0–320). */
  onTapX: (x: number) => void;
  accessibilityLabel: string;
};

/** Per-set line chart. Tapping anywhere selects the nearest session. */
export function ProgressChart({ chart, onTapX, accessibilityLabel }: Props) {
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
          {chart.dots.map((d) => (
            <Circle key={`d${d.set}`} cx={d.x} cy={d.y} r={d.r} fill={d.fill} stroke={d.stroke} strokeWidth={2} />
          ))}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
});
