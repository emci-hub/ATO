/**
 * Pet — a Digimon-style virtual pet for Divecore (approved 2026-09-29).
 *
 * Pure rules only (no React, no storage, no art): the save shape, how time
 * ages the pet, how care decides its form, and the small TD / Dive / token
 * links. `playStore.ts` stores it and wires the doc-level transitions; the
 * screen (`pet-screen.tsx`) draws it.
 *
 * Time (the app does not run in the background): everything is aged from the
 * last time the pet was seen, when the app opens or a transition runs.
 *   - `seen_at` is a HIGH-WATER MARK. A clock set backwards means no time
 *     passes, so rewinding the phone cannot undo or repeat anything. Only a
 *     clock more than 48h behind the mark re-anchors it (no time added), so a
 *     phone once set far ahead never freezes the pet.
 *   - One gap counts at most `PET_MAX_GAP_MS` (48h), so pushing the clock far
 *     ahead cannot skip the pet to God in one jump.
 *   - Stage progress is an age ACCUMULATOR (`stage_age_ms`), not a wall
 *     timestamp, so the guard above is the only place real time enters.
 *
 * Care decides WHICH form, never whether it evolves, and the pet never dies:
 * at every evolution the stage's counters (care mistakes, training, TD waves)
 * pick a branch, then reset for the next stage.
 */
import { ELEMENTS, type Element } from '@/play/kits';
import { allHeroes, heroById } from '@/play/heroes-data';

/* ------------------------------------------------------------ numbers --- */

const HOUR = 60 * 60 * 1000;

export const PET_STAGES = ['egg', 'baby', 'child', 'teen', 'adult', 'god'] as const;
export type PetStage = (typeof PET_STAGES)[number];

/** How long each stage lasts before it evolves (God is the last stage).
 * 1 + 12 + 36 + 72 + 120 h ≈ 10 days to God. */
export const PET_STAGE_MS: Record<Exclude<PetStage, 'god'>, number> = {
  egg: 1 * HOUR,
  baby: 12 * HOUR,
  child: 36 * HOUR,
  teen: 72 * HOUR,
  adult: 120 * HOUR,
};

export const PET_BRANCHES = ['standard', 'bright', 'battle', 'scruffy', 'deep'] as const;
export type PetBranch = (typeof PET_BRANCHES)[number];

/** Hearts per meter. */
export const PET_METER_MAX = 4;
/** Hunger drops one heart every 3h, mood every 4h (not while an egg). */
export const PET_HUNGER_TICK_MS = 3 * HOUR;
export const PET_MOOD_TICK_MS = 4 * HOUR;
/** A meter left empty this long is one care mistake… */
export const PET_GRACE_MS = 2 * HOUR;
/** …and at most one more mistake per meter every 6h after that. */
export const PET_MISTAKE_GAP_MS = 6 * HOUR;
/** Clock guard: one gap between visits counts at most this much. */
export const PET_MAX_GAP_MS = 48 * HOUR;

/** TD pounce (once per wave, Child and up): base damage at wave 1, scaled
 * with the wave's creep HP so it stays the same share of a creep's life.
 * Sim-validated (2026-09-29): the first draft (10/18/28/40) cut damage needed
 * by 10-31% — far past the 3-8% "helps, never mandatory" target, because one
 * pounce hits a whole clump. These land Child 3% → God 6%, Battle God under 8%. */
export const PET_POUNCE_BASE: Record<PetStage, number> = {
  egg: 0,
  baby: 0,
  child: 4.5,
  teen: 5.5,
  adult: 6.5,
  god: 7.5,
};
/** Pounce radius around the Avatar, board units (0..100). */
export const PET_POUNCE_RADIUS = 14;
/** Branch strength for the pounce. Battle was ×1.25 in the plan; the sim put
 * a Battle God at 9.7% (over the 8% ceiling), so it is ×1.1. */
export const PET_BRANCH_POUNCE: Record<PetBranch, number> = {
  standard: 1,
  bright: 1,
  battle: 1.1,
  scruffy: 0.8,
  // v21: Deep is a Dive form — its pounce stays at Standard strength, so the
  // TD sim band above is unchanged.
  deep: 1,
};

/** Dive buddy: bust chance cut, whole percentage points (floor still holds). */
export const PET_BUST_CUT_PP: Record<PetStage, number> = {
  egg: 0,
  baby: 0,
  child: 0,
  teen: 1,
  adult: 2,
  god: 3,
};
/** Dive buddy: best finds kept when a dive busts (once per dive). */
export const PET_RESCUE_KEEP: Record<PetStage, number> = {
  egg: 0,
  baby: 0,
  child: 0,
  teen: 0,
  adult: 1,
  god: 2,
};

/** Deep form (v21): +1 more bust-cut point (the half-table floor still holds)
 * and +1 rescue keep at Adult/God — but never more than 2 finds saved. */
export const PET_DEEP_BUST_CUT_PP = 1;
export const PET_RESCUE_MAX = 2;

/** Dive care (v21, emci 2026-09-29): Dive is mood only — training stays with
 * Tap to train. A surface at this depth or deeper counts toward Deep. */
export const PET_DIVE_SURFACE_MOOD = 2;
export const PET_DIVE_BUST_MOOD = 1;
export const PET_DEEP_MIN_DEPTH = 3;

/** Solo expedition (v21): Child and up, once per device-local day; away at
 * least this much counted time, can't bust, brings back one find. */
export const PET_EXPEDITION_MIN_MS = 1 * HOUR;
export const PET_EXPEDITION_MIN_STAGE: PetStage = 'child';

/** Mini-game token trickle: per finished round, capped per device-local day. */
export const PET_TOKENS_PER_ROUND = 5;
export const PET_TOKENS_DAILY_CAP = 30;
/** A round must score at least this to count (care + tokens). */
export const PET_MIN_ROUND_SCORE = 3;

/** Rebirth: +2% permanent damage per rebirth, capped at +10%. */
export const PET_REBIRTH_STEP = 0.02;
export const PET_REBIRTH_CAP = 0.1;
/** Hall of pets keeps this many retired pets (oldest drop off). */
export const PET_HALL_MAX = 60;

/** Care effects. */
export const PET_FEED_CATCH = 2; // hunger hearts from a "Catch the food" round
export const PET_TRAIN_MOOD = 2; // mood hearts from a "Tap to train" round
export const PET_FEED_WAVE = 1; // hunger heart from a cleared TD wave

/* -------------------------------------------------------------- lines --- */

/** A pet line: what each stage looks like. `creep` stages draw a creep sprite
 * (the Knight / Wizard / Village Girl minions), `hero` stages a hero's. */
export type PetLook = { kind: 'creep'; role: 'unit.tank' | 'unit.runner' | 'unit.puff' } | { kind: 'hero'; heroId: string };
export type PetLine = {
  id: string;
  label: string;
  /** Baby + Child look. */
  young: PetLook;
  /** Teen, Adult and God look. */
  grown: PetLook;
};

const THEMED_LINES: readonly PetLine[] = [
  { id: 'line_knight', label: 'Knight → Raven', young: { kind: 'creep', role: 'unit.tank' }, grown: { kind: 'hero', heroId: 'raven' } },
  { id: 'line_wizard', label: 'Wizard → Maldrath', young: { kind: 'creep', role: 'unit.runner' }, grown: { kind: 'hero', heroId: 'maldrath' } },
  { id: 'line_village', label: 'Village Girl → Elowen', young: { kind: 'creep', role: 'unit.puff' }, grown: { kind: 'hero', heroId: 'elowen' } },
];

/** Every line: the three themed minion → hero lines, then each hero alone. */
export function petLines(): readonly PetLine[] {
  const themed = THEMED_LINES.filter(
    (line) => line.grown.kind !== 'hero' || heroById(line.grown.heroId) != null,
  );
  const solo = allHeroes().map<PetLine>((hero) => ({
    id: `solo_${hero.id}`,
    label: hero.name,
    young: { kind: 'hero', heroId: hero.id },
    grown: { kind: 'hero', heroId: hero.id },
  }));
  return [...themed, ...solo];
}

export const DEFAULT_PET_LINE = 'line_knight';

export function petLineById(id: string): PetLine {
  const lines = petLines();
  return lines.find((line) => line.id === id) ?? lines[0];
}

/** The look for a stage (null = the egg, which is drawn as a vector shape). */
export function petLookFor(lineId: string, stage: PetStage): PetLook | null {
  if (stage === 'egg') return null;
  const line = petLineById(lineId);
  return stage === 'baby' || stage === 'child' ? line.young : line.grown;
}

/** Drawn size per stage, as a multiple of the base sprite box. Soft (smooth)
 * enlarging — sharp-pixel scaling is a native-build follow-up. */
export const PET_STAGE_SCALE: Record<PetStage, number> = {
  egg: 0.6,
  baby: 0.55,
  child: 0.75,
  teen: 0.9,
  adult: 1.15,
  god: 1.45,
};

/** Colour wash per branch (null = no wash). */
export const PET_BRANCH_TINT: Record<PetBranch, string | null> = {
  standard: null,
  bright: '#FFD86B',
  battle: '#FF5A4E',
  scruffy: '#8A7F6A',
  deep: '#2FD4C4',
};

export const PET_STAGE_LABEL: Record<PetStage, string> = {
  egg: 'Egg',
  baby: 'Baby',
  child: 'Child',
  teen: 'Teen',
  adult: 'Adult',
  god: 'God',
};

export const PET_BRANCH_LABEL: Record<PetBranch, string> = {
  standard: 'Standard',
  bright: 'Bright',
  battle: 'Battle',
  scruffy: 'Scruffy',
  deep: 'Deep',
};

/* -------------------------------------------------------------- state --- */

export type PetState = {
  line: string;
  stage: PetStage;
  /** The form care picked at the last evolution. */
  branch: PetBranch;
  /** Time spent in the current stage (accumulator, see the header). */
  stage_age_ms: number;
  /** Time lived since hatching began (egg included). */
  total_age_ms: number;
  hunger: number;
  mood: number;
  /** Time toward the next heart lost. */
  hunger_acc_ms: number;
  mood_acc_ms: number;
  /** How long the meter has sat empty (goes negative after a mistake — the
   * 6h gap before the next one). */
  hunger_empty_ms: number;
  mood_empty_ms: number;
  /** This stage's counters — reset at every evolution. */
  mistakes: number;
  training: number;
  waves: number;
  /** Dive surfaces at `PET_DEEP_MIN_DEPTH`+ this stage (v21). */
  deep_surfaces: number;
  /** TD waves cleared with each Legend element, over this pet's life — the
   * most used one colours the God aura. */
  element_uses: Partial<Record<Element, number>>;
  /** High-water mark of the device clock (see the header). */
  seen_at: number;
};

export type PetHallEntry = {
  line: string;
  branch: PetBranch;
  aura: Element | null;
  /** Which rebirth retired it (1 = the first). */
  rebirth: number;
  /** Days it lived (egg to rebirth, as counted by the clock guard). */
  days: number;
};

export function newPet(now: number, line: string = DEFAULT_PET_LINE): PetState {
  return {
    line,
    stage: 'egg',
    branch: 'standard',
    stage_age_ms: 0,
    total_age_ms: 0,
    hunger: PET_METER_MAX,
    mood: PET_METER_MAX,
    hunger_acc_ms: 0,
    mood_acc_ms: 0,
    hunger_empty_ms: 0,
    mood_empty_ms: 0,
    mistakes: 0,
    training: 0,
    waves: 0,
    deep_surfaces: 0,
    element_uses: {},
    seen_at: now,
  };
}

/* ---------------------------------------------------------- evolution --- */

function stageDays(stage: Exclude<PetStage, 'god'>): number {
  return PET_STAGE_MS[stage] / (24 * HOUR);
}

/** The thresholds a stage's counters are judged against (scaled by how long
 * the stage lasts, so a 12h Baby and a 5-day Adult are judged fairly). */
export function branchThresholds(stage: Exclude<PetStage, 'god'>): {
  scruffyMistakes: number;
  battleWaves: number;
  brightMaxMistakes: number;
  brightTraining: number;
  deepSurfaces: number;
} {
  const d = stageDays(stage);
  return {
    scruffyMistakes: Math.max(2, Math.ceil(d * 2)),
    battleWaves: Math.max(3, Math.ceil(d * 4)),
    // Same formula as battleWaves (emci 2026-09-29).
    deepSurfaces: Math.max(3, Math.ceil(d * 4)),
    brightMaxMistakes: Math.max(1, Math.floor(d)),
    brightTraining: Math.max(1, Math.ceil(d * 2)),
  };
}

/** Which form the ending stage's care earns. Neglect first (it wins over
 * everything), then lots of TD (Battle) or lots of deep Dive surfaces (Deep) —
 * when both qualify, the one passed by the bigger margin (count / threshold)
 * wins, ties to Battle — then good care + training. */
export function branchFor(
  stage: Exclude<PetStage, 'god'>,
  counters: { mistakes: number; training: number; waves: number; deep_surfaces?: number },
): PetBranch {
  if (stage === 'egg') return 'standard';
  const t = branchThresholds(stage);
  if (counters.mistakes >= t.scruffyMistakes) return 'scruffy';
  const deep = counters.deep_surfaces ?? 0;
  const battleOk = counters.waves >= t.battleWaves;
  const deepOk = deep >= t.deepSurfaces;
  // Cross-multiplied margin compare (no float ties): deep/dT > waves/bT.
  if (deepOk && (!battleOk || deep * t.battleWaves > counters.waves * t.deepSurfaces)) return 'deep';
  if (battleOk) return 'battle';
  if (counters.mistakes <= t.brightMaxMistakes && counters.training >= t.brightTraining) return 'bright';
  return 'standard';
}

function nextStage(stage: PetStage): PetStage {
  const i = PET_STAGES.indexOf(stage);
  return PET_STAGES[Math.min(PET_STAGES.length - 1, i + 1)];
}

function evolve(pet: PetState): PetState {
  if (pet.stage === 'god') return pet;
  const from = pet.stage;
  const hatching = from === 'egg';
  return {
    ...pet,
    stage: nextStage(from),
    branch: branchFor(from, pet),
    stage_age_ms: 0,
    mistakes: 0,
    training: 0,
    waves: 0,
    deep_surfaces: 0,
    // A fresh hatchling starts full; later stages keep their meters.
    ...(hatching
      ? { hunger: PET_METER_MAX, mood: PET_METER_MAX, hunger_acc_ms: 0, mood_acc_ms: 0, hunger_empty_ms: 0, mood_empty_ms: 0 }
      : {}),
  };
}

/* -------------------------------------------------------------- aging --- */

/** Age the pet by `ms` of counted time. Exact and split-proof: aging by 5h
 * then 3h lands on the same state as aging by 8h once. */
export function agePet(pet: PetState, ms: number): PetState {
  let p = { ...pet };
  let remaining = Math.max(0, ms);
  // Each loop reaches one event (a heart lost, a mistake, an evolution) or
  // the end — a 48h gap is a few dozen iterations. The cap is a safety net.
  for (let guard = 0; remaining > 0 && guard < 10_000; guard += 1) {
    const decays = p.stage !== 'egg';
    let dt = remaining;
    if (p.stage !== 'god') dt = Math.min(dt, PET_STAGE_MS[p.stage] - p.stage_age_ms);
    if (decays) {
      dt = Math.min(
        dt,
        p.hunger > 0 ? PET_HUNGER_TICK_MS - p.hunger_acc_ms : PET_GRACE_MS - p.hunger_empty_ms,
        p.mood > 0 ? PET_MOOD_TICK_MS - p.mood_acc_ms : PET_GRACE_MS - p.mood_empty_ms,
      );
    }
    dt = Math.max(0, dt);
    remaining -= dt;
    p.stage_age_ms += dt;
    p.total_age_ms += dt;
    if (decays) {
      // While a meter has hearts, a post-mistake gap (negative empty timer)
      // keeps counting down toward 0, so "one mistake per 6h" holds even if
      // the pet is fed in between (min(0, …) keeps this split-proof).
      if (p.hunger > 0) {
        p.hunger_acc_ms += dt;
        p.hunger_empty_ms = Math.min(0, p.hunger_empty_ms + dt);
      } else p.hunger_empty_ms += dt;
      if (p.mood > 0) {
        p.mood_acc_ms += dt;
        p.mood_empty_ms = Math.min(0, p.mood_empty_ms + dt);
      } else p.mood_empty_ms += dt;
      if (p.hunger > 0 && p.hunger_acc_ms >= PET_HUNGER_TICK_MS) {
        p.hunger -= 1;
        p.hunger_acc_ms -= PET_HUNGER_TICK_MS;
      }
      if (p.mood > 0 && p.mood_acc_ms >= PET_MOOD_TICK_MS) {
        p.mood -= 1;
        p.mood_acc_ms -= PET_MOOD_TICK_MS;
      }
      if (p.hunger === 0 && p.hunger_empty_ms >= PET_GRACE_MS) {
        p.mistakes += 1;
        p.hunger_empty_ms -= PET_MISTAKE_GAP_MS;
      }
      if (p.mood === 0 && p.mood_empty_ms >= PET_GRACE_MS) {
        p.mistakes += 1;
        p.mood_empty_ms -= PET_MISTAKE_GAP_MS;
      }
    }
    if (p.stage !== 'god' && p.stage_age_ms >= PET_STAGE_MS[p.stage]) p = evolve(p);
  }
  return p;
}

/** Bring the pet up to `now` through the clock guard (see the header). A
 * clock more than 48h BEHIND the mark (the phone was set far ahead once, even
 * by accident) re-anchors the mark to now with no time passing, so the pet
 * can never freeze until some far-future date. That adds no exploit: each
 * forward jump is already worth at most 48h. */
export function advancePet(pet: PetState, now: number): PetState {
  if (now < pet.seen_at - PET_MAX_GAP_MS) return { ...pet, seen_at: now };
  if (!(now > pet.seen_at)) return pet; // clock went back (or no time): nothing passes
  const gap = Math.min(now - pet.seen_at, PET_MAX_GAP_MS);
  return { ...agePet(pet, gap), seen_at: now };
}

/* --------------------------------------------------------------- care --- */

function fillMeter(value: number, add: number): number {
  return Math.min(PET_METER_MAX, value + add);
}

/** Add hunger hearts (an empty meter's mistake timer clears). */
export function feedPet(pet: PetState, hearts: number): PetState {
  if (pet.stage === 'egg' || hearts <= 0) return pet;
  // Keep a post-mistake gap (negative timer): feeding must never make the
  // next mistake come sooner than doing nothing would.
  return {
    ...pet,
    hunger: fillMeter(pet.hunger, hearts),
    hunger_empty_ms: Math.min(0, pet.hunger_empty_ms),
  };
}

/** A training round: +1 training, mood hearts. */
export function trainPet(pet: PetState): PetState {
  if (pet.stage === 'egg') return pet;
  return {
    ...pet,
    training: pet.training + 1,
    mood: fillMeter(pet.mood, PET_TRAIN_MOOD),
    mood_empty_ms: Math.min(0, pet.mood_empty_ms),
  };
}

/** Dive care (v21): surfacing a haul lifts mood +2 (never training — that
 * stays with Tap to train); a surface from `PET_DEEP_MIN_DEPTH`+ Deepers counts
 * toward Deep. Never touches the stage clock. */
export function petDiveSurfaced(pet: PetState, deepers: number): PetState {
  if (pet.stage === 'egg') return pet;
  return {
    ...pet,
    mood: fillMeter(pet.mood, PET_DIVE_SURFACE_MOOD),
    mood_empty_ms: Math.min(0, pet.mood_empty_ms),
    deep_surfaces: pet.deep_surfaces + (deepers >= PET_DEEP_MIN_DEPTH ? 1 : 0),
  };
}

/** Dive care (v21): a bust still cheers it a little (+1 mood). */
export function petDiveBusted(pet: PetState): PetState {
  if (pet.stage === 'egg') return pet;
  return {
    ...pet,
    mood: fillMeter(pet.mood, PET_DIVE_BUST_MOOD),
    mood_empty_ms: Math.min(0, pet.mood_empty_ms),
  };
}

/** A TD wave cleared with the pet: it eats (+1 hunger), counts the wave, and
 * tallies the Legend element toward the God aura. */
export function petWaveCleared(pet: PetState, legendElement: Element | null): PetState {
  if (pet.stage === 'egg') return pet;
  const uses = { ...pet.element_uses };
  if (legendElement) uses[legendElement] = (uses[legendElement] ?? 0) + 1;
  return { ...feedPet(pet, PET_FEED_WAVE), waves: pet.waves + 1, element_uses: uses };
}

/** Pick what hatches — only while it is still an egg. */
export function choosePetLine(pet: PetState, lineId: string): PetState | null {
  if (pet.stage !== 'egg') return null;
  if (!petLines().some((line) => line.id === lineId)) return null;
  return { ...pet, line: lineId };
}

/* -------------------------------------------------------------- links --- */

/** The element TD was played with most (ties: element order), or null. */
export function petAuraElement(pet: PetState): Element | null {
  let best: Element | null = null;
  let bestN = 0;
  for (const el of ELEMENTS) {
    const n = pet.element_uses[el] ?? 0;
    if (n > bestN) {
      best = el;
      bestN = n;
    }
  }
  return best;
}

/* Every perk below is off while the pet is away on an expedition (v21):
 * it is not with you, so no pounce, no bust cut, no rescue until collected. */

/** Pounce damage at wave 1 (the engine scales it with creep HP), or 0. */
export function petPounceBase(pet: PetState, away = false): number {
  if (away) return 0;
  return PET_POUNCE_BASE[pet.stage] * PET_BRANCH_POUNCE[pet.branch];
}

/** Whole bust points off. Deep adds one (the half-table floor is applied in
 * `effectiveBustPct`, so this can never zero the odds). */
export function petBustCutPp(pet: PetState, away = false): number {
  if (away) return 0;
  return PET_BUST_CUT_PP[pet.stage] + (pet.branch === 'deep' ? PET_DEEP_BUST_CUT_PP : 0);
}

/** Best finds saved on a bust. Deep adds one at Adult/God, capped at 2. */
export function petRescueKeep(pet: PetState, away = false): number {
  if (away) return 0;
  const base = PET_RESCUE_KEEP[pet.stage];
  const deep = pet.branch === 'deep' && base > 0 ? 1 : 0;
  return Math.min(PET_RESCUE_MAX, base + deep);
}

/** The stage after this one (God stays God). */
export function petNextStage(stage: PetStage): PetStage {
  return nextStage(stage);
}

export function rebirthBonus(rebirths: number): number {
  return Math.min(PET_REBIRTH_CAP, Math.max(0, rebirths) * PET_REBIRTH_STEP);
}

/** The stored day counts as "today" when it IS today or up to 2 days ahead
 * (clock set back a little: the cap never resets early). Further ahead means
 * the clock was once set far forward — start fresh rather than lock the cap
 * until that date. */
export function petDayHolds(today: string, storedYmd: string | null): storedYmd is string {
  if (storedYmd == null || storedYmd < today) return false;
  const ahead = (Date.parse(`${storedYmd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / (24 * HOUR);
  return Number.isFinite(ahead) && ahead <= 2;
}

/** Token trickle: how many a finished round pays right now, given what was
 * already paid today (see `petDayHolds` for which day counts). */
export function petTokensForRound(
  today: string,
  storedYmd: string | null,
  paidToday: number,
): { tokens: number; ymd: string; paid: number } {
  const sameOrBack = petDayHolds(today, storedYmd);
  const ymd = sameOrBack ? (storedYmd as string) : today;
  const paid = sameOrBack ? paidToday : 0;
  const tokens = Math.max(0, Math.min(PET_TOKENS_PER_ROUND, PET_TOKENS_DAILY_CAP - paid));
  return { tokens, ymd, paid: paid + tokens };
}

/** Tokens still available today from mini-games. */
export function petTokensLeft(today: string, storedYmd: string | null, paidToday: number): number {
  const sameOrBack = petDayHolds(today, storedYmd);
  return Math.max(0, PET_TOKENS_DAILY_CAP - (sameOrBack ? paidToday : 0));
}

/** Retire a God pet to the Hall and start a new egg. Null unless God. */
export function rebirthPet(
  pet: PetState,
  hall: readonly PetHallEntry[],
  rebirths: number,
  now: number,
): { pet: PetState; hall: PetHallEntry[]; rebirths: number } | null {
  if (pet.stage !== 'god') return null;
  const entry: PetHallEntry = {
    line: pet.line,
    branch: pet.branch,
    aura: petAuraElement(pet),
    rebirth: rebirths + 1,
    days: Math.round((pet.total_age_ms / (24 * HOUR)) * 10) / 10,
  };
  return {
    pet: newPet(Math.max(now, pet.seen_at), pet.line),
    hall: [...hall, entry].slice(-PET_HALL_MAX),
    rebirths: rebirths + 1,
  };
}

/** Time left in the current stage (null at God). */
export function petStageLeftMs(pet: PetState): number | null {
  return pet.stage === 'god' ? null : Math.max(0, PET_STAGE_MS[pet.stage] - pet.stage_age_ms);
}

/** When the hunger meter will be empty, counted from `now` (null for an egg
 * or already empty). Used by the opt-in reminder. */
export function petHungerEmptyAt(pet: PetState, now: number): number | null {
  if (pet.stage === 'egg' || pet.hunger <= 0) return null;
  return now + (pet.hunger - 1) * PET_HUNGER_TICK_MS + (PET_HUNGER_TICK_MS - pet.hunger_acc_ms);
}

/** Reminder spacing: never within 20h of the last one (at most one a day). */
export const PET_REMIND_MIN_GAP_MS = 20 * HOUR;

/** When the opt-in hunger reminder should fire: when hunger runs out (or in
 * an hour if it already has), never within 20h of the last one that FIRED,
 * never in the past. Null = nothing to remind about (an egg). */
export function petReminderTarget(
  pet: PetState,
  now: number,
  lastFiredAt: number | null,
): number | null {
  if (pet.stage === 'egg') return null;
  const emptyAt = petHungerEmptyAt(pet, now) ?? now + HOUR;
  const earliest = lastFiredAt != null ? lastFiredAt + PET_REMIND_MIN_GAP_MS : now;
  return Math.max(emptyAt, earliest, now + 60_000);
}

/** What the reminder remembers: the last one that fired, and the one pending.
 * Kept apart so re-scheduling the pending one can never forget a fired one
 * (review, 2026-09-29: a single timestamp let two fire within a day). */
export type PetReminderLog = { lastFiredAt: number | null; scheduledAt: number | null };

/** The last fired reminder as of `now`: a pending one whose time has passed
 * has fired (or would have). */
export function petReminderLastFired(log: PetReminderLog, now: number): number | null {
  const fired = log.scheduledAt != null && log.scheduledAt <= now ? log.scheduledAt : null;
  if (fired == null) return log.lastFiredAt;
  return log.lastFiredAt == null ? fired : Math.max(log.lastFiredAt, fired);
}

/* ------------------------------------------- expedition + logbook --- */

/** A solo expedition in progress (v21). "Away at least 1h" is measured in the
 * pet's own counted time (`total_age_ms`), so the clock guard covers it too:
 * setting the phone forward can't bring it back early by more than a normal
 * 48h gap, and setting it back never does. */
export type PetExpedition = {
  /** The pet's `total_age_ms` when it left. */
  left_age_ms: number;
};

export type PetExpeditionBlock = 'egg_or_baby' | 'away' | 'done_today';

/** Why the pet can't leave right now, or null when it can. Once per
 * device-local day (same day rule as the token cap), Child and up. */
export function expeditionBlock(
  pet: PetState,
  expedition: PetExpedition | null,
  today: string,
  lastYmd: string | null,
): PetExpeditionBlock | null {
  if (PET_STAGES.indexOf(pet.stage) < PET_STAGES.indexOf(PET_EXPEDITION_MIN_STAGE)) return 'egg_or_baby';
  if (expedition) return 'away';
  if (petDayHolds(today, lastYmd)) return 'done_today';
  return null;
}

/** Counted time still needed before it can come back (0 = ready). */
export function expeditionLeftMs(pet: PetState, expedition: PetExpedition): number {
  // A rebirth resets total_age_ms — callers refuse a rebirth while away, but
  // a smaller age than at departure still reads as "ready", never stuck.
  const away = pet.total_age_ms - expedition.left_age_ms;
  if (away < 0) return 0;
  return Math.max(0, PET_EXPEDITION_MIN_MS - away);
}

/** The Logbook (v21): every item the pet's dives or expeditions found, with
 * the depth of the FIRST find (0 = the first card / an expedition, 1-4 = the
 * Deeper that found it) and how many times it has been found. */
export type PetLogEntry = { depth: number; count: number };
export type PetLogbook = Record<string, PetLogEntry>;

export function logPetFind(book: PetLogbook, id: string, depth: number): PetLogbook {
  const prev = book[id];
  return {
    ...book,
    [id]: prev ? { depth: prev.depth, count: prev.count + 1 } : { depth: Math.max(0, Math.floor(depth)), count: 1 },
  };
}

export function parsePetExpedition(raw: unknown): PetExpedition | null {
  if (!isRecord(raw)) return null;
  const left = num(raw.left_age_ms, Number.NaN);
  return Number.isFinite(left) && left >= 0 ? { left_age_ms: left } : null;
}

export function parsePetLogbook(raw: unknown): PetLogbook {
  const out: PetLogbook = {};
  if (!isRecord(raw)) return out;
  for (const [id, row] of Object.entries(raw)) {
    if (!isRecord(row)) continue;
    const count = Math.max(0, Math.floor(num(row.count, 0)));
    if (count < 1) continue;
    out[id] = { depth: Math.max(0, Math.floor(num(row.depth, 0))), count };
  }
  return out;
}

/* -------------------------------------------------------------- parse --- */

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function isStage(v: unknown): v is PetStage {
  return typeof v === 'string' && (PET_STAGES as readonly string[]).includes(v);
}

function isBranch(v: unknown): v is PetBranch {
  return typeof v === 'string' && (PET_BRANCHES as readonly string[]).includes(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v != null && !Array.isArray(v);
}

/** Loose read of a stored pet; anything unreadable becomes a fresh egg. */
export function parsePet(raw: unknown, now: number): PetState {
  if (!isRecord(raw) || !isStage(raw.stage)) return newPet(now);
  const lineId = typeof raw.line === 'string' && petLines().some((l) => l.id === raw.line)
    ? raw.line
    : DEFAULT_PET_LINE;
  const meter = (v: unknown) => Math.max(0, Math.min(PET_METER_MAX, Math.floor(num(v, PET_METER_MAX))));
  const count = (v: unknown) => Math.max(0, Math.floor(num(v, 0)));
  const uses: Partial<Record<Element, number>> = {};
  if (isRecord(raw.element_uses)) {
    for (const el of ELEMENTS) {
      const n = count(raw.element_uses[el]);
      if (n > 0) uses[el] = n;
    }
  }
  const stage = raw.stage;
  const stageCap = stage === 'god' ? Number.MAX_SAFE_INTEGER : PET_STAGE_MS[stage];
  return {
    line: lineId,
    stage,
    branch: isBranch(raw.branch) ? raw.branch : 'standard',
    stage_age_ms: Math.max(0, Math.min(stageCap, num(raw.stage_age_ms, 0))),
    total_age_ms: Math.max(0, num(raw.total_age_ms, 0)),
    hunger: meter(raw.hunger),
    mood: meter(raw.mood),
    hunger_acc_ms: Math.max(0, Math.min(PET_HUNGER_TICK_MS, num(raw.hunger_acc_ms, 0))),
    mood_acc_ms: Math.max(0, Math.min(PET_MOOD_TICK_MS, num(raw.mood_acc_ms, 0))),
    hunger_empty_ms: Math.max(-PET_MISTAKE_GAP_MS, Math.min(PET_GRACE_MS, num(raw.hunger_empty_ms, 0))),
    mood_empty_ms: Math.max(-PET_MISTAKE_GAP_MS, Math.min(PET_GRACE_MS, num(raw.mood_empty_ms, 0))),
    mistakes: count(raw.mistakes),
    training: count(raw.training),
    waves: count(raw.waves),
    deep_surfaces: count(raw.deep_surfaces),
    element_uses: uses,
    seen_at: num(raw.seen_at, now),
  };
}

export function parsePetHall(raw: unknown): PetHallEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: PetHallEntry[] = [];
  for (const row of raw) {
    if (!isRecord(row) || typeof row.line !== 'string') continue;
    out.push({
      line: row.line,
      branch: isBranch(row.branch) ? row.branch : 'standard',
      aura: typeof row.aura === 'string' && (ELEMENTS as readonly string[]).includes(row.aura)
        ? (row.aura as Element)
        : null,
      rebirth: Math.max(1, Math.floor(num(row.rebirth, 1))),
      days: Math.max(0, num(row.days, 0)),
    });
  }
  return out.slice(-PET_HALL_MAX);
}
