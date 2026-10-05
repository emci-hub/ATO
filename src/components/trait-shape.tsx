import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { useAppearance } from '@/lib/theme/context';
import { shapeGeometry, type ShapePoint } from '@/lib/trait-shape';
import type { TraitAxis } from '@/lib/traits';

/**
 * "Your shape" (lib/trait-shape.ts): the profile as one figure. Used as the
 * Explore hero, the badge on You, the small one on Questions and on the share
 * card. No numbers anywhere on it. Draws in on mount (scale + fade) unless
 * Reduce Motion is on, or `animate` is false (the captured share image).
 */
export function TraitShape({
  points,
  size,
  labels = false,
  animate = true,
  selected,
  onPressAxis,
  palette,
}: {
  points: readonly ShapePoint[];
  size: number;
  /** Trait names around the edge (Explore hero only — needs ~260px). */
  labels?: boolean;
  animate?: boolean;
  selected?: TraitAxis | null;
  onPressAxis?: (axis: TraitAxis) => void;
  /** Fixed colours for surfaces that are not themed (the share card). */
  palette?: { line: string; grid: string; label: string };
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const line = palette?.line ?? theme.accent;
  const grid = palette?.grid ?? theme.border;
  const label = palette?.label ?? theme.textSecondary;
  const outer = labels ? size * 0.25 : size * 0.44;
  const geo = shapeGeometry(points, size, outer);
  const small = size < 72;

  const still = reduceMotion || !animate;
  const scale = useSharedValue(still ? 1 : 0.55);
  const opacity = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    opacity.value = withTiming(1, { duration: 320 });
    scale.value = withDelay(60, withSpring(1, { damping: 12, stiffness: 140 }));
  }, [still, scale, opacity]);
  const drawn = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Your shape">
      <Animated.View style={[StyleSheet.absoluteFill, drawn]}>
        <Svg width={size} height={size}>
          <Circle cx={geo.cx} cy={geo.cy} r={geo.outer} fill="none" stroke={grid} strokeWidth={1} />
          <Circle
            cx={geo.cx}
            cy={geo.cy}
            r={geo.mid}
            fill="none"
            stroke={grid}
            strokeWidth={1}
            strokeDasharray={small ? '2 2' : '3 3'}
          />
          {small
            ? null
            : geo.coords.map((c) => (
                <Line
                  key={`g-${c.axis}`}
                  x1={geo.cx}
                  y1={geo.cy}
                  x2={c.edgeX}
                  y2={c.edgeY}
                  stroke={grid}
                  strokeWidth={0.75}
                />
              ))}
          {geo.path ? (
            <Path
              d={geo.path}
              fill={line}
              fillOpacity={0.16}
              stroke={line}
              strokeWidth={small ? 1.25 : 2}
              strokeLinejoin="round"
            />
          ) : null}
          {geo.coords.map((c) =>
            c.state === 'blank' ? null : c.state === 'settled' ? (
              <Circle key={`p-${c.axis}`} cx={c.x} cy={c.y} r={small ? 1.8 : 3.5} fill={line} />
            ) : (
              <Circle
                key={`p-${c.axis}`}
                cx={c.x}
                cy={c.y}
                r={small ? 1.6 : 3.2}
                fill={palette ? 'none' : theme.backgroundElement}
                stroke={line}
                strokeWidth={small ? 1 : 1.5}
              />
            ),
          )}
          {selected
            ? geo.coords
                .filter((c) => c.axis === selected)
                .map((c) => (
                  <Circle
                    key="sel"
                    cx={c.x}
                    cy={c.y}
                    r={8}
                    fill="none"
                    stroke={theme.accentSecondary}
                    strokeWidth={2}
                  />
                ))
            : null}
          {labels
            ? geo.coords.map((c) => {
                const dx = c.edgeX - geo.cx;
                const anchor = dx < -4 ? 'end' : dx > 4 ? 'start' : 'middle';
                const lx = geo.cx + (c.edgeX - geo.cx) * 1.1;
                const ly = geo.cy + (c.edgeY - geo.cy) * 1.1 + 3.5;
                return (
                  <SvgText
                    key={`l-${c.axis}`}
                    x={lx}
                    y={ly}
                    fontSize={9.5}
                    fill={c.axis === selected ? theme.text : label}
                    fontWeight={c.axis === selected ? '700' : '400'}
                    textAnchor={anchor}>
                    {AXIS_SHORT_NAME[c.axis]}
                  </SvgText>
                );
              })
            : null}
        </Svg>
      </Animated.View>
      {onPressAxis
        ? geo.coords.map((c) => {
            // On the labelled hero the targets sit on the name ring, where the
            // spokes are furthest apart, so neighbours don't overlap.
            const hx = labels ? geo.cx + (c.edgeX - geo.cx) * 1.15 : c.x;
            const hy = labels ? geo.cy + (c.edgeY - geo.cy) * 1.15 : c.y;
            return (
              <Pressable
                key={`t-${c.axis}`}
                accessibilityRole="button"
                accessibilityLabel={AXIS_SHORT_NAME[c.axis]}
                onPress={() => onPressAxis(c.axis)}
                hitSlop={4}
                style={[styles.hit, { left: hx - HIT / 2, top: hy - HIT / 2 }]}
              />
            );
          })
        : null}
    </View>
  );
}

const HIT = 26;

const styles = StyleSheet.create({
  hit: { position: 'absolute', width: HIT, height: HIT },
});
