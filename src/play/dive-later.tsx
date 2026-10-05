/**
 * Post–first Surface destinations that live under Dive, not Pet:
 * Expedition, the Den, and the sheets the Den opens (egg, stones, card).
 * Gear stays on the Dive HUD and is shown by the screen, not here.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { DenSheetBody } from '@/play/den-sheet';
import { ELEMENT_COLOR } from '@/play/kits';
import { EGG_COLOR, petShownName } from '@/play/pet-eggs';
import { EggPickerBody } from '@/play/pet-egg-sheets';
import { PetFigure } from '@/play/pet-figure';
import { ExpeditionSheetBody } from '@/play/pet-sheets';
import { GuideLink } from '@/play/guide-sheet';
import type { GuideSection } from '@/play/guide-content';
import { PlaySheet } from '@/play/play-sheet';
import { StoneSheetBody } from '@/play/stone-sheet';
import type { PlayView } from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

export type DiveLaterId = 'expedition' | 'den' | 'stone' | 'prism' | 'eggs' | 'card';

const NESTED: readonly DiveLaterId[] = ['stone', 'prism', 'eggs', 'card'];

/** Stone / egg / card sit on top of the Den. Back returns there. */
export function diveLaterBack(sheet: DiveLaterId | null): 'den' | 'close' | null {
  if (sheet == null) return null;
  return NESTED.includes(sheet) ? 'den' : 'close';
}

export function DiveLaterSheets({
  sheet,
  view,
  commit,
  commitSaved,
  reduceMotion,
  onClose,
  onSheet,
  onGuide,
}: {
  sheet: DiveLaterId | null;
  view: PlayView;
  commit: (transition: PlayTransition) => boolean;
  commitSaved: (transition: PlayTransition) => Promise<boolean>;
  reduceMotion: boolean;
  onClose: () => void;
  onSheet: (id: DiveLaterId) => void;
  onGuide: (section: GuideSection) => void;
}) {
  const [stoneUid, setStoneUid] = useState<number | null>(null);
  const pet = view.pet.state;
  const eggColor = pet.egg ? EGG_COLOR[pet.egg] : ELEMENT_COLOR[view.legendElement];
  const backToDen = () => onSheet('den');

  return (
    <>
      <PlaySheet open={sheet === 'expedition'} title="Expedition" onClose={onClose} reduceMotion={reduceMotion}>
        <ExpeditionSheetBody view={view} commit={commit} onGuide={onGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'den'} title="The Den" onClose={onClose} reduceMotion={reduceMotion}>
        <GuideLink section="tend" onOpen={onGuide} />
        <DenSheetBody
          view={view}
          commit={commit}
          gameOpen={false}
          reduceMotion={reduceMotion}
          onNewEgg={() => onSheet('eggs')}
          onOpenStone={(uid) => {
            setStoneUid(uid);
            onSheet('stone');
          }}
          onOpenPrism={(uid) => {
            setStoneUid(uid);
            onSheet('prism');
          }}
          onViewActiveCard={() => onSheet('card')}
        />
      </PlaySheet>
      <PlaySheet open={sheet === 'eggs'} title="Choose an egg" onClose={backToDen} reduceMotion={reduceMotion}>
        <EggPickerBody view={view} commit={commit} onChosen={backToDen} />
        <GuideLink section="odds" onOpen={onGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'stone'} title="Shine Stone" onClose={backToDen} reduceMotion={reduceMotion}>
        <StoneSheetBody view={view} commitSaved={commitSaved} initialUid={stoneUid} />
        <GuideLink section="odds" onOpen={onGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'prism'} title="Prism Stone" onClose={backToDen} reduceMotion={reduceMotion}>
        <StoneSheetBody view={view} commitSaved={commitSaved} initialUid={stoneUid} mode="prism" />
        <GuideLink section="shop" onOpen={onGuide} />
      </PlaySheet>
      <PlaySheet open={sheet === 'card'} title={petShownName(pet)} onClose={backToDen} reduceMotion={reduceMotion}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <PetFigure pet={pet} baseBox={120} eggColor={eggColor} wear={view.pet.wear} reduceMotion={reduceMotion} />
        </View>
      </PlaySheet>
    </>
  );
}
