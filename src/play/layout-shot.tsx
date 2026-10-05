/**
 * Dev-only device frames for the pet room, Dive, and the two pet games.
 * Open /play?shot=pet&inset=se (or dive, catch, train, play; inset 15 | max | and).
 * Dive accepts phase=pre (the DIVE button) or phase=mid (DEEPER + SURFACE).
 * Catch and Train are the full-screen plate with ambient on, so a frame can
 * be compared to the mockup. The inset is the safe area for that phone, so
 * the flex layout is the one a real device gives the screen. Not linked from the hub.
 */
import { StyleSheet, View } from 'react-native';

import { defaultPlayStore, playView, type PlayStoreDoc, type PlayView } from '@/play/playStore';
import { newPet } from '@/play/pet';
import { DiveScreen } from '@/play/dive-screen';
import { PetScreen } from '@/play/pet-screen';
import { PlaySheetBody } from '@/play/pet-sheets';
import { CatchFoodGame, TapTrainGame, type GamePet } from '@/play/pet-games';
import { usePetArt } from '@/play/pet-anim-sprite';
import { EGG_COLOR } from '@/play/pet-eggs';
import { PIXEL } from '@/play/pixel-theme';
import { PixelLabel, usePixelFonts } from '@/play/pixel-ui';
import { NEON } from '@/play/neon-viper';

export type LayoutShotKind = 'pet' | 'dive' | 'catch' | 'train' | 'play';
export type LayoutInset = 'se' | '15' | 'max' | 'and';
export type LayoutPhase = 'pre' | 'mid';

const INSET: Record<LayoutInset, { top: number; bottom: number }> = {
  se: { top: 20, bottom: 0 },
  '15': { top: 59, bottom: 34 },
  max: { top: 59, bottom: 34 },
  and: { top: 24, bottom: 24 },
};

function shotDoc(now: number, kind: LayoutShotKind, phase: LayoutPhase): PlayStoreDoc {
  const doc = defaultPlayStore(now);
  const pet = newPet(now);
  pet.stage = 'child';
  pet.egg = 'knight';
  pet.hero = 'corvus';
  pet.grade = 'common';
  pet.name = 'Raven';
  pet.hunger = 2;
  pet.mood = 3;
  pet.forms = ['standard'];
  pet.reveals = [];
  doc.pet = pet;
  doc.play_settings = { ...doc.play_settings, tutorialSeen: true, chatter: 'off' };
  if (kind === 'dive' && phase === 'mid') {
    doc.dive_run = {
      deepers: 1,
      haul: ['food_kelp'],
      free_n: null,
      next: { safe: 'food_kelp', rich: 'food_shrimp' },
    };
  }
  return doc;
}

function GameFrame({ kind, view }: { kind: 'catch' | 'train'; view: PlayView }) {
  const art = usePetArt(view.pet.state);
  const egg = view.pet.state.egg;
  const gamePet: GamePet = {
    pet: view.pet.state,
    art,
    wear: view.pet.wear,
    eggColor: egg ? EGG_COLOR[egg] : PIXEL.cyan,
    recolor: null,
    glow: PIXEL.cyan,
  };
  const props = { onDone: () => undefined, onBack: () => undefined, level: 'normal' as const, gamePet, still: false };
  return kind === 'catch' ? <CatchFoodGame {...props} /> : <TapTrainGame {...props} />;
}

/** The pet room, Dive, or a pet game, in a safe-area frame. */
export function LayoutShot({
  kind,
  inset,
  phase = 'mid',
}: {
  kind: LayoutShotKind;
  inset: LayoutInset;
  phase?: LayoutPhase;
}) {
  usePixelFonts();
  const now = 1_700_000_000_000;
  const view = playView(shotDoc(now, kind, phase), now);
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
      ) : kind === 'catch' || kind === 'train' ? (
        <GameFrame kind={kind} view={view} />
      ) : kind === 'play' ? (
        <View style={styles.sheet}>
          <PixelLabel numberOfLines={1}>Play</PixelLabel>
          <PlaySheetBody
            view={view}
            onStart={() => undefined}
            lastResult={null}
            still
          />
        </View>
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
          commitSaved={async () => false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: NEON.ink },
  sheet: {
    flex: 1,
    backgroundColor: PIXEL.ink,
    borderTopWidth: 2,
    borderColor: PIXEL.cyan,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
});
