import Svg, { Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number };

// 24×24 stroke icons from the handoff: 1.9 stroke, round caps and joins.
const stroke = { fill: 'none', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function CalendarIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Rect x={3.5} y={5} width={17} height={15} rx={3.5} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  );
}

export function ListIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
    </Svg>
  );
}

export function TrendIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke}>
      <Path d="M4 17l5-6 4 3 7-8" />
      <Path d="M4 21h16" />
    </Svg>
  );
}

export function CheckIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" stroke={color} {...stroke} strokeWidth={2.6}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}
