import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, View, type ImageStyle } from 'react-native';

import { ART, getArtSource } from '@/art/art';
import type { Look, SprigKey } from '@/lib/almanac/look';
import { SPRIG_MAX, SPRIG_MIN } from '@/lib/almanac/look';
import { pixelRenderStyle } from '@/play/pixel-theme';

/** Literal accessors on purpose: the art registry only counts a literal `ART.…` mention as use. */
const SPRIG_ART: Record<SprigKey, string> = {
  christmas: ART.icon.almanacSprigs.christmas,
  diwali: ART.icon.almanacSprigs.diwali,
  easter: ART.icon.almanacSprigs.easter,
  eidAlFitr: ART.icon.almanacSprigs.eidAlFitr,
  halloween: ART.icon.almanacSprigs.halloween,
  lunarNewYear: ART.icon.almanacSprigs.lunarNewYear,
  mothersDay: ART.icon.almanacSprigs.mothersDay,
  newYear: ART.icon.almanacSprigs.newYear,
  summer: ART.icon.almanacSprigs.summer,
  thanksgiving: ART.icon.almanacSprigs.thanksgiving,
  valentines: ART.icon.almanacSprigs.valentines,
  winterSolstice: ART.icon.almanacSprigs.winterSolstice,
};

const PIXEL = pixelRenderStyle as unknown as ImageStyle;
const SPRIG_PT = 64;

/**
 * Two corner sprigs while an event is approaching or fading (intensity 0.1–0.4;
 * above that the decor ring takes over). Still images, drawn at 64 px on the
 * 32 px ladder; the second is the first mirrored, bottom-right.
 */
export function EdgeSprigs({ look }: { look: Look }) {
  const key = look.event?.sprig;
  if (!key || !look.sprigOn) return null;
  const source = getArtSource(SPRIG_ART[key]);
  if (!source) return null;
  // 0.1 → 0.55, 0.4 → 1: the band's own ramp, no second intensity curve.
  const opacity = 0.55 + 0.45 * ((look.intensity - SPRIG_MIN) / (SPRIG_MAX - SPRIG_MIN));
  return (
    <View
      pointerEvents="none"
      style={styles.fill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <ExpoImage source={source} contentFit="contain" transition={0} style={[styles.sprig, styles.topLeft, { opacity }, PIXEL]} />
      <ExpoImage
        source={source}
        contentFit="contain"
        transition={0}
        style={[styles.sprig, styles.bottomRight, { opacity }, PIXEL]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  sprig: { position: 'absolute', width: SPRIG_PT, height: SPRIG_PT },
  topLeft: { left: 0, top: 0 },
  bottomRight: { right: 0, bottom: 0, transform: [{ rotate: '180deg' }] },
});
