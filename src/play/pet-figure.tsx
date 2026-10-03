/**
 * Pet figure (v21) — the pet drawn from existing art only, shared by the Pet
 * screen and the Dive scene: the stage's creep or hero sprite at the stage's
 * scale, a tinted copy at low opacity for the care branch, or a vector egg in
 * the Legend's colour. No ring — the screens add their own framing.
 *
 * v22 cosmetics (existing art only): a worn tint replaces the branch wash, a
 * badge draws a Look's item art small on the shoulder, and an aura draws a
 * soft static glow in its element colour behind the pet.
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { itemArtSource } from '@/play/art';
import { getItemDef } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { PET_BRANCH_TINT, PET_STAGE_SCALE, petLookFor, type PetLook, type PetState } from '@/play/pet';
import { NO_WEAR, wornLook, type PetWear } from '@/play/pet-cosmetics';
import { FinishPaint } from '@/play/finish-foil';
import type { FinishKind, FinishMotion } from '@/play/finishes';
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
  /** v30 — overrides the pet's saved finish (the picker preview). */
  finish?: { kind: FinishKind; color: string | null } | null;
  /** `sweep` only on the opened card, Dress, the room and the egg reveal. */
  foilMotion?: FinishMotion;
  reduceMotion?: boolean;
  /** The parent draws the reverse-holo plate (card window / room). */
  reverseHost?: boolean;
}) {
  const box = boxOverride ?? petBoxSize(pet, baseBox);
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
  const worn = finish ?? { kind: pet.finish_kind, color: pet.finish_color };
  const foilOn = foilMotion !== 'off' && worn.color != null && (worn.kind === 'holo' || worn.kind === 'reverse');
  const showReverse = foilOn && worn.kind === 'reverse' && !reverseHost;
  const showHolo = foilOn && worn.kind === 'holo';
  return (
    <View style={{ width: box, height: box }}>
      {look.aura ? (
        <Svg width={box * 1.5} height={box * 1.5} viewBox="0 0 100 100" style={[styles.aura, { left: -box * 0.25, top: -box * 0.25 }]} pointerEvents="none">
          <Circle cx="50" cy="50" r="48" fill={ELEMENT_COLOR[look.aura]} fillOpacity={0.1} />
          <Circle cx="50" cy="50" r="38" fill={ELEMENT_COLOR[look.aura]} fillOpacity={0.14} />
        </Svg>
      ) : null}
      {showReverse && worn.color ? (
        <FinishPaint
          kind="reverse"
          colorId={worn.color}
          onShiny={pet.shiny}
          motion={foilMotion}
          reduceMotion={reduceMotion}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, (recolor && blend) || showHolo ? styles.isolate : null]}>
      <ClipImage drawable={drawable} />
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
      {showHolo && worn.color ? (
        <FinishPaint
          kind="holo"
          colorId={worn.color}
          drawable={drawable}
          onShiny={pet.shiny}
          motion={foilMotion}
          reduceMotion={reduceMotion}
        />
      ) : null}
      </View>
      {badgeArt ? (
        <Image
          source={badgeArt}
          contentFit="contain"
          style={[styles.badge, { width: badge, height: badge }]}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { opacity: 0.35 },
  /** The shiny / dye recolour: a hue swap, or the wash fallback. */
  hue: { mixBlendMode: 'hue' },
  recolorWash: { opacity: 0.38 },
  isolate: { isolation: 'isolate' },
  silhouette: { opacity: 0.55 },
  aura: { position: 'absolute' },
  badge: { position: 'absolute', right: -2, top: -2 },
});
