/**
 * Pet figure (v21) — the pet drawn from existing art only, shared by the Pet
 * screen and the Dive scene: the stage's creep or hero sprite at the stage's
 * scale, a tinted copy at low opacity for the care branch, or a vector egg in
 * the Legend's colour. No ring — the screens add their own framing.
 *
 * v22 cosmetics (existing art only): a worn tint replaces the branch wash, a
 * badge draws a Look's item art small on the shoulder, and an aura draws a
 * soft static glow in its element colour behind the pet.
 *
 * Layers (aura/holo rework): one stage that moves with the pet and reserves room
 * for the biggest aura + glint halo, clipped to that room (the screen's viewport
 * region clips it again, never a bar or a button):
 *   aura behind · sprite (+ shiny / dye / tint) · holo (prism, rim, sweep, glints) · aura front
 */
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { itemArtSource } from '@/play/art';
import { getItemDef } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { PET_BRANCH_TINT, PET_STAGE_SCALE, petLookFor, type PetLook, type PetState } from '@/play/pet';
import { NO_WEAR, wornLook, type PetWear } from '@/play/pet-cosmetics';
import { HideoutAuraStrip, PetAuraSprite } from '@/play/aura-view';
import { auraConfig, auraPaintOrder, auraRamps } from '@/play/auras';
import { petFinishOf, type FinishKind, type FinishMotion } from '@/play/finishes';
import { PetHolo } from '@/play/pet-holo';
import { ClipImage } from '@/play/sheet-sprite';
import {
  getSkinRole,
  heroAvatarRole,
  roleArtDrawable,
  roleFaceArtIndex,
  type ClipDrawable,
} from '@/play/skin';

export function lookDrawable(look: PetLook | null) {
  if (!look) return undefined;
  const role = look.kind === 'hero' ? heroAvatarRole(look.heroId) : getSkinRole(look.role);
  return roleArtDrawable(role, roleFaceArtIndex(role, 'e'));
}

export function EggShape({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 8 C30 8 18 38 18 58 C18 78 32 92 50 92 C68 92 82 78 82 58 C82 38 70 8 50 8 Z"
        fill={color}
        fillOpacity={0.85}
        stroke="#FFFFFF"
        strokeOpacity={0.5}
        strokeWidth={2}
      />
      <Circle cx="38" cy="44" r="6" fill="#FFFFFF" fillOpacity={0.35} />
      <Circle cx="62" cy="62" r="8" fill="#FFFFFF" fillOpacity={0.25} />
      <Circle cx="44" cy="74" r="4" fill="#FFFFFF" fillOpacity={0.3} />
      <Ellipse cx="40" cy="26" rx="6" ry="10" fill="#FFFFFF" fillOpacity={0.3} />
    </Svg>
  );
}

/** Room a pet's stage reserves on every side, as a share of the box: the biggest aura + a glint halo. */
export const STAGE_RESERVE = 0.6;

/** Drawn box size for a stage at a given base box. */
export function petBoxSize(pet: PetState, baseBox: number): number {
  return Math.round(baseBox * PET_STAGE_SCALE[pet.stage]);
}

/** The pet at `petBoxSize(pet, baseBox)` — sprite + wash (+ cosmetics), or
 * the egg. `silhouette` draws it all black (the Collection's unfound slots). */
export function PetFigure({
  pet,
  baseBox,
  eggColor,
  wear = NO_WEAR,
  silhouette = false,
  frame,
  box: boxOverride,
  recolor = null,
  blend = false,
  lockColour = false,
  finish = null,
  foilMotion = 'still',
  reduceMotion = false,
  reverseHost = false,
  auraElement = null,
  flash = null,
  hideoutFx = false,
}: {
  pet: PetState;
  baseBox: number;
  eggColor: string;
  wear?: PetWear;
  silhouette?: boolean;
  /** Animated frame to draw instead of the still pose (room + dive, 2026-09-29). */
  frame?: ClipDrawable;
  /** Exact drawn size (the room snaps it to whole device pixels). */
  box?: number;
  /** v23 — shiny / 3★ dye recolour (a hue swap; see pet-looks.tsx). */
  recolor?: string | null;
  /** Use the hue blend (else the tint wash at ~38%). */
  blend?: boolean;
  /** A shiny's colour is its own: no form wash or Wardrobe tint on top. */
  lockColour?: boolean;
  /** v30 — the pet's finish (the picker previews its own). Drawn ON the pet by `PetHolo`. */
  finish?: { kind: FinishKind; color: string | null; sweep?: string; glint?: string } | null;
  /** Kept for callers: the holo on the pet runs its own loop (gentle under Reduce Motion). */
  foilMotion?: FinishMotion;
  reduceMotion?: boolean;
  /** Kept for callers: the card draws only a quiet border now. */
  reverseHost?: boolean;
  /** Equipped sword element. The aura colour follows it. */
  auraElement?: string | null;
  /** 0–1 white copy of the sprite (feed / find). Null skips the extra image. */
  flash?: SharedValue<number> | null;
  /** Hideout / Underground: 84px blaze + outlined bubbles. */
  hideoutFx?: boolean;
}) {
  const flashFallback = useSharedValue(0);
  const flashT = flash ?? flashFallback;
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashT.value }));
  const box = boxOverride ?? petBoxSize(pet, baseBox);
  // The card and the room own reverse holo. This flag stays so those callers
  // can say they took the plate; the sprite never paints one.
  void reverseHost;
  if (pet.stage === 'egg') return <EggShape size={box} color={silhouette ? '#000000' : eggColor} />;
  const look = wornLook(wear);
  const drawable = frame ?? lookDrawable(petLookFor(pet.line, pet.stage));
  if (silhouette) {
    return (
      <View style={[{ width: box, height: box }, styles.silhouette]}>
        <ClipImage drawable={drawable} tintColor="#000000" />
      </View>
    );
  }
  const tint = lockColour ? null : (look.tint ?? PET_BRANCH_TINT[pet.branch]);
  const badgeArt = look.badgeItemId ? itemArtSource(getItemDef(look.badgeItemId)?.core.art ?? '') : undefined;
  const badge = Math.max(14, Math.round(box * 0.3));
  void foilMotion;
  void reduceMotion;
  const worn = auraPaintOrder(pet.auras);
  const sword = auraElement || auraConfig().fallback_element;
  const reserve = Math.ceil(box * STAGE_RESERVE);
  const worn_finish =
    finish && finish.kind !== 'none' && finish.color
      ? {
          kind: finish.kind,
          color: finish.color,
          sweep: finish.sweep ?? pet.finish_sweep,
          glint: finish.glint ?? pet.finish_glint,
        }
      : finish === undefined || finish === null
        ? petFinishOf(pet)
        : null;
  return (
    <View style={{ width: box, height: box }}>
     <View pointerEvents="none" style={[styles.stage, { left: -reserve, top: -reserve, width: box + reserve * 2, height: box + reserve * 2 }]}>
      <View style={{ position: 'absolute', left: reserve, top: reserve, width: box, height: box }}>
      {worn.map((wear) =>
        hideoutFx && (wear.style === 'fire' || wear.style === 'water') ? (
          <HideoutAuraStrip key={wear.style} styleId={wear.style} layer="back" box={box} />
        ) : (
          <PetAuraSprite
            key={wear.style}
            drawable={drawable}
            styleId={wear.style}
            ramps={auraRamps(wear.style, wear.color, sword)}
            box={box}
            layer="back"
          />
        ),
      )}
      {look.aura ? (
        <Svg width={box * 1.5} height={box * 1.5} viewBox="0 0 100 100" style={[styles.aura, { left: -box * 0.25, top: -box * 0.25 }]} pointerEvents="none">
          <Circle cx="50" cy="50" r="48" fill={ELEMENT_COLOR[look.aura]} fillOpacity={0.1} />
          <Circle cx="50" cy="50" r="38" fill={ELEMENT_COLOR[look.aura]} fillOpacity={0.14} />
        </Svg>
      ) : null}
      <View style={[StyleSheet.absoluteFill, recolor && blend ? styles.isolate : null]}>
      <ClipImage drawable={drawable} />
      {flash ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, flashStyle]}>
          <ClipImage drawable={drawable} tintColor="#FFFFFF" />
        </Animated.View>
      ) : null}
      {recolor ? (
        <View
          style={[StyleSheet.absoluteFill, blend ? styles.hue : styles.recolorWash]}
          pointerEvents="none">
          <ClipImage drawable={drawable} tintColor={recolor} />
        </View>
      ) : null}
      {tint ? (
        <View style={[StyleSheet.absoluteFill, styles.wash]} pointerEvents="none">
          <ClipImage drawable={drawable} tintColor={tint} />
        </View>
      ) : null}
      </View>
      {worn_finish ? <PetHolo finish={worn_finish} drawable={drawable} still={lookDrawable(petLookFor(pet.line, pet.stage))} box={box} /> : null}
      {worn.map((wear) =>
        hideoutFx && (wear.style === 'fire' || wear.style === 'water') ? (
          <HideoutAuraStrip key={`front-${wear.style}`} styleId={wear.style} layer="front" box={box} />
        ) : (
          <PetAuraSprite
            key={`front-${wear.style}`}
            drawable={drawable}
            styleId={wear.style}
            ramps={auraRamps(wear.style, wear.color, sword)}
            box={box}
            layer="front"
          />
        ),
      )}
      {badgeArt ? (
        <Image
          source={badgeArt}
          contentFit="contain"
          style={[styles.badge, { width: badge, height: badge }]}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      </View>
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** The reserve round the pet: clipped here so an aura never spills past it. */
  stage: { position: 'absolute', overflow: 'hidden' },
  wash: { opacity: 0.35 },
  /** The shiny / dye recolour: a hue swap, or the wash fallback. */
  hue: { mixBlendMode: 'hue' },
  recolorWash: { opacity: 0.38 },
  isolate: { isolation: 'isolate' },
  silhouette: { opacity: 0.55 },
  aura: { position: 'absolute' },
  badge: { position: 'absolute', right: -2, top: -2 },
});
