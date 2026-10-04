/**
 * Neon pixel UI kit.
 *
 * Panels, buttons and nameplates follow ui2.py: a 1-art-px border, stepped
 * corners (2px stair), a solid inner glow ring and a checker outer ring.
 * Buttons add an ink outline, a 1px top highlight and a 2px bottom shade.
 * Press feedback is a short squash on the UI thread while ambient motion is
 * on (Effects full, Reduce Motion off). Otherwise it stays an opacity press.
 * Departure Mono + Rajdhani SemiBold load before any pixel label paints.
 */
import { Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani';
import { useFonts } from 'expo-font';
import { Image, type ImageProps } from 'expo-image';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import Svg, { Path } from 'react-native-svg';

import { useFxQuality } from '@/play/fx-quality';
import { usePlayReduceMotion } from '@/play/play-motion';
import { AtlasSprite } from '@/play/pixel-atlas';
import {
  ART_PT,
  PIXEL,
  PIXEL_BODY_PT,
  PIXEL_CAPTION_PT,
  PIXEL_FONT,
  PIXEL_LABEL_PT,
  PIXEL_NUM_PT,
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

/** Load Departure Mono (labels) and Rajdhani SemiBold (body). Safe to call from each screen. */
export function usePixelFonts(): boolean {
  const [loaded, error] = useFonts({
    DepartureMono_Regular: require('@/assets/play/fonts/DepartureMono-Regular.otf'),
    Rajdhani_600SemiBold,
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
  /** Outer glow rings. Nameplates and slots turn this off, matching ui2. */
  glow?: boolean;
  /** Corner stair in art pixels. Panels and buttons use 2; haul slots use 1. */
  step?: number;
  /** Button bevel: ink outline, top highlight, bottom shade. No glow rings. */
  bevel?: 'cyan' | 'amber';
};

/** True when art pixel (x, y) sits inside a stepped rectangle. */
function inStepped(x: number, y: number, w: number, h: number, step: number): boolean {
  if (x < 0 || y < 0 || x >= w || y >= h || w <= 0 || h <= 0) return false;
  const s = Math.min(step, Math.floor((Math.min(w, h) - 1) / 2));
  const edge = Math.min(y, h - 1 - y);
  if (edge < s) {
    const n = s - edge;
    if (x < n || x >= w - n) return false;
  }
  return true;
}

/** One glow ring as a crisp path. Ring 2 is the checker dither from ui2. */
function ringPath(artW: number, artH: number, ring: number, step: number, checker: boolean): string {
  const W = artW + ring * 2;
  const H = artH + ring * 2;
  const parts: string[] = [];
  const s = ART_PT;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      // The ring is `ring` art px thick. Stairs only cut corners, they never add depth.
      if (Math.min(x, y, W - 1 - x, H - 1 - y) > ring) continue;
      if (!inStepped(x, y, W, H, step + ring)) continue;
      if (inStepped(x - ring, y - ring, artW, artH, step)) continue;
      if (checker && (x + y) % 2 !== 0) continue;
      parts.push(`M${x * s} ${y * s}h${s}v${s}h${-s}z`);
    }
  }
  return parts.join('');
}

function glowInk(border: string): string | null {
  const b = border.toLowerCase();
  if (b === PIXEL.cyan.toLowerCase()) return PIXEL.glow;
  if (b === PIXEL.amber.toLowerCase()) return PIXEL.glowAmber;
  return null;
}

/**
 * Ink (or any fill) with the mockup frame: 1-art-px border, 2px corner
 * stairs, and two outer glow rings (solid, then checker).
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
  glow = true,
  step = 2,
  bevel,
}: FrameProps) {
  const alive = useAmbientOn();
  const enterT = useSharedValue(1);
  const glowPulse = useSharedValue(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
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
    cancelAnimation(glowPulse);
    glowPulse.value = 0;
    if (!pulse || !alive) return;
    glowPulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(glowPulse);
  }, [alive, glowPulse, pulse]);
  const motion = useAnimatedStyle(() => ({
    opacity: enterT.value,
    transform: [{ translateY: (1 - enterT.value) * 12 }],
    shadowColor: bevel ? fill : border,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: pulse && alive ? 0.28 + glowPulse.value * 0.5 : 0,
    shadowRadius: 6 + glowPulse.value * 6,
  }));
  const px = ART_PT;
  const stair = Math.max(1, step);
  const artW = Math.max(1, Math.round(box.w / px));
  const artH = Math.max(1, Math.round(box.h / px));
  const glowCol = glow && !bevel ? glowInk(border) : null;
  const rings = useMemo(() => {
    if (!glowCol || artW < 4 || artH < 4) return null;
    return {
      solid: ringPath(artW, artH, 1, stair, false),
      checker: ringPath(artW, artH, 2, stair, true),
    };
  }, [artH, artW, glowCol, stair]);
  const edge = border;
  const hi = bevel === 'amber' ? PIXEL.amberHi : PIXEL.cyanHi;
  const lo = bevel === 'amber' ? PIXEL.amberLo : PIXEL.cyanLo;
  const outline = bevel ? PIXEL.ink : edge;
  const notch = stair * px;
  return (
    <Animated.View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }}
      style={[{ minHeight, overflow: 'visible' }, style, motion]}>
      {rings && glowCol ? (
        <Svg
          pointerEvents="none"
          width={box.w + px * 4}
          height={box.h + px * 4}
          style={{ position: 'absolute', left: -px * 2, top: -px * 2 }}>
          <Path d={rings.checker} fill={glowCol} />
          <Path d={rings.solid} fill={glowCol} />
        </Svg>
      ) : null}
      <View
        style={{
          margin: px,
          backgroundColor: fill,
          padding: padded ? px * 2 : 0,
          minHeight: minHeight != null ? Math.max(0, minHeight - px * 2) : undefined,
          alignItems: align === 'stretch' ? 'stretch' : 'center',
          justifyContent: 'center',
        }}>
        {bevel ? (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: px,
                right: px,
                height: px,
                backgroundColor: hi,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: px * 2,
                backgroundColor: lo,
              }}
            />
          </>
        ) : null}
        {children}
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: notch, right: notch, height: px, backgroundColor: outline }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: notch, right: notch, height: px, backgroundColor: outline }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: notch, bottom: notch, width: px, backgroundColor: outline }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: notch, bottom: notch, width: px, backgroundColor: outline }} />
      {stair >= 2 ? (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', left: px, top: px, width: px, height: px, backgroundColor: outline }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: px, top: px, width: px, height: px, backgroundColor: outline }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: px, bottom: px, width: px, height: px, backgroundColor: outline }} />
          <View pointerEvents="none" style={{ position: 'absolute', right: px, bottom: px, width: px, height: px, backgroundColor: outline }} />
        </>
      ) : null}
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
          lineHeight: PIXEL_LABEL_PT + 2,
          letterSpacing: 0,
          fontWeight: 'normal',
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
  size = 'md',
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** md is the coach sentence (19pt). sm is the secondary line (17pt). num is a count (21pt). */
  size?: 'md' | 'sm' | 'num';
}) {
  const fontSize = size === 'sm' ? PIXEL_CAPTION_PT : size === 'num' ? PIXEL_NUM_PT : PIXEL_BODY_PT;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: PIXEL_FONT.body,
          fontSize,
          lineHeight: fontSize + 3,
          letterSpacing: 0,
          fontWeight: 'normal',
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
  const border = variant === 'muted' ? PIXEL.muted : PIXEL.ink;
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
          bevel={variant === 'muted' ? undefined : variant}
          glow={false}
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

/** Name + status. Stepped frame with the glow rings off, matching the mockup nameplate. */
export function PixelNameplate({
  children,
  onPress,
  accessibilityLabel,
  style,
  /** False when the plate draws its own line (stars + a word). */
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
    <PixelFrame glow={false} style={[{ minHeight: onPress ? PIXEL_TAP_PT : undefined }, style]}>
      {label ? (
        <PixelLabel color={PIXEL.cyan} numberOfLines={1} style={{ textAlign: 'center' }}>
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

export function PixelHeart({ filled, partial }: { filled: boolean; partial?: boolean; color?: string }) {
  const frame = filled ? 'heart' : partial ? 'heart-part' : 'heart-empty';
  return <AtlasSprite atlas="room" frame={frame} />;
}

function HeartBump({ filled, partial, token }: { filled: boolean; partial?: boolean; token: number }) {
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
      <PixelHeart filled={filled} partial={partial} />
    </Animated.View>
  );
}

export function PixelHearts({
  value,
  max,
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const alive = useAmbientOn();
  const clamped = Math.max(0, Math.min(max, value));
  const full = Math.floor(clamped);
  const partial = clamped - full >= 0.25 && clamped - full < 0.85;
  const shown = partial ? full : Math.round(clamped);
  const prev = useRef(shown);
  const [tokens, setTokens] = useState<number[]>(() => Array.from({ length: max }, () => 0));
  useEffect(() => {
    if (prev.current === shown) return;
    const index = shown > prev.current ? shown - 1 : prev.current - 1;
    prev.current = shown;
    if (!alive || index < 0 || index >= max) return;
    setTokens((current) => {
      const next = current.length === max ? [...current] : Array.from({ length: max }, () => 0);
      next[index] = (next[index] ?? 0) + 1;
      return next;
    });
  }, [alive, max, shown]);
  return (
    <View style={{ flexDirection: 'row', gap: ART_PT }}>
      {Array.from({ length: max }, (_, i) => (
        <HeartBump
          key={i}
          filled={i < shown}
          partial={partial && i === full}
          token={alive ? (tokens[i] ?? 0) : 0}
        />
      ))}
    </View>
  );
}

/** Shown bust chance. One amber bar, the mockup's track and highlight. */
export function PixelRisk({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: ART_PT * 3 }}
      accessibilityLabel={`Risk ${clamped} percent`}>
      <PixelLabel color={PIXEL.amber}>Risk</PixelLabel>
      <View style={{ flex: 1, height: ART_PT * 7, backgroundColor: PIXEL.cyanLo, padding: ART_PT }}>
        <View style={{ flex: 1, backgroundColor: PIXEL.slot }}>
          <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: PIXEL.amber }}>
            <View style={{ height: ART_PT, backgroundColor: PIXEL.amberHi }} />
          </View>
        </View>
      </View>
      <PixelBody size="num" color={PIXEL.amber}>{`${clamped}%`}</PixelBody>
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
