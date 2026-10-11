/**
 * Streetwear menu chrome (emci 2026-10-11) — drawn only while the art style is
 * Streetwear (`artSkin()`), so Classic stays exactly as it was.
 *
 * The pieces are PixelLab art packed by `play-art-pack.ts --skin streetwear`
 * (`packSwUiKit`) into one atlas. Each is drawn as a 9-slice: the corners keep
 * their art pixels, the edges and middle stretch. Crops use percentages of the
 * cell, so no layout pass is needed; `onLayout` only shrinks the art when a box
 * is smaller than its corners.
 *
 * Font: Pixelify Sans (OFL, `assets/play/fonts/`) for titles, buttons and
 * labels. Body copy keeps the app's fonts.
 */
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import streetwearMeta from '@/assets/play/sheets/streetwear/meta.json';
import { artSkin } from '@/play/art-skin';
import { PLAY_SHEET_ART, PLAY_SHEETS } from '@/play/generated-play-sheets';
import { pixelRenderStyle } from '@/play/pixel-theme';

export type StreetPiece =
  | 'panel'
  | 'header'
  | 'back'
  | 'toggle'
  | 'chip-on'
  | 'chip-off'
  | 'button-primary'
  | 'button-primary-pressed'
  | 'button-secondary'
  | 'button-secondary-pressed'
  | 'button-danger'
  | 'button-danger-pressed';

type PieceMeta = { w: number; h: number; inset: [number, number, number, number]; scale: number };
const UI = (streetwearMeta as unknown as { ui: Record<StreetPiece, PieceMeta> }).ui;

/** Pixelify Sans faces (loaded by `useStreetFonts`). */
export const STREET_FONT = { regular: 'PixelifySans_Regular', bold: 'PixelifySans_Bold' } as const;

/** Street palette (asphalt / off-white / mustard / tag red). */
export const STREET = {
  ink: '#1A1A1D',
  asphalt: '#2B2B2E',
  paper: '#F2EDE4',
  muted: '#A1A1AA',
  mustard: '#E0A526',
  red: '#E5484D',
} as const;

/** True while the Streetwear art style is on (re-read on each render). */
export function streetUiOn(): boolean {
  return artSkin() === 'streetwear';
}

/** Load Pixelify Sans. Safe to call from every street component (cached). */
export function useStreetFonts(): boolean {
  const [loaded, error] = useFonts({
    [STREET_FONT.regular]: require('@/assets/play/fonts/PixelifySans-Regular.ttf'),
    [STREET_FONT.bold]: require('@/assets/play/fonts/PixelifySans-Bold.ttf'),
  });
  return loaded || !!error;
}

/** Button art for a variant + pressed state. */
export function streetButtonPiece(variant: 'primary' | 'secondary' | 'danger', pressed: boolean): StreetPiece {
  return `button-${variant}${pressed ? '-pressed' : ''}` as StreetPiece;
}

/** Text colour that reads on a button face. */
export function streetButtonText(variant: 'primary' | 'secondary' | 'danger'): string {
  return variant === 'primary' ? STREET.ink : STREET.paper;
}

/** One crop of the piece's image, stretched to fill its cell. */
function Cell({
  piece,
  sx,
  sy,
  sw,
  sh,
  style,
}: {
  piece: StreetPiece;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  style: ViewStyle;
}) {
  const key = `sheets/streetwear/ui-kit/${piece}`;
  const sheet = PLAY_SHEETS[key];
  const rect = sheet?.frames.img;
  const source = PLAY_SHEET_ART[key];
  if (!sheet || !rect || !source || sw <= 0 || sh <= 0) return <View style={style} />;
  return (
    <View style={[style, styles.cell]}>
      <Image
        source={source}
        contentFit="fill"
        transition={0}
        style={{
          ...pixelRenderStyle,
          position: 'absolute',
          width: `${(sheet.sheetW / sw) * 100}%`,
          height: `${(sheet.sheetH / sh) * 100}%`,
          left: `${(-(rect.x + sx) / sw) * 100}%`,
          top: `${(-(rect.y + sy) / sh) * 100}%`,
        }}
      />
    </View>
  );
}

/** The 9-slice art, absolutely filling its parent (draw it first, behind). */
export function StreetBackdrop({ piece }: { piece: StreetPiece }) {
  const meta = UI[piece];
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (!meta) return null;
  const [t, r, b, l] = meta.inset;
  // Shrink the corners when the box is smaller than them (a short chip).
  const fit = Math.min(
    meta.scale,
    box.h > 0 && t + b > 0 ? (box.h * 0.98) / (t + b) : meta.scale,
    box.w > 0 && l + r > 0 ? (box.w * 0.98) / (l + r) : meta.scale,
  );
  const midW = meta.w - l - r;
  const midH = meta.h - t - b;
  const row = (sy: number, sh: number, height: number | undefined) => (
    <View style={[styles.row, height == null ? styles.grow : { height }]}>
      {l > 0 ? <Cell piece={piece} sx={0} sy={sy} sw={l} sh={sh} style={{ width: l * fit }} /> : null}
      <Cell piece={piece} sx={l} sy={sy} sw={midW} sh={sh} style={styles.grow} />
      {r > 0 ? <Cell piece={piece} sx={meta.w - r} sy={sy} sw={r} sh={sh} style={{ width: r * fit }} /> : null}
    </View>
  );
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }}>
      {t > 0 ? row(0, t, t * fit) : null}
      {row(t, midH, undefined)}
      {b > 0 ? row(meta.h - b, b, b * fit) : null}
    </View>
  );
}

/** A box drawn with a street piece behind its children. */
export function StreetFrame({
  piece = 'panel',
  children,
  style,
}: {
  piece?: StreetPiece;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.frame, style]}>
      <StreetBackdrop piece={piece} />
      {children}
    </View>
  );
}

/** Natural drawn size of an unsliced piece (the back button, the toggle). */
export function streetPieceSize(piece: StreetPiece): { width: number; height: number } {
  const meta = UI[piece];
  return meta ? { width: Math.round(meta.w * meta.scale), height: Math.round(meta.h * meta.scale) } : { width: 0, height: 0 };
}

const styles = StyleSheet.create({
  frame: { position: 'relative', backgroundColor: 'transparent' },
  row: { flexDirection: 'row' },
  grow: { flex: 1 },
  cell: { overflow: 'hidden' },
});
