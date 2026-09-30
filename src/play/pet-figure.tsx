/**
 * Pet figure (v21) — the pet drawn from existing art only, shared by the Pet
 * screen and the Dive scene: the stage's creep or hero sprite at the stage's
 * scale, a tinted copy at low opacity for the care branch, or a vector egg in
 * the Legend's colour. No ring, no aura — the screens add their own framing.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { PET_BRANCH_TINT, PET_STAGE_SCALE, petLookFor, type PetLook, type PetState } from '@/play/pet';
import { ClipImage } from '@/play/sheet-sprite';
import { getSkinRole, heroAvatarRole, roleArtDrawable, roleFaceArtIndex } from '@/play/skin';

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

/** The pet at `petBoxSize(pet, baseBox)` — sprite + branch wash, or the egg. */
export function PetFigure({ pet, baseBox, eggColor }: { pet: PetState; baseBox: number; eggColor: string }) {
  const box = petBoxSize(pet, baseBox);
  if (pet.stage === 'egg') return <EggShape size={box} color={eggColor} />;
  const tint = PET_BRANCH_TINT[pet.branch];
  const drawable = lookDrawable(petLookFor(pet.line, pet.stage));
  return (
    <View style={{ width: box, height: box }}>
      <ClipImage drawable={drawable} />
      {tint ? (
        <View style={[StyleSheet.absoluteFill, styles.wash]} pointerEvents="none">
          <ClipImage drawable={drawable} tintColor={tint} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { opacity: 0.35 },
});
