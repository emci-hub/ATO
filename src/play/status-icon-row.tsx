/**
 * Draws a creep's status icons in the board `<Svg>` (board units), centred
 * above its health bar — see `status-icons.ts` for which icons and why.
 *
 * Each icon is a dark backing disc + one small vector glyph (flame, snowflake,
 * star, shield), so no art assets and 2 shapes per icon. A stack
 * count (e.g. two DoTs) is a tiny number at the icon's lower right.
 */
import { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import type { StatusIcon } from '@/play/status-icons';

/** Glyphs in a -1..1 box; scaled to the icon size by a transform. */
const GLYPH: Record<StatusIcon['kind'], { d: string; fill: boolean }> = {
  dot: {
    d: 'M0 -0.85 C0.45 -0.35 0.62 0 0.46 0.4 C0.34 0.76 -0.34 0.76 -0.46 0.4 C-0.62 0 -0.2 -0.2 0 -0.85 Z',
    fill: true,
  },
  slow: { d: 'M0 -0.8 L0 0.8 M-0.7 -0.4 L0.7 0.4 M-0.7 0.4 L0.7 -0.4', fill: false },
  stun: {
    d: 'M0 -0.85 L0.22 -0.28 L0.82 -0.26 L0.34 0.1 L0.52 0.7 L0 0.34 L-0.52 0.7 L-0.34 0.1 L-0.82 -0.26 L-0.22 -0.28 Z',
    fill: true,
  },
  shred: { d: 'M0 -0.8 L0.65 -0.5 L0.55 0.3 L0 0.8 L-0.55 0.3 L-0.65 -0.5 Z', fill: true },
};

export function StatusIconRow({
  icons,
  cx,
  cy,
  size,
}: {
  icons: readonly StatusIcon[];
  /** Row centre, board units. */
  cx: number;
  cy: number;
  /** Icon diameter, board units. */
  size: number;
}) {
  if (icons.length === 0) return null;
  const gap = size * 0.2;
  const width = icons.length * size + (icons.length - 1) * gap;
  const r = size / 2;
  const k = r * 0.78;
  return (
    <G>
      {icons.map((icon, i) => {
        const x = cx - width / 2 + r + i * (size + gap);
        const glyph = GLYPH[icon.kind];
        // Two shapes per icon (disc + glyph); the stack count only when > 1.
        return (
          <G key={icon.kind}>
            <Circle cx={x} cy={cy} r={r} fill="rgba(0,0,0,0.6)" />
            <Path
              transform={`translate(${x} ${cy}) scale(${k})`}
              d={glyph.d}
              fill={glyph.fill ? icon.color : 'none'}
              stroke={glyph.fill ? 'none' : icon.color}
              strokeWidth={glyph.fill ? 0 : 0.26}
              strokeLinecap="round"
            />
            {icon.count > 1 ? (
              <SvgText
                x={x + r * 0.95}
                y={cy + r * 1.05}
                fontSize={size * 0.6}
                fontFamily="SpaceMono_700Bold"
                fill="#FFFFFF"
                textAnchor="middle">
                {String(icon.count)}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </G>
  );
}

/** The creep's weakness colour as a small diamond at the left end of its
 * health bar (replaces the old outline ring). */
export function WeaknessDiamond({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const h = size / 2;
  return (
    <Path
      d={`M${x} ${y - h} L${x + h} ${y} L${x} ${y + h} L${x - h} ${y} Z`}
      fill={color}
      stroke="rgba(0,0,0,0.6)"
      strokeWidth={0.25}
    />
  );
}
