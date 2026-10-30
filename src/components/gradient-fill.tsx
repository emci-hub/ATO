import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * A gradient that fills its parent (buttons, bars, tiles). Drawn with SVG: the
 * app has no expo-linear-gradient. `angle` follows CSS (135 = top-left to
 * bottom-right). Decorative, so it is hidden from screen readers and never
 * takes touches. Static: it has no motion of its own, so it needs no Reduce
 * Motion branch.
 */
export function GradientFill({
  colors,
  stops,
  opacities,
  type = 'linear',
  angle = 135,
  borderRadius = 0,
  style,
}: {
  colors: readonly string[];
  /** 0..1 per colour; default: evenly spaced. */
  stops?: readonly number[];
  /** 0..1 per colour: fade out with the SAME colour (a 'transparent' stop would blend toward black). */
  opacities?: readonly number[];
  type?: 'linear' | 'radial';
  angle?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const id = `gf${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const last = Math.max(colors.length - 1, 1);
  const rad = ((angle - 90) * Math.PI) / 180;
  const dx = Math.cos(rad) / 2;
  const dy = Math.sin(rad) / 2;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          {type === 'radial' ? (
            <RadialGradient id={id} cx="50%" cy="50%" r="50%">
              {colors.map((c, i) => (
                <Stop key={i} offset={stops?.[i] ?? i / last} stopColor={c} stopOpacity={opacities?.[i] ?? 1} />
              ))}
            </RadialGradient>
          ) : (
            <LinearGradient id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
              {colors.map((c, i) => (
                <Stop key={i} offset={stops?.[i] ?? i / last} stopColor={c} stopOpacity={opacities?.[i] ?? 1} />
              ))}
            </LinearGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
