/**
 * Decor slots — what you see (roadmap step 5, plan approved by emci 2026-10-15).
 *
 *  - `DecorSprites`: the placed props, drawn inside the room layer (stage region) from their own
 *    sprites. pet-room draws one group behind the pet and one in front, sorted by each footprint.
 *  - `DecorSpots`: one tap target per slot, over the pet — a "+" on an empty spot, the whole prop when
 *    filled. Spots on the art are stage content; they never resize a region.
 *  - `DecorSheet`: the picker. The away card's shape on the float layer: fixed boxes, outside tap /
 *    Android back / Done close it, Reduce Motion = a gentle fade. Tapping a prop places it and closes.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { ART, getArtSource } from '@/art/art';
import {
  DECOR_ITEMS,
  DECOR_SLOTS,
  DECOR_UI,
  decorItem,
  decorSlot,
  slotRect,
  type DecorItem,
  type DecorItemId,
  type DecorSlotId,
  type DecorState,
  type PlacedDecor,
} from '@/play/decor-slots';
import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { sheetCard } from '@/play/sheet-kit';
import { noticeReduceMotion } from '@/play/notify/notify';
import { pixelRenderStyle } from '@/play/pixel-theme';
import { STREET, STREET_FONT, useStreetFonts } from '@/play/street-ui';

/** Each prop's sprite (art library: the room's own props + the streetwear set). */
export const DECOR_ART: Readonly<Record<DecorItemId, ImageSourcePropType | undefined>> = {
  dc_plant: getArtSource(ART.prop.hideout.streetwear.plant),
  dc_beanbag: getArtSource(ART.prop.hideout.streetwear.beanbag),
  dc_table: getArtSource(ART.prop.hideout.streetwear.table),
  dc_lamp: getArtSource(ART.prop.hideout.streetwear.lamp),
  dc_crate: getArtSource(ART.prop.streetwear.crate),
  dc_boombox: getArtSource(ART.prop.streetwear.boombox),
  dc_traffic_cone: getArtSource(ART.prop.streetwear.trafficCone),
  dc_barrel_fire: getArtSource(ART.prop.streetwear.barrelFire),
  dc_tire_stack: getArtSource(ART.prop.streetwear.tireStack),
  dc_trash_bags: getArtSource(ART.prop.streetwear.trashBags),
};

/** One prop drawn pixel-exact: its trimmed box, cropped out of the source file at `k` pt per art px. */
function PropImage({ item, k }: { item: DecorItem; k: number }) {
  const src = DECOR_ART[item.id];
  if (!src) return null;
  const [tx, ty, tw, th] = item.trim;
  return (
    <View style={{ width: tw * k, height: th * k, overflow: 'hidden' }} pointerEvents="none">
      <ExpoImage
        source={src}
        contentFit="fill"
        transition={0}
        accessibilityIgnoresInvertColors
        style={{ position: 'absolute', left: -tx * k, top: -ty * k, width: item.src[0] * k, height: item.src[1] * k, ...pixelRenderStyle }}
      />
    </View>
  );
}

/* -------------------------------------------------------- room sprites --- */

/** Placed props in the room layer. `left/top` = the room's origin on screen, `k` = pt per art px. */
export function DecorSprites({ items, left, top, k }: { items: readonly PlacedDecor[]; left: number; top: number; k: number }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((p) => (
        <View
          key={p.slot}
          pointerEvents="none"
          style={{ position: 'absolute', left: Math.round(left + p.rect[0] * k), top: Math.round(top + p.rect[1] * k) }}>
          <PropImage item={p.item} k={k} />
        </View>
      ))}
    </>
  );
}

/* ----------------------------------------------------------- tap spots --- */

const TAP_MIN = 44;
const PLUS = 28;

/** A tap target per slot, over the pet and the front layer. */
export function DecorSpots({
  decor,
  left,
  top,
  k,
  onTap,
}: {
  decor: DecorState;
  left: number;
  top: number;
  k: number;
  onTap: (slot: DecorSlotId) => void;
}) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {DECOR_SLOTS.map((s) => {
        const item = decorItem(decor[s.id]);
        const [fx, fy, fw, fh] = slotRect(s);
        // The tap target is the footprint (at least 44 pt) — never the whole height of a tall prop, so a pet
        // standing in front of it still gets its tap. The spots also sit under the pet in the room.
        const x = left + fx * k;
        const bottom = top + (fy + fh) * k;
        const w = Math.max(TAP_MIN, fw * k);
        const h = Math.max(TAP_MIN, fh * k);
        return (
          <Pressable
            key={s.id}
            onPress={() => onTap(s.id)}
            accessibilityRole="button"
            accessibilityLabel={item ? DECOR_UI.filledA11y(s.label, item.label) : DECOR_UI.emptyA11y(s.label)}
            style={{ position: 'absolute', left: Math.round(x + (fw * k - w) / 2), top: Math.round(bottom - h), width: w, height: h, alignItems: 'center', justifyContent: 'flex-end' }}>
            {item ? null : (
              <View style={[styles.plus, { marginBottom: Math.max(0, (fh * k - PLUS) / 2) }]}>
                <Text style={styles.plusText} maxFontSizeMultiplier={1}>
                  +
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------------------------------------- sheet --- */

export function DecorSheet({
  slot,
  placed,
  top,
  onPick,
  onClose,
}: {
  slot: DecorSlotId;
  placed: DecorItemId | null;
  top: number;
  onPick: (item: DecorItemId | null) => void;
  onClose: () => void;
}) {
  useStreetFonts();
  const reduced = noticeReduceMotion();
  const label = decorSlot(slot)?.label ?? '';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${DECOR_UI.title}, ${label}. ${DECOR_UI.hint}`);
  }, [label]);

  const ms = reduced ? 260 : 200;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.Never)}
        exiting={FadeOut.duration(ms).reduceMotion(ReduceMotion.Never)}
        style={[styles.card, { top }]}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {DECOR_UI.title} · {label}
        </Text>
        <Text style={styles.hint} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {DECOR_UI.hint}
        </Text>
        <View style={styles.grid}>
          {DECOR_ITEMS.map((it) => {
            const on = it.id === placed;
            const k = Math.min(1, 44 / Math.max(it.trim[2], it.trim[3]));
            return (
              <Pressable
                key={it.id}
                onPress={() => onPick(it.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={it.label}
                style={[styles.cell, on && styles.cellOn]}>
                <PropImage item={it} k={k} />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.buttons}>
          <View style={styles.btn}>
            <NeonButton label={DECOR_UI.takeAway} variant="secondary" disabled={placed == null} onPress={() => onPick(null)} />
          </View>
          <View style={styles.btn}>
            <NeonButton label={DECOR_UI.done} variant="secondary" onPress={onClose} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  plus: {
    width: PLUS,
    height: PLUS,
    borderRadius: PLUS / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,14,18,0.82)',
    borderWidth: 2,
    borderColor: STREET.mustard,
  },
  plusText: { fontFamily: STREET_FONT.bold, fontSize: 18, lineHeight: 22, color: STREET.mustard, includeFontPadding: false },
  card: {
    position: 'absolute',
    right: 12,
    left: 12,
    maxWidth: 360,
    alignSelf: 'center',
    gap: 8,
    padding: 16,
    ...sheetCard,
  },
  title: { fontFamily: STREET_FONT.bold, fontSize: 16, color: NEON.cyan, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, color: NEON.textMuted },
  // 5 × 56 + 4 × 6 = 304: two fixed rows, whatever the viewport.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, height: 118 },
  cell: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cellOn: { borderColor: STREET.mustard },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1 },
});
