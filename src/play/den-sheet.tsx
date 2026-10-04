/**
 * The Den sheet (v27, Part D) — every pet you keep, one active at a time.
 *
 *   Slots used / total · the swap block (mid-dive, away, a mini-game, an
 *   egg already paid for) · sort chips (favourites first) · the active pet
 *   and every resting one as STATIC figures (no animated sprites — up to 12
 *   rows on a phone) · per pet: Make active, View card, Rename, ★, Use a
 *   Shine Stone, Release (double tap) · New egg (needs a free slot) · Buy a
 *   slot for shells. Every rule lives in `den.ts` / `playStore.ts`.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { DEN_MAX_SLOTS, DEN_SORTS, DEN_SORT_LABEL, isBlankSlot, petRevealed, sortDen, type DenSort } from '@/play/den';
import { finishWornLabel } from '@/play/finishes';
import { FinishPicker } from '@/play/finish-picker';
import { heroName } from '@/play/heroes-data';
import { ELEMENT_COLOR } from '@/play/kits';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { PET_STAGE_LABEL, type PetState } from '@/play/pet';
import { PetCard } from '@/play/pet-card';
import {
  EGG_COLOR,
  EGG_LABEL,
  GRADE_COLOR,
  GRADE_LABEL,
  SHINY_STYLE_LABEL,
  gradeTag,
  heroStars,
  ownsAllStyles,
  petShownName,
} from '@/play/pet-eggs';
import { PetFigure } from '@/play/pet-figure';
import { petRecolor } from '@/play/pet-looks';
import { useArm } from '@/play/pet-menu';
import { PET_NAME_MAX, checkPetName } from '@/play/play-settings';
import {
  activateDenPet,
  buyDenSlot,
  newEggDoc,
  releaseDenPet,
  renameDenPet,
  setPetFav,
  type DenRefusal,
  type DenSlotResult,
  type PlayView,
} from '@/play/playStore';
import type { PlayTransition } from '@/play/use-play-store';

type Commit = (transition: PlayTransition) => boolean;

export const DEN_REFUSAL: Record<DenRefusal, string> = {
  diving: 'Your pet is on a dive — surface first, then swap.',
  away: 'Your pet is away on an expedition — swap once it’s back.',
  game: 'Finish the mini-game first, then swap.',
  pick_egg: 'Pick the egg you already paid for first.',
  full: 'The Den is full — free a slot or buy one.',
  blank: 'You’re already choosing an egg — pick one first.',
  missing: 'That pet isn’t in the Den any more.',
};

const NAME_REASON = {
  empty: 'Type a name first.',
  long: `Up to ${PET_NAME_MAX} characters.`,
  chars: 'Letters, numbers, spaces, - and ’ only.',
  word: 'Let’s pick a different name.',
} as const;

function stageLine(pet: PetState): string {
  if (isBlankSlot(pet)) return 'Choosing an egg';
  if (pet.stage === 'egg') return `${pet.egg ? EGG_LABEL[pet.egg] : ''} egg`.trim();
  if (!petRevealed(pet)) return `${PET_STAGE_LABEL[pet.stage]}${pet.egg ? ` · ${EGG_LABEL[pet.egg]}` : ''}`;
  return `${pet.grade ? gradeTag(pet.grade) : ''} · ${PET_STAGE_LABEL[pet.stage]}${pet.shiny ? ' · ✨' : ''}${pet.glimmer && !pet.shiny ? ' · glimmer' : ''}`;
}

function DenRow({
  pet,
  active,
  selected,
  dyeOn,
  fallbackColor,
  onPress,
}: {
  pet: PetState;
  active: boolean;
  selected: boolean;
  dyeOn: boolean;
  fallbackColor: string;
  onPress: () => void;
}) {
  const revealed = petRevealed(pet);
  const blank = isBlankSlot(pet);
  const name = blank ? 'New egg' : petShownName(pet);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${stageLine(pet)}${finishWornLabel(pet.finish_kind, pet.finish_color) ? `, ${finishWornLabel(pet.finish_kind, pet.finish_color)}` : ''}${active ? ', active' : ', resting'}${pet.fav ? ', favourite' : ''}`}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}>
      <View style={styles.figure}>
        {blank ? (
          <Text style={styles.blankEgg}>🥚</Text>
        ) : (
          <PetFigure
            pet={pet}
            baseBox={44}
            eggColor={pet.egg ? EGG_COLOR[pet.egg] : fallbackColor}
            recolor={revealed ? petRecolor(pet.hero, pet.shiny, dyeOn, pet.shiny_style) : null}
            lockColour={pet.shiny}
          />
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, revealed && pet.grade ? { color: GRADE_COLOR[pet.grade] } : null]} numberOfLines={1}>
          {pet.fav ? '★ ' : ''}
          {name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {stageLine(pet)}
          {finishWornLabel(pet.finish_kind, pet.finish_color) ? ` · ${finishWornLabel(pet.finish_kind, pet.finish_color)}` : ''}
        </Text>
      </View>
      <Text style={[styles.rowTag, active && styles.rowTagActive]}>{active ? 'Active' : '💤 Resting'}</Text>
    </Pressable>
  );
}

export function DenSheetBody({
  view,
  commit,
  gameOpen,
  reduceMotion,
  onNewEgg,
  onOpenStone,
  onOpenPrism,
  onViewActiveCard,
}: {
  view: PlayView;
  commit: Commit;
  /** A mini-game round is open (UI state) — swapping is refused. */
  gameOpen: boolean;
  reduceMotion: boolean;
  /** A new egg slot is ready: open the egg picker. */
  onNewEgg: () => void;
  /** Open the Shine Stone sheet with this pet picked. */
  onOpenStone: (uid: number) => void;
  /** Open the Prism Stone sheet with this pet picked. */
  onOpenPrism: (uid: number) => void;
  onViewActiveCard: () => void;
}) {
  const pv = view.pet;
  const den = pv.den;
  const active = pv.state;
  const [sort, setSort] = useState<DenSort>('recent');
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [draft, setDraft] = useState('');
  const [releaseArmed, pressRelease, disarmRelease] = useArm();

  const resting = sortDen(den.resting, sort);
  const selected = picked == null ? null : picked === active.uid && active.uid > 0 ? active : den.resting.find((p) => p.uid === picked) ?? null;
  const selectedResting = selected != null && selected !== active;
  const block = gameOpen ? 'game' : den.block;
  const fallback = ELEMENT_COLOR[view.legendElement];

  useEffect(() => {
    setShowCard(false);
    setDraft(selected?.name ?? '');
    disarmRelease();
    // Only when the picked pet changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  useEffect(() => {
    if (picked != null && selected == null) setPicked(null);
  }, [picked, selected]);

  const pick = (uid: number) => {
    setNote(null);
    setPicked((cur) => (cur === uid ? null : uid));
  };

  const makeActive = (uid: number) => {
    let reason: DenRefusal | null = null;
    commit((doc, now) => {
      const next = activateDenPet(doc, now, uid, gameOpen);
      if (!next.result.ok) reason = next.result.reason;
      return next.doc;
    });
    if (reason) setNote(DEN_REFUSAL[reason as DenRefusal]);
    else {
      setNote(null);
      setPicked(null);
    }
  };

  const newEgg = () => {
    let reason: DenRefusal | null = null;
    commit((doc, now) => {
      const next = newEggDoc(doc, now, gameOpen);
      if (!next.result.ok) reason = next.result.reason;
      return next.doc;
    });
    if (reason) setNote(DEN_REFUSAL[reason as DenRefusal]);
    else {
      setNote(null);
      onNewEgg();
    }
  };

  const buySlot = () => {
    let result: DenSlotResult | null = null;
    commit((doc) => {
      const next = buyDenSlot(doc);
      result = next.result;
      return next.doc;
    });
    const r = result as DenSlotResult | null;
    if (!r) return;
    if (r.ok) setNote(`A new slot — ${den.slots + 1} in your Den.`);
    else setNote(r.reason === 'max' ? `The Den is at its most (${DEN_MAX_SLOTS}).` : `Not enough shells — a slot costs ${den.nextSlotPrice}.`);
  };

  const saveName = (uid: number) => {
    const checked = checkPetName(draft);
    if (!checked.ok) {
      setNote(NAME_REASON[checked.reason]);
      return;
    }
    const ok = commit((doc, now) => renameDenPet(doc, now, uid, checked.name));
    setNote(ok ? `Renamed to ${checked.name}.` : 'That name didn’t change anything.');
  };

  const release = (uid: number) => {
    if (!pressRelease()) return;
    const ok = commit((doc, now) => releaseDenPet(doc, now, uid));
    setNote(ok ? 'Sent to the Hall — a shard is waiting in your Collection.' : 'Only a Child or older can be released.');
    if (ok) setPicked(null);
  };

  const full = den.used >= den.slots;
  const rec = selected?.hero ? pv.heroes[selected.hero] : undefined;
  const selDye = selected ? (selected === active ? pv.dyeOn : den.dyeOn[selected.uid] ?? false) : false;

  return (
    <>
      <View style={styles.headRow}>
        <Text style={styles.slots}>
          Slots {den.used}/{den.slots}
        </Text>
        <Text style={styles.body}>Resting pets are frozen — no growing, hunger or mood loss.</Text>
      </View>
      {block ? <Text style={styles.block}>{DEN_REFUSAL[block]}</Text> : null}

      <View style={styles.chips}>
        {DEN_SORTS.map((s) => (
          <NeonChip key={s} label={DEN_SORT_LABEL[s]} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </View>

      <DenRow
        pet={active}
        active
        selected={selected === active}
        dyeOn={pv.dyeOn}
        fallbackColor={fallback}
        onPress={() => (active.uid > 0 ? pick(active.uid) : undefined)}
      />
      {resting.length === 0 ? <Text style={styles.body}>No pets resting yet — start a new egg and this one rests here.</Text> : null}
      {resting.map((p) => (
        <DenRow
          key={p.uid}
          pet={p}
          active={false}
          selected={selected?.uid === p.uid}
          dyeOn={den.dyeOn[p.uid] ?? false}
          fallbackColor={fallback}
          onPress={() => pick(p.uid)}
        />
      ))}

      {selected ? (
        <View style={styles.panel}>
          <NeonLabel>{petShownName(selected)}</NeonLabel>
          <View style={styles.chips}>
            <NeonChip
              label={selected.fav ? '★ Favourite' : '☆ Favourite'}
              selected={selected.fav}
              onPress={() => commit((doc, now) => setPetFav(doc, now, selected.uid, !selected.fav))}
            />
            {petRevealed(selected) ? (
              <NeonChip
                label={selectedResting ? (showCard ? 'Hide card' : 'View card') : 'View card'}
                onPress={() => (selectedResting ? setShowCard((s) => !s) : onViewActiveCard())}
              />
            ) : null}
            {petRevealed(selected) && !selected.shiny ? (
              <NeonChip label="Use a Shine Stone" onPress={() => onOpenStone(selected.uid)} />
            ) : null}
            {petRevealed(selected) && !selected.shiny ? (
              <NeonChip label="Use a Prism Stone" onPress={() => onOpenPrism(selected.uid)} />
            ) : null}
          </View>

          {showCard && selectedResting && selected.hero ? (
            <View style={styles.cardCenter}>
              <PetCard
                live
                width={230}
                animate={!reduceMotion}
                info={{
                  name: selected.name ?? heroName(selected.hero),
                  hero: selected.name ? heroName(selected.hero) : null,
                  grade: selected.grade,
                  shiny: selected.shiny,
                  stars: heroStars(rec?.copies ?? 0),
                  egg: selected.egg,
                  forms: selected.forms,
                  band: selected.band,
                  days: Math.round((selected.total_age_ms / 86_400_000) * 10) / 10,
                  dye: selDye,
                  resting: true,
                  allStyles: ownsAllStyles(rec),
                  styleLabel: selected.shiny && selected.shiny_style ? SHINY_STYLE_LABEL[selected.shiny_style] : null,
                  finishKind: selected.finish_kind,
                  finishColor: selected.finish_color,
                  finishLabel: finishWornLabel(selected.finish_kind, selected.finish_color),
                  aura: selected.aura_style !== 'none',
                }}
                sprite={
                  <PetFigure
                    pet={selected}
                    baseBox={140}
                    eggColor={selected.egg ? EGG_COLOR[selected.egg] : fallback}
                    recolor={petRecolor(selected.hero, selected.shiny, selDye, selected.shiny_style)}
                    lockColour={selected.shiny}
                    foilMotion="sweep"
                    reduceMotion={reduceMotion}
                    reverseHost
                    auraElement={view.swords.equipped?.element ?? null}
                  />
                }
              />
            </View>
          ) : null}

          {petRevealed(selected) ? (
            <FinishPicker view={view} commit={commit} pet={selected} dyeOn={selDye} reduceMotion={reduceMotion} />
          ) : null}

          {selectedResting ? (
            <>
              <NeonButton
                label={block ? 'Make active · not now' : 'Make active'}
                disabled={block != null}
                onPress={() => makeActive(selected.uid)}
              />
              {selected.egg != null || selected.hero != null ? (
                <>
                  <TextInput
                    value={draft}
                    onChangeText={(t) => {
                      setDraft(t.slice(0, PET_NAME_MAX + 4));
                      setNote(null);
                    }}
                    maxLength={PET_NAME_MAX}
                    placeholder={petShownName({ ...selected, name: null })}
                    placeholderTextColor={NEON.textMuted}
                    style={styles.input}
                    accessibilityLabel="Resting pet name"
                    autoCorrect={false}
                  />
                  <View style={styles.chips}>
                    <NeonChip label="Save name" onPress={() => saveName(selected.uid)} />
                    {selected.name ? (
                      <NeonChip
                        label="Use the default"
                        onPress={() => {
                          commit((doc, now) => renameDenPet(doc, now, selected.uid, null));
                          setDraft('');
                        }}
                      />
                    ) : null}
                  </View>
                </>
              ) : null}
              {petRevealed(selected) ? (
                <NeonButton
                  label={
                    releaseArmed
                      ? `Tap again · release (1 ${GRADE_LABEL[selected.grade ?? 'common']} shard)`
                      : 'Release to the Hall'
                  }
                  variant={releaseArmed ? 'danger' : 'secondary'}
                  onPress={() => release(selected.uid)}
                />
              ) : (
                <Text style={styles.body}>Eggs and Babies can’t be released — make it active and raise it to Child.</Text>
              )}
            </>
          ) : (
            <Text style={styles.body}>This is your active pet — rename or release it from the ⋯ menu.</Text>
          )}
        </View>
      ) : null}

      {note ? <Text style={styles.note}>{note}</Text> : null}

      <NeonLabel>More pets</NeonLabel>
      <NeonButton
        label={full ? 'New egg · free a slot or buy one' : 'New egg'}
        variant="primary"
        disabled={full || block != null || isBlankSlot(active)}
        onPress={newEgg}
      />
      <Text style={styles.body}>
        {isBlankSlot(active)
          ? 'You’re choosing an egg right now — pick one first.'
          : full
            ? 'The Den is full — release a pet or buy a slot.'
            : 'Your active pet rests here and the new egg becomes active.'}
      </Text>
      {den.nextSlotPrice != null ? (
        <NeonButton
          label={`Buy a slot · ${den.nextSlotPrice} shells`}
          variant="secondary"
          disabled={view.shells < den.nextSlotPrice}
          onPress={buySlot}
          accessibilityLabel={`Buy a Den slot for ${den.nextSlotPrice} shells. You have ${view.shells}.`}
        />
      ) : (
        <Text style={styles.body}>The Den is at its most — {DEN_MAX_SLOTS} slots.</Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  note: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.cyan },
  block: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.pink },
  headRow: { gap: 2 },
  slots: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rowSelected: { borderColor: NEON.cyan },
  pressed: { opacity: 0.7 },
  figure: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  blankEgg: { fontSize: 28 },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.textPrimary },
  rowMeta: { fontFamily: Fonts.mono, fontSize: 11, color: NEON.textMuted },
  rowTag: { fontFamily: Fonts.mono, fontSize: 10, color: NEON.textMuted },
  rowTagActive: { color: NEON.cyan, fontFamily: Fonts.monoBold },
  panel: { gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: NEON.cyanDim },
  cardCenter: { alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: Fonts.monoBold,
    color: NEON.textPrimary,
  },
});
