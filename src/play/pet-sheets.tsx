/**
 * Pet room sheets (overhaul, 2026-09-29) — everything the old Pet screen
 * stacked as cards, moved as-is into the sheets the room's icon row opens:
 *
 *   Feed        — the pantry and its Feed buttons.
 *   Play        — the mini-game hub (Catch / Train). A round itself is full screen.
 *   Expedition  — status, the returned find, Send on expedition.
 *   Info        — tabs: Status (form, timers, perks, Today, what hatches,
 *                 rebirth, reminder) · Book (Logbook + Collection) · Hall ·
 *                 Style (Wardrobe) · Guide (v26: everything, from the code's own
 *                 numbers) · Dev (dev builds).
 *
 * Rules and transitions are unchanged — everything still commits through the
 * same `playStore.ts` transitions the old cards used.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { PIXEL } from '@/play/pixel-theme';
import { PixelBody, PixelButton, PixelFrame, PixelHearts, PixelLabel } from '@/play/pixel-ui';
import { NEON } from '@/play/neon-viper';
import {
  PET_BRANCH_LABEL,
  PET_METER_MAX,
  PET_REBIRTH_CAP,
  PET_RESCUE_MAX,
  PET_STAGE_LABEL,
  PET_STAGE_MS,
  PET_TOKENS_DAILY_CAP,
  PET_TOKENS_PER_ROUND,
  branchFor,
  branchThresholds,
  petBustCutPp,
  petNextStage,
  petPounceBase,
  petRescueKeep,
  type PetState,
} from '@/play/pet';
import { COSMETICS, COSMETIC_SLOTS, cosmeticById, type CosmeticSlot } from '@/play/pet-cosmetics';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  outcomeLine,
  type Difficulty,
  type RoundOutcome,
} from '@/play/pet-game-rules';
import {
  GAME_LABEL,
  MEDAL_ICON,
  MEDAL_LABEL,
  MEDAL_SCORES,
  levelUnlocked,
  unlockHint,
  type Game,
} from '@/play/game-records';
import { BUFF_ICON, BUFF_LABEL, FOCUSED_TRIP_MULT, SNACK_BUST_PP, buffForMedal } from '@/play/play-buffs';
import { CollectionPanel, DyePanel, HallCards, OddsPanel } from '@/play/pet-egg-sheets';
import { GuideLink, GuideView } from '@/play/guide-sheet';
import { stagePowerLine, type GuideSection } from '@/play/guide-content';
import { gradeTag, petShownName } from '@/play/pet-eggs';
import { heartsText } from '@/play/pet-status';
import { ScoreBurst } from '@/play/score-burst';
import { EXPEDITION_STEPS, tripLabel } from '@/play/expedition-ladder';
import { AURA_COLORS, AURA_HUES, AURA_VALUES, auraCustomParts, auraHueHex, auraPrice, auraStyles, auraTintLabel, type AuraTint } from '@/play/auras';
import { swordElement } from '@/play/swords';
import {
  applyPetAura,
  setPetAuraColor,
  buyCosmetic,
  dismissExpeditionNote,
  feedFromPantry,
  sendPetExpedition,
  wearCosmetic,
  type PetRoundKind,
  type PetRoundResult,
  type PlayView,
} from '@/play/playStore';
import { todayPlan } from '@/play/today-plan';
import type { PlayTransition } from '@/play/use-play-store';

type Commit = (transition: PlayTransition) => boolean;

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
  if (next === 'child') gains.push('solo expeditions');
  if (next === 'god') gains.push('the God aura and rebirth');
  return `${PET_STAGE_LABEL[next]}: ${gains.length > 0 ? gains.join(' · ') : 'grows bigger'}`;
}

export function roundResultLine(kind: PetRoundKind, outcome: RoundOutcome, result: PetRoundResult): string {
  const line = outcomeLine(kind, outcome);
  if (!result.counted) {
    return `${line} — you need 50% to pass. Try again!`;
  }
  const care = kind === 'catch' ? `${line} — +2 hunger` : `${line} — +1 training, +2 mood`;
  const pay =
    result.tokensGranted > 0 ? ` · +${result.tokensGranted} tokens` : ' · daily token cap reached';
  // v26: score, medal, record, buff, daily challenge, unlock, rank.
  const bits: string[] = [`${result.score} pts on ${DIFFICULTY_LABEL[result.level]}${result.daily ? ' (daily)' : ''}`];
  if (result.medal) bits.push(`${MEDAL_ICON[result.medal]} ${MEDAL_LABEL[result.medal]}`);
  if (result.newRecord) bits.push(`NEW RECORD (was ${result.prevBest})`);
  if (result.buff) bits.push(`${BUFF_ICON[result.buff]} ${BUFF_LABEL[result.buff]}`);
  if (result.dailyBest) bits.push(`new daily best${result.dailyBonusShells > 0 ? ` · +${result.dailyBonusShells} shells` : ''}`);
  if (result.unlocked) bits.push(`${DIFFICULTY_LABEL[result.unlocked]} unlocked!`);
  if (result.rankUp) bits.push(`rank: ${result.rank}`);
  if (result.swordDrop) bits.push(`Sword: ${result.swordDrop}`);
  return `${care}${pay}\n${bits.join(' · ')}`;
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

export function FeedSheetBody({ view, commit, onFed }: { view: PlayView; commit: Commit; onFed?: () => void }) {
  const pv = view.pet;
  const [note, setNote] = useState<string | null>(null);
  const feed = (food: FoodId) => {
    const ok = commit((doc, now) => feedFromPantry(doc, now, food));
    if (ok) onFed?.();
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

/** Solid cyan or amber ink needs that fill's shade, or a black shadow doubles the letters. */
function chipShadow(fill: string): string {
  if (fill === PIXEL.amber) return PIXEL.amberLo;
  if (fill === PIXEL.cyan) return PIXEL.cyanLo;
  return PIXEL.ink;
}

/** Difficulty chip in the pixel kit. The medal stays a system glyph so Departure Mono does not eat it. */
function GameChip({
  label,
  selected,
  locked,
  medal,
  onPress,
}: {
  label: string;
  selected: boolean;
  locked: boolean;
  medal: string | null;
  onPress: () => void;
}) {
  const fill = selected ? PIXEL.cyan : PIXEL.ink;
  const text = selected ? PIXEL.onFill : locked ? PIXEL.dim : PIXEL.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={styles.gameChip}>
      <PixelFrame
        fill={fill}
        border={selected ? PIXEL.ink : PIXEL.muted}
        bevel={selected ? 'cyan' : undefined}
        glow={false}
        lined={!selected}
        padded={false}
        minHeight={36}>
        <View style={styles.gameChipRow}>
          {locked ? <MaterialCommunityIcons name="lock" size={12} color={PIXEL.dim} /> : null}
          <PixelLabel color={text} shadowColor={chipShadow(fill)} numberOfLines={1} style={styles.gameChipLabel}>
            {label}
          </PixelLabel>
          {medal ? <Text style={styles.gameMedal}>{medal}</Text> : null}
        </View>
      </PixelFrame>
    </Pressable>
  );
}

/** v26 — a round being played: which game, at which level, daily or not. */
export type GameRun = { kind: PetRoundKind; level: Difficulty; daily: boolean };

export function PlaySheetBody({
  view,
  onStart,
  lastResult,
  lastRound = null,
  still,
  onGuide,
}: {
  view: PlayView;
  onStart: (run: GameRun) => void;
  lastResult: string | null;
  /** The last counted round's score, for the count-up + confetti. */
  lastRound?: { key: string; score: number; strong: boolean } | null;
  /** Reduced motion or Effects Low: the score burst holds still. */
  still: boolean;
  onGuide?: () => void;
}) {
  const pv = view.pet;
  const [level, setLevel] = useState<Record<Game, Difficulty>>({ catch: 'normal', train: 'normal' });
  const [hint, setHint] = useState<string | null>(null);
  if (pv.state.stage === 'egg') {
    return (
      <PixelBody>Games start once it hatches. For now, pick what it hatches into in Info.</PixelBody>
    );
  }
  return (
    <View style={styles.playSheet}>
      <View style={styles.meterRow}>
        <View style={styles.meterBlock}>
          <PixelBody size="sm" color={PIXEL.dim}>Hunger</PixelBody>
          <PixelHearts value={pv.state.hunger} max={PET_METER_MAX} />
        </View>
        <View style={styles.meterBlock}>
          <PixelBody size="sm" color={PIXEL.dim}>Mood</PixelBody>
          <PixelHearts value={pv.state.mood} max={PET_METER_MAX} />
        </View>
      </View>
      <PixelBody numberOfLines={4}>
        {`Catch the food feeds it (+2 hunger); Tap to train cheers it up (+2 mood) — only if you pass (50%+). +${PET_TOKENS_PER_ROUND} tokens a passed round · ${pv.tokensLeftToday}/${PET_TOKENS_DAILY_CAP} left today. TD stays the main way to earn.`}
      </PixelBody>
      {(['catch', 'train'] as const).map((g) => {
        // A level picked earlier may have closed again (Reset Divecore): fall back to Normal.
        const lv = levelUnlocked(pv.records, g, level[g]) ? level[g] : 'normal';
        const rec = pv.records[g][lv];
        const [b, sv, gd] = MEDAL_SCORES[g][lv];
        const silverBuff = buffForMedal(g, 'silver');
        const goldBuff = buffForMedal(g, 'gold');
        const daily = pv.daily[g];
        return (
          <PixelFrame key={g} align="stretch" glow={false}>
            <View style={styles.gameCard}>
              <View style={styles.gameTitleRow}>
                <PixelLabel numberOfLines={1} style={styles.gameTitle}>{GAME_LABEL[g]}</PixelLabel>
                <PixelBody size="sm" color={PIXEL.amber} numberOfLines={1}>{pv.ranks[g]}</PixelBody>
              </View>
              <View style={styles.chips}>
                {DIFFICULTIES.map((d) => {
                  const open = levelUnlocked(pv.records, g, d);
                  const r = pv.records[g][d];
                  return (
                    <GameChip
                      key={d}
                      label={DIFFICULTY_LABEL[d]}
                      locked={!open}
                      medal={r.medal ? MEDAL_ICON[r.medal] : null}
                      selected={open && lv === d}
                      onPress={() => {
                        if (open) {
                          setLevel((prev) => ({ ...prev, [g]: d }));
                          setHint(null);
                        } else setHint(`${GAME_LABEL[g]} · ${DIFFICULTY_LABEL[d]}: ${unlockHint(d)}.`);
                      }}
                    />
                  );
                })}
              </View>
              <PixelBody size="sm" color={PIXEL.dim} numberOfLines={3}>
                {`Best on ${DIFFICULTY_LABEL[lv]}: ${rec.best > 0 ? rec.best : '—'} · 🥉 ${b} · 🥈 ${sv} (${silverBuff ? BUFF_LABEL[silverBuff] : ''}) · 🥇 ${gd} (${goldBuff ? BUFF_LABEL[goldBuff] : ''})`}
              </PixelBody>
              <View style={styles.buttons}>
                <PixelButton
                  label={`Play · ${DIFFICULTY_LABEL[lv]}`}
                  variant={g === 'catch' ? 'cyan' : 'amber'}
                  onPress={() => onStart({ kind: g, level: lv, daily: false })}
                  style={styles.shareButton}
                />
                <PixelButton
                  label={daily.best > 0 ? `Daily · best ${daily.best}` : 'Daily'}
                  variant="cyan"
                  onPress={() => onStart({ kind: g, level: 'normal', daily: true })}
                  style={styles.shareButton}
                />
              </View>
            </View>
          </PixelFrame>
        );
      })}
      {hint ? <PixelBody color={PIXEL.cyan}>{hint}</PixelBody> : null}
      {lastRound ? (
        <ScoreBurst score={lastRound.score} strong={lastRound.strong} runKey={lastRound.key} animate={!still} />
      ) : null}
      {lastResult ? <PixelBody color={PIXEL.cyan}>{lastResult}</PixelBody> : null}
      {onGuide ? (
        <Pressable onPress={onGuide} accessibilityRole="button" accessibilityLabel="Mini-games in the Guide">
          <PixelBody size="sm" color={PIXEL.cyan}>Mini-games in the Guide</PixelBody>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------- Expedition --- */

/** v26 — the active medal buffs as plain lines (nothing when none). */
export function BuffLines({ view }: { view: PlayView }) {
  const b = view.pet.buffs;
  const lines: string[] = [];
  if (b.hearty > 0) lines.push(`${BUFF_ICON.hearty} ${BUFF_LABEL.hearty}: +1 find on ${b.hearty} more dive surface${b.hearty === 1 ? '' : 's'}`);
  if (b.snack > 0) lines.push(`${BUFF_ICON.snack} ${BUFF_LABEL.snack}: −${SNACK_BUST_PP} bust points on your next dive`);
  if (b.pumped > 0) {
    lines.push(
      view.pet.pumped.maxed
        ? `${BUFF_ICON.pumped} Maxed aura: your pet's pounce is already at the top of the band — Pumped adds nothing, so it glows instead and keeps its ${b.pumped} uses`
        : `${BUFF_ICON.pumped} ${BUFF_LABEL.pumped}: stronger pounce for ${b.pumped} more TD wave${b.pumped === 1 ? '' : 's'}`,
    );
  }
  if (b.focused > 0) lines.push(`${BUFF_ICON.focused} ${BUFF_LABEL.focused}: your next expedition is ${Math.round((1 - FOCUSED_TRIP_MULT) * 100)}% shorter`);
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map((l) => (
        <Text key={l} style={styles.body}>
          {l}
        </Text>
      ))}
    </>
  );
}

export function ExpeditionSheetBody({
  view,
  commit,
  onGuide,
}: {
  view: PlayView;
  commit: Commit;
  onGuide?: (s: GuideSection) => void;
}) {
  const pv = view.pet;
  const line =
    pv.expedition === 'locked'
      ? 'Expeditions unlock at Child.'
      : pv.expedition === 'ready' && pv.nextTripMs != null
        ? `Next trip: ${tripLabel(pv.nextTripMs)}. It dives alone, can’t bust, and brings back 1 find — longer trips bring back better things.`
        : pv.expedition === 'away'
          ? `Away on a ${tripLabel(pv.expeditionTripMs ?? 0)} trip — back in ${durationLabel(pv.expeditionBackInMs ?? 0)}.`
          : 'Done for today — the next trip (1m) is at midnight.';
  const noteName = pv.expeditionNote ? findName(pv.expeditionNote) : null;
  return (
    <>
      <Text style={styles.body}>{line}</Text>
      <Text style={styles.body}>
        Trips today: {pv.tripsToday}/{EXPEDITION_STEPS}. Each is longer than the last: 1m · 5m · 15m (food or shells) ·
        30m · 1h (a find) · 2h · 4h (a chance of a Power). Starts over at midnight.
      </Text>
      <Text style={styles.body}>
        While it’s away there’s no pounce, bust cut or rescue, and your dives don’t count as its care.
      </Text>
      {pv.state.stage !== 'egg' ? <Text style={styles.body}>{stagePowerLine(pv.stagePower)}</Text> : null}
      {pv.buffs.focused > 0 ? (
        <Text style={styles.result}>
          {BUFF_ICON.focused} Focused: this next trip is {Math.round((1 - FOCUSED_TRIP_MULT) * 100)}% shorter.
        </Text>
      ) : null}
      {onGuide ? <GuideLink section="dive" onOpen={onGuide} /> : null}
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

export type InfoTab = 'status' | 'journal' | 'book' | 'hall' | 'style' | 'guide' | 'dev';

export function infoTabs(dev: boolean): { id: InfoTab; label: string }[] {
  const tabs: { id: InfoTab; label: string }[] = [
    { id: 'status', label: 'Status' },
    { id: 'journal', label: 'Journal' },
    { id: 'book', label: 'Book' },
    { id: 'hall', label: 'Hall' },
    { id: 'style', label: 'Style' },
    { id: 'guide', label: 'Guide' },
  ];
  return dev ? [...tabs, { id: 'dev', label: 'Dev' }] : tabs;
}

export function StatusTab({ view, onGuide }: { view: PlayView; onGuide?: (s: GuideSection) => void }) {
  const pv = view.pet;
  const pet = pv.state;
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
      <Text style={styles.subtle}>
        {petShownName(pet)}
        {pet.hero && pet.stage !== 'egg' && pet.stage !== 'baby' && pet.grade ? ` · ${gradeTag(pet.grade)}` : ''}
      </Text>
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
      {pet.stage !== 'egg' ? <Text style={styles.body}>{stagePowerLine(pv.stagePower)}</Text> : null}
      <BuffLines view={view} />
      {onGuide ? (
        <View style={styles.chips}>
          <GuideLink section="tend" onOpen={onGuide} />
          <GuideLink section="odds" onOpen={onGuide} />
        </View>
      ) : null}
      {formNote ? <Text style={styles.body}>{formNote}</Text> : null}
      {nextUnlock ? <Text style={styles.body}>Next — {nextUnlock}</Text> : null}
      <Text style={styles.body}>
        Rebirth bonus: +{rebirthPct}% damage in TD ({plural(pv.rebirths, 'rebirth')}, max +
        {Math.round(PET_REBIRTH_CAP * 100)}%).
      </Text>

      <OddsPanel view={view} />
      <Text style={styles.body}>Name, change egg, tickets, Release and Rebirth are in the ⋯ menu.</Text>

      <NeonLabel>Today · one minute</NeonLabel>
      {[today.td, today.pet, today.both, today.goal].map((lineText) => (
        <Text key={lineText} style={styles.body}>
          {lineText}
        </Text>
      ))}

      <Text style={styles.body}>Notifications, quiet hours, bedtime and chatter are in ⚙ Settings.</Text>
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

const SLOT_LABEL: Record<CosmeticSlot, string> = { badge: 'Badges', tint: 'Tints', ring: 'Rings', aura: 'Glows' };

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
        sale; rings come from the Trench and deeper, glows from the Abyss and deeper.
      </Text>
      <View style={styles.wardSlot}>
        <Text style={styles.logName}>Aura</Text>
        <Text style={styles.body}>
          Wear any you own. Match the sword{pv.auraSlot.element ? ` (${pv.auraSlot.element})` : ''}, tap an element, or pick a hue. Colours are free.
        </Text>
        {auraStyles().map((row) => {
          const wear = pv.auraSlot.worn.find((item) => item.style === row.id);
          const owned = pv.auraSlot.free || pv.auraSlot.owned.includes(row.id);
          const price = auraPrice(row.id, pv.auraSlot.pass);
          const tints: AuraTint[] = ['sword', ...AURA_COLORS];
          return (
            <View key={row.id} style={styles.auraBlock}>
              <View style={styles.logRow}>
                <Text style={[styles.body, styles.flex]}>{row.name}</Text>
                {wear ? (
                  <NeonChip
                    label="Take off"
                    selected
                    onPress={() => commit((doc, now) => applyPetAura(doc, now, pv.state.uid, row.id, false).doc)}
                  />
                ) : (
                  <NeonChip
                    label={owned || pv.auraSlot.free ? 'Wear' : `Buy · ${price}`}
                    onPress={() => {
                      let msg = '';
                      commit((doc, now) => {
                        const res = applyPetAura(doc, now, pv.state.uid, row.id, true);
                        msg = res.result.ok
                          ? `${row.name} is on.`
                          : res.result.reason === 'tokens'
                            ? 'Not enough tokens yet.'
                            : res.result.reason === 'not_revealed'
                              ? 'Wait until your pet is revealed.'
                              : 'Couldn’t wear that.';
                        return res.result.ok ? res.doc : null;
                      });
                      setNote(msg);
                    }}
                  />
                )}
              </View>
              {wear ? (
                <View style={styles.auraBlock}>
                  <View style={styles.auraColors}>
                    {tints.map((tint) => {
                      const on = wear.color === tint;
                      const hex = tint === 'sword' ? '#F4F7FF' : swordElement(tint)?.color ?? '#888';
                      return (
                        <Pressable
                          key={tint}
                          accessibilityRole="button"
                          accessibilityLabel={`${row.name} colour ${auraTintLabel(tint)}`}
                          accessibilityState={{ selected: on }}
                          onPress={() => {
                            if (on) return;
                            commit((doc, now) => {
                              const res = setPetAuraColor(doc, now, pv.state.uid, row.id, tint);
                              return res.result.ok ? res.doc : null;
                            });
                          }}
                          style={[styles.swatch, { backgroundColor: hex }, on && styles.swatchOn]}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.auraColors}>
                    {AURA_HUES.map((hue) => {
                      const parts = auraCustomParts(wear.color);
                      const on = parts?.hue === hue;
                      const hex = auraHueHex(hue, 1);
                      return (
                        <Pressable
                          key={hue}
                          accessibilityRole="button"
                          accessibilityLabel={`${row.name} hue ${hue}`}
                          accessibilityState={{ selected: on }}
                          onPress={() => {
                            const next = auraHueHex(hue, parts?.hue === hue ? parts.step : 1);
                            commit((doc, now) => {
                              const res = setPetAuraColor(doc, now, pv.state.uid, row.id, next);
                              return res.result.ok ? res.doc : null;
                            });
                          }}
                          style={[styles.swatch, { backgroundColor: hex }, on && styles.swatchOn]}
                        />
                      );
                    })}
                  </View>
                  <View style={styles.auraColors}>
                    {AURA_VALUES.map((_, step) => {
                      const parts = auraCustomParts(wear.color);
                      const hue = parts?.hue ?? 300;
                      const hex = auraHueHex(hue, step);
                      const on = parts?.step === step;
                      return (
                        <Pressable
                          key={step}
                          accessibilityRole="button"
                          accessibilityLabel={`${row.name} tone ${step + 1}`}
                          accessibilityState={{ selected: on }}
                          onPress={() => {
                            commit((doc, now) => {
                              const res = setPetAuraColor(doc, now, pv.state.uid, row.id, hex);
                              return res.result.ok ? res.doc : null;
                            });
                          }}
                          style={[styles.tone, { backgroundColor: hex }, on && styles.swatchOn]}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
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

/** Info → Guide (v26): the one place to learn everything — replaces the old
 * scattered help text. Opens at `section` when a "?" sent you. */
export function HelpTab({ section = null }: { section?: GuideSection | null }) {
  return <GuideView initial={section} />;
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
  auraBlock: { gap: 6 },
  auraColors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  tone: { width: 36, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  swatchOn: { borderWidth: 2, borderColor: NEON.cyan },
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
  gameCard: { width: '100%', gap: 8 },
  buttons: { flexDirection: 'row', width: '100%', gap: 8 },
  shareButton: { flexGrow: 1, flexShrink: 1, flexBasis: '0%', minWidth: 96, minHeight: 50 },
  flex: { flex: 1 },
  playSheet: { width: '100%', gap: 10 },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  meterBlock: { gap: 4 },
  gameTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gameTitle: { flexShrink: 1 },
  gameChip: { flexGrow: 0, flexShrink: 0 },
  gameChipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  gameChipLabel: { fontSize: 12, lineHeight: 16 },
  gameMedal: { fontSize: 14 },
});
