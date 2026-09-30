/**
 * Pet screen (v20, 2026-09-29) — the Digimon-style virtual pet.
 *
 * Pure view over `view.pet` + pure transitions through `commit` (the rules
 * are in `pet.ts` / `playStore.ts`). Visuals reuse existing art only: the
 * stage's creep or hero sprite, enlarged smoothly per stage; a tinted copy at
 * low opacity + a coloured ring for the care branch; a vector egg in the
 * Legend's colour; and a God aura drawn by the attack-effects layer in the
 * most-used Legend element (a static glow when Effects Quality is Off).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { itemArtSource } from '@/play/art';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import { petBackStep, type InnerBack } from '@/play/edge-back';
import { FxLayer, FX_ULTIMATE_LIFE_MS, type FxEvent } from '@/play/fx-layer';
import { useFxQuality } from '@/play/fx-quality';
import { HeartIcon } from '@/play/icons';
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
import { ELEMENT_COLOR, ELEMENT_LABEL, type Element } from '@/play/kits';
import {
  NeonBackLink,
  NeonButton,
  NeonChip,
  NeonHeader,
  NeonLabel,
  NeonPanel,
} from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import {
  PET_BRANCH_LABEL,
  PET_BRANCH_TINT,
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
  petLines,
  petNextStage,
  petPounceBase,
  petRescueKeep,
  type PetState,
  PET_BRANCHES,
  formKey,
  newPet,
} from '@/play/pet';
import {
  COSMETICS,
  COSMETIC_SLOTS,
  cosmeticById,
  wornLook,
  type CosmeticSlot,
  type PetWear,
} from '@/play/pet-cosmetics';
import { PetFigure, petBoxSize } from '@/play/pet-figure';
import { CatchFoodGame, TapTrainGame, TRAIN_REPS } from '@/play/pet-games';
import { askPetReminderPermission, syncPetReminder } from '@/play/pet-reminder';
import {
  buyCosmetic,
  devAddShells,
  devPetExpeditionReset,
  devPetFinishStage,
  devPetNewEgg,
  devPetSetStage,
  devPetStarve,
  dismissExpeditionNote,
  feedFromPantry,
  finishPetRound,
  rebirthPetDoc,
  sendPetExpedition,
  setPetLine,
  setPetRemind,
  wearCosmetic,
  type PetRoundKind,
  type PetRoundResult,
  type PetView,
  type PlayView,
} from '@/play/playStore';
import { todayPlan } from '@/play/today-plan';
import type { PlayTransition } from '@/play/use-play-store';

const FRAME = 240;
const BASE_BOX = 150;
const AURA_EVERY_MS = 1400;
const ARM_LAPSE_MS = 3500;
const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------- sprite --- */

/** God aura: a soft static glow, plus a slow pulse from the effects layer
 * every ~1.4s (skipped when Effects Quality is Off or motion is reduced). */
function GodAura({ element, reduceMotion }: { element: Element; reduceMotion: boolean }) {
  const quality = useFxQuality();
  const color = ELEMENT_COLOR[element];
  const animate = quality !== 'off' && !reduceMotion;
  const [now, setNow] = useState(() => Date.now());
  const eventsRef = useRef<FxEvent[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!animate) return;
    let last = 0;
    const id = setInterval(() => {
      const t = Date.now();
      if (t - last >= AURA_EVERY_MS) {
        last = t;
        eventsRef.current = [
          ...eventsRef.current.filter((fx) => t - fx.bornAt < fx.lifeMs),
          {
            id: ++seqRef.current,
            bornAt: t,
            lifeMs: FX_ULTIMATE_LIFE_MS * 2,
            behavior: 'slow',
            element,
            secondary: null,
            ultimate: true,
            from: { x: 50, y: 50 },
            points: [{ x: 50, y: 50 }],
            arc: null,
            radius: 44,
            center: { x: 50, y: 50 },
            centredOnSource: true,
          },
        ];
      }
      setNow(t);
    }, 60);
    return () => clearInterval(id);
  }, [animate, element]);

  return (
    <Svg width={FRAME} height={FRAME} viewBox="0 0 100 100" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx="50" cy="50" r="46" fill={color} fillOpacity={0.06} />
      <Circle cx="50" cy="50" r="40" fill={color} fillOpacity={0.08} />
      <Circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={0.8} />
      {animate ? <FxLayer events={eventsRef.current} now={now} quality={quality} /> : null}
    </Svg>
  );
}

function PetSprite({
  pet,
  aura,
  eggColor,
  wear,
  reduceMotion,
}: {
  pet: PetState;
  aura: Element | null;
  eggColor: string;
  wear: PetWear;
  reduceMotion: boolean;
}) {
  const box = petBoxSize(pet, BASE_BOX);
  // The ring keeps the branch colour (the form stays readable); a worn ring
  // cosmetic only changes its style (v22).
  const tint = PET_BRANCH_TINT[pet.branch];
  const ringStyle = wornLook(wear).ring;
  const ring = Math.min(FRAME - 8, Math.round(box * 1.12));
  const ringColor = tint ?? NEON.cyanBorder;
  return (
    <View style={styles.frame}>
      {pet.stage === 'god' && aura ? <GodAura element={aura} reduceMotion={reduceMotion} /> : null}
      <View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: ringColor,
            borderWidth: ringStyle === 'thick' ? 5 : 2,
            borderStyle: ringStyle === 'dashed' ? 'dashed' : 'solid',
          },
        ]}
      />
      {ringStyle === 'double' ? (
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            { width: ring + 12, height: ring + 12, borderRadius: (ring + 12) / 2, borderColor: ringColor, borderWidth: 1 },
          ]}
        />
      ) : null}
      <PetFigure pet={pet} baseBox={BASE_BOX} eggColor={eggColor} wear={wear} />
    </View>
  );
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

/* ------------------------------------------------------------ helpers --- */

function durationLabel(ms: number): string {
  const mins = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.meterRow}>
      <Text style={styles.meterLabel}>{label}</Text>
      <View style={styles.hearts}>
        {Array.from({ length: PET_METER_MAX }, (_, i) => (
          <HeartIcon key={i} filled={i < value} size={16} />
        ))}
      </View>
    </View>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function roundResultLine(kind: PetRoundKind, score: number, result: PetRoundResult): string {
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
        <Text style={styles.subtle}>
          {entry
            ? `found ×${entry.count} · first at ${entry.depth === 0 ? 'the surface' : `depth ${entry.depth}`}`
            : `not found yet${tier ? ` · look from the ${DIVE_TIER_LABEL[tier]}` : ''}`}
        </Text>
      </View>
    </View>
  );
}

const SLOT_LABEL: Record<CosmeticSlot, string> = { badge: 'Badges', tint: 'Tints', ring: 'Rings', aura: 'Auras' };

/** Wardrobe (v22): wear / take off what you own; buy tints and badges with
 * tokens; rings and auras only come from deep dives. */
function Wardrobe({
  view,
  commit,
}: {
  view: PlayView;
  commit: (transition: PlayTransition) => boolean;
}) {
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
    <View style={styles.logList}>
      <Text style={styles.body}>
        Tokens: {view.tokens}. Tints and badges are in the Wardrobe; rings come from the Trench and
        deeper, auras from the Abyss and deeper.
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
    </View>
  );
}

/** Collection (v22): every form of every pet line — found ones drawn, the
 * rest as silhouettes. */
function Collection({ view, eggColor }: { view: PlayView; eggColor: string }) {
  const found = new Set(view.pet.collection);
  return (
    <View style={styles.logList}>
      <Text style={styles.body}>
        Every form each pet line can take. A form counts once a pet reaches it (from Child). Cosmetics
        owned: {view.pet.cosmetics.length}/{COSMETICS.length}.
      </Text>
      {petLines().map((line) => (
        <View key={line.id} style={styles.collRow}>
          <Text style={[styles.subtle, styles.collLabel]} numberOfLines={2}>
            {line.label}
          </Text>
          <View style={styles.collForms}>
            {PET_BRANCHES.map((branch) => {
              const has = found.has(formKey(line.id, branch));
              const sample: PetState = { ...newPet(0, line.id), stage: 'teen', branch };
              return (
                <View key={branch} style={styles.collCell} accessibilityLabel={`${line.label} ${PET_BRANCH_LABEL[branch]}${has ? '' : ', not found'}`}>
                  <PetFigure pet={sample} baseBox={34} eggColor={eggColor} silhouette={!has} />
                  <Text style={styles.collName}>{has ? PET_BRANCH_LABEL[branch] : '???'}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Keep the opt-in hunger reminder in step with the pet (call once from the
 * Play shell so a TD feed moves it too, not only this screen). */
export function usePetReminderSync(pet: PetView | null): void {
  const on = pet?.remind ?? false;
  const stage = pet?.state.stage;
  const hunger = pet?.state.hunger;
  const state = pet?.state;
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const current = stateRef.current;
    if (!current) return;
    void syncPetReminder(on, current, Date.now());
  }, [on, stage, hunger]);
}

/* ------------------------------------------------------------- screen --- */

export function PetScreen({
  view,
  commit,
  registerBack,
  reduceMotion,
  onBack,
  onGoDive,
}: {
  view: PlayView;
  commit: (transition: PlayTransition) => boolean;
  /** Back one level (edge-back.ts): a running mini-game closes first. */
  registerBack?: (inner: InnerBack | null) => void;
  reduceMotion: boolean;
  onBack: () => void;
  /** "Go diving" (v21) — opens Dive; its Back returns here. */
  onGoDive: () => void;
}) {
  const devUnlocked = usePlayDevUnlocked();
  const pv = view.pet;
  const pet = pv.state;
  const [game, setGame] = useState<PetRoundKind | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [rebirthArmed, setRebirthArmed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hallOpen, setHallOpen] = useState(false);
  const [logbookOpen, setLogbookOpen] = useState(false);
  const [wardrobeOpen, setWardrobeOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [feedNote, setFeedNote] = useState<string | null>(null);
  const [remindNote, setRemindNote] = useState<string | null>(null);

  useEffect(() => {
    if (!registerBack) return;
    registerBack({
      edgeSwipe: true,
      back: () => {
        if (petBackStep(game != null) === 'hub') return false;
        setGame(null); // the unfinished round does not count
        return true;
      },
    });
    return () => registerBack(null);
  }, [registerBack, game]);

  useEffect(() => {
    if (!rebirthArmed) return;
    const id = setTimeout(() => setRebirthArmed(false), ARM_LAPSE_MS);
    return () => clearTimeout(id);
  }, [rebirthArmed]);

  const finishRound = (kind: PetRoundKind) => (score: number) => {
    let result: PetRoundResult | null = null;
    commit((doc, now) => {
      const next = finishPetRound(doc, now, kind, score);
      result = next.result;
      return next.doc;
    });
    setGame(null);
    if (result) setLastResult(roundResultLine(kind, score, result));
  };

  const pressRebirth = () => {
    if (!rebirthArmed) {
      setRebirthArmed(true);
      return;
    }
    setRebirthArmed(false);
    commit((doc, now) => rebirthPetDoc(doc, now));
  };

  const toggleRemind = async () => {
    if (pv.remind) {
      commit((doc) => setPetRemind(doc, false));
      setRemindNote(null);
      return;
    }
    const granted = await askPetReminderPermission();
    if (!granted) {
      setRemindNote('Notifications are off for ATO — turn them on in your phone’s Settings to get the reminder.');
      return;
    }
    commit((doc) => setPetRemind(doc, true));
    setRemindNote('On — one gentle nudge when your pet gets hungry, at most once a day.');
  };

  const line = petLineById(pet.line);
  const stageName = PET_STAGE_LABEL[pet.stage];
  const showBranch = pet.stage !== 'egg' && pet.stage !== 'baby';
  const title = showBranch ? `${stageName} · ${PET_BRANCH_LABEL[pet.branch]}` : stageName;
  const onTrack =
    pet.stage !== 'egg' && pet.stage !== 'god' ? PET_BRANCH_LABEL[branchFor(pet.stage, pet)] : null;
  const deepNeed = pet.stage !== 'egg' && pet.stage !== 'god' ? branchThresholds(pet.stage).deepSurfaces : null;
  const rebirthPct = Math.round(view.petRebirthBonus * 100);

  // Status card (v21) — replaces the old timer line and "What your pet does".
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
  const expeditionLine =
    pv.expedition === 'locked'
      ? 'Expedition: unlocks at Child.'
      : pv.expedition === 'ready'
        ? `Expedition ready — it dives the shallows alone for at least an hour, can’t bust, and brings back 1 find.`
        : pv.expedition === 'away'
          ? `Away on expedition — back in ${durationLabel(pv.expeditionBackInMs ?? 0)}.`
          : 'Expedition: back tomorrow — once a day.';
  const noteName = pv.expeditionNote ? findName(pv.expeditionNote) : null;
  const logIds = diveCollectibleIds();
  const today = todayPlan(view);
  const feed = (food: FoodId) => {
    const ok = commit((doc, now) => feedFromPantry(doc, now, food));
    setFeedNote(
      ok
        ? `Fed ${FOODS[food].name} — +${FOODS[food].hearts} hunger.`
        : pv.away
          ? 'It’s away on an expedition.'
          : 'It’s full — save it for later.',
    );
  };
  const logFound = logIds.filter((id) => pv.logbook[id]).length;

  return (
    <View style={styles.screen}>
      <NeonBackLink onPress={onBack} />
      <NeonHeader
        title="Pet"
        lede="Raise one buddy from an egg to a God. Care decides its form — it never dies."
      />

      <NeonPanel style={styles.stageCard}>
        <PetSprite
          pet={pet}
          aura={pv.aura ?? view.legendElement}
          eggColor={ELEMENT_COLOR[view.legendElement]}
          wear={pv.wear}
          reduceMotion={reduceMotion}
        />
        <Text style={styles.stageTitle}>{title}</Text>
        <Text style={styles.subtle}>{pet.stage === 'egg' ? `Will hatch as: ${line.label}` : line.label}</Text>
        {pet.stage !== 'egg' ? (
          <View style={styles.meters}>
            <Meter label="Hunger" value={pet.hunger} />
            <Meter label="Mood" value={pet.mood} />
          </View>
        ) : null}
        {onTrack ? (
          <Text style={styles.subtle}>
            This stage: {plural(pet.mistakes, 'care mistake')} · {pet.training} training ·{' '}
            {plural(pet.waves, 'wave')} · {pet.deep_surfaces}/{deepNeed} deep{' '}
            {pet.deep_surfaces === 1 ? 'surface' : 'surfaces'} → on track for {onTrack}
          </Text>
        ) : null}
      </NeonPanel>

      <NeonPanel>
        <NeonLabel>Status</NeonLabel>
        <Text style={styles.body}>Age: {ageDays} {ageDays === 1 ? 'day' : 'days'}</Text>
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
        <Text style={styles.body}>{expeditionLine}</Text>
        {noteName ? (
          <View style={styles.noteRow}>
            <Text style={styles.result}>Your pet brought back {noteName}!</Text>
            <NeonChip label="Nice" onPress={() => commit((doc) => dismissExpeditionNote(doc))} />
          </View>
        ) : null}
        <View style={styles.buttons}>
          {pv.expedition === 'ready' ? (
            <NeonButton
              label="Send on expedition"
              variant="secondary"
              onPress={() => commit((doc, now) => sendPetExpedition(doc, now).doc)}
              style={styles.flex}
            />
          ) : null}
          <NeonButton label="Go diving" onPress={onGoDive} style={styles.flex} />
        </View>
      </NeonPanel>

      <NeonPanel>
        <NeonLabel>Today · one minute</NeonLabel>
        {[today.td, today.pet, today.both, today.goal].map((lineText) => (
          <Text key={lineText} style={styles.body}>
            {lineText}
          </Text>
        ))}
      </NeonPanel>

      {pet.stage === 'egg' ? (
        <NeonPanel>
          <NeonLabel>Choose what hatches</NeonLabel>
          <Text style={styles.body}>
            You can change it until the egg hatches. The three minion lines grow into a hero at Teen.
          </Text>
          <View style={styles.chips}>
            {petLines().map((option) => (
              <NeonChip
                key={option.id}
                label={option.label}
                selected={option.id === pet.line}
                onPress={() => commit((doc, now) => setPetLine(doc, now, option.id))}
              />
            ))}
          </View>
        </NeonPanel>
      ) : (
        <NeonPanel>
          <NeonLabel>Play</NeonLabel>
          {game === 'catch' ? (
            <CatchFoodGame onDone={finishRound('catch')} />
          ) : game === 'train' ? (
            <TapTrainGame onDone={finishRound('train')} />
          ) : (
            <>
              <Text style={styles.body}>
                +{PET_TOKENS_PER_ROUND} tokens a round · {pv.tokensLeftToday}/{PET_TOKENS_DAILY_CAP} left
                today. TD stays the main way to earn.
              </Text>
              <View style={styles.buttons}>
                <NeonButton label="Catch the food" onPress={() => setGame('catch')} style={styles.flex} />
                <NeonButton
                  label="Tap to train"
                  variant="secondary"
                  onPress={() => setGame('train')}
                  style={styles.flex}
                />
              </View>
              {lastResult ? <Text style={styles.result}>{lastResult}</Text> : null}
              <Text style={styles.body}>
                Pantry ({pv.pantryTotal}/{PANTRY_MAX}):{' '}
                {pv.pantryTotal === 0
                  ? 'empty — dives find Kelp snacks and Glow shrimp.'
                  : FOOD_IDS.filter((f) => (pv.pantry[f] ?? 0) > 0)
                      .map((f) => `${FOODS[f].name} ×${pv.pantry[f]}`)
                      .join(' · ')}
              </Text>
              {pv.pantryTotal > 0 ? (
                <View style={styles.buttons}>
                  {FOOD_IDS.filter((f) => (pv.pantry[f] ?? 0) > 0).map((f) => (
                    <NeonButton
                      key={f}
                      label={`Feed ${FOODS[f].name} (+${FOODS[f].hearts})`}
                      variant="secondary"
                      onPress={() => feed(f)}
                      style={styles.flex}
                    />
                  ))}
                </View>
              ) : null}
              {feedNote ? <Text style={styles.result}>{feedNote}</Text> : null}
            </>
          )}
        </NeonPanel>
      )}

      {pet.stage === 'god' ? (
        <NeonPanel>
          <NeonLabel>Rebirth</NeonLabel>
          <Text style={styles.body}>
            Retire this God to the Hall of pets and start a new egg. Each rebirth adds +2% damage
            for good (up to +10%). Optional — your God can stay as long as you like.
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
        </NeonPanel>
      ) : null}

      <NeonPanel>
        <NeonChip
          label={`Hall of pets · ${pv.hall.length}`}
          selected={hallOpen}
          onPress={() => setHallOpen((open) => !open)}
        />
        {hallOpen ? (
          pv.hall.length === 0 ? (
            <Text style={styles.body}>Empty for now — a pet joins after its rebirth.</Text>
          ) : (
            [...pv.hall].reverse().map((entry, i) => (
              <Text key={`${entry.rebirth}-${i}`} style={styles.body}>
                #{entry.rebirth} {petLineById(entry.line).label} · {PET_BRANCH_LABEL[entry.branch]}
                {entry.aura ? ` · ${ELEMENT_LABEL[entry.aura]} aura` : ''} · {entry.days}d
              </Text>
            ))
          )
        ) : null}
      </NeonPanel>

      <NeonPanel>
        <NeonChip
          label={`Logbook · ${logFound}/${logIds.length}`}
          selected={logbookOpen}
          onPress={() => setLogbookOpen((open) => !open)}
        />
        {logbookOpen ? (
          <View style={styles.logList}>
            <Text style={styles.body}>
              Everything your pet has found on dives and expeditions. Depth = where it was first found.
            </Text>
            {logIds.map((id) => (
              <LogRow key={id} id={id} entry={pv.logbook[id] ?? null} />
            ))}
          </View>
        ) : null}
      </NeonPanel>

      <NeonPanel>
        <NeonChip
          label={`Wardrobe · ${pv.cosmetics.length}/${COSMETICS.length}`}
          selected={wardrobeOpen}
          onPress={() => setWardrobeOpen((open) => !open)}
        />
        {wardrobeOpen ? <Wardrobe view={view} commit={commit} /> : null}
      </NeonPanel>

      <NeonPanel>
        <NeonChip
          label={`Collection · ${pv.collection.length}/${pv.collectionSize}`}
          selected={collectionOpen}
          onPress={() => setCollectionOpen((open) => !open)}
        />
        {collectionOpen ? <Collection view={view} eggColor={ELEMENT_COLOR[view.legendElement]} /> : null}
      </NeonPanel>

      <NeonPanel>
        <NeonChip
          label={`Hunger reminder · ${pv.remind ? 'On' : 'Off'}`}
          selected={pv.remind}
          onPress={() => void toggleRemind()}
        />
        {remindNote ? <Text style={styles.body}>{remindNote}</Text> : null}
      </NeonPanel>

      <NeonPanel>
        <NeonChip label="How it works" selected={guideOpen} onPress={() => setGuideOpen((o) => !o)} />
        {guideOpen ? (
          <View style={styles.guide}>
            <Text style={styles.body}>
              • It grows on real time: Egg (1h) → Baby (12h) → Child (1.5 days) → Teen (3 days) →
              Adult (5 days) → God. About 10 days in all, even if you only play TD.
            </Text>
            <Text style={styles.body}>
              • Hunger drops a heart every 3h, mood every 4h. Leaving one empty for over 2h is a
              care mistake. Feed it with Catch the food or by clearing TD waves; cheer it up with Tap
              to train.
            </Text>
            <Text style={styles.body}>
              • Diving is care too: surfacing a haul with your pet along gives +2 mood, a bust still
              gives +1. Diving never adds training and never speeds up the timer.
            </Text>
            <Text style={styles.body}>
              • At each evolution this stage’s care picks the form: lots of mistakes → Scruffy; lots
              of TD waves → Battle (stronger pounce); lots of surfaces from {PET_DEEP_MIN_DEPTH}+
              Deepers → Deep (if it earned both Battle and Deep, the one it beat by more wins, ties go
              to Battle); good care + training → Bright; otherwise Standard. Counters reset every stage.
            </Text>
            <Text style={styles.body}>
              • TD: from Child it pounces once per wave, and every cleared wave feeds it one heart.
              Dive: from Teen it lowers the bust chance, from Adult it saves your best find on a bust
              (two at God). A Deep pet takes one more point off at every stage (so a Deep Child
              already helps) and saves one more find at Adult/God (never more than {PET_RESCUE_MAX}). The % shown is always the real one, and the pet is never lost.
            </Text>
            <Text style={styles.body}>
              • Expedition (Child and up, once a day): it dives the shallows alone for at least an
              hour, can’t bust, and brings back one find — collected the next time you open the app
              after that. While it’s away there’s no pounce, bust cut or rescue, and your dives don’t
              count as its care or go in its Logbook.
            </Text>
            <Text style={styles.body}>
              • Logbook: every find from your pet’s dives and expeditions, with how deep it was first
              found and how many times. It stays through rebirths.
            </Text>
            <Text style={styles.body}>
              • Dive levels: Shallows, Reef, Trench, Abyss (and the Hadal with Oxygen). Deeper levels
              hold more Powers and the only rings and auras. Each Deeper has two paths — Safer (8
              points less bust, finds from one level up) and Richer (8 more, one level down) — and
              both show their exact %.
            </Text>
            <Text style={styles.body}>
              • Shells come from TD waves and dives and buy Dive gear for good: Lamp (see each path’s
              next find), Net (+1 find when you surface from depth 2+), Oxygen (a 5th Deeper).
            </Text>
            <Text style={styles.body}>
              • Out of charges? Free dives keep only shells (the first 10 a day pay full, then fewer)
              and mood; their finds are Logbook sightings. They never count toward the Deep form.
            </Text>
            <Text style={styles.body}>
              • Food found diving goes to the pantry (up to {PANTRY_MAX}) — your pet only eats when you
              tap Feed. Cosmetics (badge, tint, ring, aura) are in the Wardrobe; the Collection shows
              every form each pet line can take.
            </Text>
            <Text style={styles.body}>
              • The God form glows in the Legend element you played TD with most. Rebirth is optional
              and adds +2% damage for good (max +10%).
            </Text>
            <Text style={styles.body}>
              • Time only counts forward: changing the phone’s clock back does nothing, and at most 2
              days count between visits.
            </Text>
          </View>
        ) : null}
      </NeonPanel>

      {PRE_LAUNCH_DEV && devUnlocked ? (
        <NeonPanel>
          <NeonLabel>Dev · pet</NeonLabel>
          <View style={styles.chips}>
            <NeonChip label="Finish stage" onPress={() => commit((doc, now) => devPetFinishStage(doc, now))} />
            <NeonChip label="Starve" onPress={() => commit((doc, now) => devPetStarve(doc, now))} />
            <NeonChip label="Set Adult" onPress={() => commit((doc, now) => devPetSetStage(doc, now, 'adult'))} />
            <NeonChip label="Set God" onPress={() => commit((doc, now) => devPetSetStage(doc, now, 'god'))} />
            <NeonChip label="New egg" onPress={() => commit((doc, now) => devPetNewEgg(doc, now))} />
            <NeonChip
              label="Expedition: back now + reset day"
              onPress={() => commit((doc, now) => devPetExpeditionReset(doc, now))}
            />
            <NeonChip label="+100 shells" onPress={() => commit((doc) => devAddShells(doc))} />
          </View>
        </NeonPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 14 },
  stageCard: { alignItems: 'center', gap: 6 },
  frame: {
    width: FRAME,
    height: FRAME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: NEON.cyanBorder,
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: NEON.cyan },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  logList: { gap: 8, marginTop: 4 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  logArt: { width: 28, height: 28 },
  silhouette: { opacity: 0.55 },
  wardSlot: { gap: 6, marginTop: 6 },
  collRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collLabel: { width: 72, textAlign: 'left' },
  collForms: { flexDirection: 'row', flex: 1, justifyContent: 'space-between' },
  collCell: { alignItems: 'center', width: 44 },
  collName: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    color: NEON.textMuted,
  },
  logName: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: NEON.textPrimary,
  },
  stageTitle: {
    fontFamily: Fonts.displayBold,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
  },
  timer: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    color: NEON.cyan,
  },
  subtle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: NEON.textMuted,
    textAlign: 'center',
  },
  meters: { alignSelf: 'stretch', gap: 6, marginTop: 4 },
  meterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabel: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: NEON.textPrimary,
  },
  hearts: { flexDirection: 'row', gap: 6 },
  body: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: NEON.textMuted,
    marginTop: 6,
  },
  result: {
    fontFamily: Fonts.monoBold,
    fontSize: 12,
    color: NEON.cyan,
    marginTop: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  flex: { flex: 1 },
  guide: { marginTop: 4 },
});
