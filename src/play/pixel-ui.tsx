/**
 * Neon pixel UI kit (Divecore phase 1).
 *
 * Ink panels, a 1-art-px cyan border with the corner pixel cut out (stepped,
 * not a rounded blur), cyan primary buttons and an amber Surface button.
 * Press feedback is opacity only — nothing scales or slides, so Reduce Motion
 * stays still. Fonts load from the OFL files in assets/play/fonts.
 */
import { useFonts } from 'expo-font';
import { Image, type ImageProps } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, Text, View, type ImageStyle, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

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
}: FrameProps) {
  const b = ART_PT;
  return (
    <View style={[{ minHeight }, style]}>
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
    </View>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [{ minHeight: PIXEL_TAP_PT, opacity: disabled ? 0.4 : pressed ? 0.82 : 1 }, style]}>
      <PixelFrame fill={fill} border={border} align="stretch" minHeight={PIXEL_TAP_PT} style={{ flexGrow: 1 }}>
        <PixelLabel color={text} numberOfLines={2} style={{ textAlign: 'center', alignSelf: 'stretch' }}>
          {label}
        </PixelLabel>
      </PixelFrame>
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
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ minHeight: PIXEL_TAP_PT, opacity: pressed ? 0.82 : 1 }]}>
      {plate}
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

export function PixelHearts({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const filled = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <View style={{ flexDirection: 'row', gap: ART_PT }}>
      {Array.from({ length: max }, (_, i) => (
        <PixelHeart key={i} filled={i < filled} color={color} />
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
