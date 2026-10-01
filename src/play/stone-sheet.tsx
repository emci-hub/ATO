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
import {
  EGG_COLOR,
  GLIMMER_PITY,
  PRISM_STYLES,
  PRISM_STYLE_COST,
  SHINY_STYLE_LABEL,
  STONE_ODDS,
  gradeTag,
  petShownName,
  type PrismStyle,
} from '@/play/pet-eggs';
import { PetFigure } from '@/play/pet-figure';
import { petRecolor } from '@/play/pet-looks';
import {
  applyPrismStone,
  applyShineStone,
  type PlayView,
  type PrismRefusal,
  type PrismResult,
  type StoneRefusal,
  type StoneResult,
} from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

type CommitSaved = (transition: PlayTransition) => Promise<boolean>;

export const PRISM_REFUSAL: Record<PrismRefusal, string> = {
  no_stones: 'Not enough Prism Stones for that style.',
  missing: 'That pet isn’t here any more.',
  not_revealed: 'Only a revealed pet (Child and up) can take a Prism Stone.',
  shiny: 'It’s already shiny — a Prism Stone can’t restyle it.',
  style: 'Pick a Prism style. Classic is never sold.',
};

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
  commitSaved,
  initialUid,
  mode = 'shine',
}: {
  view: PlayView;
  /** Resolves after the Stone is in storage. The result line waits on it. */
  commitSaved: CommitSaved;
  /** The pet the Den (or the menu) opened this for. */
  initialUid: number | null;
  /** v28 — Prism Stones: pick a style. Shine is the Part D sheet. */
  mode?: 'shine' | 'prism';
}) {
  const pv = view.pet;
  const st = pv.stones;
  const pets: PetState[] = [pv.state, ...pv.den.resting].filter((p) => p.uid > 0 && petRevealed(p) && !p.shiny);
  const [uid, setUid] = useState<number | null>(initialUid);
  const [line, setLine] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [style, setStyle] = useState<PrismStyle>('aurora');
  useEffect(() => {
    setUid(initialUid);
    setLine(null);
  }, [initialUid]);
  const chosen = pets.find((p) => p.uid === uid) ?? pets[0] ?? null;
  const chance = nextStoneChance(st.glimmers);
  const dyeFor = (p: PetState) => (p.uid === pv.state.uid ? pv.dyeOn : pv.den.dyeOn[p.uid] ?? false);

  const use = () => {
    if (!chosen || pending) return;
    const name = petShownName(chosen);
    const target = chosen.uid;
    setPending(true);
    setLine(null);
    void (async () => {
      const box: { result: StoneResult | null } = { result: null };
      const saved = await commitSaved((doc, now) => {
        const next = applyShineStone(doc, now, target);
        box.result = next.result;
        return next.doc;
      });
      setPending(false);
      const result = box.result;
      // The line is the first thing the player sees. It is set only after the
      // write finishes, so a hit they have read cannot be aimed at another pet.
      if (!saved || !result) {
        setLine('Couldn’t save that Stone. Nothing was spent — try again.');
        return;
      }
      const r = result;
      if (!r.ok) setLine(STONE_REFUSAL[r.reason]);
      else if (r.shiny) setLine(`✨ It worked — ${name} is shiny (${SHINY_STYLE_LABEL.classic})!`);
      else if (r.glimmers >= GLIMMER_PITY) setLine(`No shine this time — glimmer ${r.glimmers}/${GLIMMER_PITY}. Your next Stone is certain.`);
      else setLine(`No shine this time — glimmer ${r.glimmers}/${GLIMMER_PITY}. ${GLIMMER_PITY - r.glimmers} more and the next Stone is certain.`);
    })();
  };

  const usePrism = () => {
    if (!chosen || pending) return;
    const name = petShownName(chosen);
    const target = chosen.uid;
    const picked = style;
    setPending(true);
    setLine(null);
    void (async () => {
      const box: { result: PrismResult | null } = { result: null };
      const saved = await commitSaved((doc, now) => {
        const next = applyPrismStone(doc, now, target, picked);
        box.result = next.result;
        return next.doc;
      });
      setPending(false);
      const result = box.result;
      if (!saved || !result) {
        setLine('Couldn’t save that Stone. Nothing was spent — try again.');
        return;
      }
      if (!result.ok) setLine(PRISM_REFUSAL[result.reason]);
      else setLine(`✨ ${name} is shiny — ${SHINY_STYLE_LABEL[result.style]}. ${result.left} Prism Stone${result.left === 1 ? '' : 's'} left.`);
    })();
  };

  if (mode === 'prism') {
    const cost = PRISM_STYLE_COST[style];
    return (
      <>
        <Text style={styles.held}>◆ Prism Stones: {st.prism}</Text>
        <Text style={styles.body}>
          Pick a style for a revealed pet that isn’t shiny yet. The number on each style is how many Prism Stones it costs.
          Classic is never sold — it comes from play. Looks only.
        </Text>
        <NeonLabel>Pick a style</NeonLabel>
        <View style={styles.chips}>
          {PRISM_STYLES.map((s) => (
            <NeonChip
              key={s}
              label={`${SHINY_STYLE_LABEL[s]} · ${PRISM_STYLE_COST[s]}`}
              selected={style === s}
              onPress={() => {
                setStyle(s);
                setLine(null);
              }}
            />
          ))}
        </View>
        <NeonLabel>Pick a pet</NeonLabel>
        {pets.length === 0 ? (
          <Text style={styles.body}>No pet can take a Prism Stone right now — it needs a revealed pet that isn’t shiny yet.</Text>
        ) : (
          <>
            <View style={styles.chips}>
              {pets.map((p) => (
                <NeonChip
                  key={p.uid}
                  label={`${petShownName(p)}${p.uid === pv.state.uid ? ' · active' : ''}`}
                  selected={chosen?.uid === p.uid}
                  onPress={() => {
                    setUid(p.uid);
                    setLine(null);
                  }}
                />
              ))}
            </View>
            <NeonButton
              label={chosen && st.prism >= cost ? `Use ${cost} on ${petShownName(chosen)}` : `Need ${cost} Prism Stones`}
              variant="primary"
              disabled={pending || !chosen || st.prism < cost}
              onPress={usePrism}
            />
          </>
        )}
        {line ? <Text style={styles.result}>{line}</Text> : null}
      </>
    );
  }

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
            disabled={pending || st.held < 1 || !chosen}
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
