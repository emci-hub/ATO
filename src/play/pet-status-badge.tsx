/**
 * The one pet status badge (pet team roadmap P2): star row + grade-colour frame + shiny mark.
 *
 *   'strip'  — Hideout name tag: stars · grade word · ✨ in a framed chip (one fixed row).
 *   'detail' — Den card header: the same chip, a touch larger.
 *   'mini'   — Den grid tile: just the star row (colour = grade); the word lives in the detail bar.
 *
 * Every size draws exactly `STAR_MAX` star glyphs, so a 1★ and a 5★ pet take the same room (fixed regions).
 * Data comes from `petStatusView()` (`pet-status-view.ts`); this file only draws it.
 */
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import type { PetStatusView } from '@/play/pet-status-view';

type Variant = 'strip' | 'detail' | 'mini';

const SIZE: Record<Variant, { star: number; word: number }> = {
  strip: { star: 9, word: 10 },
  detail: { star: 12, word: 11 },
  mini: { star: 8, word: 0 },
};

export function PetStatusBadge({
  status,
  variant,
  wordFont,
}: {
  status: PetStatusView;
  variant: Variant;
  /** The screen's own label font (the strip is pixel-font, the Den is mono). */
  wordFont?: TextStyle['fontFamily'];
}) {
  const size = SIZE[variant];
  const stars = (
    <Text
      style={[styles.stars, { color: status.color, fontSize: size.star, lineHeight: size.star + 3 }]}
      numberOfLines={1}
      maxFontSizeMultiplier={1.2}>
      {status.starText}
    </Text>
  );
  if (variant === 'mini') {
    return (
      <View accessible accessibilityLabel={status.label} style={styles.mini}>
        {stars}
      </View>
    );
  }
  const word: StyleProp<TextStyle> = [
    styles.word,
    { color: status.color, fontSize: size.word, lineHeight: size.word + 3 },
    wordFont ? { fontFamily: wordFont } : null,
  ];
  return (
    <View accessible accessibilityLabel={status.label} style={[styles.chip, { borderColor: status.color }]}>
      {stars}
      <Text style={word} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {status.gradeLabel}
        {status.shiny ? ' ✨' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    // The star row keeps its width; the grade word is what gives way on a narrow strip.
    flexShrink: 1,
    minWidth: 0,
    gap: 4,
    borderWidth: 2,
    paddingHorizontal: 4,
    paddingVertical: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  mini: { height: 11, alignItems: 'center', justifyContent: 'center' },
  stars: { includeFontPadding: false, flexShrink: 0 },
  word: { textTransform: 'uppercase', includeFontPadding: false, flexShrink: 1, minWidth: 0 },
});
