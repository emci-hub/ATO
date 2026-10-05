/**
 * Dev-only device frames for the pet room and Dive.
 * Open /play?shot=pet&inset=se (or dive, inset 15 | max | and).
 * The inset is the safe area for that phone, so the flex layout is the one
 * a real device gives the screen. Not linked from the hub.
 */
import { StyleSheet, View } from 'react-native';

import { defaultPlayStore, playView, type PlayStoreDoc } from '@/play/playStore';
import { newPet } from '@/play/pet';
import { DiveScreen } from '@/play/dive-screen';
import { PetScreen } from '@/play/pet-screen';
import { NEON } from '@/play/neon-viper';

export type LayoutShotKind = 'pet' | 'dive';
export type LayoutInset = 'se' | '15' | 'max' | 'and';

const INSET: Record<LayoutInset, { top: number; bottom: number }> = {
  se: { top: 20, bottom: 0 },
  '15': { top: 59, bottom: 34 },
  max: { top: 59, bottom: 34 },
  and: { top: 24, bottom: 24 },
};

function shotDoc(now: number, kind: LayoutShotKind): PlayStoreDoc {
  const doc = defaultPlayStore(now);
  const pet = newPet(now);
  pet.stage = 'child';
  pet.egg = 'knight';
  pet.hero = 'corvus';
  pet.grade = 'common';
  pet.name = 'Raven';
  pet.hunger = 0;
  pet.mood = 3;
  pet.forms = ['standard'];
  pet.reveals = [];
  doc.pet = pet;
  doc.play_settings = { ...doc.play_settings, tutorialSeen: true, chatter: 'off' };
  if (kind === 'dive') {
    doc.dive_run = {
      deepers: 1,
      haul: ['food_kelp'],
      free_n: null,
      next: { safe: 'food_kelp', rich: 'food_shrimp' },
    };
  }
  return doc;
}

/** The pet room or Dive, in a safe-area frame, with the layout the owner reported. */
export function LayoutShot({ kind, inset }: { kind: LayoutShotKind; inset: LayoutInset }) {
  const now = 1_700_000_000_000;
  const view = playView(shotDoc(now, kind), now);
  const pad = INSET[inset];
  const noop = async () => false;
  return (
    <View style={[styles.frame, { paddingTop: pad.top, paddingBottom: pad.bottom }]}>
      {kind === 'pet' ? (
        <PetScreen
          view={view}
          commit={() => false}
          commitSaved={async () => false}
          reduceMotion
          onBack={() => undefined}
          onGoDive={() => undefined}
        />
      ) : (
        <DiveScreen
          view={view}
          skipDelays
          reduceMotion
          onSpendCharge={noop}
          onFreeDive={noop}
          onSurface={async () => null}
          onDeeper={async () => null}
          onBack={() => undefined}
          commit={() => false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: NEON.ink },
});
