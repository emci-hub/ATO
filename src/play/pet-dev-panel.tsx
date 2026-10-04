/**
 * Pet dev panel (dev builds only) — every pet / egg / room test button, sorted
 * into groups a tester can open one at a time:
 *
 *   Pet · stage & care     grow it, starve it, set its care band
 *   Eggs · hatch & grade   hatch / reveal, force a grade or Shiny
 *   Collection & stones    shards, Shine / Prism Stones, shells, buffs, medals
 *   Tide & streak          Tide Pass on / off, streak day
 *   Pity & Den             pity position, fill the Den
 *   Room · look & talk     forced status, night, Shiny look, speech
 *
 * One component, two homes: the floating DEV kit (when you are in the Pet room)
 * and the Info sheet's Dev tab. The room toggles go through `pet-dev-state`, so
 * they work from either place.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { auraStyles } from '@/play/auras';
import { finishColors } from '@/play/finishes';
import { NeonChip } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import type { PetState } from '@/play/pet';
import {
  cycleDevNight,
  cycleDevStatus,
  cycleShinyLook,
  requestDevSay,
  usePetDevRoom,
} from '@/play/pet-dev-state';
import { CARE_BANDS, CARE_BAND_LABEL, GRADES, GRADE_LABEL, PITY_HARD, PITY_SOFT_FROM } from '@/play/pet-eggs';
import { PET_TALK_SITUATIONS } from '@/play/pet-talk';
import {
  devAddPrism,
  devAddShells,
  devAddStones,
  devEndTide,
  devFillDen,
  devGiveShards,
  devGoldAllGames,
  devGrantAllBuffs,
  devGrantTide,
  devPetEndStage,
  devPetExpeditionReset,
  devPetFinishStage,
  devPetForce,
  devPetNewEgg,
  devPetSetBand,
  devPetSetStage,
  devPetStarve,
  devResetCollection,
  devSetPetAura,
  devSetPetFinish,
  devSetPity,
  devSetStreakDay,
} from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

/** Pity positions worth testing: fresh, just before soft pity, inside it, last before hard. */
export const DEV_PITY_PRESETS = [0, PITY_SOFT_FROM - 1, PITY_SOFT_FROM + 4, PITY_HARD - 1] as const;

export const PET_DEV_GROUPS = [
  { id: 'pet', title: 'Pet · stage & care' },
  { id: 'eggs', title: 'Eggs · hatch & grade' },
  { id: 'collection', title: 'Collection & stones' },
  { id: 'tide', title: 'Tide & streak' },
  { id: 'pity', title: 'Pity & Den' },
  { id: 'room', title: 'Room · look & talk' },
  { id: 'finish', title: 'Finishes' },
  { id: 'aura', title: 'Aura' },
] as const;
export type PetDevGroupId = (typeof PET_DEV_GROUPS)[number]['id'];

export function PetDevPanel({
  pet,
  commit,
  startOpen = ['pet'],
}: {
  pet: PetState;
  commit: (transition: PlayTransition) => boolean;
  /** Groups open on entry. */
  startOpen?: readonly PetDevGroupId[];
}) {
  const room = usePetDevRoom();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PET_DEV_GROUPS.map((g) => [g.id, startOpen.includes(g.id)])),
  );
  if (!PRE_LAUNCH_DEV) return null;

  const btn = (label: string, fn: PlayTransition) => <NeonChip key={label} label={label} onPress={() => commit(fn)} />;

  const body: Record<PetDevGroupId, React.ReactNode> = {
    pet: (
      <>
        {btn('Finish stage', (doc, now) => devPetFinishStage(doc, now))}
        {btn('Set Adult', (doc, now) => devPetSetStage(doc, now, 'adult'))}
        {btn('Set God', (doc, now) => devPetSetStage(doc, now, 'god'))}
        {btn('Starve', (doc, now) => devPetStarve(doc, now))}
        {CARE_BANDS.map((b) => btn(`Care ${CARE_BAND_LABEL[b]}`, (doc, now) => devPetSetBand(doc, now, b)))}
        {btn('Expedition: back now + reset day', (doc, now) => devPetExpeditionReset(doc, now))}
      </>
    ),
    eggs: (
      <>
        {btn('New egg', (doc, now) => devPetNewEgg(doc, now))}
        {btn('Hatch now', (doc, now) => devPetEndStage(doc, now, 'egg'))}
        {btn('Reveal now', (doc, now) => devPetEndStage(doc, now, 'baby'))}
        {GRADES.map((g) => btn(`Force ${GRADE_LABEL[g]}`, (doc, now) => devPetForce(doc, now, { grade: g })))}
        {btn(pet.shiny ? 'Shiny: off' : 'Force shiny', (doc, now) => devPetForce(doc, now, { shiny: !pet.shiny }))}
      </>
    ),
    collection: (
      <>
        {GRADES.map((g) => btn(`+5 ${GRADE_LABEL[g]} shards`, (doc) => devGiveShards(doc, g)))}
        {btn('+5 Shine Stones', (doc) => devAddStones(doc))}
        {btn('+Prism Stone', (doc) => devAddPrism(doc))}
        {btn('+100 shells', (doc) => devAddShells(doc))}
        {btn('All buffs', (doc) => devGrantAllBuffs(doc))}
        {btn('Gold on every level', (doc) => devGoldAllGames(doc))}
        {btn('Reset Collection', (doc) => devResetCollection(doc))}
      </>
    ),
    tide: (
      <>
        {btn('Grant Tide (5 days)', (doc, now) => devGrantTide(doc, now))}
        {btn('End Tide', (doc, now) => devEndTide(doc, now))}
        {[1, 6, 7].map((d) => btn(`Streak day ${d}`, (doc, now) => devSetStreakDay(doc, now, d)))}
      </>
    ),
    pity: (
      <>
        {DEV_PITY_PRESETS.map((n) => btn(`Pity: egg ${n + 1}`, (doc, now) => devSetPity(doc, now, n)))}
        {btn('Fill the Den', (doc, now) => devFillDen(doc, now))}
      </>
    ),
    room: (
      <>
        <NeonChip label={`Status: ${room.status ?? 'real'}`} selected={room.status != null} onPress={cycleDevStatus} />
        <NeonChip label={`Night: ${room.night}`} selected={room.night !== 'auto'} onPress={cycleDevNight} />
        <NeonChip label={`Shiny look: ${room.shinyLook}`} selected={room.shinyLook !== 'auto'} onPress={cycleShinyLook} />
        <NeonChip
          label="Say a line"
          onPress={() => requestDevSay(PET_TALK_SITUATIONS[Math.floor(Math.random() * PET_TALK_SITUATIONS.length)])}
        />
        <NeonChip label="Fake evolve (I grew!)" onPress={() => requestDevSay('evolved')} />
      </>
    ),
    finish: (
      <>
        {btn('Finish off', (doc, now) => devSetPetFinish(doc, now, pet.uid, 'none', null))}
        {finishColors().map((color) => btn(`Holo ${color.name}`, (doc, now) => devSetPetFinish(doc, now, pet.uid, 'holo', color.id)))}
        {finishColors().map((color) => btn(`Reverse ${color.name}`, (doc, now) => devSetPetFinish(doc, now, pet.uid, 'reverse', color.id)))}
      </>
    ),
    aura: (
      <>
        {btn('Auras off', (doc, now) => devSetPetAura(doc, now, pet.uid, 'none'))}
        {auraStyles().map((row) => btn(row.name, (doc, now) => devSetPetAura(doc, now, pet.uid, row.id)))}
      </>
    ),
  };

  return (
    <View style={styles.wrap}>
      {PET_DEV_GROUPS.map((g) => {
        const isOpen = open[g.id];
        return (
          <View key={g.id}>
            <Pressable
              onPress={() => setOpen((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={`${isOpen ? 'Collapse' : 'Expand'} ${g.title}`}
              style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
              <Text style={styles.headerText}>{g.title}</Text>
              <Text style={styles.chevron}>{isOpen ? '⌄' : '›'}</Text>
            </Pressable>
            {isOpen ? <View style={styles.chips}>{body[g.id]}</View> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  headerText: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
  chevron: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8, paddingBottom: 4 },
  pressed: { opacity: 0.75 },
});
