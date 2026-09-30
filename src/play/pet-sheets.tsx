/**
 * Pet room sheets (overhaul, 2026-09-29) — everything the old Pet screen
 * stacked as cards, moved as-is into the sheets the room's icon row opens:
 *
 *   Feed        — the pantry and its Feed buttons.
 *   Play        — Catch the food / Tap to train (+ the token note).
 *   Expedition  — status, the returned find, Send on expedition.
 *   Info        — tabs: Status (form, timers, perks, Today, what hatches,
 *                 rebirth, reminder) · Book (Logbook + Collection) · Hall ·
 *                 Style (Wardrobe) · Help (How it works) · Dev (dev builds).
 *
 * Rules and transitions are unchanged — everything still commits through the
 * same `playStore.ts` transitions the old cards used.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { itemArtSource } from '@/play/art';
import {
  DIVE_TIER_LABEL,
  FOOD_IDS,
  FOODS,
  PANTRY_MAX,
  diveCollectibleIds,
  findKind,
  findName,
  firstTierOf,
  type FoodId,
} from '@/play/dive-loot';
import { getItemDef } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { NeonButton, NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import {
  PET_BRANCH_LABEL,
  PET_DEEP_MIN_DEPTH,
  PET_METER_MAX,
  PET_MIN_ROUND_SCORE,
  PET_REBIRTH_CAP,
  PET_RESCUE_MAX,
  PET_STAGE_LABEL,
  PET_STAGE_MS,
  PET_TOKENS_DAILY_CAP,
  PET_TOKENS_PER_ROUND,
  branchFor,
  branchThresholds,
  petBustCutPp,
  petLineById,
  petNextStage,
  petPounceBase,
  petRescueKeep,
  type PetState,
} from '@/play/pet';
import { COSMETICS, COSMETIC_SLOTS, cosmeticById, type CosmeticSlot } from '@/play/pet-cosmetics';
import { CatchFoodGame, TapTrainGame, TRAIN_REPS } from '@/play/pet-games';
import { CollectionPanel, DyePanel, EggHelp, HallCards, OddsPanel, ReleasePanel } from '@/play/pet-egg-sheets';
import { heartsText } from '@/play/pet-status';
import {
  buyCosmetic,
  dismissExpeditionNote,
  feedFromPantry,
  rebirthPetDoc,
  sendPetExpedition,
  wearCosmetic,
  type PetRoundKind,
  type PetRoundResult,
  type PlayView,
} from '@/play/playStore';
import { todayPlan } from '@/play/today-plan';
import type { PlayTransition } from '@/play/use-play-store';

type Commit = (transition: PlayTransition) => boolean;

const ARM_LAPSE_MS = 3500;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------ helpers --- */

export function durationLabel(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "TD pounce 5.5 · Dive −2 bust points · saves 1 find" — what a pet gives,
 * or null when it gives nothing yet. */
function perksText(pounce: number, cut: number, rescue: number): string | null {
  const parts: string[] = [];
  if (pounce > 0) parts.push(`TD pounce ${Number(pounce.toFixed(1))} at wave 1 (grows with the wave)`);
  if (cut > 0) parts.push(`Dive −${plural(cut, 'bust point')}`);
  if (rescue > 0) parts.push(`saves your best ${rescue === 1 ? 'find' : `${rescue} finds`} on a bust`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** What evolving next adds, as if it evolved now (the branch it is on track
 * for). Only what changes is listed. */
function nextUnlockText(pet: PetState): string | null {
  if (pet.stage === 'god') return null;
  const next = petNextStage(pet.stage);
  const nextPet: PetState = { ...pet, stage: next, branch: branchFor(pet.stage, pet) };
  const gains: string[] = [];
  if (pet.stage === 'egg') gains.push('it hatches — hunger and mood start');
  const pounceNow = petPounceBase(pet);
  const pounceNext = petPounceBase(nextPet);
  if (pounceNext > pounceNow) {
    gains.push(pounceNow > 0 ? `stronger pounce (${Number(pounceNext.toFixed(1))})` : 'TD pounce');
  }
  const cutNow = petBustCutPp(pet);
  const cutNext = petBustCutPp(nextPet);
  if (cutNext > cutNow) gains.push(`−${plural(cutNext, 'bust point')} in Dive`);
  const keepNow = petRescueKeep(pet);
  const keepNext = petRescueKeep(nextPet);
  if (keepNext > keepNow) gains.push(`saves ${keepNext === 1 ? 'your best find' : `${keepNext} finds`} on a bust`);
  if (next === 'child') gains.push('the daily solo expedition');
  if (next === 'god') gains.push('the God aura and rebirth');
  return `${PET_STAGE_LABEL[next]}: ${gains.length > 0 ? gains.join(' · ') : 'grows bigger'}`;
}

export function roundResultLine(kind: PetRoundKind, score: number, result: PetRoundResult): string {
  if (!result.counted) {
    return `Scored ${score} — a round needs ${PET_MIN_ROUND_SCORE} to count. Try again!`;
  }
  const care =
    kind === 'catch' ? `Caught ${score} — +2 hunger` : `${score}/${TRAIN_REPS} hits — +1 training, +2 mood`;
  const pay =
    result.tokensGranted > 0 ? ` · +${result.tokensGranted} tokens` : ' · daily token cap reached';
  return care + pay;
}

/** Art for any find: an item's own art, a badge's Look art, else null. */
function findArt(id: string) {
  const kind = findKind(id);
  if (kind === 'item') return itemArtSource(getItemDef(id)?.core.art ?? '');
  const badgeItem = kind === 'cosmetic' ? cosmeticById(id)?.itemId : undefined;
  return badgeItem ? itemArtSource(getItemDef(badgeItem)?.core.art ?? '') : undefined;
}

/** Colour for a find drawn as an icon (tints, auras), else cyan. */
function findColor(id: string): string {
  const cos = cosmeticById(id);
  if (cos?.color) return cos.color;
  if (cos?.element) return ELEMENT_COLOR[cos.element];
  return NEON.cyan;
}

function MeterLine({ label, value }: { label: string; value: number }) {
  return (
    <Text style={styles.meter} accessibilityLabel={`${label} ${value} of ${PET_METER_MAX} hearts`}>
      {label} <Text style={styles.hearts}>{heartsText(value)}</Text>
    </Text>
  );
}

/* ---------------------------------------------------------------- Feed --- */

export function FeedSheetBody({ view, commit }: { view: PlayView; commit: Commit }) {
  const pv = view.pet;
  const [note, setNote] = useState<string | null>(null);
  const feed = (food: FoodId) => {
    const ok = commit((doc, now) => feedFromPantry(doc, now, food));
    setNote(
      ok
        ? `Fed ${FOODS[food].name} — +${FOODS[food].hearts} hunger.`
        : pv.away
          ? 'It’s away on an expedition.'
          : 'It’s full — save it for later.',
    );
  };
  const stocked = FOOD_IDS.filter((f) => (pv.pantry[f] ?? 0) > 0);
  return (
    <>
      <MeterLine label="Hunger" value={pv.state.hunger} />
      <Text style={styles.body}>
        Pantry ({pv.pantryTotal}/{PANTRY_MAX}):{' '}
        {pv.pantryTotal === 0
          ? 'empty — dives find Kelp snacks and Glow shrimp, or play Catch the food.'
          : stocked.map((f) => `${FOODS[f].name} ×${pv.pantry[f]}`).join(' · ')}
      </Text>
      {stocked.map((f) => (
        <NeonButton
          key={f}
          label={`Feed ${FOODS[f].name} (+${FOODS[f].hearts})`}
          variant="secondary"
          onPress={() => feed(f)}
        />
      ))}
      {note ? <Text style={styles.result}>{note}</Text> : null}
    </>
  );
}

/* ---------------------------------------------------------------- Play --- */

export function PlaySheetBody({
  view,
  game,
  onStart,
  onRoundDone,
  lastResult,
}: {
  view: PlayView;
  game: PetRoundKind | null;
  onStart: (kind: PetRoundKind) => void;
  onRoundDone: (kind: PetRoundKind) => (score: number) => void;
  lastResult: string | null;
}) {
  const pv = view.pet;
  if (pv.state.stage === 'egg') {
    return <Text style={styles.body}>Games start once it hatches. For now, pick what it hatches into in Info.</Text>;
  }
  if (game === 'catch') return <CatchFoodGame onDone={onRoundDone('catch')} />;
  if (game === 'train') return <TapTrainGame onDone={onRoundDone('train')} />;
  return (
    <>
      <MeterLine label="Hunger" value={pv.state.hunger} />
      <MeterLine label="Mood" value={pv.state.mood} />
      <Text style={styles.body}>
        Catch the food feeds it (+2 hunger); Tap to train cheers it up (+2 mood). +{PET_TOKENS_PER_ROUND}{' '}
        tokens a round · {pv.tokensLeftToday}/{PET_TOKENS_DAILY_CAP} left today. TD stays the main way to earn.
      </Text>
      <View style={styles.buttons}>
        <NeonButton label="Catch the food" onPress={() => onStart('catch')} style={styles.flex} />
        <NeonButton label="Tap to train" variant="secondary" onPress={() => onStart('train')} style={styles.flex} />
      </View>
      {lastResult ? <Text style={styles.result}>{lastResult}</Text> : null}
    </>
  );
}

/* ---------------------------------------------------------- Expedition --- */

export function ExpeditionSheetBody({ view, commit }: { view: PlayView; commit: Commit }) {
  const pv = view.pet;
  const line =
    pv.expedition === 'locked'
      ? 'Expeditions unlock at Child.'
      : pv.expedition === 'ready'
        ? 'Ready — it dives the shallows alone for at least an hour, can’t bust, and brings back 1 find.'
        : pv.expedition === 'away'
          ? `Away on expedition — back in ${durationLabel(pv.expeditionBackInMs ?? 0)}.`
          : 'Back tomorrow — once a day.';
  const noteName = pv.expeditionNote ? findName(pv.expeditionNote) : null;
  return (
    <>
      <Text style={styles.body}>{line}</Text>
      <Text style={styles.body}>
        While it’s away there’s no pounce, bust cut or rescue, and your dives don’t count as its care.
      </Text>
      {noteName ? (
        <View style={styles.noteRow}>
          <Text style={styles.result}>Your pet brought back {noteName}!</Text>
          <NeonChip label="Nice" onPress={() => commit((doc) => dismissExpeditionNote(doc))} />
        </View>
      ) : null}
      {pv.expedition === 'ready' ? (
        <NeonButton label="Send on expedition" onPress={() => commit((doc, now) => sendPetExpedition(doc, now).doc)} />
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- Info --- */

export type InfoTab = 'status' | 'book' | 'hall' | 'style' | 'help' | 'dev';

export function infoTabs(dev: boolean): { id: InfoTab; label: string }[] {
  const tabs: { id: InfoTab; label: string }[] = [
    { id: 'status', label: 'Status' },
    { id: 'book', label: 'Book' },
    { id: 'hall', label: 'Hall' },
    { id: 'style', label: 'Style' },
    { id: 'help', label: 'Help' },
  ];
  return dev ? [...tabs, { id: 'dev', label: 'Dev' }] : tabs;
}

export function StatusTab({
  view,
  commit,
  remindNote,
  onToggleRemind,
}: {
  view: PlayView;
  commit: Commit;
  remindNote: string | null;
  onToggleRemind: () => void;
}) {
  const pv = view.pet;
  const pet = pv.state;
  const [rebirthArmed, setRebirthArmed] = useState(false);
  useEffect(() => {
    if (!rebirthArmed) return;
    const id = setTimeout(() => setRebirthArmed(false), ARM_LAPSE_MS);
    return () => clearTimeout(id);
  }, [rebirthArmed]);
  const pressRebirth = () => {
    if (!rebirthArmed) {
      setRebirthArmed(true);
      return;
    }
    setRebirthArmed(false);
    commit((doc, now) => rebirthPetDoc(doc, now));
  };

  const line = petLineById(pet.line);
  const stageName = PET_STAGE_LABEL[pet.stage];
  const showBranch = pet.stage !== 'egg' && pet.stage !== 'baby';
  const title = showBranch ? `${stageName} · ${PET_BRANCH_LABEL[pet.branch]}` : stageName;
  const onTrack =
    pet.stage !== 'egg' && pet.stage !== 'god' ? PET_BRANCH_LABEL[branchFor(pet.stage, pet)] : null;
  const deepNeed = pet.stage !== 'egg' && pet.stage !== 'god' ? branchThresholds(pet.stage).deepSurfaces : null;
  const rebirthPct = Math.round(view.petRebirthBonus * 100);
  const ageDays = Math.floor((pet.total_age_ms / DAY_MS) * 10) / 10;
  const nextName = pet.stage === 'god' ? null : PET_STAGE_LABEL[petNextStage(pet.stage)];
  const evolveLine =
    pv.stageLeftMs == null || nextName == null
      ? 'Final form — you can rebirth it into a new egg.'
      : pet.stage === 'egg'
        ? `Hatches into a ${nextName} in ${durationLabel(pv.stageLeftMs)}`
        : `Evolves to ${nextName} in ${durationLabel(pv.stageLeftMs)}`;
  const progress =
    pet.stage === 'god' ? 1 : Math.max(0, Math.min(1, pet.stage_age_ms / PET_STAGE_MS[pet.stage]));
  const perksNow = pv.away
    ? `Away on expedition — no pounce, bust cut or rescue until it’s back.`
    : (perksText(pv.pounceBase, pv.bustCutPp, pv.rescueKeep) ??
      'Nothing yet — TD pounce from Child, Dive help from Teen.');
  const formNote =
    pet.branch === 'deep' && pet.stage !== 'egg'
      ? `Deep form: +1 bust point, and +1 find saved on a bust at Adult/God (max ${PET_RESCUE_MAX}).`
      : pet.branch === 'battle' && pet.stage !== 'egg'
        ? 'Battle form: pounce ×1.1.'
        : pet.branch === 'scruffy' && pet.stage !== 'egg'
          ? 'Scruffy form: pounce ×0.8.'
          : null;
  const nextUnlock = nextUnlockText(pet);
  const today = todayPlan(view);

  return (
    <>
      <Text style={styles.stageTitle}>{title}</Text>
      <Text style={styles.subtle}>{pet.stage === 'egg' ? `Will hatch as: ${line.label}` : line.label}</Text>
      {pet.stage !== 'egg' ? (
        <>
          <MeterLine label="Hunger" value={pet.hunger} />
          <MeterLine label="Mood" value={pet.mood} />
        </>
      ) : null}
      {onTrack ? (
        <Text style={styles.body}>
          This stage: {plural(pet.mistakes, 'care mistake')} · {pet.training} training ·{' '}
          {plural(pet.waves, 'wave')} · {pet.deep_surfaces}/{deepNeed} deep{' '}
          {pet.deep_surfaces === 1 ? 'surface' : 'surfaces'} → on track for {onTrack}
        </Text>
      ) : null}
      <Text style={styles.body}>
        Age: {ageDays} {ageDays === 1 ? 'day' : 'days'}
      </Text>
      <Text style={styles.timer}>{evolveLine}</Text>
      <View
        style={styles.barTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
        <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.body}>Right now: {perksNow}</Text>
      {formNote ? <Text style={styles.body}>{formNote}</Text> : null}
      {nextUnlock ? <Text style={styles.body}>Next — {nextUnlock}</Text> : null}
      <Text style={styles.body}>
        Rebirth bonus: +{rebirthPct}% damage in TD ({plural(pv.rebirths, 'rebirth')}, max +
        {Math.round(PET_REBIRTH_CAP * 100)}%).
      </Text>

      <OddsPanel view={view} />

      <ReleasePanel view={view} commit={commit} />

      {pet.stage === 'god' ? (
        <>
          <NeonLabel>Rebirth</NeonLabel>
          <Text style={styles.body}>
            Retire this God to the Hall of pets and start a new egg. Each rebirth adds +2% damage for
            good (up to +10%). Optional — your God can stay as long as you like.
          </Text>
          {pv.away ? (
            <Text style={styles.body}>Your pet is away on an expedition — rebirth once it’s back.</Text>
          ) : (
            <NeonButton
              label={rebirthArmed ? 'Tap again · retire to the Hall' : 'Rebirth into a new egg'}
              variant={rebirthArmed ? 'danger' : 'primary'}
              onPress={pressRebirth}
            />
          )}
        </>
      ) : null}

      <NeonLabel>Today · one minute</NeonLabel>
      {[today.td, today.pet, today.both, today.goal].map((lineText) => (
        <Text key={lineText} style={styles.body}>
          {lineText}
        </Text>
      ))}

      <NeonChip label={`Hunger reminder · ${pv.remind ? 'On' : 'Off'}`} selected={pv.remind} onPress={onToggleRemind} />
      {remindNote ? <Text style={styles.body}>{remindNote}</Text> : null}
    </>
  );
}

/** One Logbook slot: found → art, name, "found ×N · first at depth D";
 * not found yet → a dark silhouette and "???" with where to look. */
function LogRow({ id, entry }: { id: string; entry: { depth: number; count: number } | null }) {
  const art = findArt(id);
  const kind = findKind(id);
  const tier = firstTierOf(id);
  return (
    <View style={styles.logRow}>
      <View style={styles.logIcon}>
        {art ? (
          <Image
            source={art}
            contentFit="contain"
            tintColor={entry ? undefined : '#000000'}
            style={[styles.logArt, !entry && styles.silhouette]}
          />
        ) : (
          <MaterialCommunityIcons
            name={kind === 'food' ? 'fish' : 'palette'}
            size={22}
            color={entry ? findColor(id) : '#000000'}
            style={!entry ? styles.silhouette : undefined}
          />
        )}
      </View>
      <View style={styles.flex}>
        <Text style={styles.logName}>{entry ? findName(id) : '???'}</Text>
        <Text style={styles.subtleLeft}>
          {entry
            ? `found ×${entry.count} · first at ${entry.depth === 0 ? 'the surface' : `depth ${entry.depth}`}`
            : `not found yet${tier ? ` · look from the ${DIVE_TIER_LABEL[tier]}` : ''}`}
        </Text>
      </View>
    </View>
  );
}

export function BookTab({ view, commit, eggColor }: { view: PlayView; commit: Commit; eggColor: string }) {
  const pv = view.pet;
  const logIds = diveCollectibleIds();
  const logFound = logIds.filter((id) => pv.logbook[id]).length;
  return (
    <>
      <NeonLabel>
        Logbook · {logFound}/{logIds.length}
      </NeonLabel>
      <Text style={styles.body}>
        Everything your pet has found on dives and expeditions. Depth = where it was first found.
      </Text>
      {logIds.map((id) => (
        <LogRow key={id} id={id} entry={pv.logbook[id] ?? null} />
      ))}
      <CollectionPanel view={view} commit={commit} eggColor={eggColor} />
    </>
  );
}

export function HallTab({ view, eggColor }: { view: PlayView; eggColor: string }) {
  return <HallCards view={view} eggColor={eggColor} />;
}

const SLOT_LABEL: Record<CosmeticSlot, string> = { badge: 'Badges', tint: 'Tints', ring: 'Rings', aura: 'Auras' };

/** Wardrobe (v22): wear / take off what you own; buy tints and badges with
 * tokens; rings and auras only come from deep dives. */
export function StyleTab({ view, commit }: { view: PlayView; commit: Commit }) {
  const pv = view.pet;
  const [note, setNote] = useState<string | null>(null);
  const buy = (id: string) => {
    let msg = '';
    commit((doc) => {
      const res = buyCosmetic(doc, id);
      msg = res.result.ok
        ? `${cosmeticById(id)?.name ?? 'It'} is yours.`
        : res.result.reason === 'tokens'
          ? 'Not enough tokens yet.'
          : 'Not for sale.';
      return res.result.ok ? res.doc : null;
    });
    setNote(msg);
  };
  return (
    <>
      <DyePanel view={view} commit={commit} />
      {pv.state.shiny ? (
        <Text style={styles.body}>✨ Your shiny keeps its own colour — tints don’t show on it.</Text>
      ) : null}
      <Text style={styles.body}>
        Tokens: {view.tokens}. Wardrobe · {pv.cosmetics.length}/{COSMETICS.length}. Tints and badges are for
        sale; rings come from the Trench and deeper, auras from the Abyss and deeper.
      </Text>
      {COSMETIC_SLOTS.map((slot) => (
        <View key={slot} style={styles.wardSlot}>
          <Text style={styles.logName}>{SLOT_LABEL[slot]}</Text>
          {COSMETICS.filter((c) => c.slot === slot).map((c) => {
            const owned = pv.cosmetics.includes(c.id);
            const worn = pv.wear[slot] === c.id;
            return (
              <View key={c.id} style={styles.logRow}>
                <View style={styles.logIcon}>
                  <MaterialCommunityIcons
                    name={slot === 'ring' ? 'circle-outline' : slot === 'aura' ? 'weather-sunny' : 'palette'}
                    size={20}
                    color={owned ? findColor(c.id) : NEON.textMuted}
                  />
                </View>
                <Text style={[styles.body, styles.flex]}>{c.name}</Text>
                {owned ? (
                  <NeonChip
                    label={worn ? 'Take off' : 'Wear'}
                    selected={worn}
                    onPress={() => commit((doc) => wearCosmetic(doc, slot, worn ? null : c.id))}
                  />
                ) : c.price != null ? (
                  <NeonChip label={`Buy · ${c.price} tokens`} onPress={() => buy(c.id)} />
                ) : (
                  <Text style={styles.subtle}>Dive find</Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
      {note ? <Text style={styles.result}>{note}</Text> : null}
    </>
  );
}

export function HelpTab() {
  return (
    <>
      <EggHelp />
      <NeonLabel>Raising your pet</NeonLabel>
      <Text style={styles.body}>
        • It grows on real time: Egg (5 min) → Baby (10 min) → Child (1.5 days) → Teen (3 days) → Adult (5
        days) → God. About 9.5 days in all, even if you only play TD. Its form is first picked at Teen.
      </Text>
      <Text style={styles.body}>
        • Hunger drops a heart every 3h, mood every 4h. Leaving one empty for over 2h is a care mistake.
        Feed it from the pantry, with Catch the food or by clearing TD waves; cheer it up with Tap to train.
      </Text>
      <Text style={styles.body}>
        • The bubble over its head shows how it feels, the most urgent first; the line under it says what
        it needs, and the matching icon glows. It sleeps from 22:00 to 07:00 on your phone’s clock — that’s
        just for looks, hunger still drops overnight.
      </Text>
      <Text style={styles.body}>
        • Diving is care too: surfacing a haul with your pet along gives +2 mood, a bust still gives +1.
        Diving never adds training and never speeds up the timer.
      </Text>
      <Text style={styles.body}>
        • At each evolution this stage’s care picks the form: lots of mistakes → Scruffy; lots of TD waves →
        Battle (stronger pounce); lots of surfaces from {PET_DEEP_MIN_DEPTH}+ Deepers → Deep (if it earned both
        Battle and Deep, the one it beat by more wins, ties go to Battle); good care + training → Bright;
        otherwise Standard. Counters reset every stage.
      </Text>
      <Text style={styles.body}>
        • TD: from Child it pounces once per wave, and every cleared wave feeds it one heart. Dive: from Teen
        it lowers the bust chance, from Adult it saves your best find on a bust (two at God). A Deep pet
        takes one more point off at every stage (so a Deep Child already helps) and saves one more find at
        Adult/God (never more than {PET_RESCUE_MAX}). The % shown is always the real one, and the pet is
        never lost.
      </Text>
      <Text style={styles.body}>
        • Expedition (Child and up, once a day): it dives the shallows alone for at least an hour, can’t
        bust, and brings back one find — collected the next time you open the app after that. While it’s
        away there’s no pounce, bust cut or rescue, and your dives don’t count as its care or go in its
        Logbook.
      </Text>
      <Text style={styles.body}>
        • Logbook: every find from your pet’s dives and expeditions, with how deep it was first found and
        how many times. It stays through rebirths.
      </Text>
      <Text style={styles.body}>
        • Dive levels: Shallows, Reef, Trench, Abyss (and the Hadal with Oxygen). Deeper levels hold more
        Powers and the only rings and auras. Each Deeper has two paths — Safer (8 points less bust, finds
        from one level up) and Richer (8 more, one level down) — and both show their exact %.
      </Text>
      <Text style={styles.body}>
        • Shells come from TD waves and dives and buy Dive gear for good: Lamp (see each path’s next find),
        Net (+1 find when you surface from depth 2+), Oxygen (a 5th Deeper).
      </Text>
      <Text style={styles.body}>
        • Out of charges? Free dives keep only shells (the first 10 a day pay full, then fewer) and mood;
        their finds are Logbook sightings. They never count toward the Deep form.
      </Text>
      <Text style={styles.body}>
        • Food found diving goes to the pantry (up to {PANTRY_MAX}) — your pet only eats when you tap Feed.
        Cosmetics (badge, tint, ring, aura) are in Style; the Collection in Book shows every form each pet
        line can take.
      </Text>
      <Text style={styles.body}>
        • The God form glows in the Legend element you played TD with most. Rebirth is optional and adds
        +2% damage for good (max +10%).
      </Text>
      <Text style={styles.body}>
        • Time only counts forward: changing the phone’s clock back does nothing, and at most 2 days count
        between visits.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  meter: { fontFamily: Fonts.monoBold, fontSize: 14, color: NEON.textPrimary },
  hearts: { color: '#FF5A8A', letterSpacing: 2 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: NEON.cyanBorder,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: NEON.cyan },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  logArt: { width: 28, height: 28 },
  silhouette: { opacity: 0.55 },
  wardSlot: { gap: 6, marginTop: 6 },
  collRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collLabel: { width: 72, textAlign: 'left' },
  collForms: { flexDirection: 'row', flex: 1, justifyContent: 'space-between' },
  collCell: { alignItems: 'center', width: 44 },
  collName: { fontFamily: Fonts.mono, fontSize: 8, color: NEON.textMuted },
  logName: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.textPrimary },
  stageTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 20,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
  },
  timer: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
  subtle: { fontFamily: Fonts.mono, fontSize: 12, color: NEON.textMuted, textAlign: 'center' },
  subtleLeft: { fontFamily: Fonts.mono, fontSize: 12, color: NEON.textMuted },
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
  result: { fontFamily: Fonts.monoBold, fontSize: 12, color: NEON.cyan },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buttons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
