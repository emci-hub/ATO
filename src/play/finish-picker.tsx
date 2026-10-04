/**
 * Finish picker (save v30) — holo or reverse holo, plus a named colour.
 * Names are always written out (the swatch is only a hint). The preview is
 * the pet you are dressing, foil included, before you spend tokens.
 */
import { useEffect, useState } from 'react';
import { PixelRatio, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { petRevealed } from '@/play/den';
import {
  finishColors,
  finishPrice,
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
  color: 'Pick a named colour.',
  pass: 'Starpearl is a Tide Pass colour.',
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
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setKind(pet.finish_kind);
    setColorId(pet.finish_color ?? finishColors()[0].id);
  }, [pet.uid, pet.finish_kind, pet.finish_color]);

  const wearing = finishWornLabel(pet.finish_kind, pet.finish_color);
  const quote = planFinishWear({
    wallet: access.wallet,
    tokens: view.tokens,
    pass: access.pass,
    free: access.free,
    kind,
    color: kind === 'none' ? null : colorId,
  });
  const previewKind = kind === 'none' ? null : kind;
  const color = finishColors().find((row) => row.id === colorId) ?? finishColors()[0];

  const wear = () => {
    if (!revealed) return;
    let line = '';
    const ok = commit((doc, now) => {
      const res = applyPetFinish(doc, now, pet.uid, kind, kind === 'none' ? null : colorId);
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

  return (
    <View style={styles.wrap}>
      <NeonLabel>Finish</NeonLabel>
      <Text style={styles.body}>
        A look you pick. Holo foils the art window behind the pet. Reverse holo foils
        the rest of the card, and the pet stays plain. Never rolled, so the egg odds stay the odds you see. Classic is
        still the only shiny you earn.
        {access.free ? ' Unlocked while everything is free.' : access.pass ? ' Tide Pass discount is on.' : ''}
      </Text>
      {wearing ? <Text style={styles.wearing}>Wearing {wearing}</Text> : null}
      <View style={styles.chips}>
        {(['none', 'holo', 'reverse'] as const).map((id) => (
          <NeonChip
            key={id}
            label={id === 'none' ? 'None' : id === 'holo' ? 'Holo' : 'Reverse holo'}
            selected={kind === id}
            onPress={() => {
              setKind(id);
              setNote(null);
            }}
          />
        ))}
      </View>
      <View style={styles.colors}>
        {finishColors().map((row) => {
          const locked = row.pass_only && !access.pass && !access.free;
          return (
            <NeonChip
              key={row.id}
              label={locked ? `${row.name} · Tide Pass` : row.name}
              selected={colorId === row.id}
              accessibilityLabel={locked ? `${row.name}, Tide Pass colour` : row.name}
              onPress={() => {
                setColorId(row.id);
                if (kind === 'none') setKind('holo');
                setNote(null);
              }}
            />
          );
        })}
      </View>
      <Swatch stops={color.stops} />
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
              finish={previewKind ? { kind: previewKind, color: colorId } : { kind: 'none', color: null }}
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
          : `Holo or reverse holo is ${finishPrice('holo', access.pass)} tokens and includes one new colour. Each extra colour is ${finishPrice('extra_color', access.pass)}. You have ${view.tokens}.`}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  swatchBand: { flex: 1 },
  preview: { alignSelf: 'center', alignItems: 'center' },
  note: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
});
