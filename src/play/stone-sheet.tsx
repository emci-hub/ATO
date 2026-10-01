/**
 * The Shine Stone sheet (v27, Part D) — make a revealed pet shiny.
 *
 *   Stones held · glimmers x/5 · the chance the NEXT Stone really rolls
 *   (`STONE_ODDS`, or certain at `GLIMMER_PITY` glimmers — the same test
 *   `stoneSucceeds` makes) · pick a pet (the active one or any resting one,
 *   revealed and not shiny) · use · the result. Looks only — never stats.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { petRevealed } from '@/play/den';
import { ELEMENT_COLOR } from '@/play/kits';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import type { PetState } from '@/play/pet';
import { EGG_COLOR, GLIMMER_PITY, SHINY_STYLE_LABEL, STONE_ODDS, gradeTag, petShownName } from '@/play/pet-eggs';
import { PetFigure } from '@/play/pet-figure';
import { petRecolor } from '@/play/pet-looks';
import { applyShineStone, type PlayView, type StoneRefusal, type StoneResult } from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

type Commit = (transition: PlayTransition) => boolean;

export const STONE_REFUSAL: Record<StoneRefusal, string> = {
  no_stones: 'No Shine Stones left.',
  missing: 'That pet isn’t here any more.',
  not_revealed: 'Only a revealed pet (Child and up) can take a Stone.',
  shiny: 'It’s already shiny — a Stone can’t change it.',
};

/** The chance the next Stone works, in percent — what `stoneSucceeds` rolls. */
export function nextStoneChance(glimmers: number): number {
  return glimmers >= GLIMMER_PITY ? 100 : Math.round(STONE_ODDS * 100);
}

export function StoneSheetBody({
  view,
  commit,
  initialUid,
}: {
  view: PlayView;
  commit: Commit;
  /** The pet the Den (or the menu) opened this for. */
  initialUid: number | null;
}) {
  const pv = view.pet;
  const st = pv.stones;
  const pets: PetState[] = [pv.state, ...pv.den.resting].filter((p) => p.uid > 0 && petRevealed(p) && !p.shiny);
  const [uid, setUid] = useState<number | null>(initialUid);
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    setUid(initialUid);
    setLine(null);
  }, [initialUid]);
  const chosen = pets.find((p) => p.uid === uid) ?? pets[0] ?? null;
  const chance = nextStoneChance(st.glimmers);
  const dyeFor = (p: PetState) => (p.uid === pv.state.uid ? pv.dyeOn : pv.den.dyeOn[p.uid] ?? false);

  const use = () => {
    if (!chosen) return;
    const name = petShownName(chosen);
    let result: StoneResult | null = null;
    commit((doc, now) => {
      const next = applyShineStone(doc, now, chosen.uid);
      result = next.result;
      return next.doc;
    });
    const r = result as StoneResult | null;
    if (!r) return;
    if (!r.ok) setLine(STONE_REFUSAL[r.reason]);
    else if (r.shiny) setLine(`✨ It worked — ${name} is shiny (${SHINY_STYLE_LABEL.classic})!`);
    else if (r.glimmers >= GLIMMER_PITY) setLine(`No shine this time — glimmer ${r.glimmers}/${GLIMMER_PITY}. Your next Stone is certain.`);
    else setLine(`No shine this time — glimmer ${r.glimmers}/${GLIMMER_PITY}. ${GLIMMER_PITY - r.glimmers} more and the next Stone is certain.`);
  };

  return (
    <>
      <View style={styles.statRow}>
        <Text style={styles.held}>💎 Shine Stones: {st.held}</Text>
        <Text style={styles.glimmer}>
          Glimmers {Math.min(st.glimmers, GLIMMER_PITY)}/{GLIMMER_PITY}
        </Text>
      </View>
      <Text style={styles.chance}>
        {chance === 100 ? 'Your next Stone is certain to work.' : `Your next Stone: a ${chance}% chance to turn a pet shiny.`}
      </Text>
      <Text style={styles.body}>
        A miss adds a glimmer (yours, not the pet’s); with {GLIMMER_PITY} the next Stone always works. Each Stone’s roll is
        set in advance — closing the app can’t change it. Looks only: a shiny never changes stats.
      </Text>

      <NeonLabel>Pick a pet</NeonLabel>
      {pets.length === 0 ? (
        <Text style={styles.body}>No pet can take a Stone right now — it needs a revealed pet (Child and up) that isn’t shiny yet.</Text>
      ) : (
        <>
          <View style={styles.chips}>
            {pets.map((p) => (
              <NeonChip
                key={p.uid}
                label={`${petShownName(p)}${p.grade ? ` · ${gradeTag(p.grade)}` : ''}${p.uid === pv.state.uid ? ' · active' : ''}${p.glimmer ? ' · glimmer' : ''}`}
                selected={chosen?.uid === p.uid}
                onPress={() => {
                  setUid(p.uid);
                  setLine(null);
                }}
              />
            ))}
          </View>
          {chosen ? (
            <View style={styles.figure}>
              <PetFigure
                pet={chosen}
                baseBox={72}
                eggColor={chosen.egg ? EGG_COLOR[chosen.egg] : ELEMENT_COLOR[view.legendElement]}
                recolor={petRecolor(chosen.hero, chosen.shiny, dyeFor(chosen), chosen.shiny_style)}
                lockColour={chosen.shiny}
              />
            </View>
          ) : null}
          <NeonButton
            label={st.held > 0 && chosen ? `Use a Shine Stone on ${petShownName(chosen)}` : 'No Shine Stones'}
            variant="primary"
            disabled={st.held < 1 || !chosen}
            onPress={use}
          />
        </>
      )}
      {line ? <Text style={styles.result}>{line}</Text> : null}
      {st.held < 1 ? (
        <Text style={styles.body}>
          Stones come from the first daily-challenge Gold each day, long expeditions, the deepest dives, days you play and
          milestones — the Guide has every chance.
        </Text>
      ) : null}
      <Text style={styles.body}>Stones used so far: {st.used}.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  held: { fontFamily: Fonts.monoBold, fontSize: 14, color: NEON.cyan },
  glimmer: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#FFE9A8' },
  chance: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  figure: { alignItems: 'center', paddingVertical: 4 },
  result: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
});
