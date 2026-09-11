/**
 * Neon Viper icons — cyan line glyphs for the Command Hub (Play).
 *
 * Ported from the reference sketch `games/grove/ref/neon-viper-hub/Icons.js`
 * (reference-only; values copied, never imported). `react-native-svg` is
 * already a dependency.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { NEON } from '@/play/neon-viper';

export type HubIconName = 'divecore' | 'shop' | 'dress' | 'more';

function svgProps(size: number, color: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** One of the four Command Hub tile glyphs. */
export function HubIcon({
  name,
  size = 72,
  color = NEON.cyan,
}: {
  name: HubIconName;
  size?: number;
  color?: string;
}) {
  switch (name) {
    case 'divecore':
      return (
        <Svg {...svgProps(size, color)}>
          <Rect x="8" y="8" width="48" height="48" rx="4" strokeOpacity={0.3} />
          <Path d="M20 32 L32 20 L44 32 L32 44 Z" />
          <Circle cx="32" cy="32" r="4" fill={color} stroke="none" />
          <Path d="M16 16 L20 16 M44 16 L48 16 M16 48 L20 48 M44 48 L48 48" strokeOpacity={0.5} />
          <Path d="M32 8 L32 12 M32 52 L32 56 M8 32 L12 32 M52 32 L56 32" strokeOpacity={0.4} />
        </Svg>
      );
    case 'shop':
      return (
        <Svg {...svgProps(size, color)}>
          <Path d="M14 20 L14 14 L50 14 L50 20" />
          <Path d="M14 20 L50 20 L48 50 L16 50 Z" />
          <Path d="M26 20 L26 28 Q26 34 32 34 Q38 34 38 28 L38 20" />
          <Path d="M22 40 L42 40" strokeOpacity={0.4} />
        </Svg>
      );
    case 'dress':
      return (
        <Svg {...svgProps(size, color)}>
          <Path d="M24 12 L40 12 L38 20 L42 28 L38 36 L40 52 L24 52 L26 36 L22 28 L26 20 Z" />
          <Circle cx="32" cy="16" r="2" fill={color} stroke="none" />
          <Path d="M28 42 L36 42" strokeOpacity={0.4} />
        </Svg>
      );
    case 'more':
      return (
        <Svg {...svgProps(size, color)}>
          <Circle cx="32" cy="32" r="22" strokeOpacity={0.3} />
          <Circle cx="32" cy="16" r="2" fill={color} stroke="none" />
          <Path d="M32 24 L32 40" />
          <Path d="M28 46 L36 46" strokeOpacity={0.5} />
        </Svg>
      );
  }
}

/** HUD scrap pip. */
export function ScrapIcon({ size = 12, color = NEON.cyan }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M6 1 L11 6 L6 11 L1 6 Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M6 3.5 L8.5 6 L6 8.5 L3.5 6 Z" fill={color} />
    </Svg>
  );
}

/** HUD wave glyph. */
export function WaveIcon({ size = 12, color = NEON.cyan }: { size?: number; color?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round">
      <Path d="M1 6 Q3 3 6 6 Q9 9 11 6" />
      <Path d="M1 3 Q3 0 6 3 Q9 6 11 3" strokeOpacity={0.4} />
    </Svg>
  );
}

/** HUD life heart — filled for a life remaining, outline once lost. */
export function HeartIcon({
  filled = true,
  size = 12,
  color = NEON.pink,
}: {
  filled?: boolean;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path
        d="M7 12 C7 12 1.5 8 1.5 4.5 C1.5 2.5 3 1 5 1 C6 1 7 2 7 3 C7 2 8 1 9 1 C11 1 12.5 2.5 12.5 4.5 C12.5 8 7 12 7 12 Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}
