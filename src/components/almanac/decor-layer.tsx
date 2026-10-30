import { Image as ExpoImage } from 'expo-image';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, type ImageStyle } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { ART, getArtSource } from '@/art/art';
import { useMotionActive } from '@/hooks/use-motion-active';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import {
  LOOPS,
  REDUCE_MOTION_FRAME_STEP,
  REDUCE_MOTION_SPEED,
  particleOpacity,
  reducedDecorCount,
  type DecorKey,
  type Look,
  type LoopKey,
  type StickerKey,
} from '@/lib/almanac/look';
import { pixelRenderStyle } from '@/play/pixel-theme';

/** Literal accessors on purpose: the art registry only counts a literal `ART.…` mention as use. */
const LOOP_ART: Record<LoopKey, string> = {
  snow: ART.fx.almanacSnow.snow64,
  leaf: ART.fx.almanacLeaf.leaf64,
  petal: ART.fx.almanacPetal.petal64,
  candle: ART.fx.almanacCandle.candle64,
  firework: ART.fx.almanacFirework.firework64,
  'lantern-glow': ART.fx.almanacLanternGlow.lanternGlow64,
};

const DECOR_ART: Record<DecorKey, string> = {
  crescent: ART.icon.almanacDecor.crescent,
  diya: ART.icon.almanacDecor.diya,
  egg: ART.icon.almanacDecor.egg,
  firework: ART.icon.almanacDecor.firework,
  lantern: ART.icon.almanacDecor.lantern,
  petal: ART.icon.almanacDecor.petal,
  pumpkin: ART.icon.almanacDecor.pumpkin,
  snowflake: ART.icon.almanacDecor.snowflake,
  star: ART.icon.almanacDecor.star,
  wreath: ART.icon.almanacDecor.wreath,
};

const STICKER_ART: Record<StickerKey, string> = {
  clockChange: ART.icon.almanacStickers.clockChange,
  equinox: ART.icon.almanacStickers.equinox,
  firstSnow: ART.icon.almanacStickers.firstSnow,
  friday13th: ART.icon.almanacStickers.friday13th,
  fullMoon: ART.icon.almanacStickers.fullMoon,
  glow30: ART.icon.almanacStickers.glow30,
  halfYear: ART.icon.almanacStickers.halfYear,
  oneYearAgo: ART.icon.almanacStickers.oneYearAgo,
  paydayFriday: ART.icon.almanacStickers.paydayFriday,
  pick100: ART.icon.almanacStickers.pick100,
  smallMoment: ART.icon.almanacStickers.smallMoment,
  month01: ART.icon.almanacStickers.month01,
  month02: ART.icon.almanacStickers.month02,
  month03: ART.icon.almanacStickers.month03,
  month04: ART.icon.almanacStickers.month04,
  month05: ART.icon.almanacStickers.month05,
  month06: ART.icon.almanacStickers.month06,
  month07: ART.icon.almanacStickers.month07,
  month08: ART.icon.almanacStickers.month08,
  month09: ART.icon.almanacStickers.month09,
  month10: ART.icon.almanacStickers.month10,
  month11: ART.icon.almanacStickers.month11,
  month12: ART.icon.almanacStickers.month12,
};

const PIXEL = pixelRenderStyle as unknown as ImageStyle;
const FRAME_PX = 64;
const ICON_PT = 32;
const STICKER_PT = 28;

/**
 * The Almanac's decor over the hero (PHASE-11h): ONE sprite-sheet particle layer
 * on this screen's single frame callback (M13: no per-flake nodes), a static ring
 * of decor icons (`round(12 × intensity)` of them), and one sticker. The only
 * animated node is the sheet layer; the ring and sticker are still images.
 *
 * Reduce Motion is gentle, never still: half the ring, a half-strength layer at a
 * quarter of the speed on every 3rd frame (the breath on the hero itself comes from
 * `Appear breathe`). The clock pauses when the screen is unfocused or backgrounded.
 */
export function DecorLayer({ look, size }: { look: Look; size: number }) {
  const rm = useMotionReduced();
  const count = rm ? reducedDecorCount(look.decorCount) : look.decorCount;
  const loop = look.event?.loop ?? null;
  return (
    <View
      pointerEvents="none"
      style={styles.fill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {loop ? <ParticleLayer loop={loop} size={size} opacity={particleOpacity(look.intensity, rm)} rm={rm} /> : null}
      {look.event && count > 0 ? <DecorRing keys={look.event.decor} count={count} size={size} /> : null}
      <Sticker name={look.sticker} micro={look.stickerIsMicro} />
    </View>
  );
}

/** Memoised: a re-render re-registers the frame callback and the loop would restart at frame 0. */
const ParticleLayer = memo(function ParticleLayer({
  loop,
  size,
  opacity,
  rm,
}: {
  loop: LoopKey;
  size: number;
  opacity: number;
  rm: boolean;
}) {
  const active = useMotionActive();
  const sheet = LOOPS[loop];
  const source = getArtSource(LOOP_ART[loop]);
  const layer = Math.floor(size / FRAME_PX) * FRAME_PX;
  const inset = (size - layer) / 2;
  const frame = useSharedValue(0);
  const visible = useSharedValue(1);

  const speed = rm ? REDUCE_MOTION_SPEED : 1;
  const stride = rm ? REDUCE_MOTION_FRAME_STEP : 1;
  const loopTicks = sheet.frames + (sheet.rest ?? 0);
  const { frames, ms } = sheet;
  const tick = useFrameCallback((info) => {
    'worklet';
    const n = Math.floor((info.timeSinceFirstFrame * speed) / ms);
    const i = (n * stride) % loopTicks;
    frame.value = i % frames;
    visible.value = i < frames ? 1 : 0;
  }, false);
  useEffect(() => {
    tick.setActive(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: visible.value * opacity,
    transform: [
      { translateX: -(frame.value % sheet.cols) * layer },
      { translateY: -Math.floor(frame.value / sheet.cols) * layer },
    ],
  }));
  if (!source) return null;
  return (
    <View style={[styles.clip, { left: inset, top: inset, width: layer, height: layer }]}>
      <Animated.View style={[{ width: sheet.cols * layer, height: sheet.rows * layer }, sheetStyle]}>
        <ExpoImage source={source} contentFit="fill" transition={0} style={[styles.fill, PIXEL]} />
      </Animated.View>
    </View>
  );
});

function DecorRing({ keys, count, size }: { keys: readonly DecorKey[]; count: number; size: number }) {
  const radius = size / 2 - ICON_PT / 2 - 2;
  const spots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
        return {
          key: keys[i % keys.length],
          left: size / 2 + radius * Math.cos(angle) - ICON_PT / 2,
          top: size / 2 + radius * Math.sin(angle) - ICON_PT / 2,
        };
      }),
    [keys, count, size, radius],
  );
  return (
    <>
      {spots.map((s, i) => {
        const source = getArtSource(DECOR_ART[s.key]);
        return source ? (
          <ExpoImage
            key={i}
            source={source}
            contentFit="contain"
            transition={0}
            style={[{ position: 'absolute', left: s.left, top: s.top, width: ICON_PT, height: ICON_PT }, PIXEL]}
          />
        ) : null;
      })}
    </>
  );
}

function Sticker({ name, micro }: { name: StickerKey; micro: boolean }) {
  const source = getArtSource(STICKER_ART[name]);
  if (!source) return null;
  return (
    <ExpoImage
      source={source}
      contentFit="contain"
      transition={0}
      style={[styles.sticker, { opacity: micro ? 1 : 0.55 }, PIXEL]}
    />
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  clip: { position: 'absolute', overflow: 'hidden' },
  sticker: { position: 'absolute', right: 0, top: 0, width: STICKER_PT, height: STICKER_PT },
});
