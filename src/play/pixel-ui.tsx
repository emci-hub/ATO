/**
 * Neon pixel UI kit (Divecore phase 1).
 *
 * Ink panels, a 1-art-px cyan border with the corner pixel cut out (stepped,
 * not a rounded blur), cyan primary buttons and an amber Surface button.
 * Press feedback is a short squash on the UI thread while ambient motion is
 * on (Effects full, Reduce Motion off). Otherwise it stays an opacity press.
 * Fonts load from the OFL files in assets/play/fonts.
 */
import { useFonts } from 'expo-font';
import { Image, type ImageProps } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useFxQuality } from '@/play/fx-quality';
import { usePlayReduceMotion } from '@/play/play-motion';
import {
  ART_PT,
  PIXEL,
  PIXEL_BODY_PT,
  PIXEL_FONT,
  PIXEL_LABEL_PT,
  PIXEL_TAP_PT,
  crispSpan,
  pixelRenderStyle,
} from '@/play/pixel-theme';

/** Scene juice and UI juice share one gate: full effects, motion allowed. */
function useAmbientOn(): boolean {
  const quality = useFxQuality();
  const reduceMotion = usePlayReduceMotion();
  return quality === 'full' && !reduceMotion;
}

function usePressSquash(enabled: boolean) {
  const squish = useSharedValue(1);
  const onPressIn = () => {
    if (!enabled) return;
    squish.value = withTiming(0.94, { duration: 70, easing: Easing.out(Easing.quad) });
  };
  const onPressOut = () => {
    squish.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
  };
  const style = useAnimatedStyle(() => ({ transform: [{ scale: squish.value }] }));
  return { onPressIn, onPressOut, style };
}

export { pixelRenderStyle };

/** Load Tiny5 (labels) and Inter Regular (body). Safe to call from each screen. */
export function usePixelFonts(): boolean {
  const [loaded, error] = useFonts({
    Tiny5_Regular: require('@/assets/play/fonts/Tiny5-Regular.ttf'),
    Inter_400Regular: require('@/assets/play/fonts/Inter-Regular.ttf'),
  });
  return loaded || !!error;
}

type FrameProps = {
  children?: ReactNode;
  fill?: string;
  border?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Stretch left-aligns panel rows; center is for buttons and nameplates. */
  align?: 'center' | 'stretch';
  minHeight?: number;
  /** Slide up once when ambient motion is on. Holds in place when it is off. */
  enter?: boolean;
  /** Soft cyan glow pulse. Only runs for the primary action while motion is on. */
  pulse?: boolean;
};

/**
 * Ink (or any fill) with a 1-art-px border. The four corner pixels are left
 * empty so the corner steps instead of rounding.
 */
export function PixelFrame({
  children,
  fill = PIXEL.ink,
  border = PIXEL.cyan,
  style,
  padded = true,
  align = 'center',
  minHeight,
  enter = false,
  pulse = false,
}: FrameProps) {
  const alive = useAmbientOn();
  const enterT = useSharedValue(1);
  const glow = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(enterT);
    if (!enter || !alive) {
      enterT.value = 1;
      return;
    }
    enterT.value = 0;
    enterT.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(enterT);
  }, [alive, enter, enterT]);
  useEffect(() => {
    cancelAnimation(glow);
    glow.value = 0;
    if (!pulse || !alive) return;
    glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(glow);
  }, [alive, glow, pulse]);
  const motion = useAnimatedStyle(() => ({
    opacity: enterT.value,
    transform: [{ translateY: (1 - enterT.value) * 12 }],
    shadowColor: border,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: pulse && alive ? 0.28 + glow.value * 0.5 : 0,
    shadowRadius: 6 + glow.value * 6,
  }));
  const b = ART_PT;
  return (
    <Animated.View style={[{ minHeight }, style, motion]}>
      <View
        style={{
          margin: b,
          backgroundColor: fill,
          padding: padded ? b * 2 : 0,
          minHeight: minHeight != null ? Math.max(0, minHeight - b * 2) : undefined,
          alignItems: align === 'stretch' ? 'stretch' : 'center',
          justifyContent: 'center',
        }}>
        {children}
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: b, right: b, height: b, backgroundColor: border }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: b, right: b, height: b, backgroundColor: border }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: b, bottom: b, width: b, backgroundColor: border }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: b, bottom: b, width: b, backgroundColor: border }} />
    </Animated.View>
  );
}

export function PixelLabel({
  children,
  color = PIXEL.text,
  style,
  numberOfLines,
  accessibilityRole,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      style={[
        {
          fontFamily: PIXEL_FONT.label,
          fontSize: PIXEL_LABEL_PT,
          lineHeight: PIXEL_LABEL_PT,
          color,
          textTransform: 'uppercase',
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function PixelBody({
  children,
  color = PIXEL.body,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: PIXEL_FONT.body,
          fontSize: PIXEL_BODY_PT,
          lineHeight: 22,
          color,
        },
        style,
      ]}>
      {children}
    </Text>
  );
}

export type PixelButtonVariant = 'cyan' | 'amber' | 'muted';

/** Cyan primary, amber Surface, muted when a control is off. At least 48pt. */
export function PixelButton({
  label,
  onPress,
  disabled = false,
  variant = 'cyan',
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: PixelButtonVariant;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const fill = variant === 'amber' ? PIXEL.amber : variant === 'muted' ? PIXEL.ink : PIXEL.cyan;
  const border = variant === 'muted' ? PIXEL.muted : fill;
  const text = variant === 'muted' ? PIXEL.muted : PIXEL.onFill;
  const alive = useAmbientOn();
  const squash = usePressSquash(alive && !disabled);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={squash.onPressIn}
      onPressOut={squash.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        { minHeight: PIXEL_TAP_PT, opacity: disabled ? 0.4 : alive ? 1 : pressed ? 0.82 : 1 },
        style,
      ]}>
      <Animated.View style={squash.style}>
        <PixelFrame
          fill={fill}
          border={border}
          align="stretch"
          minHeight={PIXEL_TAP_PT}
          pulse={variant === 'cyan' && !disabled}
          style={{ flexGrow: 1 }}>
          <PixelLabel color={text} numberOfLines={2} style={{ textAlign: 'center', alignSelf: 'stretch' }}>
            {label}
          </PixelLabel>
        </PixelFrame>
      </Animated.View>
    </Pressable>
  );
}

/** Name + status. Stepped cyan frame, no parchment and no speech tail. */
export function PixelNameplate({
  children,
  onPress,
  accessibilityLabel,
  style,
  /** False when the plate draws its own Tiny5 line (stars + a word). */
  label = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  label?: boolean;
}) {
  const alive = useAmbientOn();
  const squash = usePressSquash(!!onPress && alive);
  const plate = (
    <PixelFrame style={[{ minHeight: onPress ? PIXEL_TAP_PT : undefined }, style]}>
      {label ? (
        <PixelLabel numberOfLines={1} style={{ textAlign: 'center' }}>
          {children}
        </PixelLabel>
      ) : (
        children
      )}
    </PixelFrame>
  );
  if (!onPress) return plate;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={squash.onPressIn}
      onPressOut={squash.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ minHeight: PIXEL_TAP_PT, opacity: alive ? 1 : pressed ? 0.82 : 1 }]}>
      <Animated.View style={squash.style}>{plate}</Animated.View>
    </Pressable>
  );
}

const HEART_ROWS = [
  [1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
];

export function PixelHeart({ filled, color }: { filled: boolean; color?: string }) {
  const ink = filled ? (color ?? PIXEL.heart) : PIXEL.heartEmpty;
  // Two art pixels per sprite pixel so a 5px heart sits beside a Tiny5 cap.
  const p = ART_PT * 2;
  return (
    <View style={{ width: 5 * p, height: 5 * p }}>
      {HEART_ROWS.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <View
              key={`${x}-${y}`}
              style={{ position: 'absolute', left: x * p, top: y * p, width: p, height: p, backgroundColor: ink }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}

function HeartBump({ filled, color, token }: { filled: boolean; color?: string; token: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(scale);
    if (token === 0) {
      scale.value = 1;
      return;
    }
    scale.value = 1;
    scale.value = withSequence(withTiming(1.35, { duration: 90 }), withTiming(1, { duration: 160 }));
    return () => cancelAnimation(scale);
  }, [scale, token]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <PixelHeart filled={filled} color={color} />
    </Animated.View>
  );
}

export function PixelHearts({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const alive = useAmbientOn();
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  const prev = useRef(filled);
  const [tokens, setTokens] = useState<number[]>(() => Array.from({ length: max }, () => 0));
  useEffect(() => {
    if (prev.current === filled) return;
    const index = filled > prev.current ? filled - 1 : prev.current - 1;
    prev.current = filled;
    if (!alive || index < 0 || index >= max) return;
    setTokens((current) => {
      const next = current.length === max ? [...current] : Array.from({ length: max }, () => 0);
      next[index] = (next[index] ?? 0) + 1;
      return next;
    });
  }, [alive, filled, max]);
  return (
    <View style={{ flexDirection: 'row', gap: ART_PT }}>
      {Array.from({ length: max }, (_, i) => (
        <HeartBump key={i} filled={i < filled} color={color} token={alive ? (tokens[i] ?? 0) : 0} />
      ))}
    </View>
  );
}

/** Shown bust chance. Cells sit on the art grid; the number is Inter. */
export function PixelRisk({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const cells = 12;
  const filled = Math.round((clamped / 100) * cells);
  const cell = ART_PT * 4;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: ART_PT * 4 }}
      accessibilityLabel={`Risk ${clamped} percent`}>
      <PixelLabel>Risk</PixelLabel>
      <View style={{ flexDirection: 'row', gap: ART_PT }}>
        {Array.from({ length: cells }, (_, i) => (
          <View
            key={i}
            style={{ width: cell, height: ART_PT * 4, backgroundColor: i < filled ? PIXEL.amber : '#1C2433' }}
          />
        ))}
      </View>
      <PixelBody color={PIXEL.text}>{`${clamped}%`}</PixelBody>
    </View>
  );
}

type PixelImageProps = {
  source: ImageProps['source'] | undefined;
  /** Source bitmap width in art pixels. */
  sourceWidth: number;
  sourceHeight: number;
  /** Cap the 2pt scale when the bitmap would overflow its slot. */
  maxWidth?: number;
  maxHeight?: number;
  style?: StyleProp<ImageStyle>;
};

/** Pixel art at an integer scale, nearest-neighbour, no blur and no tint. */
export function PixelImage({ source, sourceWidth, sourceHeight, maxWidth, maxHeight, style }: PixelImageProps) {
  if (!source) return null;
  const width = crispSpan(sourceWidth, maxWidth);
  const height = crispSpan(sourceHeight, maxHeight);
  return (
    <Image
      source={source}
      contentFit="fill"
      transition={0}
      accessibilityIgnoresInvertColors
      style={[{ width, height, ...pixelRenderStyle }, style]}
    />
  );
}
