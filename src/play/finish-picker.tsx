/**
 * Finish picker (save v30, reworked 2026-10-14) — holo or reverse holo, plus a
 * prism / rim colour, a shine sweep colour and a glint colour. Colours come in
 * two groups: Single colour (free) and Mix (150 tokens once, 110 with a Tide
 * Pass). Names are always written out (the swatch is only a hint). The preview
 * is the pet you are dressing, holo on it, before you spend tokens.
 */
import { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { petRevealed } from '@/play/den';
import {
  finishColors,
  finishGlints,
  finishPrice,
  finishSweeps,
  finishWornLabel,
  planFinishWear,
  type FinishKind,
} from '@/play/finishes';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { heroStars } from '@/play/pet-eggs';
import { NEON } from '@/play/neon-viper';
import type { PetState } from '@/play/pet';
import { PetCard } from '@/play/pet-card';
import { sharpPetBox } from '@/play/pet-actor';
import { usePetArt } from '@/play/pet-anim-sprite';
import { PetFigure } from '@/play/pet-figure';
import { petRecolor, useBlendRecolor } from '@/play/pet-looks';
import { applyPetFinish, type PlayView } from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

const REFUSAL = {
  kind: 'Pick holo or reverse holo.',
  color: 'Pick a colour.',
  pass: 'That needs a Tide Pass.',
  tokens: 'Not enough tokens yet.',
  missing: 'That pet is not here.',
  not_revealed: 'From Child up.',
} as const;

function Swatch({ stops }: { stops: readonly string[] }) {
  return (
    <View style={styles.swatch}>
      {stops.map((color, i) => (
        <View key={`${color}-${i}`} style={[styles.swatchBand, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** Chips for one colour list, with its Single colour / Mix group labels. */
function ColourChips<T extends { id: string; name: string; group?: string }>({
  items,
  selected,
  onPick,
  locked,
}: {
  items: readonly T[];
  selected: string;
  onPick: (id: string) => void;
  locked?: (item: T) => boolean;
}) {
  const out: React.ReactNode[] = [];
  let last: string | undefined;
  for (const item of items) {
    if (item.group && item.group !== last) {
      last = item.group;
      out.push(
        <Text key={`group-${item.group}`} style={styles.group}>
          {item.group}
        </Text>,
      );
    }
    const isLocked = locked?.(item) ?? false;
    out.push(
      <NeonChip
        key={item.id}
        label={isLocked ? `${item.name} · token` : item.name}
        selected={selected === item.id}
        accessibilityLabel={isLocked ? `${item.name}, costs tokens` : item.name}
        onPress={() => onPick(item.id)}
      />,
    );
  }
  return <View style={styles.colors}>{out}</View>;
}

export function FinishPicker({
  view,
  commit,
  pet,
  dyeOn,
  reduceMotion,
}: {
  view: PlayView;
  commit: (transition: PlayTransition) => boolean;
  pet: PetState;
  dyeOn: boolean;
  reduceMotion: boolean;
}) {
  const blend = useBlendRecolor();
  const { width: screenW } = useWindowDimensions();
  const art = usePetArt(pet);
  const previewW = Math.min(280, Math.max(200, screenW - 32));
  const previewBox = sharpPetBox(Math.round(previewW * 0.7), art.cellPx, PixelRatio.get());
  const access = view.pet.finish;
  const revealed = petRevealed(pet);
  const [kind, setKind] = useState<FinishKind>(pet.finish_kind);
  const [colorId, setColorId] = useState(pet.finish_color ?? finishColors()[0].id);
  const [sweepId, setSweepId] = useState(pet.finish_sweep);
  const [glintId, setGlintId] = useState(pet.finish_glint);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setKind(pet.finish_kind);
    setColorId(pet.finish_color ?? finishColors()[0].id);
    setSweepId(pet.finish_sweep);
    setGlintId(pet.finish_glint);
  }, [pet.uid, pet.finish_kind, pet.finish_color, pet.finish_sweep, pet.finish_glint]);

  const wearing = finishWornLabel(pet.finish_kind, pet.finish_color);
  const quote = planFinishWear({
    wallet: access.wallet,
    tokens: view.tokens,
    pass: access.pass,
    free: access.free,
    kind,
    color: kind === 'none' ? null : colorId,
    sweep: sweepId,
    glint: glintId,
  });
  const previewKind = kind === 'none' ? null : kind;
  const color = finishColors().find((row) => row.id === colorId) ?? finishColors()[0];
  const owned = (key: string) => access.free || access.wallet.colors.includes(key);

  const wear = () => {
    if (!revealed) return;
    let line = '';
    const ok = commit((doc, now) => {
      const res = applyPetFinish(doc, now, pet.uid, kind, kind === 'none' ? null : colorId, sweepId, glintId);
      if (!res.result.ok) {
        line = REFUSAL[res.result.reason];
        return null;
      }
      const label = finishWornLabel(res.result.kind, res.result.color);
      line = label
        ? res.result.cost > 0
          ? `${label} is on. ${res.result.cost} tokens spent, ${res.result.left} left.`
          : `${label} is on.`
        : 'Finish taken off.';
      return res.doc;
    });
    setNote(line || (ok ? 'Done.' : 'Couldn’t save that finish.'));
  };

  let button = 'Wear';
  if (!revealed) button = 'From Child up';
  else if (!quote.ok) button = REFUSAL[quote.reason];
  else if (kind === 'none') button = wearing ? 'Take the finish off' : 'No finish';
  else if (access.free) button = `Wear ${finishWornLabel(kind, colorId) ?? ''}`;
  else if (quote.cost > 0) button = `Wear · ${quote.cost} tokens`;
  else button = `Wear ${finishWornLabel(kind, colorId) ?? ''}`;

  const pickKind = (id: FinishKind) => {
    setKind(id);
    setNote(null);
  };
  const touch = () => {
    if (kind === 'none') setKind('holo');
    setNote(null);
  };

  return (
    <View style={styles.wrap}>
      <NeonLabel>Finish</NeonLabel>
      <Text style={styles.body}>
        Holo puts moving prism bands, a shine sweep and glints on your pet. Reverse holo wraps a foil rim round it and
        keeps its own colours. The card keeps a quiet foil border. Never rolled, so the egg odds stay the odds you see.
        Classic is still the only shiny you earn.
        {access.free ? ' Unlocked while everything is free.' : access.pass ? ' Tide Pass discount is on.' : ''}
      </Text>
      {wearing ? <Text style={styles.wearing}>Wearing {wearing}</Text> : null}
      <View style={styles.chips}>
        {(['none', 'holo', 'reverse'] as const).map((id) => (
          <NeonChip
            key={id}
            label={id === 'none' ? 'None' : id === 'holo' ? 'Holo' : 'Reverse holo'}
            selected={kind === id}
            onPress={() => pickKind(id)}
          />
        ))}
      </View>
      <Text style={styles.section}>{kind === 'reverse' ? 'Rim colour' : 'Prism colour'}</Text>
      <ColourChips
        items={finishColors()}
        selected={colorId}
        locked={(item) => item.group === 'Mix' && !owned(item.id)}
        onPick={(id) => {
          setColorId(id);
          touch();
        }}
      />
      <Swatch stops={color.stops} />
      <Text style={styles.section}>Shine sweep</Text>
      <ColourChips
        items={finishSweeps()}
        selected={sweepId}
        locked={(item) => item.group === 'Mix' && !owned(`sweep:${item.id}`)}
        onPick={(id) => {
          setSweepId(id);
          touch();
        }}
      />
      <Text style={styles.section}>Glint</Text>
      <ColourChips
        items={finishGlints()}
        selected={glintId}
        onPick={(id) => {
          setGlintId(id);
          touch();
        }}
      />
      <View style={styles.preview}>
        <PetCard
          live
          width={previewW}
          animate={!reduceMotion}
          info={{
            name: pet.name ?? 'Pet',
            grade: pet.grade,
            shiny: pet.shiny,
            stars: pet.hero ? heroStars(view.pet.heroes[pet.hero]?.copies ?? 0) : 0,
            egg: pet.egg,
            forms: pet.forms,
            band: pet.band,
            days: null,
            dye: dyeOn,
            styleLabel: pet.shiny ? 'Classic' : null,
            finishKind: kind,
            finishColor: kind === 'none' ? null : colorId,
            finishLabel: kind === 'none' ? null : finishWornLabel(kind, colorId),
            aura: pet.auras.length > 0,
          }}
          sprite={
            <PetFigure
              pet={pet}
              baseBox={previewBox}
              box={previewBox}
              eggColor="#9FD8FF"
              recolor={revealed ? petRecolor(pet.hero, pet.shiny, dyeOn, pet.shiny_style) : null}
              blend={blend}
              lockColour={pet.shiny}
              finish={
                previewKind
                  ? { kind: previewKind, color: colorId, sweep: sweepId, glint: glintId }
                  : { kind: 'none', color: null }
              }
              foilMotion="sweep"
              reduceMotion={reduceMotion}
              reverseHost
              auraElement={view.swords.equipped?.element ?? null}
            />
          }
        />
      </View>
      <Text style={styles.body}>
        {access.free
          ? 'Tokens are not spent while everything is free.'
          : `Holo or reverse holo is ${finishPrice('holo', access.pass)} tokens. Single colours are free; each mix is ${finishPrice('extra_color', access.pass)} once. You have ${view.tokens}.`}
      </Text>
      <NeonButton label={button} disabled={!revealed || (kind !== 'none' && !quote.ok)} onPress={wear} />
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  wearing: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.textPrimary },
  section: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.textPrimary, marginTop: 4 },
  group: { fontFamily: Fonts.mono, fontSize: 11, color: NEON.textMuted, width: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  swatchBand: { flex: 1 },
  preview: { alignSelf: 'center', alignItems: 'center' },
  note: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
});
