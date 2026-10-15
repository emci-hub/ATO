/**
 * Daily visitors — what you see (roadmap step 4, plan approved by emci 2026-10-15).
 *
 *  - `DailyVisitorActor`: the visitor standing in the Hideout room (stage region), idling on its own
 *    room-ready idle clip, a "!" over its head until you say hi. Drawn inside the room layer, so it
 *    never resizes a region; its hit box is the figure, not the whole sprite cell.
 *  - `VisitorCard`: the float-layer card a tap opens (the away card's shape: fixed boxes, outside
 *    tap / Android back / the button close it, Reduce Motion = a gentle fade).
 *  - `StickerBook`: the 14 stickers at the top of Info → Style (have = the sticker, not yet = a
 *    dark outline).
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { ART, getArtSource } from '@/art/art';
import { VISITOR_LOOK_AT, hasSticker, stickerCount, type VisitorBook, type VisitorReward } from '@/play/daily-visitors';
import { VISITOR_LINES, VISITOR_UI } from '@/play/daily-visitors-bank';
import { VISITOR_STICKER_HEROES, VISITOR_TINT_COLOR } from '@/play/daily-visitors-roster';
import { heroName } from '@/play/heroes-data';
import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { noticeReduceMotion } from '@/play/notify/notify';
import { petFrameAt, petKitOfRole, petPose } from '@/play/pet-actor';
import { poseDrawable, usePetClock } from '@/play/pet-anim-sprite';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { ClipImage } from '@/play/sheet-sprite';
import { heroAvatarRole, roleFootAt } from '@/play/skin';
import { STREET, STREET_FONT, useStreetFonts } from '@/play/street-ui';

/* ----------------------------------------------------------- stickers --- */

/** Each visitor's sticker (art library, stickers set — baked from the hero's front frame by art:bake-stickers). */
export const VISITOR_STICKER_ART: Readonly<Record<string, ImageSourcePropType | undefined>> = {
  kael: getArtSource(ART.icon.stickers.streetwear.kael),
  kitsune: getArtSource(ART.icon.stickers.streetwear.kitsune),
  corvus: getArtSource(ART.icon.stickers.streetwear.corvus),
  'neon-viper': getArtSource(ART.icon.stickers.streetwear.neonViper),
  archangel: getArtSource(ART.icon.stickers.streetwear.archangel),
  oni: getArtSource(ART.icon.stickers.streetwear.oni),
  elowen: getArtSource(ART.icon.stickers.streetwear.elowen),
  maldrath: getArtSource(ART.icon.stickers.streetwear.maldrath),
  'cyber-shinobi': getArtSource(ART.icon.stickers.streetwear.cyberShinobi),
  raven: getArtSource(ART.icon.stickers.streetwear.raven),
  'frost-lich': getArtSource(ART.icon.stickers.streetwear.frostLich),
  sak: getArtSource(ART.icon.stickers.streetwear.sak),
  velkhar: getArtSource(ART.icon.stickers.streetwear.velkhar),
  'void-raven': getArtSource(ART.icon.stickers.streetwear.voidRaven),
};

function Sticker({ heroId, size, have = true }: { heroId: string; size: number; have?: boolean }) {
  const src = VISITOR_STICKER_ART[heroId];
  if (!src) return <View style={{ width: size, height: size }} />;
  return (
    <ExpoImage
      source={src}
      contentFit="contain"
      transition={0}
      tintColor={have ? undefined : NEON.cyanBorder}
      style={{ width: size, height: size, opacity: have ? 1 : 0.5, ...pixelRenderStyle }}
      accessibilityIgnoresInvertColors
    />
  );
}

/* -------------------------------------------------------- room actor --- */

/** The visitor in the room. `feetX/feetY` = its feet on screen (room-layer coords). */
export function DailyVisitorActor({
  heroId,
  box,
  feetX,
  feetY,
  figurePt,
  greeted,
  animate,
  onTap,
}: {
  heroId: string;
  box: number;
  feetX: number;
  feetY: number;
  /** Drawn figure height (pt) above the feet — the "!" sits just over the head. */
  figurePt: number;
  greeted: boolean;
  animate: boolean;
  onTap: () => void;
}) {
  const role = useMemo(() => heroAvatarRole(heroId), [heroId]);
  const kit = useMemo(() => petKitOfRole(role, heroId), [role, heroId]);
  const pose = petPose(kit, 'idle');
  const [startedAt] = useState(() => Date.now());
  const ticking = animate && pose != null && !pose.hold;
  const now = usePetClock(ticking);
  const frame = ticking ? petFrameAt(kit, pose, now - startedAt, true, 1) : 0;
  // It stands on the right of the room and faces the middle (west).
  const drawable = poseDrawable(role, pose, 'w', frame);
  const footAt = roleFootAt(role);
  const left = Math.round(feetX - box / 2);
  const top = Math.round(feetY - footAt * box);
  const name = heroName(heroId);
  return (
    <View pointerEvents="box-none" style={[styles.actor, { left, top, width: box, height: box }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <ClipImage drawable={drawable} />
      </View>
      {/* Kept mounted (opacity) so nothing shifts when it goes. */}
      <View pointerEvents="none" style={[styles.bang, { left: box / 2 - 12, top: footAt * box - figurePt - 30, opacity: greeted ? 0 : 1 }]}>
        <Text style={styles.bangText} maxFontSizeMultiplier={1}>
          !
        </Text>
      </View>
      <Pressable
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel={greeted ? `${name}, visiting today. You said hi.` : `${name} dropped by. Tap to say hi.`}
        style={{ position: 'absolute', left: box * 0.3, width: box * 0.4, top: footAt * box - box * 0.42, height: box * 0.42 }}
      />
    </View>
  );
}

/* --------------------------------------------------------------- card --- */

/** The card's content for one greeting (or a re-tap later the same day = `visit`). */
export type VisitorCardShow = { reward: VisitorReward; greetN: number };

function rewardLine(show: VisitorCardShow): string {
  const lines = VISITOR_LINES[show.reward.heroId];
  if (!lines) return '';
  if (show.reward.kind === 'sticker') return lines.sticker.text;
  if (show.reward.kind === 'line') return lines.line.text;
  if (show.reward.kind === 'look') return lines.look.text;
  return lines.visits[show.greetN % 2]?.text ?? lines.visits[0].text;
}

export function VisitorCard({ show, top, onClose }: { show: VisitorCardShow; top: number; onClose: () => void }) {
  useStreetFonts();
  const reduced = noticeReduceMotion();
  const heroId = show.reward.heroId;
  const name = heroName(heroId);
  const arrive = VISITOR_LINES[heroId]?.arrive.text ?? '';
  const line = rewardLine(show);
  const label =
    show.reward.kind === 'sticker' ? VISITOR_UI.sticker(name) : show.reward.kind === 'look' ? VISITOR_UI.look(name) : null;
  const hint = show.reward.kind === 'sticker' ? VISITOR_UI.stickerHint : show.reward.kind === 'look' ? VISITOR_UI.lookHint : null;
  const gift = show.reward.kind === 'sticker' || show.reward.kind === 'look';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([VISITOR_UI.cardTitle(name), label, line].filter(Boolean).join('. '));
  }, [name, label, line]);

  const ms = reduced ? 260 : 200;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.Never)}
        exiting={FadeOut.duration(ms).reduceMotion(ReduceMotion.Never)}
        style={[styles.card, { top }]}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {VISITOR_UI.cardTitle(name)}
        </Text>
        <Text style={styles.arrive} numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {arrive}
        </Text>
        <View style={styles.giftRow}>
          <View style={styles.giftArt}>
            <Sticker heroId={heroId} size={96} />
            {show.reward.kind === 'look' ? (
              <View style={[styles.swatch, { backgroundColor: VISITOR_TINT_COLOR[heroId] ?? NEON.cyan }]} />
            ) : null}
          </View>
          <View style={styles.giftText}>
            {/* Fixed boxes: the label row is reserved even when there is no gift. */}
            <Text style={[styles.label, !gift && styles.hidden]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {label ?? ' '}
            </Text>
            <Text style={styles.line} numberOfLines={3} maxFontSizeMultiplier={1.2}>
              {line}
            </Text>
          </View>
        </View>
        <Text style={[styles.hint, !hint && styles.hidden]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {hint ?? ' '}
        </Text>
        <NeonButton label={gift ? VISITOR_UI.keep : VISITOR_UI.bye} variant="secondary" onPress={onClose} />
      </Animated.View>
    </View>
  );
}

/* -------------------------------------------------------- sticker book --- */

export function StickerBook({ book }: { book: VisitorBook }) {
  const have = stickerCount(book);
  return (
    <View style={styles.book}>
      <Text style={styles.bookTitle}>{VISITOR_UI.bookTitle}</Text>
      <Text style={styles.bookNote}>{VISITOR_UI.bookNote(have, VISITOR_STICKER_HEROES.length)}</Text>
      <View style={styles.grid}>
        {VISITOR_STICKER_HEROES.map((id) => {
          const got = hasSticker(book, id);
          const n = book.greets[id] ?? 0;
          return (
            <View
              key={id}
              style={styles.cell}
              accessible
              accessibilityLabel={
                got
                  ? `${heroName(id)} sticker${n >= VISITOR_LOOK_AT ? ', rare look found' : ''}`
                  : 'Sticker not found yet'
              }>
              <Sticker heroId={id} size={52} have={got} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actor: { position: 'absolute' },
  bang: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STREET.mustard,
    borderWidth: 2,
    borderColor: NEON.ink,
  },
  bangText: { fontFamily: STREET_FONT.bold, fontSize: 15, lineHeight: 18, color: NEON.ink },
  card: {
    position: 'absolute',
    right: 12,
    left: 12,
    maxWidth: 360,
    alignSelf: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    backgroundColor: NEON.panel,
  },
  title: { fontFamily: STREET_FONT.bold, fontSize: 16, color: NEON.cyan, textTransform: 'uppercase', letterSpacing: 1 },
  arrive: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, height: 36, color: NEON.textMuted },
  giftRow: { flexDirection: 'row', gap: 12, alignItems: 'center', height: 96 },
  giftArt: { width: 96, height: 96 },
  swatch: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: NEON.ink,
  },
  giftText: { flex: 1, gap: 4 },
  label: { fontFamily: STREET_FONT.bold, fontSize: 13, lineHeight: 16, color: STREET.mustard },
  line: { fontFamily: STREET_FONT.regular, fontSize: 15, lineHeight: 20, height: 60, color: NEON.textPrimary },
  hint: { fontFamily: STREET_FONT.regular, fontSize: 12, lineHeight: 16, color: NEON.textMuted },
  hidden: { opacity: 0 },
  book: { gap: 6, marginTop: 6 },
  bookTitle: { fontFamily: STREET_FONT.bold, fontSize: 14, color: NEON.textPrimary },
  bookNote: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, color: NEON.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
});
