/**
 * The Den / Stash sheet — every pet you keep, one active at a time. Step 0p: PLAIN.
 *
 *   A collection grid of every slot (filled, open, locked — "7/20 collected"),
 *   one fixed-height detail bar above it (Make active · ★ · rename · Release),
 *   New egg, Buy a slot for shells, and an "Open Locker" link. Pets are STATIC
 *   figures: no holo, rim, shine sweep, glint, wear or live cards here — those
 *   moved out of the Stash (the finish picker's new home is the Locker Style
 *   group). Every rule lives in `den.ts` / `playStore.ts`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { DEN_MAX_SLOTS, DEN_SORTS, DEN_SORT_LABEL, isBlankSlot, petRevealed, sortDen, type DenSort } from '@/play/den';
import { finishWornLabel } from '@/play/finishes';
import { ELEMENT_COLOR } from '@/play/kits';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { PET_STAGE_LABEL, type PetState } from '@/play/pet';
import { EGG_COLOR, EGG_LABEL, GRADE_COLOR, GRADE_LABEL, gradeTag, petShownName } from '@/play/pet-eggs';
import { PetFigure } from '@/play/pet-figure';
import { petStatusView } from '@/play/pet-status-view';
import { PetStatusBadge } from '@/play/pet-status-badge';
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

/** Fixed height of the detail bar: it never grows when a pet is picked (fixed regions). */
const DETAIL_H = 264;

/** The tile draws the pet bare: PetFigure falls back to the pet's own finish (a per-frame holo
 * clock) and its aura layers, so both are stripped here. */
function plainPet(pet: PetState): PetState {
  return { ...pet, finish_kind: 'none', finish_color: null, auras: [] };
}

/** `withGrade` false: the status badge beside it already says the grade, stars and shiny. */
function stageLine(pet: PetState, withGrade = true): string {
  if (isBlankSlot(pet)) return 'Choosing an egg';
  if (pet.stage === 'egg') return `${pet.egg ? EGG_LABEL[pet.egg] : ''} egg`.trim();
  if (!petRevealed(pet)) return `${PET_STAGE_LABEL[pet.stage]}${pet.egg ? ` · ${EGG_LABEL[pet.egg]}` : ''}`;
  if (!withGrade) return `${PET_STAGE_LABEL[pet.stage]}${pet.glimmer && !pet.shiny ? ' · glimmer' : ''}`;
  return `${pet.grade ? gradeTag(pet.grade) : ''} · ${PET_STAGE_LABEL[pet.stage]}${pet.shiny ? ' · ✨' : ''}${pet.glimmer && !pet.shiny ? ' · glimmer' : ''}`;
}

function PetTile({
  pet,
  active,
  selected,
  dyeOn,
  copies,
  fallbackColor,
  onPress,
}: {
  pet: PetState;
  active: boolean;
  selected: boolean;
  dyeOn: boolean;
  /** Copies of this pet's hero (the star row). */
  copies: number;
  fallbackColor: string;
  onPress: () => void;
}) {
  const revealed = petRevealed(pet);
  const blank = isBlankSlot(pet);
  const name = blank ? 'New egg' : petShownName(pet);
  const status = revealed ? petStatusView({ grade: pet.grade, copies, shiny: pet.shiny }) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${stageLine(pet)}${status ? `, ${status.label}` : ''}${active ? ', active' : ', resting'}${pet.fav ? ', favourite' : ''}`}
      style={({ pressed }) => [styles.tile, active && styles.tileActive, selected && styles.tileSelected, pressed && styles.pressed]}>
      <View style={styles.figure}>
        {blank ? (
          <Text style={styles.blankEgg}>🥚</Text>
        ) : (
          <PetFigure
            pet={plainPet(pet)}
            baseBox={44}
            eggColor={pet.egg ? EGG_COLOR[pet.egg] : fallbackColor}
            recolor={revealed ? petRecolor(pet.hero, pet.shiny, dyeOn, pet.shiny_style) : null}
            lockColour={pet.shiny}
          />
        )}
      </View>
      <Text style={[styles.tileName, revealed && pet.grade ? { color: GRADE_COLOR[pet.grade] } : null]} numberOfLines={1}>
        {pet.fav ? '★ ' : ''}
        {name}
      </Text>
      {/* The star row always reserves its line, so a tile never shifts when a pet is revealed. */}
      {status ? <PetStatusBadge status={status} variant="mini" /> : <View style={styles.miniSpacer} />}
    </Pressable>
  );
}

function EmptyTile({ kind, price }: { kind: 'open' | 'next' | 'locked'; price: number | null }) {
  return (
    <View
      style={[styles.tile, styles.tileEmpty, kind === 'locked' && styles.tileLocked]}
      accessibilityLabel={kind === 'open' ? 'Empty slot' : kind === 'next' ? `Locked slot, ${price} shells` : 'Locked slot'}>
      <Text style={styles.emptyMark}>{kind === 'open' ? '+' : '🔒'}</Text>
      <Text style={styles.tileName} numberOfLines={1}>
        {kind === 'open' ? 'Free' : kind === 'next' && price != null ? `${price}` : ' '}
      </Text>
    </View>
  );
}

export function DenSheetBody({
  view,
  commit,
  gameOpen,
  onNewEgg,
  onViewActiveCard,
  onOpenLocker,
}: {
  view: PlayView;
  commit: Commit;
  /** A mini-game round is open (UI state) — swapping is refused. */
  gameOpen: boolean;
  /** A new egg slot is ready: open the egg picker. */
  onNewEgg: () => void;
  onViewActiveCard: () => void;
  /** Opens the Locker (cosmetics live there, not in the Stash). */
  onOpenLocker?: () => void;
}) {
  const pv = view.pet;
  const den = pv.den;
  const active = pv.state;
  const [sort, setSort] = useState<DenSort>('recent');
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [releaseArmed, pressRelease, disarmRelease] = useArm();

  const resting = sortDen(den.resting, sort);
  const selected = picked == null ? null : picked === active.uid && active.uid > 0 ? active : den.resting.find((p) => p.uid === picked) ?? null;
  const selectedResting = selected != null && selected !== active;
  const block = gameOpen ? 'game' : den.block;
  const fallback = ELEMENT_COLOR[view.legendElement];

  useEffect(() => {
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

  const copiesOf = (p: PetState) => (p.hero ? pv.heroes[p.hero]?.copies ?? 0 : 0);
  const selectedStatus =
    selected && petRevealed(selected) ? petStatusView({ grade: selected.grade, copies: copiesOf(selected), shiny: selected.shiny }) : null;
  const full = den.used >= den.slots;
  const pets: { pet: PetState; active: boolean }[] = [
    { pet: active, active: true },
    ...resting.map((pet) => ({ pet, active: false })),
  ];
  const tiles: ReactNode[] = pets.map(({ pet, active: isActive }) => (
    <PetTile
      key={pet.uid}
      pet={pet}
      active={isActive}
      selected={selected?.uid === pet.uid && selected.uid > 0}
      dyeOn={isActive ? pv.dyeOn : den.dyeOn[pet.uid] ?? false}
      copies={copiesOf(pet)}
      fallbackColor={fallback}
      onPress={() => (pet.uid > 0 ? pick(pet.uid) : undefined)}
    />
  ));
  for (let i = pets.length; i < DEN_MAX_SLOTS; i++) {
    tiles.push(
      <EmptyTile key={`e${i}`} kind={i < den.slots ? 'open' : i === den.slots ? 'next' : 'locked'} price={den.nextSlotPrice} />,
    );
  }

  return (
    <>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={styles.slots}>
            Collected {den.used}/{DEN_MAX_SLOTS}
          </Text>
          <Text style={styles.body}>
            {den.slots} slots open · resting pets are frozen.
          </Text>
        </View>
        {onOpenLocker ? <NeonChip label="Open Locker" onPress={onOpenLocker} /> : null}
      </View>
      {block ? <Text style={styles.block}>{DEN_REFUSAL[block]}</Text> : null}

      <View style={styles.detail}>
        {selected ? (
          <>
            <View style={styles.labelRow}>
              <View style={styles.labelText}>
                <NeonLabel>{petShownName(selected)}</NeonLabel>
              </View>
              {selectedStatus ? <PetStatusBadge status={selectedStatus} variant="detail" wordFont={Fonts.monoBold} /> : null}
            </View>
            <Text style={styles.body} numberOfLines={1}>
              {stageLine(selected, !selectedStatus)}
              {finishWornLabel(selected.finish_kind, selected.finish_color) ? ` · ${finishWornLabel(selected.finish_kind, selected.finish_color)}` : ''}
            </Text>
            <View style={styles.chips}>
              <NeonChip
                label={selected.fav ? '★ Favourite' : '☆ Favourite'}
                selected={selected.fav}
                onPress={() => commit((doc, now) => setPetFav(doc, now, selected.uid, !selected.fav))}
              />
              {selectedResting ? (
                <NeonChip
                  label={block ? 'Make active · not now' : 'Make active'}
                  onPress={() => (block ? setNote(DEN_REFUSAL[block]) : makeActive(selected.uid))}
                />
              ) : petRevealed(selected) ? (
                <NeonChip label="View card" onPress={onViewActiveCard} />
              ) : null}
              {selectedResting && petRevealed(selected) ? (
                <NeonChip
                  label={releaseArmed ? 'Tap again · release' : 'Release'}
                  onPress={() => release(selected.uid)}
                />
              ) : null}
            </View>
            {releaseArmed && selectedResting ? (
              <Text style={styles.block} numberOfLines={1}>
                Gives 1 {GRADE_LABEL[selected.grade ?? 'common']} shard.
              </Text>
            ) : null}
            {selectedResting && (selected.egg != null || selected.hero != null) ? (
              <View style={styles.nameRow}>
                <TextInput
                  value={draft}
                  onChangeText={(t) => {
                    setDraft(t.slice(0, PET_NAME_MAX + 4));
                    setNote(null);
                  }}
                  maxLength={PET_NAME_MAX}
                  placeholder={petShownName({ ...selected, name: null })}
                  placeholderTextColor={NEON.textMuted}
                  style={[styles.input, styles.inputFlex]}
                  accessibilityLabel="Resting pet name"
                  autoCorrect={false}
                />
                <NeonChip label="Save" onPress={() => saveName(selected.uid)} />
                {selected.name ? (
                  <NeonChip
                    label="Default"
                    onPress={() => {
                      commit((doc, now) => renameDenPet(doc, now, selected.uid, null));
                      setDraft('');
                    }}
                  />
                ) : null}
              </View>
            ) : selectedResting ? null : (
              <Text style={styles.body}>This is your active pet — rename or release it from the ⋯ menu.</Text>
            )}
            {selectedResting && !petRevealed(selected) ? (
              <Text style={styles.body}>Eggs and Babies can’t be released — make it active and raise it to Child.</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.body}>Tap a pet to see what you can do with it. Looks (holo, colours) live in the Locker.</Text>
        )}
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>

      <View style={styles.chips}>
        {DEN_SORTS.map((s) => (
          <NeonChip key={s} label={DEN_SORT_LABEL[s]} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </View>

      <View style={styles.grid}>{tiles}</View>

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

const GAP = 8;
const styles = StyleSheet.create({
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  note: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.cyan },
  block: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.pink },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  slots: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detail: {
    height: DETAIL_H,
    gap: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 10,
    padding: 8,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  labelText: { flex: 1, minWidth: 0 },
  miniSpacer: { height: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    width: '23%',
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 10,
    paddingHorizontal: 2,
  },
  tileActive: { borderColor: NEON.cyanBorder },
  tileSelected: { borderColor: NEON.cyan, borderWidth: 2 },
  tileEmpty: { borderStyle: 'dashed' },
  tileLocked: { opacity: 0.45 },
  emptyMark: { fontFamily: Fonts.monoBold, fontSize: 18, color: NEON.textMuted },
  pressed: { opacity: 0.7 },
  figure: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  blankEgg: { fontSize: 28 },
  tileName: { fontFamily: Fonts.mono, fontSize: 10, color: NEON.textPrimary, maxWidth: '100%' },
  input: {
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: Fonts.monoBold,
    color: NEON.textPrimary,
  },
  inputFlex: { flex: 1, minWidth: 0 },
});
