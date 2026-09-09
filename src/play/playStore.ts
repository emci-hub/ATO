/**
 * Grove local economy store (Play step 2 — GAME_SPEC §5, §8, §16b; GAME_DATA
 * research/timers + currencies).
 *
 * What lives here, and the exact knobs:
 * - `tokens` — soft meta wallet. Grows from Claim (tend + daily tend bonus);
 *   future steps add Dive bank / wave clear spends.
 * - `dive_charge` — energy, 0–10, +1 every ~10 min while below cap (timer
 *   pauses at cap), and a 35% chance of +1 once per Research Claim.
 * - Research — 30 min cycles that accrue continuously into a pending bag,
 *   offline included, capped at 10h (20 cycles). One Claim dumps the whole bag,
 *   then accrual resets and the timer restarts.
 * - Inventory — owned items stack by id AND star (`{ id, count, star }`, v6).
 *   Every find (Research bag dump, Dive bank, dev grants) merges into the
 *   stacks at star 0. The bag holds what is NOT worn: equipping takes one copy
 *   out of its (id, star) stack into the slot, unequipping puts it back, so a
 *   stack is never cleared and an unequip never dupes. Dress (step 4) consumes
 *   it: 4 slots, one item per slot, mult buckets summed per stat (same-stat
 *   add, §9c soft-caps), scaled lightly by the worn copy's star. The §9 soft
 *   cap (80) counts TOTAL items — the sum of stack counts + worn — not the
 *   number of distinct rows.
 * - Risky Merge — same id + same star can merge (★0→1 70%, 1→2 55%, 2→3 40%,
 *   3→4 28%, 4→5 18%, cap ★5). A worn main or a bagged copy is the "main";
 *   one bagged spare of the same id + star is consumed as fuel. Success raises
 *   the main one star (mults scale +10% per star); a fail loses the fuel only —
 *   the main is never destroyed. Same Dive feel: honest % shown, ~1s beat.
 * - Dive — push-your-luck (GAME_SPEC §7, step 3): spend 1 charge → find card →
 *   Surface banks the whole haul into `inventory`, or Deeper rolls the bust
 *   table (18/28/40/55%, max 4 Deepers). The in-progress haul lives in
 *   `dive_run` so killing the app mid-run keeps the same decision on relaunch.
 *   Equipped `dive_luck` bends the bust % (§7: bust × (1 − 0.15·(luck_bucket−1)),
 *   floored at half the table value) — never hidden, always shown as-is.
 * - Defend campaign (step 5a+ / Phase B) — the `campaign` seat
 *   (`{ phase: 'trial' | 'main', wave_in_phase }`) is what Defend plays next:
 *   Trial waves 1–5 on the Grove Path map, then Main waves 1–20 on the
 *   Divecore Main map. Clearing Main wave 20 → `conquered_cycles += 1`,
 *   `cycle_power` recomputed via `CycleScaler`, and the seat resets to Main
 *   wave 1 (Trial is skipped once `conquered_cycles ≥ 1`). Cleared bands can
 *   be replayed at half tokens. `recordDefendWin` banks tokens + XP + level
 *   and advances the seat. Legacy `highest_wave_cleared` (start 0) is kept for
 *   old saves but no longer drives the next wave. The live board (spawns,
 *   pauses, leak) is a transient screen sim in `defend.ts`, not persisted —
 *   only these numbers are.
 * - Daily tend bonus — +10 tokens once per device-local day on the first Claim
 *   (later also Dress/Decor), tracked by `last_tend_bonus_ymd`.
 *
 * Everything is a pure function of the persisted doc + `now`, so timers survive
 * app kills (AsyncStorage) and the module stays testable. AsyncStorage only —
 * no Supabase `play_*` tables until the optional sync step (see
 * PLAY_DEEPSEEK_HANDOFF.md).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { cyclePower, defaultCyclePower } from '@/play/engine/cycle';
import { bossBandFor } from '@/play/engine/bands';
import {
  BOUND_BOSS_MAX_STAR,
  boundBossFragmentCost,
  defaultBoundBossId,
  getBoundBossDef,
  type BoundBossDef,
} from '@/play/engine/bound-boss';
import { isUniqueDrop, rollDropById } from '@/play/engine/drop-table';
import { gearScore, recommendedGs } from '@/play/engine/gear-score';
import { isTypeTag, type TypeTag } from '@/play/engine/type-match';
import { getTune } from '@/play/tune';
import {
  getItemDef,
  junkLookId,
  rollDiveFind,
  rollMilestoneLook,
  rollPowerFind,
  rollResearchFind,
  type ItemSlot,
  type ItemStat,
} from '@/play/items';

export const PLAY_STORE_KEY = 'ato.play.store.v1';

/** Dive charge energy (GAME_DATA currencies.dive_charge). */
export const DIVE_CHARGE_CAP = 10;
export const DIVE_CHARGE_REFILL_MS = 10 * 60 * 1000; // refill_seconds: 600

/** Dive push-your-luck odds (GAME_SPEC §7 / GAME_DATA dive odds). */
export const DIVE_DEEPER_MAX = 4; // dive_deeper_max
export const DIVE_BUST_TABLE = [0.18, 0.28, 0.4, 0.55] as const; // Deeper #1..#4

/** Research idle earn (GAME_DATA research_default). */
export const RESEARCH_CYCLE_MS = 30 * 60 * 1000; // duration_seconds: 1800
export const RESEARCH_CAP_MS = 10 * 60 * 60 * 1000; // offline_cap_seconds: 36000
export const RESEARCH_MAX_CYCLES = RESEARCH_CAP_MS / RESEARCH_CYCLE_MS; // 20
export const RESEARCH_DIVE_CHARGE_CHANCE = 0.35; // per Claim, not per cycle

/** Tend / daily tend bonus (GAME_SPEC §5). */
export const TEND_MIN_TOKENS = 15;
export const TEND_MAX_TOKENS = 40;
export const DAILY_TEND_BONUS_TOKENS = 10;

/** Inventory + Dress (GAME_SPEC §9 inventory, §9c; GAME_DATA sell knob). */
export const INVENTORY_SOFT_CAP = 80; // soft cap: total items across stacks (sum of counts)
export const LOOK_SELL_TOKENS = 3; // GAME_DATA look_sell_tokens

/**
 * §9c Tune-able economy/reward numbers — the exports below are the SANE
 * reference values; every live read goes through `getTune()` so presets take
 * effect without recompiling. `recordDefendWin` / the daily half-cap read the
 * tune doc; the Defend run's starting scrap is the tune's `startScrap`.
 */
export const DEFEND_START_SCRAP = 80; // Sane start_scrap
export const TOKEN_CLEAR_BASE = 50; // Sane token_clear_base
export const DAILY_CLEAR_HALF_AFTER = 5; // Sane daily_clear_half_after
/** First-clear milestone waves: each grants one Rare Look once. §18 lock:
 * milestones fire off `lifetime_waves_cleared` (never resets on a Conquered),
 * so the 25 milestone stays reachable after Main ends at 20. */
export const MILESTONE_WAVES = [5, 10, 25] as const;
/** Campaign (Phase B — GAME_SPEC §9e). The seat names the phase + next
 * display wave Defend plays. Trial = Grove Path map, waves 1–5 (teach);
 * Main = Divecore Main map, waves 1–20 (real climb). Clearing Main wave 20
 * conquers the cycle. */
export const TRIAL_WAVE_COUNT = 5; // Trial waves 1..5 (Grove Path map)
export const MAIN_WAVE_COUNT = 20; // Main waves 1..20 (Divecore Main map)
/** Cycle-clear bonus (GAME_SPEC §9e "tokens/XP milestone bonus"). Sane flat
 * amounts so it reads as a milestone — tuned later. */
export const CYCLE_CLEAR_BONUS_TOKENS = 150;
export const CYCLE_CLEAR_BONUS_XP = 50;
/** Avatar star cap (§9h) — same soft ★5 feel as gear, max 5 stars. */
export const AVATAR_STAR_MAX = 5;
/** Default cycle boss tint (§18 C: one boss family until ContentPack 2). */
export const DEFAULT_CYCLE_TINT: TypeTag = 'ember';
/** Dev kit (skip smoke): the four regular Powers worn at ★5 when overgearing.
 * One per slot — weapon/armor/trinket/cloak — no uniques, no boss gear. */
const OVERGEAR_POWER_IDS = [
  'item_tide_blade_01',
  'item_bark_aegis_01',
  'item_copper_keeper_01',
  'item_curator_cloak_01',
] as const;
/** Dev kit (skip smoke): the Avatar level `devOvergear` jumps to, so GS reads
 * far above every normal wave's recommendation (§18 level term +2%). */
const DEV_OVERGEAR_LEVEL = 200;
/** Clear wave W → this much XP to the Avatar (GAME_SPEC "xp_clear: 10 + wave*2"). */
export function xpForClear(wave: number): number {
  return 10 + Math.max(1, Math.floor(wave)) * 2;
}
/** XP needed to go from `level` → `level + 1` (GAME_SPEC "50 + level*25"). */
export function xpToNext(level: number): number {
  return 50 + level * 25;
}
/** Avatar level → small base wave_power bonus (+2% per level, GAME_SPEC §9). */
export function avatarLevelWavePower(level: number): number {
  return 1 + 0.02 * (level - 1);
}

/** Avatar stars → base wave_power bonus (+3% per star, §9h, Tune-able). */
export function avatarStarWavePower(stars: number): number {
  return 1 + getTune().avatarStarWavePowerStep * Math.max(0, Math.min(AVATAR_STAR_MAX, stars));
}

/** Risky merge (Dive-style, this step). */
export const MERGE_MAX_STAR = 5;
/** Success % per current star: ★0→1 70%, 1→2 55%, 2→3 40%, 3→4 28%, 4→5 18%. */
export const MERGE_SUCCESS_TABLE = [0.7, 0.55, 0.4, 0.28, 0.18] as const;
/** Each star scales the item's mults +10% (light per-star bump). */
export const MERGE_STAR_MULT_STEP = 0.1;

/** One bag row: a stack of identical copies (same id AND star). */
export type ItemStack = { id: string; count: number; star: number };

/** A worn (equipped) item: id + the star tier of that copy. */
export type ItemRef = { id: string; star: number };

/** Sum of counts across the bag stacks (= bagged items only). */
export function bagItemCount(inventory: readonly ItemStack[]): number {
  return inventory.reduce((sum, stack) => sum + stack.count, 0);
}

/** How many slots are currently worn. */
export function wornItemCount(
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>,
): number {
  return Object.values(equipped).filter((ref): ref is ItemRef => ref != null).length;
}

/** Total owned items — worn + bagged. The soft cap counts THIS, not rows. */
export function totalOwnedCount(
  inventory: readonly ItemStack[],
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>,
): number {
  return bagItemCount(inventory) + wornItemCount(equipped);
}

/** Same id AND same star — the only copies that can stack or merge. */
function sameTier(stack: { id: string; star: number }, id: string, star: number): boolean {
  return stack.id === id && stack.star === star;
}

/** Add `n` copies of (id, star) into the bag, merging into the matching stack. */
function addCopiesToBag(
  inventory: readonly ItemStack[],
  id: string,
  star: number,
  n: number,
): ItemStack[] {
  const existing = inventory.find((stack) => sameTier(stack, id, star));
  if (existing) {
    return inventory.map((stack) =>
      sameTier(stack, id, star) ? { id, star, count: stack.count + n } : stack,
    );
  }
  return [...inventory, { id, star, count: n }];
}

/** Merge a run of granted ids (all star 0) into the bag as stacks. */
function addManyToBag(
  inventory: readonly ItemStack[],
  ids: readonly string[],
): ItemStack[] {
  let next: ItemStack[] = [...inventory];
  for (const id of ids) next = addCopiesToBag(next, id, 0, 1);
  return next;
}

/** Take one copy out of the matching (id, star) stack; it disappears at zero. */
function takeOneFromBag(
  inventory: readonly ItemStack[],
  id: string,
  star: number,
): ItemStack[] {
  return inventory
    .map((stack) =>
      sameTier(stack, id, star) ? { ...stack, count: stack.count - 1 } : stack,
    )
    .filter((stack) => stack.count > 0);
}

/** §7 luck tiers: each whole +5% equipped dive_luck is one bucket. */
const LUCK_BUCKET_STEP = 0.05;
const LUCK_BUCKET_MAX = 5;
/** §7 bust bend per luck tier and floor ("floored at 50% of table bust"). */
const LUCK_BUST_BEND_PER_TIER = 0.15;

/**
 * Gear soft-caps + diminishing are §9c Tune knobs now — the docs below are the
 * Sane reference; the engines read them from the tune doc via `getTune()`.
 * gear_softcap_wave_power (Sane 2.0), gear_softcap_other (Sane 1.5),
 * diminishing_after_cap (Sane 0.25).
 */

/**
 * An in-progress Dive run. Persisted so an app kill mid-run keeps the same
 * haul + the same Surface/Deeper decision on relaunch (the charge is already
 * spent either way).
 */
export type DiveRun = {
  /** Deeper presses survived so far (0 on the first find card, max 4). */
  deepers: number;
  /** Item ids found this run. Surface banks all of them; a bust loses them. */
  haul: string[];
};

/**
 * Persisted shape. Versioned under one key; add fields behind a version bump.
 * v2 added `inventory` (step 2b); v3 added `dive_run` (step 3); v4 added
 * `equipped` (step 4); v5 re-shaped `inventory` from a string[] of owned ids
 * (worn included) into `ItemStack[]` of bagged copies (worn excluded); v6
 * (this step) added a `star` tier to every stack copy and changed `equipped`
 * from slot → id into slot → `{ id, star }` so a worn merge result survives.
 * v1–v5 docs migrate (legacy copies are star 0). v7 (Defend 5a) added the
 * `highest_wave_cleared` meta. v8 (Defend 5c) added `xp` + `avatar_level`
 * (clears grant XP; a level gives +2% base wave_power). v9 (Defend daily soft
 * cap) added `clears_today` + `clears_ymd` — after 5 clears in a local day the
 * token reward halves until the next local midnight (XP/highest stay full).
 * v10 (milestones) added `milestone_waves_claimed` — the first clear of waves
 * 5/10/25 grants one guaranteed Rare Look, once each.
 * v11 (forever-engine stubs) added the campaign seat + forever meta — the
 * `campaign` seat (phase / wave_in_phase), `conquered_cycles` with its derived
 * `cycle_power`, `lifetime_waves_cleared`, and an empty `bound_bosses[]`.
 * v12 (campaign Phase B) makes the seat live: `campaign.phase` is
 * `'trial' | 'main'`, Defend plays the seat's wave, Main wave 20 conquers a
 * cycle, `cycle_power` scales the next run's enemies, cleared bands replay at
 * half tokens, and milestones fire off the lifetime clear count. Legacy saves
 * (numeric phase 1/2) migrate onto the string phases.
 * v13 (Phase C — bosses + type match + Avatar star) adds `avatar_stars`,
 * `avatar_star_tokens`, `avatar_star_rolled_cycle`, `final_clears_this_cycle`,
 * `uniques[]`, and `cycle_tint`. Older saves default these to fresh values.
 * v14 (Phase E — Bound Boss) makes `bound_bosses[]` live: each record carries
 * `stars` (0 = fragments only, 1–5 = bound) + `frags` (toward the next star).
 * Older empty/legacy records default to stars 0 / frags 0, so no migration is
 * needed beyond the version bump.
 */

/** Campaign phase. `trial` (Grove Path, waves 1–5) then `main` (Divecore
 * Main, waves 1–20); a cleared Main 20 conquers a cycle and the seat resets
 * (Trial is skipped once `conquered_cycles ≥ 1`). */
export type CampaignPhase = 'trial' | 'main';

/** Forever-engine campaign seat — the phase + next display wave Defend plays
 * (`wave_in_phase` is 1-based and ALWAYS the next wave to clear). */
export type CampaignState = {
  /** Phase the player is parked in. */
  phase: CampaignPhase;
  /** 1-based next wave inside that phase. */
  wave_in_phase: number;
};

/** One Bound Boss record (GAME_SPEC §9k). `stars` 0 = fragments collected but
 * the boss is not a tower yet; 1–5 = bound at that star. `frags` counts
 * fragments toward the NEXT star (or toward the ★1 unlock when stars === 0). */
export type BoundBossRecord = {
  /** Stable boss id (matches a row in bound_bosses.json). */
  id: string;
  /** Unlocked stars (0 = not yet bound, 1–5 = bound). */
  stars: number;
  /** Fragments toward the next star (or toward unlock when stars === 0). */
  frags: number;
  /** Wave the boss was first bound at; null until it has been bound. */
  bound_wave: number | null;
};

/** Read-model of a Bound Boss for the Defend setup / drop preview. */
export type BoundBossView = {
  id: string;
  name: string;
  /** Unlocked stars (0 = fragments only, 1–5 = bound). */
  stars: number;
  /** Fragments toward the next star (or unlock). */
  frags: number;
  /** True when placeable on a pad (stars ≥ 1). */
  unlocked: boolean;
  /** Fragments needed for the next star/unlock; null at the ★5 cap. */
  nextCost: number | null;
};

/** Add `count` boss fragments to a record, auto-starring up through the §9k
 * fragment ladder (unlock ★1 at 3, then +2/+3/+4/+5 per star, cap ★5).
 * Returns the new record + whether a star was gained. */
function addBossFragments(
  record: BoundBossRecord,
  def: BoundBossDef,
  count: number,
  wave: number | null,
): { record: BoundBossRecord; gainedStar: boolean } {
  let stars = Math.max(0, Math.min(BOUND_BOSS_MAX_STAR, Math.floor(record.stars)));
  let frags = Math.max(0, Math.floor(record.frags)) + Math.max(0, count);
  let gainedStar = false;
  while (stars < BOUND_BOSS_MAX_STAR) {
    const cost = boundBossFragmentCost(def, stars);
    if (cost == null || frags < cost) break;
    frags -= cost;
    stars += 1;
    gainedStar = true;
  }
  return {
    record: {
      id: record.id,
      stars,
      frags,
      bound_wave: record.bound_wave ?? (stars > 0 ? wave : null),
    },
    gainedStar,
  };
}

export type PlayStoreDoc = {
  version: 14;
  tokens: number;
  /** Whole charges as of `dive_charge_at` (0–10). Timer pauses at cap. */
  dive_charge: number;
  /** Epoch ms anchoring the refill timer (backdated to the last full charge). */
  dive_charge_at: number;
  /** Epoch ms the current accrual run started (last Claim / install). */
  research_started_at: number;
  /** Accrued research ms banked at `research_started_at` (clamped to cap). */
  research_accrued_ms: number;
  /** Device-local YYYY-MM-DD the daily tend bonus was last granted. */
  last_tend_bonus_ymd: string | null;
  /** Bagged copies stacked by (id, star). Worn copies are NOT in here. */
  inventory: ItemStack[];
  /** Worn item refs by slot (one per slot); the worn copy lives outside the bag. */
  equipped: Partial<Record<ItemSlot, ItemRef>>;
  /** Active Dive run (null when no charge has been spent / run is over). */
  dive_run: DiveRun | null;
  /** Defend meta — highest wave cleared (start 0). Next wave = this + 1. */
  highest_wave_cleared: number;
  /** Avatar meta XP (toward the next level), from Defend clears only. */
  xp: number;
  /** Avatar meta level (start 1). +2% base wave_power per level. */
  avatar_level: number;
  /** Defend clears this device-local day (drives the §9 half-cap). */
  clears_today: number;
  /** Device-local YYYY-MM-DD `clears_today` belongs to. */
  clears_ymd: string | null;
  /** Milestone waves whose Rare-Look reward has already fired (5/10/25). */
  milestone_waves_claimed: number[];
  /** Forever-engine (v11+): campaign seat + cycle / boss meta. */
  campaign: CampaignState;
  /** Whole cycles conquered (drives cycle_power). Starts 0. */
  conquered_cycles: number;
  /** cycle_power = 1 + conquered_cycles × tune step (Sane 0.12). Derived
   * value stored so old saves default without a crash. */
  cycle_power: number;
  /** Total waves cleared over all time (+1 per Defend win). Starts 0. */
  lifetime_waves_cleared: number;
  /** Bound Bosses bound so far (empty until the boss system lands). */
  bound_bosses: BoundBossRecord[];
  /** Avatar stars earned (0..5) — +3% base wave_power each (§9h). */
  avatar_stars: number;
  /** Unspent Avatar star tokens (spend → +1 star). */
  avatar_star_tokens: number;
  /** The cycle's star has already rolled once this cycle (§9h once/cycle). */
  avatar_star_rolled_cycle: boolean;
  /** Final clears this cycle (pity guarantees the star on the 3rd). */
  final_clears_this_cycle: number;
  /** Unique item ids already granted (drop once, never again — §9i). */
  uniques: string[];
  /** Current cycle's boss tint (one family until ContentPack 2). */
  cycle_tint: TypeTag;
};

export type DiveChargeView = {
  current: number;
  full: boolean;
  /** Epoch ms the next +1 lands; null while full. */
  nextChargeAt: number | null;
};

export type ResearchView = {
  /** Accrued research ms clamped to the 10h cap. */
  accruedMs: number;
  /** Whole 30-min cycles waiting in the bag (= finds to dump on Claim). */
  readyFinds: number;
  atCap: boolean;
  /** Epoch ms the next whole cycle lands; null while at cap. */
  nextFindAt: number | null;
};

export type PlayView = {
  tokens: number;
  dive: DiveChargeView;
  /** In-progress Dive run view (null run → not diving). */
  diveRun: DiveRunView;
  research: ResearchView;
  /** Daily tend bonus still available this device-local day. */
  tendBonusAvailable: boolean;
  /** Bagged copies stacked by (id, star) (worn excluded); Dress renders it. */
  inventory: readonly ItemStack[];
  /** Worn item refs by slot; Dress renders it. */
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>;
  /** Raw additive mult sums from equipped items (§9c same-stat adds, scaled
   * +10% per worn star so a merged ★2 Tide Blade beats a ★1). */
  statSums: StatSums;
  /** Avatar meta level (start 1) — drives the +2% wave_power HUD note. */
  avatarLevel: number;
  /** Defend clears this device-local day (over 5 → tokens halved). */
  clearsToday: number;
  /** Campaign seat — the phase + next display wave Defend plays. */
  campaign: CampaignState;
  /** Whole cycles conquered (drives `cyclePower`). */
  conqueredCycles: number;
  /** Cycle power = 1 + conquered × tune step — scales the next run's enemies. */
  cyclePower: number;
  /** Total waves cleared over all time (never resets on a Conquered). */
  lifetimeWavesCleared: number;
  /** Avatar stars earned (0..5). */
  avatarStars: number;
  /** Unspent Avatar star tokens. */
  avatarStarTokens: number;
  /** This cycle's star already rolled (drives Final 25% + pity). */
  avatarStarRolledCycle: boolean;
  /** Final clears this cycle (pity fires on the 3rd). */
  finalClearsThisCycle: number;
  /** Unique item ids already granted (drop once). */
  uniques: readonly string[];
  /** Current cycle's boss tint. */
  cycleTint: TypeTag;
  /** Bound Bosses (fragments + stars) — the §9k tower roster. */
  boundBosses: readonly BoundBossView[];
};

/** Raw mult sums per stat from the four equipped items (before soft-cap). */
export type StatSums = Record<ItemStat, number>;

/** Read-model of an active Dive run for the screen (no mutable doc shape). */
export type DiveRunView = {
  active: boolean;
  /** Deeper presses survived so far (0 on the first find card). */
  deepers: number;
  /** Finds so far this run — the haul the screen renders as find cards. */
  haul: readonly string[];
  /** Bust % of the next Deeper press, or null when the run is maxed. */
  bustPctNext: number | null;
  /** A Deeper press is still allowed. */
  canDeeper: boolean;
};

export type ClaimResult = {
  /** Whole cycles dumped from the bag (= number of item finds granted). */
  cyclesClaimed: number;
  /** Granted item ids (one roll per claimed cycle), appended to `inventory`. */
  items: string[];
  tendTokens: number;
  dailyBonusTokens: number;
  diveChargeGranted: boolean;
  diveChargeNow: number;
  tokensNow: number;
};

/** Device-local YYYY-MM-DD — "once per device-local-day" is just this string. */
export function localYmd(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultPlayStore(now: number = Date.now()): PlayStoreDoc {
  return {
    version: 14,
    tokens: 0,
    dive_charge: DIVE_CHARGE_CAP, // start full; research claims can top back up
    dive_charge_at: now,
    research_started_at: now,
    research_accrued_ms: 0,
    last_tend_bonus_ymd: null,
    inventory: [],
    equipped: {},
    dive_run: null,
    highest_wave_cleared: 0,
    xp: 0,
    avatar_level: 1,
    clears_today: 0,
    clears_ymd: null,
    milestone_waves_claimed: [],
    campaign: { phase: 'trial', wave_in_phase: 1 },
    conquered_cycles: 0,
    cycle_power: defaultCyclePower(),
    lifetime_waves_cleared: 0,
    bound_bosses: [],
    avatar_stars: 0,
    avatar_star_tokens: 0,
    avatar_star_rolled_cycle: false,
    final_clears_this_cycle: 0,
    uniques: [],
    cycle_tint: DEFAULT_CYCLE_TINT,
  };
}

/** Dive charges as of `now`, refilling +1/10 min only while below cap. */
export function diveChargeAt(doc: PlayStoreDoc, now: number): DiveChargeView {
  if (doc.dive_charge >= DIVE_CHARGE_CAP) {
    return { current: DIVE_CHARGE_CAP, full: true, nextChargeAt: null };
  }
  const elapsed = Math.max(0, now - doc.dive_charge_at);
  const added = Math.min(
    DIVE_CHARGE_CAP - doc.dive_charge,
    Math.floor(elapsed / DIVE_CHARGE_REFILL_MS),
  );
  const current = doc.dive_charge + added;
  if (current >= DIVE_CHARGE_CAP) {
    return { current: DIVE_CHARGE_CAP, full: true, nextChargeAt: null };
  }
  const lastLand = doc.dive_charge_at + added * DIVE_CHARGE_REFILL_MS;
  return { current, full: false, nextChargeAt: lastLand + DIVE_CHARGE_REFILL_MS };
}

/** Research accrual as of `now`: 1:1 real time, clamped at the 10h cap. */
export function researchAt(doc: PlayStoreDoc, now: number): ResearchView {
  const sinceStart = Math.max(0, now - doc.research_started_at);
  const accruedMs = Math.min(RESEARCH_CAP_MS, doc.research_accrued_ms + sinceStart);
  if (accruedMs >= RESEARCH_CAP_MS) {
    return {
      accruedMs,
      readyFinds: RESEARCH_MAX_CYCLES,
      atCap: true,
      nextFindAt: null,
    };
  }
  const readyFinds = Math.floor(accruedMs / RESEARCH_CYCLE_MS);
  // Time the (readyFinds + 1)-th whole cycle lands, from a linear run.
  const nextFindAt =
    doc.research_started_at + (readyFinds + 1) * RESEARCH_CYCLE_MS - doc.research_accrued_ms;
  return { accruedMs, readyFinds, atCap: false, nextFindAt };
}

export function playView(doc: PlayStoreDoc, now: number): PlayView {
  return {
    tokens: doc.tokens,
    dive: diveChargeAt(doc, now),
    diveRun: diveRunViewOf(doc),
    research: researchAt(doc, now),
    tendBonusAvailable: doc.last_tend_bonus_ymd !== localYmd(new Date(now)),
    inventory: doc.inventory,
    equipped: doc.equipped,
    statSums: equippedStatSums(doc.equipped),
    avatarLevel: doc.avatar_level,
    clearsToday: doc.clears_today,
    campaign: doc.campaign,
    conqueredCycles: doc.conquered_cycles,
    cyclePower: doc.cycle_power,
    lifetimeWavesCleared: doc.lifetime_waves_cleared,
    avatarStars: doc.avatar_stars,
    avatarStarTokens: doc.avatar_star_tokens,
    avatarStarRolledCycle: doc.avatar_star_rolled_cycle,
    finalClearsThisCycle: doc.final_clears_this_cycle,
    uniques: doc.uniques,
    cycleTint: doc.cycle_tint,
    boundBosses: doc.bound_bosses.map((record) => {
      const def = getBoundBossDef(record.id);
      return {
        id: record.id,
        name: def?.name ?? record.id,
        stars: record.stars,
        frags: record.frags,
        unlocked: record.stars >= 1,
        nextCost: def ? boundBossFragmentCost(def, record.stars) : null,
      };
    }),
  };
}

function diveRunViewOf(doc: PlayStoreDoc): DiveRunView {
  const run = doc.dive_run;
  if (!run) return { active: false, deepers: 0, haul: [], bustPctNext: null, canDeeper: false };
  const canDeeper = run.deepers < DIVE_DEEPER_MAX;
  return {
    active: true,
    deepers: run.deepers,
    haul: run.haul,
    bustPctNext: canDeeper
      ? effectiveBustPct(diveBustChanceAt(run.deepers), doc.equipped)
      : null,
    canDeeper,
  };
}

export function canClaimResearch(view: PlayView): boolean {
  return view.research.readyFinds >= 1;
}

/* ---------------------------------------------------------------------------
 * Defend meta (GAME_SPEC §9 wave ladder, §9 XP + §9e campaign; GAME_DATA
 * defend run defaults).
 *
 * The persistent numbers live here — campaign seat, conquered cycles with the
 * derived cycle_power, lifetime clear count, XP/level, and the legacy
 * `highest_wave_cleared` mirror. The live board — spawns, puffs walking the
 * path, towers, Avatar, pause, leak → fail — is a transient screen simulation
 * in `defend.ts` that is never persisted.
 * ------------------------------------------------------------------------- */

/** What a Defend win paid out (the overlay shows the honest amount). */
export type DefendWinResult = {
  tokensGranted: number;
  xpGranted: number;
  /** True when this win was past the daily soft cap (tokens halved). */
  halved: boolean;
  /** True when this was a band replay (half tokens + half XP, §9h farm). */
  replayHalf: boolean;
  /** Clears today AFTER this win (unchanged by replays). */
  clearsToday: number;
  /** Milestone Rare Look granted by a lifetime-clear boundary (5/10/25). */
  milestoneLook: { count: number; itemId: string } | null;
  /** True when this Main wave-20 campaign clear conquered the cycle. */
  conquered: boolean;
  /** Conquered cycles AFTER this win. */
  conqueredCycles: number;
  /** Cycle power AFTER this win (`1 + conquered × step`). */
  cyclePower: number;
  /** Campaign seat AFTER this win (what Defend plays next). */
  campaign: CampaignState;
  /** A Final clear dropped an Avatar star token this win (§9h). */
  starTokenGranted: boolean;
  /** Unspent Avatar star tokens AFTER this win. */
  avatarStarTokens: number;
  /** Item ids dropped from this wave's drop table (rolled on the win). */
  dropItems: string[];
  /** Boss fragment dropped this win (§9k — Final/Scout/Semi bands only), or
   * null when no fragment dropped. `starred` = the drop auto-starred-up. */
  bossFragment: {
    id: string;
    name: string;
    stars: number;
    frags: number;
    nextCost: number | null;
    starred: boolean;
  } | null;
};

/**
 * What one Defend fight is: the display wave on its phase/map and whether it
 * is the campaign's next wave (`campaign` — advances the seat) or a cleared
 * band replay (`replay` — half tokens, seat untouched).
 */
export type DefendWinMode = 'campaign' | 'replay';
export type DefendWinContext = {
  phase: CampaignPhase;
  wave: number;
  mode: DefendWinMode;
};

/** The drop table a Defend wave rolls from (boss bands have their own; normal
 * waves share the generic farm table). */
export function dropTableForWave(phase: CampaignPhase, wave: number): string {
  return bossBandFor(phase, wave)?.drops ?? 'drop_defend_farm';
}

/** Type tags of every worn Power (Looks never carry a combat tag). */
export function equippedTypeTags(
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>,
): TypeTag[] {
  const tags: TypeTag[] = [];
  for (const ref of Object.values(equipped)) {
    if (!ref) continue;
    const def = getItemDef(ref.id);
    if (def?.core.kind === 'power') tags.push(def.core.type_tag);
  }
  return tags;
}

/** True when any worn Power's type_tag matches the cycle tint (§9f). */
export function hasTypeMatch(
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>,
  tint: TypeTag,
): boolean {
  return equippedTypeTags(equipped).includes(tint);
}

/**
 * A Defend win → the shared reward + campaign-advance math (GAME_SPEC §9e).
 *
 * `recordDefendWin` is the ONLY write path for a Defend clear. It grants
 * tokens + XP, levels the Avatar, counts the clear toward the lifetime total
 * AND (campaign clears only) the §9 daily soft-cap counter, fires first-clear
 * milestones off `lifetime_waves_cleared` (5/10/25 — never reset by a
 * Conquered), and advances the campaign seat.
 *
 * Daily soft cap (§9): after `DAILY_CLEAR_HALF_AFTER` (5) campaign clears in a
 * device-local day, the TOKEN reward halves until the next local midnight.
 * XP and the seat always stay full. Band replays (`mode: 'replay'`) are the
 * §9h farm path: half tokens AND half XP, and they never consume the daily
 * clear counter, never count toward `lifetime_waves_cleared`, and never fire a
 * milestone — so grinding one cleared band cannot print Rare Looks or level
 * the Avatar without campaign progress. Milestones (5/10/25) land on natural
 * campaign beats (finishing Trial, mid-Main, and the Conquered clear itself).
 *
 * Conquered (Main wave 20 clear, campaign mode): `conquered_cycles += 1`,
 * `cycle_power` recomputed via `CycleScaler`, the seat resets to Main wave 1
 * (skip Trial once `conquered_cycles ≥ 1`), and a cycle-clear token/XP bonus
 * is added to that final wave's payout.
 */
export function recordDefendWin(
  doc: PlayStoreDoc,
  ctx: DefendWinContext,
  now: number = Date.now(),
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; result: DefendWinResult } {
  const tune = getTune();
  const todayYmd = localYmd(new Date(now));
  const { phase, wave, mode } = ctx;
  const isReplay = mode === 'replay';
  const isFinalBand = phase === 'main' && Math.floor(wave) >= MAIN_WAVE_COUNT;

  // Drop roll (§9g/§9i): every Defend win (campaign or replay) rolls this
  // wave's drop table once. Owned uniques are excluded so they never drop
  // twice; a rolled unique is remembered for the rest of the save.
  const dropTableId = dropTableForWave(phase, wave);
  const droppedId = rollDropById(dropTableId, rng, new Set(doc.uniques));
  const dropItems = droppedId ? [droppedId] : [];
  const uniquesAfter =
    droppedId && isUniqueDrop(dropTableId, droppedId)
      ? Array.from(new Set([...doc.uniques, droppedId]))
      : doc.uniques;

  // Avatar star roll (§9h): a Final clear (campaign OR replay) rolls 25%
  // once/cycle, with pity guaranteeing it on the 3rd Final clear of the cycle.
  let avatar_star_tokens = doc.avatar_star_tokens;
  let avatar_star_rolled_cycle = doc.avatar_star_rolled_cycle;
  let final_clears_this_cycle = doc.final_clears_this_cycle;
  let starTokenGranted = false;
  if (isFinalBand && !avatar_star_rolled_cycle) {
    const attempts = final_clears_this_cycle + 1;
    const hit = rng() < tune.avatarStarDropPct || attempts >= tune.avatarStarPityClears;
    if (hit) {
      starTokenGranted = true;
      avatar_star_tokens += 1;
      avatar_star_rolled_cycle = true;
    }
    final_clears_this_cycle = attempts;
  }

  // Boss fragment roll (§9k): Final ~35%, Scout 5%, Semi 10% — a simple roll
  // every clear, no pity. Fragments go to the cycle's one boss family (Ember
  // until pack 2). Skip is a separate path (skipCampaignToEven), so fragments
  // can never come from the skip crate.
  const band = bossBandFor(phase, wave);
  const cycleBossId = defaultBoundBossId();
  let bound_bosses = doc.bound_bosses;
  let bossFragment: DefendWinResult['bossFragment'] = null;
  if (band && cycleBossId) {
    const pct =
      band.kind === 'final'
        ? tune.bossFragFinalPct
        : band.kind === 'semi'
          ? tune.bossFragSemiPct
          : tune.bossFragScoutPct; // scout_mini + scout both use the Scout %
    if (rng() < pct) {
      const def = getBoundBossDef(cycleBossId);
      if (def) {
        const existing =
          bound_bosses.find((b) => b.id === cycleBossId) ??
          { id: cycleBossId, stars: 0, frags: 0, bound_wave: null };
        const next = addBossFragments(existing, def, 1, Math.floor(wave));
        bound_bosses = bound_bosses.some((b) => b.id === cycleBossId)
          ? bound_bosses.map((b) => (b.id === cycleBossId ? next.record : b))
          : [...bound_bosses, next.record];
        bossFragment = {
          id: cycleBossId,
          name: def.name,
          stars: next.record.stars,
          frags: next.record.frags,
          nextCost: boundBossFragmentCost(def, next.record.stars),
          starred: next.gainedStar,
        };
      }
    }
  }

  // Rewards. Replays are the §9h farm path: half tokens + half XP, and they
  // never count as a lifetime/campaign clear. Campaign wins honour the §9
  // daily soft cap on tokens and always add a lifetime clear.
  let tokensGranted = tune.tokenClearBase;
  let halved = false;
  let replayHalf = false;
  let clearsToday = doc.clears_today;
  let clearsYmd = doc.clears_ymd;
  let xpGranted = xpForClear(wave);
  let lifetimeAfter = doc.lifetime_waves_cleared;
  let milestone: { wave: number; itemId: string } | null = null;
  if (isReplay) {
    replayHalf = true;
    tokensGranted = Math.floor(tokensGranted / 2);
    xpGranted = Math.floor(xpGranted / 2);
  } else {
    const priorClears = doc.clears_ymd === todayYmd ? doc.clears_today : 0;
    halved = priorClears >= tune.dailyClearHalfAfter;
    if (halved) tokensGranted = Math.floor(tokensGranted / 2);
    clearsToday = priorClears + 1;
    clearsYmd = todayYmd;
    // Lifetime clear count (never resets on a Conquered) + milestones.
    lifetimeAfter = doc.lifetime_waves_cleared + 1;
    milestone = (MILESTONE_WAVES as readonly number[]).includes(lifetimeAfter)
      ? claimMilestoneLook(doc, lifetimeAfter, rng)
      : null;
  }

  // Campaign seat advance + Conquered. A campaign-mode win only advances when
  // it matches the seat — a stale/duplicate win after the seat already moved
  // (e.g. Main 20 conquered) grants rewards but never double-advances.
  let campaign = doc.campaign;
  let conquered = false;
  let conqueredCycles = doc.conquered_cycles;
  if (mode === 'campaign') {
    const seatMatches =
      doc.campaign.phase === phase && doc.campaign.wave_in_phase === Math.floor(wave);
    if (seatMatches) {
      if (phase === 'trial') {
        campaign =
          wave >= TRIAL_WAVE_COUNT
            ? { phase: 'main', wave_in_phase: 1 }
            : { phase: 'trial', wave_in_phase: Math.min(TRIAL_WAVE_COUNT, wave + 1) };
      } else if (wave >= MAIN_WAVE_COUNT) {
        conquered = true;
        conqueredCycles = doc.conquered_cycles + 1;
        // Reset display; default skips Trial once Conquered ≥ 1 (§9e).
        campaign = { phase: 'main', wave_in_phase: 1 };
      } else {
        campaign = { phase: 'main', wave_in_phase: Math.min(MAIN_WAVE_COUNT, wave + 1) };
      }
    }
  }
  const cyclePowerValue = cyclePower(conqueredCycles);
  if (conquered) {
    tokensGranted += CYCLE_CLEAR_BONUS_TOKENS;
    xpGranted += CYCLE_CLEAR_BONUS_XP;
    // A new cycle begins — the Avatar-star roll + pity counters reset (§9h:
    // once/cycle, pity counts Final clears WITHIN a cycle).
    final_clears_this_cycle = 0;
    avatar_star_rolled_cycle = false;
  }

  // XP level-ups (clear XP + any conquer bonus feed the same curve).
  let xp = doc.xp + xpGranted;
  let level = doc.avatar_level;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }

  // Bag: milestone Rare Look (if fired) + this wave's drop roll(s).
  let inventory = doc.inventory;
  if (milestone) inventory = addCopiesToBag(inventory, milestone.itemId, 0, 1);
  if (dropItems.length > 0) inventory = addManyToBag(inventory, dropItems);

  const next: PlayStoreDoc = {
    ...doc,
    tokens: doc.tokens + tokensGranted,
    xp,
    avatar_level: level,
    highest_wave_cleared: Math.max(doc.highest_wave_cleared, Math.floor(wave)),
    lifetime_waves_cleared: lifetimeAfter,
    clears_today: clearsToday,
    clears_ymd: clearsYmd,
    campaign,
    conquered_cycles: conqueredCycles,
    cycle_power: cyclePowerValue,
    inventory,
    milestone_waves_claimed: milestone
      ? [...doc.milestone_waves_claimed, lifetimeAfter]
      : doc.milestone_waves_claimed,
    avatar_star_tokens,
    avatar_star_rolled_cycle,
    final_clears_this_cycle,
    uniques: uniquesAfter,
    bound_bosses,
  };
  return {
    doc: next,
    result: {
      tokensGranted,
      xpGranted,
      halved,
      replayHalf,
      clearsToday,
      milestoneLook: milestone
        ? { count: lifetimeAfter, itemId: milestone.itemId }
        : null,
      conquered,
      conqueredCycles,
      cyclePower: cyclePowerValue,
      campaign,
      starTokenGranted,
      avatarStarTokens: avatar_star_tokens,
      dropItems,
      bossFragment,
    },
  };
}

/**
 * Grant the Rare Look for a lifetime-clear boundary when it is a milestone
 * (5/10/25 — GAME_SPEC §18 lock: milestones read `lifetime_waves_cleared`,
 * never reset on a Conquered) and it has not fired yet. Pure doc transition:
 * rolls a Rare Look into the bag (star 0) and marks the boundary claimed.
 * Returns what was granted (null = nothing fired, e.g. not a milestone or
 * already claimed). Shared by recordDefendWin and the Dev kit's force-grant.
 */
export function claimMilestoneLook(
  doc: PlayStoreDoc,
  wave: number,
  rng: () => number = Math.random,
): { wave: number; itemId: string } | null {
  const milestone = (MILESTONE_WAVES as readonly number[]).includes(wave);
  if (!milestone || doc.milestone_waves_claimed.includes(wave)) return null;
  const itemId = rollMilestoneLook(rng);
  return { wave, itemId };
}

/**
 * Spend one Avatar star token → +1 Avatar star (§9h). The token is only
 * consumed when a star is actually gained (at the ★5 cap or with no token,
 * this is a no-op). Each star adds +3% base wave_power (`avatarStarWavePower`).
 */
export function spendAvatarStarToken(
  doc: PlayStoreDoc,
): { doc: PlayStoreDoc; gainedStar: boolean } {
  if (doc.avatar_star_tokens < 1 || doc.avatar_stars >= AVATAR_STAR_MAX) {
    return { doc, gainedStar: false };
  }
  return {
    doc: {
      ...doc,
      avatar_stars: doc.avatar_stars + 1,
      avatar_star_tokens: doc.avatar_star_tokens - 1,
    },
    gainedStar: true,
  };
}

/**
 * Dev kit only: reset the campaign back to a fresh start — Trial wave 1, no
 * conquered cycles, cycle_power back to ×1 (lifetime clears / XP / inventory
 * are kept; this only resets the campaign seat + cycle counter).
 */
export function devCampaignReset(doc: PlayStoreDoc): PlayStoreDoc {
  return {
    ...doc,
    campaign: { phase: 'trial', wave_in_phase: 1 },
    conquered_cycles: 0,
    cycle_power: cyclePower(0),
  };
}

/**
 * Dev kit only: park the campaign seat at a specific phase + next wave
 * (e.g. Main wave 19) so a specific band / the final climb is testable fast.
 */
export function devSetCampaignSeat(
  doc: PlayStoreDoc,
  phase: CampaignPhase,
  wave: number,
): PlayStoreDoc {
  const waveInPhase =
    phase === 'trial'
      ? Math.min(TRIAL_WAVE_COUNT, Math.max(1, Math.floor(wave)))
      : Math.min(MAIN_WAVE_COUNT, Math.max(1, Math.floor(wave)));
  return { ...doc, campaign: { phase, wave_in_phase: waveInPhase } };
}

/**
 * Dev kit only: force one more Conquered cycle — bumps `conquered_cycles`,
 * recomputes `cycle_power` via CycleScaler, and resets the seat to Main wave 1
 * (the post-Conquered default). Enemies on the next run scale × the new power.
 */
export function devForceConquered(doc: PlayStoreDoc): PlayStoreDoc {
  const conqueredCycles = doc.conquered_cycles + 1;
  return {
    ...doc,
    campaign: { phase: 'main', wave_in_phase: 1 },
    conquered_cycles: conqueredCycles,
    cycle_power: cyclePower(conqueredCycles),
  };
}

/** Player-facing label for a campaign phase (what Defend shows next). */
export function campaignPhaseLabel(phase: CampaignPhase): string {
  return phase === 'main' ? 'Main' : 'Trial';
}

/**
 * One replay band (GAME_SPEC §9h farm): a cleared wave range on a phase's map,
 * replayable at half tokens. `clearedThrough` is the furthest wave of the band
 * cleared in the CURRENT cycle (waves below the seat are cleared); a band
 * fully cleared in ANY prior cycle is unlocked for the whole range again —
 * `conquered_cycles ≥ 1` proves Main wave 20, and therefore every wave of the
 * current Main climb, was beaten once, so the Final stays farmable each cycle.
 */
export type ReplayBandView = {
  phase: CampaignPhase;
  label: string;
  firstWave: number;
  lastWave: number;
  /** True when at least one wave of the band is replayable right now. */
  unlocked: boolean;
  /** Furthest wave of the band replayable now (≤ lastWave when unlocked). */
  clearedThrough: number;
};

/** The two campaign facts replay gates are derived from (doc or view). */
export type CampaignSnapshot = {
  campaign: CampaignState;
  conqueredCycles: number;
};

export function replayBands(snapshot: CampaignSnapshot): ReplayBandView[] {
  const conquered = snapshot.conqueredCycles > 0;
  const seat = snapshot.campaign;
  const trialThrough =
    seat.phase === 'main' || conquered
      ? TRIAL_WAVE_COUNT
      : seat.phase === 'trial'
        ? Math.max(0, seat.wave_in_phase - 1)
        : 0;
  const mainThrough = conquered
    ? MAIN_WAVE_COUNT
    : seat.phase === 'main'
      ? Math.max(0, seat.wave_in_phase - 1)
      : 0;
  return [
    {
      phase: 'trial',
      label: 'Trial',
      firstWave: 1,
      lastWave: TRIAL_WAVE_COUNT,
      unlocked: trialThrough >= 1,
      clearedThrough: trialThrough,
    },
    {
      phase: 'main',
      label: 'Main',
      firstWave: 1,
      lastWave: MAIN_WAVE_COUNT,
      unlocked: mainThrough >= 1,
      clearedThrough: mainThrough,
    },
  ];
}

/* ---------------------------------------------------------------------------
 * Gear Score + Skip-to-even (GAME_SPEC §9j; §18 lock — Phase D).
 *
 * GS (engine/gear-score.ts) is the §18 locked formula from the soft-capped
 * equipped wave_power bucket, Avatar level and Avatar stars; Defend setup
 * shows it next to `recommendedGs` for the wave. When GS overkills the next
 * normal wave by `skipGsThreshold` (Sane ×1.25), the player can fast-forward
 * through the trivial normal waves until the gate fails or a boss band is
 * reached. Skipped waves pay REDUCED tokens/XP (`skipPayFraction`, Sane 45%)
 * + ONE commons-only skip crate per batch — never uniques, tint boss gear,
 * Avatar stars, or boss fragments (§9j table). Milestones (5/10/25) still fire
 * when the lifetime clear count crosses a boundary (§18: milestones ride
 * `lifetime_waves_cleared`, which skip also advances). Farm bands stay open:
 * the seat has moved, so replayBands unlocks everything below it.
 *
 * Skip is the ONLY write path here besides `recordDefendWin` that advances the
 * campaign seat; both never run on replays. Skip does not touch the §9 daily
 * clear cap or the milestone flags beyond genuine crossings.
 * ------------------------------------------------------------------------- */

/** Why a skip walk stopped — shown to the player when an offer exists. */
export type SkipStopReason = 'boss' | 'gs' | 'end';

export type SkipPlan = {
  /** Normal waves the walk would fast-forward (empty → nothing to skip). */
  steps: readonly CampaignState[];
  /** Seat when the offer is made. */
  fromSeat: CampaignState;
  /** Seat after skipping (== fromSeat when nothing was skippable). */
  toSeat: CampaignState;
  /** Why the walk stopped at `toSeat` ('end' is a guard — Main 20 is a boss
   * band and always stops as 'boss' first). */
  stopReason: SkipStopReason;
};

/** Advance the campaign seat one display wave (Trial 5 → Main 1). Null when
 * there is no normal wave left to fast-forward past (Main 20 is a boss band). */
export function campaignNextSeat(seat: CampaignState): CampaignState | null {
  if (seat.phase === 'trial') {
    return seat.wave_in_phase >= TRIAL_WAVE_COUNT
      ? { phase: 'main', wave_in_phase: 1 }
      : { phase: 'trial', wave_in_phase: seat.wave_in_phase + 1 };
  }
  if (seat.wave_in_phase >= MAIN_WAVE_COUNT) return null;
  return { phase: 'main', wave_in_phase: seat.wave_in_phase + 1 };
}

/** Player GS from the persisted doc (soft-capped bucket + level + stars). */
export function gearScoreOf(doc: PlayStoreDoc): number {
  const wavePowerBucket = bucketMultiplier('wave_power', equippedStatSums(doc.equipped));
  return gearScore(wavePowerBucket, doc.avatar_level, doc.avatar_stars);
}

/**
 * Walk the campaign forward from the seat across normal waves that GS
 * overkills by the skip threshold; stop at the first boss band (Main
 * 9/10/19/20 — never auto-skipped) or the first wave whose recommended GS
 * clears the gate. Pure — the UI reads it to decide whether to offer Skip.
 */
export function planSkipToEven(
  seat: CampaignState,
  gs: number,
  cyclePowerValue: number,
): SkipPlan {
  const threshold = getTune().skipGsThreshold;
  const steps: CampaignState[] = [];
  let cursor: CampaignState = seat;
  let guard = 0;
  while (guard++ < 64) {
    if (bossBandFor(cursor.phase, cursor.wave_in_phase)) {
      return { steps, fromSeat: seat, toSeat: cursor, stopReason: 'boss' };
    }
    const rec = recommendedGs(cursor.phase, cursor.wave_in_phase, cyclePowerValue);
    if (gs < threshold * rec) {
      return {
        steps,
        fromSeat: seat,
        toSeat: cursor,
        stopReason: steps.length > 0 ? 'gs' : 'end',
      };
    }
    const next = campaignNextSeat(cursor);
    if (!next) {
      return { steps, fromSeat: seat, toSeat: cursor, stopReason: 'end' };
    }
    steps.push(cursor);
    cursor = next;
  }
  return { steps, fromSeat: seat, toSeat: cursor, stopReason: 'gs' };
}

/** What one Skip batch paid (the Defend screen + hub toast show it honestly). */
export type SkipRewardResult = {
  /** Normal waves fast-forwarded this batch. */
  skippedWaves: number;
  stopReason: SkipStopReason;
  /** Seat before the batch. */
  fromSeat: CampaignState;
  /** Seat after the batch (what Defend plays next). */
  toSeat: CampaignState;
  tokensGranted: number;
  xpGranted: number;
  /** The ONE commons-only skip crate roll (may be empty if the table is gone). */
  crateItemIds: string[];
  /** Milestone Rare Looks fired because lifetime crossed 5/10/25. */
  milestoneLooks: readonly { wave: number; itemId: string }[];
  /** Avatar level after XP from this batch. */
  avatarLevel: number;
};

/**
 * Apply one Skip-to-even batch (GAME_SPEC §9j). Refuses when nothing is
 * skippable at the seat (returns null). Grants reduced tokens/XP per skipped
 * wave, ONE commons-only crate (`drop_skip_crate`) at the end of the batch,
 * and any milestone Look whose lifetime boundary was crossed — then parks the
 * seat at the stop wave. Daily clear cap, uniques, tint gear and Avatar-star
 * rolls are never touched by a skip.
 */
export function skipCampaignToEven(
  doc: PlayStoreDoc,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; result: SkipRewardResult } | null {
  const plan = planSkipToEven(doc.campaign, gearScoreOf(doc), doc.cycle_power);
  if (plan.steps.length < 1) return null;

  const tune = getTune();
  const payFraction = tune.skipPayFraction;

  // Reduced pay per skipped wave (flat token base + wave-scaled XP, × fraction).
  let tokensGranted = 0;
  let xpGranted = 0;
  let highestWave = doc.highest_wave_cleared;
  for (const step of plan.steps) {
    tokensGranted += Math.floor(tune.tokenClearBase * payFraction);
    xpGranted += Math.floor(xpForClear(step.wave_in_phase) * payFraction);
    highestWave = Math.max(highestWave, step.wave_in_phase);
  }

  // Lifetime clear count + milestones crossing 5/10/25 (§18 lock).
  const lifetimeAfter = doc.lifetime_waves_cleared + plan.steps.length;
  const milestoneLooks: { wave: number; itemId: string }[] = [];
  const claimedNow: number[] = [];
  for (const milestoneWave of MILESTONE_WAVES) {
    if (
      milestoneWave > doc.lifetime_waves_cleared &&
      milestoneWave <= lifetimeAfter &&
      !doc.milestone_waves_claimed.includes(milestoneWave)
    ) {
      const grant = claimMilestoneLook(doc, milestoneWave, rng);
      if (grant) {
        milestoneLooks.push(grant);
        claimedNow.push(grant.wave);
      }
    }
  }

  // ONE commons-only skip crate per batch — never uniques / tint gear / stars.
  let inventory = doc.inventory;
  const crateId = rollDropById('drop_skip_crate', rng);
  const crateItemIds = crateId ? [crateId] : [];
  for (const look of milestoneLooks) {
    inventory = addCopiesToBag(inventory, look.itemId, 0, 1);
  }
  if (crateId) inventory = addCopiesToBag(inventory, crateId, 0, 1);

  // XP feeds the same level curve as a real clear.
  let xp = doc.xp + xpGranted;
  let level = doc.avatar_level;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }

  const next: PlayStoreDoc = {
    ...doc,
    tokens: doc.tokens + tokensGranted,
    xp,
    avatar_level: level,
    highest_wave_cleared: highestWave,
    lifetime_waves_cleared: lifetimeAfter,
    campaign: plan.toSeat,
    inventory,
    milestone_waves_claimed: [
      ...doc.milestone_waves_claimed,
      ...claimedNow,
    ],
  };
  return {
    doc: next,
    result: {
      skippedWaves: plan.steps.length,
      stopReason: plan.stopReason,
      fromSeat: plan.fromSeat,
      toSeat: plan.toSeat,
      tokensGranted,
      xpGranted,
      crateItemIds,
      milestoneLooks,
      avatarLevel: level,
    },
  };
}

/** Dev kit only: zero today's clear counter (clears stay on today's YMD so a
 * fresh win restarts from 1 full-reward clear). */
export function devDefendResetClears(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, clears_today: 0, clears_ymd: localYmd() };
}

/** Dev kit only: set today's clears to the Tune half threshold so the next
 * win is halved (honest-note path becomes reachable on demand). */
export function devDefendSetClearsFive(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, clears_today: getTune().dailyClearHalfAfter, clears_ymd: localYmd() };
}

/** Dev kit only: force the wave-5 milestone Look into the bag (fires once —
 * repeat presses are no-ops until milestones reset). Returns the granted id. */
export function devGrantMilestoneWaveFive(
  doc: PlayStoreDoc,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; grantedId: string | null } {
  const granted = claimMilestoneLook(doc, MILESTONE_WAVES[0], rng);
  if (!granted) return { doc, grantedId: null };
  return {
    doc: {
      ...doc,
      inventory: addCopiesToBag(doc.inventory, granted.itemId, 0, 1),
      milestone_waves_claimed: [...doc.milestone_waves_claimed, granted.wave],
    },
    grantedId: granted.itemId,
  };
}

/** Dev kit only: clear milestone flags so 5/10/25 fire again on their clears. */
export function devResetMilestones(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, milestone_waves_claimed: [] };
}

/** Dev kit only: grant one Avatar star token (tests the spend → +★ path). */
export function devGrantAvatarStarToken(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, avatar_star_tokens: doc.avatar_star_tokens + 1 };
}

/** Dev kit only: set the cycle boss tint (re-skins boss bands + preview). */
export function devSetCycleTint(doc: PlayStoreDoc, tint: TypeTag): PlayStoreDoc {
  return { ...doc, cycle_tint: tint };
}

/** Dev kit only: park the seat at the Final band (Main wave 20). */
export function devForceFinal(doc: PlayStoreDoc): PlayStoreDoc {
  return devSetCampaignSeat(doc, 'main', MAIN_WAVE_COUNT);
}

/** Dev kit only: reset the Avatar-star cycle flags (re-test 25% + pity). */
export function devResetAvatarStarCycle(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, avatar_star_rolled_cycle: false, final_clears_this_cycle: 0 };
}

/**
 * Dev kit only: jump the Avatar to an extreme level + ★5 and wear a ★5 copy
 * of every regular Power, so GS reads far above any normal wave's
 * recommendation — Skip-to-even becomes offerable from any seat. Worn copies
 * are fabricated directly (dev-only); nothing in a game path calls this.
 */
export function devOvergear(doc: PlayStoreDoc): PlayStoreDoc {
  const equipped: PlayStoreDoc['equipped'] = { ...doc.equipped };
  for (const id of OVERGEAR_POWER_IDS) {
    const def = getItemDef(id);
    if (!def) continue;
    equipped[def.core.slot] = { id, star: MERGE_MAX_STAR };
  }
  return {
    ...doc,
    avatar_level: DEV_OVERGEAR_LEVEL,
    avatar_stars: AVATAR_STAR_MAX,
    equipped,
  };
}

/** Dev kit only: overgear AND reset the campaign to Trial wave 1, so the Skip
 * offer is force-visible at the next Defend setup (smoke: skip then stops at
 * the Scout band, never auto-runs the bosses). */
export function devForceSkipOffer(doc: PlayStoreDoc): PlayStoreDoc {
  return devOvergear(devCampaignReset(doc));
}

/** Dev kit only: grant one boss fragment to the cycle's boss family (auto-star
 * ups through the §9k fragment ladder). */
export function devGrantBossFragment(doc: PlayStoreDoc): PlayStoreDoc {
  const bossId = defaultBoundBossId();
  if (!bossId) return doc;
  const def = getBoundBossDef(bossId);
  if (!def) return doc;
  const existing =
    doc.bound_bosses.find((b) => b.id === bossId) ??
    { id: bossId, stars: 0, frags: 0, bound_wave: null };
  const next = addBossFragments(existing, def, 1, null);
  const bound_bosses = doc.bound_bosses.some((b) => b.id === bossId)
    ? doc.bound_bosses.map((b) => (b.id === bossId ? next.record : b))
    : [...doc.bound_bosses, next.record];
  return { ...doc, bound_bosses };
}

/** Dev kit only: force the cycle boss to be bound (≥ ★1) immediately. */
export function devUnlockBoundBoss(doc: PlayStoreDoc): PlayStoreDoc {
  const bossId = defaultBoundBossId();
  if (!bossId) return doc;
  const existing = doc.bound_bosses.find((b) => b.id === bossId);
  const record: BoundBossRecord = {
    id: bossId,
    stars: Math.max(1, existing?.stars ?? 1),
    frags: existing?.frags ?? 0,
    bound_wave: existing?.bound_wave ?? null,
  };
  const bound_bosses = existing
    ? doc.bound_bosses.map((b) => (b.id === bossId ? record : b))
    : [...doc.bound_bosses, record];
  return { ...doc, bound_bosses };
}

/** Dev kit only: clear every Bound Boss record (re-test the fragment grind). */
export function devResetBoundBosses(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, bound_bosses: [] };
}

/** §7 bust table value at a Deeper index plus the §9c tune boost (whole-%),
 * clamped to 5%–90% so a preset can soften or spice the risk safely. */
function diveBustChanceAt(deeperIndex: number): number {
  const table = DIVE_BUST_TABLE[deeperIndex];
  const boost = getTune().diveBustBoostPct / 100;
  return Math.min(0.9, Math.max(0.05, table + boost));
}

/* ---------------------------------------------------------------------------
 * Equipped gear buckets (GAME_SPEC §9c).
 *
 * Each equipped item contributes its mult_a / mult_b. Same stat adds into one
 * bucket; different stats stay separate and multiply later (Defend). The raw
 * sums are the display truth ("+8% wave power"); `bucketMultiplier` applies
 * the §9c soft-cap — past the cap extra rolls add at diminishing strength
 * (Tune knobs, Sane: wave_power ×2.0, others ×1.5, past-cap 25%). Dive bust %
 * is the §7 table plus the tune boost, bent by `effectiveBustPct` via equipped
 * dive_luck (the §7 luck formula) — the number the UI always shows.
 * ------------------------------------------------------------------------- */

/**
 * Raw additive sums per stat from the equipped items (0 when none). Each
 * worn copy's mult value is scaled by its star: value × (1 + 10% per star),
 * so a merged ★2 power beats a ★1 (GAME_SPEC "scale mults lightly per star").
 */
export function equippedStatSums(
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>,
): StatSums {
  const sums: StatSums = {
    wave_power: 0,
    tower_speed: 0,
    token_earn: 0,
    dive_luck: 0,
    research_yield: 0,
  };
  for (const slot of Object.values(equipped)) {
    if (!slot) continue;
    const def = getItemDef(slot.id);
    if (!def) continue;
    const scale = 1 + MERGE_STAR_MULT_STEP * slot.star;
    for (const mult of [def.mult_a, def.mult_b]) {
      if (mult) sums[mult.stat] += mult.value * scale;
    }
  }
  return sums;
}

/** §9c soft-capped multiplier for one stat from its raw additive sum. The
 * soft caps are Tune knobs: wave_power uses gear_softcap_wave_power; every
 * other stat uses gear_softcap_other. Past-cap rolls add at diminishing
 * strength (diminishing_after_cap). */
export function bucketMultiplier(stat: ItemStat, sums: StatSums): number {
  const tune = getTune();
  const cap =
    stat === 'wave_power' ? tune.gearSoftcapWavePower : tune.gearSoftcapOther;
  const addCap = cap - 1;
  const raw = sums[stat];
  return (
    1 + Math.min(raw, addCap) + tune.diminishingAfterCap * Math.max(0, raw - addCap)
  );
}

/** §7 luck tier from the (uncapped) dive_luck sum: each +5% is one tier. */
export function diveLuckBucket(statSums: StatSums): number {
  return Math.min(
    LUCK_BUCKET_MAX,
    Math.max(1, 1 + Math.floor(statSums.dive_luck / LUCK_BUCKET_STEP)),
  );
}

/**
 * §7 bust bend: table bust % × (1 − 0.15·(luck_bucket−1)), floored at 50% of
 * the table value. Returns whole percent (what the UI shows) — honest odds,
 * never hidden.
 */
export function effectiveBustPct(
  baseBust: number,
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>,
): number {
  const bucket = diveLuckBucket(equippedStatSums(equipped));
  const bent = baseBust * (1 - LUCK_BUST_BEND_PER_TIER * (bucket - 1));
  const floored = Math.max(0.5 * baseBust, bent);
  return Math.round(floored * 100);
}

/**
 * Claim the whole research bag once (GAME_SPEC §8).
 *
 * Grants tend tokens (15–40), the daily tend bonus (+10, first Claim of the
 * device-local day), a 35% roll for +1 dive charge (once per Claim, no-op at
 * cap), and one item find per dumped cycle — each cycle rolls a stub id from
 * the Grove item table and the ids are appended to `inventory`. Resets accrued
 * research to 0 and restarts the timer. Returns null when nothing is ready.
 */
export function claimResearch(
  doc: PlayStoreDoc,
  now: number,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; result: ClaimResult } | null {
  const research = researchAt(doc, now);
  if (research.readyFinds < 1) return null;

  const tendTokens =
    TEND_MIN_TOKENS + Math.floor(rng() * (TEND_MAX_TOKENS - TEND_MIN_TOKENS + 1));

  const todayYmd = localYmd(new Date(now));
  const dailyBonusTokens =
    doc.last_tend_bonus_ymd === todayYmd ? 0 : DAILY_TEND_BONUS_TOKENS;

  const dive = diveChargeAt(doc, now);
  const diveChargeGranted =
    !dive.full && rng() < RESEARCH_DIVE_CHARGE_CHANCE;
  const nextDive = diveChargeGranted
    ? { dive_charge: dive.current + 1, dive_charge_at: now }
    : snapshotDive(doc, now);

  // Bag dump: every whole cycle in the bag is one find = one roll from the
  // stub table. Real ids go into inventory (stacked by id); the toast result
  // keeps the raw rolls so the UI can name them.
  const items = Array.from({ length: research.readyFinds }, () => rollResearchFind(rng));

  const next: PlayStoreDoc = {
    ...doc,
    tokens: doc.tokens + tendTokens + dailyBonusTokens,
    ...nextDive,
    inventory: addManyToBag(doc.inventory, items),
    research_accrued_ms: 0,
    research_started_at: now,
    last_tend_bonus_ymd: dailyBonusTokens > 0 ? todayYmd : doc.last_tend_bonus_ymd,
  };

  return {
    doc: next,
    result: {
      cyclesClaimed: research.readyFinds,
      items,
      tendTokens,
      dailyBonusTokens,
      diveChargeGranted,
      diveChargeNow: next.dive_charge,
      tokensNow: next.tokens,
    },
  };
}

/* ---------------------------------------------------------------------------
 * Dive — push-your-luck (GAME_SPEC §7, GAME_DATA "Dive odds + XP").
 *
 * Flow: spend 1 charge → first find card → Surface banks the whole haul into
 * inventory, or Deeper rolls the bust table (18/28/40/55%) and, on a safe
 * roll, adds another find. Max 4 Deepers. A bust loses this haul only — the
 * charge is already spent and nothing outside the haul is touched. Honest
 * numbers: the UI shows the effective bust % of the next Deeper — the table
 * value already bent by equipped `dive_luck` (§7), never hidden.
 *
 * All item rolls reuse the stub-table uniform roll — weighted Dive loot
 * arrives with loot_tables.json later.
 * ------------------------------------------------------------------------- */

export type DeeperOutcome =
  | { busted: true; bustPct: number }
  | { busted: false; bustPct: number; addedId: string };

/**
 * Spend 1 dive charge to start a run and roll the first find. Null when there
 * is already a run in progress or no charge is available.
 */
export function startDive(
  doc: PlayStoreDoc,
  now: number,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; firstFind: string } | null {
  if (doc.dive_run) return null;
  const dive = diveChargeAt(doc, now);
  if (dive.current < 1) return null;
  const firstFind = rollDiveFind(rng);
  return {
    doc: {
      ...doc,
      // Spend one derived charge; the refill timer restarts from now.
      dive_charge: dive.current - 1,
      dive_charge_at: now,
      dive_run: { deepers: 0, haul: [firstFind] },
    },
    firstFind,
  };
}

/** Bank the current haul into inventory (stacked) and end the run. Null when idle. */
export function surfaceDive(
  doc: PlayStoreDoc,
): { doc: PlayStoreDoc; banked: string[] } | null {
  const run = doc.dive_run;
  if (!run) return null;
  return {
    doc: {
      ...doc,
      dive_run: null,
      inventory: addManyToBag(doc.inventory, run.haul),
    },
    banked: run.haul,
  };
}

/**
 * Roll one Deeper press. Bust chance is the §7 table value at this run's depth
 * (Deeper # = deepers + 1), bent by equipped `dive_luck` via `effectiveBustPct`
 * — the same number the UI shows. On a bust the whole haul is lost and the run
 * ends. On a safe roll another find is added. Null when idle or run is maxed.
 */
export function deeperDive(
  doc: PlayStoreDoc,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; outcome: DeeperOutcome } | null {
  const run = doc.dive_run;
  if (!run || run.deepers >= DIVE_DEEPER_MAX) return null;
  // §7 table at this depth + the §9c tune bust boost, bent by equipped
  // dive_luck — the same number the UI shows.
  const bustChance =
    effectiveBustPct(diveBustChanceAt(run.deepers), doc.equipped) / 100;
  if (rng() < bustChance) {
    const bustPct = Math.round(bustChance * 100);
    return { doc: { ...doc, dive_run: null }, outcome: { busted: true, bustPct } };
  }
  const addedId = rollDiveFind(rng);
  return {
    doc: {
      ...doc,
      dive_run: { deepers: run.deepers + 1, haul: [...run.haul, addedId] },
    },
    outcome: { busted: false, bustPct: Math.round(bustChance * 100), addedId },
  };
}

/* ---------------------------------------------------------------------------
 * Dress — 4 slots, one item per slot (GAME_SPEC §9 inventory, §11 screen 4;
 * GAME_DATA item + equipped shape).
 *
 * `inventory` is the bag: copies stacked by (id, star), worn copies excluded.
 * Equipping takes exactly ONE copy out of its matching stack into the slot
 * (the stack keeps the rest — never cleared); unequipping puts that one copy
 * back, so a stack is never duped. Swapping a slot returns the old ref to its
 * own stack. The §9 soft cap (80) counts TOTAL owned items (sum of stack
 * counts + worn) and gates a net-new Power into an empty slot: you must sell
 * a Look for `LOOK_SELL_TOKENS` first. Sell removes one copy from a Look
 * stack (Looks never carry stars).
 *
 * Risky Merge lives right below — duplicates of a Power (same id + star)
 * become the merge fuel; see that section for the ladder TODO.
 * ------------------------------------------------------------------------- */

export type EquipOutcome =
  | { ok: true }
  | { ok: false; reason: 'not_owned' | 'bag_full' | 'already_equipped' };

export type SellOutcome =
  | { ok: true; gainedTokens: number; name: string }
  | { ok: false; reason: 'not_owned' | 'not_look' };

/** Equip one owned (bagged) copy of (id, star) into its slot. Blocked when
 * the bag is over the soft cap and the item is a Power going into an EMPTY
 * slot (net-new gear — sell a Look first). Swaps (slot holds a DIFFERENT ref)
 * are always allowed, as are Look equips, because neither adds to the total
 * owned count. Equipping the exact ref ALREADY worn is refused
 * (`already_equipped`) — one per slot — so spare copies of a worn item can
 * only sit in the bag (or feed a merge, or sell, if Look). */
export function equipItem(
  doc: PlayStoreDoc,
  itemId: string,
  star: number,
): { doc: PlayStoreDoc; outcome: EquipOutcome } {
  const def = getItemDef(itemId);
  if (!def || !doc.inventory.some((stack) => sameTier(stack, itemId, star))) {
    return { doc, outcome: { ok: false, reason: 'not_owned' } };
  }
  const slot = def.core.slot;
  const occupied = doc.equipped[slot];
  if (occupied && occupied.id === itemId && occupied.star === star) {
    return { doc, outcome: { ok: false, reason: 'already_equipped' } };
  }
  const totalOwned = totalOwnedCount(doc.inventory, doc.equipped);
  if (def.core.kind === 'power' && occupied == null && totalOwned >= INVENTORY_SOFT_CAP) {
    return { doc, outcome: { ok: false, reason: 'bag_full' } };
  }
  // Take one copy from the bag; if this is a swap, the old ref goes back to
  // its own (id, star) stack.
  let inventory = takeOneFromBag(doc.inventory, itemId, star);
  if (occupied) inventory = addCopiesToBag(inventory, occupied.id, occupied.star, 1);
  return {
    doc: { ...doc, inventory, equipped: { ...doc.equipped, [slot]: { id: itemId, star } } },
    outcome: { ok: true },
  };
}

/** Take an equipped item off and return exactly one copy to its bag stack
 * (the matching (id, star) tier). */
export function unequipItem(
  doc: PlayStoreDoc,
  slot: ItemSlot,
): { doc: PlayStoreDoc } {
  const ref = doc.equipped[slot];
  if (!ref) return { doc };
  const equipped = { ...doc.equipped };
  delete equipped[slot];
  // Only return known items; a corrupt id is dropped rather than bagged.
  const inventory = getItemDef(ref.id)
    ? addCopiesToBag(doc.inventory, ref.id, ref.star, 1)
    : doc.inventory;
  return { doc: { ...doc, equipped, inventory } };
}

/** Sell ONE copy from a Look stack for a tiny token gain. Powers are never
 * sellable. Worn copies are not in the bag, so they can never be sold out from
 * under you — extra bagged copies of a worn id are sellable. */
export function sellItem(
  doc: PlayStoreDoc,
  itemId: string,
  star: number,
): { doc: PlayStoreDoc; outcome: SellOutcome } {
  const def = getItemDef(itemId);
  if (!def || !doc.inventory.some((stack) => sameTier(stack, itemId, star))) {
    return { doc, outcome: { ok: false, reason: 'not_owned' } };
  }
  if (def.core.kind !== 'look') {
    return { doc, outcome: { ok: false, reason: 'not_look' } };
  }
  return {
    doc: {
      ...doc,
      tokens: doc.tokens + LOOK_SELL_TOKENS,
      inventory: takeOneFromBag(doc.inventory, itemId, star),
    },
    outcome: { ok: true, gainedTokens: LOOK_SELL_TOKENS, name: def.core.name },
  };
}

/* ---------------------------------------------------------------------------
 * Risky Merge — Dive feel on Power duplicates.
 *
 * Same id + same star can merge. A "main" (the copy you keep and upgrade) can
 * be a WORN item or a BAGGED copy; one bagged spare of the same id + star is
 * consumed as fuel. Roll the honest % from `MERGE_SUCCESS_TABLE` (★0→1 70% …
 * 4→5 18%, cap ★5). Success raises the main one star; a fail spends the fuel
 * and leaves the main untouched — an equipped main is NEVER destroyed. Mult
 * values scale +10% per star (see `equippedStatSums`).
 *
 * TODO(merge ladder → GAME_SPEC §16c "fridge" / the old "No crafting / merge"
 * line): this risky single-star merge is v0. The specced upgrade ladder (e.g.
 * Tide Blade ×3 → Tide Blade 2/3 tiers with new art/names, or auto-combine of
 * excess spares) stays out of scope on purpose — when it lands it builds on
 * these same (id, star) stacks.
 * ------------------------------------------------------------------------- */

export type MergeOutcome =
  | { success: true; pct: number; fromStar: number; toStar: number }
  | { success: false; pct: number; fromStar: number };

/** What a merge is trying to raise: the main copy's tier + where it lives. */
export type MergeTarget = { id: string; star: number; main: 'worn' | 'bag' };

/** Honest success % (whole number) for raising `star` → `star + 1`, or null
 * when `star` is at the cap (nothing to roll). */
export function mergeSuccessPct(star: number): number | null {
  if (star < 0 || star >= MERGE_MAX_STAR) return null;
  return Math.round(MERGE_SUCCESS_TABLE[star] * 100);
}

/** Does the worn slot hold an item that can be merged with bagged fuel? */
export function canMergeWorn(
  doc: PlayStoreDoc,
  slot: ItemSlot,
): boolean {
  const ref = doc.equipped[slot];
  if (!ref) return false;
  const def = getItemDef(ref.id);
  if (!def || def.core.kind !== 'power') return false;
  if (mergeSuccessPct(ref.star) == null) return false;
  return doc.inventory.some((stack) => sameTier(stack, ref.id, ref.star));
}

/** Is this bag stack a merge-able main (a Power with ≥ 2 copies of its tier)?
 * A stack of 1 could still be fuel for a worn main, but not a main itself. */
export function canMergeStack(stack: ItemStack): boolean {
  const def = getItemDef(stack.id);
  if (!def || def.core.kind !== 'power') return false;
  if (mergeSuccessPct(stack.star) == null) return false;
  return stack.count >= 2;
}

/**
 * Roll one risky merge.
 *
 * `main` 'worn' targets the equipped copy (def.core.slot) and needs ≥ 1
 * bagged fuel of the same (id, star). `main` 'bag' targets a bagged copy and
 * needs its own (id, star) stack to hold ≥ 2 (main + fuel). Fuel is always
 * consumed; the main only changes on success. Null when the merge cannot be
 * made (nothing to do — caller should have hidden the button).
 */
export function mergeItem(
  doc: PlayStoreDoc,
  target: MergeTarget,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; outcome: MergeOutcome } | null {
  const def = getItemDef(target.id);
  const pct = mergeSuccessPct(target.star);
  if (!def || def.core.kind !== 'power' || pct == null) return null;
  const slot = def.core.slot;

  // Validate the main and that enough fuel of the same tier exists.
  if (target.main === 'worn') {
    const worn = doc.equipped[slot];
    if (!worn || worn.id !== target.id || worn.star !== target.star) return null;
    const fuel = doc.inventory.find((stack) => sameTier(stack, target.id, target.star));
    if (!fuel || fuel.count < 1) return null;
  } else {
    const stack = doc.inventory.find((stack) => sameTier(stack, target.id, target.star));
    if (!stack || stack.count < 2) return null;
  }

  const success = rng() < MERGE_SUCCESS_TABLE[target.star];

  // Fuel always goes first.
  let inventory = takeOneFromBag(doc.inventory, target.id, target.star);
  let equipped = doc.equipped;

  if (success) {
    if (target.main === 'worn') {
      // The worn main keeps its copy and moves up a star.
      equipped = { ...equipped, [slot]: { id: target.id, star: target.star + 1 } };
    } else {
      // The bag main moves up a star: pull one more copy from the old tier,
      // push it into the next tier.
      inventory = takeOneFromBag(inventory, target.id, target.star);
      inventory = addCopiesToBag(inventory, target.id, target.star + 1, 1);
    }
    return {
      doc: { ...doc, inventory, equipped },
      outcome: { success: true, pct, fromStar: target.star, toStar: target.star + 1 },
    };
  }

  // Fail: main untouched (bag main = the remaining copy of its stack), fuel gone.
  return {
    doc: { ...doc, inventory, equipped },
    outcome: { success: false, pct, fromStar: target.star },
  };
}

/* ---------------------------------------------------------------------------
 * Standing Dev kit mutators (test panel).
 *
 * Pure transitions backing the Grove "Dev kit · testing only" rows in
 * `src/app/play.tsx`. Dev-only: the kit's UI is PRE_LAUNCH_DEV-gated (Play's
 * route redirects when the gate is off), and nothing in a production path
 * calls these. This kit is the single test surface for Play — when a step adds
 * a time/RNG-gated feature, add its fill/reset transition here and a button in
 * that same step. Never reach these from game code.
 * ------------------------------------------------------------------------- */

/** Bank exactly one whole 30-min cycle so Claim becomes available. */
export function devFillResearchOne(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return { ...doc, research_accrued_ms: RESEARCH_CYCLE_MS, research_started_at: now };
}

/** Bank the full 10h cap (20 finds); accrual stops until Claim. */
export function devFillResearchFull(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return { ...doc, research_accrued_ms: RESEARCH_CAP_MS, research_started_at: now };
}

/** +10 tokens (matches the kit row label). */
export function devAddTokens(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, tokens: doc.tokens + 10 };
}

/**
 * Dev kit: roll one research-bag find straight into the bag. Also returns the
 * granted id so the kit row can toast the item name — the roll goes through
 * the same `rollResearchFind` path a real Claim uses, never fake state.
 */
export function devGrantRandomFind(
  doc: PlayStoreDoc,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; grantedId: string } {
  const grantedId = rollResearchFind(rng);
  return {
    doc: { ...doc, inventory: addCopiesToBag(doc.inventory, grantedId, 0, 1) },
    grantedId,
  };
}

/** Top dive charges to 10; refill timer pauses at cap. */
export function devFillDiveCharges(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return { ...doc, dive_charge: DIVE_CHARGE_CAP, dive_charge_at: now };
}

/** +1 dive charge from the derived count, clamped at cap (kit row label). */
export function devAddDiveCharge(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  const current = diveChargeAt(doc, now).current;
  if (current >= DIVE_CHARGE_CAP) return doc;
  return { ...doc, dive_charge: current + 1, dive_charge_at: now };
}

/** Dev kit: grant one random Power item into the bag. */
export function devGrantRandomPower(
  doc: PlayStoreDoc,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; grantedId: string } {
  const grantedId = rollPowerFind(rng);
  return {
    doc: { ...doc, inventory: addCopiesToBag(doc.inventory, grantedId, 0, 1) },
    grantedId,
  };
}

/** Dev kit: grant 3 copies of Tide Blade (one ★0 stack) to test stacking. */
export function devGrantTideBlades(
  doc: PlayStoreDoc,
): { doc: PlayStoreDoc; grantedId: string; count: number } {
  const grantedId = 'item_tide_blade_01';
  return {
    doc: { ...doc, inventory: addCopiesToBag(doc.inventory, grantedId, 0, 3) },
    grantedId,
    count: 3,
  };
}

/** Dev kit: sell EVERY Look copy in the bag. Returns what sold so the row can
 * toast. Worn Looks are not in the bag, so they are never touched. */
export function devSellAllJunk(
  doc: PlayStoreDoc,
): { doc: PlayStoreDoc; sold: number; gainedTokens: number } {
  let sold = 0;
  let gainedTokens = 0;
  const inventory: ItemStack[] = [];
  for (const stack of doc.inventory) {
    const def = getItemDef(stack.id);
    if (def?.core.kind === 'look') {
      sold += stack.count;
      gainedTokens += stack.count * LOOK_SELL_TOKENS;
    } else {
      inventory.push(stack);
    }
  }
  return {
    doc: { ...doc, tokens: doc.tokens + gainedTokens, inventory },
    sold,
    gainedTokens,
  };
}

/** Dev kit: take every slot off (items stay in the collection). */
export function devClearEquipped(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, equipped: {} };
}

/** Dev kit: fill junk Looks until total owned is just over the soft cap (81),
 * so the §9 "bag full — sell a Look" path is testable. No-op when already over. */
export function devFillJunkLooks(doc: PlayStoreDoc): PlayStoreDoc {
  const junk = junkLookId();
  if (!junk) return doc;
  const totalOwned = totalOwnedCount(doc.inventory, doc.equipped);
  const needed = INVENTORY_SOFT_CAP + 1 - totalOwned;
  if (needed <= 0) return doc;
  return {
    ...doc,
    inventory: addCopiesToBag(doc.inventory, junk, 0, needed),
  };
}

/** Reset the whole store to a fresh default (fresh timers, 10 charges, 0 tokens). */
export function devResetPlayStore(_doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return defaultPlayStore(now);
}

/**
 * Rewrite dive_charge/dive_charge_at from the derived value at `now`, keeping
 * partial refill progress by backdating `dive_charge_at` to the last full
 * charge landing. At cap the timer pauses (`dive_charge_at = now`).
 */
function snapshotDive(
  doc: PlayStoreDoc,
  now: number,
): { dive_charge: number; dive_charge_at: number } {
  const dive = diveChargeAt(doc, now);
  if (dive.full) {
    return { dive_charge: DIVE_CHARGE_CAP, dive_charge_at: now };
  }
  const elapsed = Math.max(0, now - doc.dive_charge_at);
  const lastLand = doc.dive_charge_at + Math.floor(elapsed / DIVE_CHARGE_REFILL_MS) * DIVE_CHARGE_REFILL_MS;
  return { dive_charge: dive.current, dive_charge_at: lastLand };
}

function parsePlayStore(raw: string, now: number): PlayStoreDoc | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    // v1 (pre-inventory) … v11 (forever stubs) all migrate to v12: legacy
    // copies are star 0, equipped string ids become refs with star 0, Defend
    // meta defaults to 0 clears / 0 XP / level 1 / no daily count / no
    // milestone flags, and the campaign seat (v11 numeric phases 1/2 → v12
    // string phases 'trial'/'main') + conquered cycles + cycle_power +
    // lifetime clears + bound bosses default to fresh values. v1–v4 also
    // stored `inventory` as a string[] of owned ids WITH worn copies included,
    // so those subtract one per equipped slot.
    const version = data?.version;
    if (
      version !== 1 && version !== 2 && version !== 3 && version !== 4 &&
      version !== 5 && version !== 6 && version !== 7 && version !== 8 &&
      version !== 9 && version !== 10 && version !== 11 && version !== 12 &&
      version !== 13 && version !== 14
    ) {
      return null;
    }
    const tokens = finiteNumber(data.tokens);
    const diveCharge = finiteNumber(data.dive_charge);
    const diveChargeAt = finiteNumber(data.dive_charge_at);
    const researchStartedAt = finiteNumber(data.research_started_at);
    const researchAccruedMs = finiteNumber(data.research_accrued_ms);
    const lastTend = typeof data.last_tend_bonus_ymd === 'string' ? data.last_tend_bonus_ymd : null;
    if (tokens == null || diveCharge == null || diveChargeAt == null || researchStartedAt == null) {
      return null;
    }
    const equipped = parseEquipped(data.equipped);
    const highestWaveCleared = finiteNumber(data.highest_wave_cleared) ?? 0;
    const xp = finiteNumber(data.xp) ?? 0;
    const avatarLevel = finiteNumber(data.avatar_level) ?? 1;
    const clearsToday = finiteNumber(data.clears_today) ?? 0;
    const clearsYmd =
      typeof data.clears_ymd === 'string' ? data.clears_ymd : null;
    const milestoneWaves = Array.isArray(data.milestone_waves_claimed)
      ? data.milestone_waves_claimed.filter(
          (w): w is number => typeof w === 'number' && Number.isFinite(w),
        )
      : [];
    // Forever-engine v11 stubs — default so every older save still parses.
    const campaign = parseCampaign(data.campaign);
    const conqueredRaw = finiteNumber(data.conquered_cycles);
    const conqueredCycles = conqueredRaw == null ? 0 : Math.max(0, Math.floor(conqueredRaw));
    const storedPower = finiteNumber(data.cycle_power);
    const cyclePowerValue =
      storedPower != null && storedPower >= 1 ? storedPower : cyclePower(conqueredCycles);
    const lifetimeWaves = finiteNumber(data.lifetime_waves_cleared) ?? 0;
    const boundBosses = parseBoundBosses(data.bound_bosses);
    // v13 (Phase C): Avatar star + unique drops + cycle tint. All default for
    // older saves.
    const avatarStars = Math.max(0, Math.min(AVATAR_STAR_MAX, Math.floor(finiteNumber(data.avatar_stars) ?? 0)));
    const avatarStarTokens = Math.max(0, Math.floor(finiteNumber(data.avatar_star_tokens) ?? 0));
    const avatarStarRolled = data.avatar_star_rolled_cycle === true;
    const finalClears = Math.max(0, Math.floor(finiteNumber(data.final_clears_this_cycle) ?? 0));
    const uniques = Array.isArray(data.uniques)
      ? data.uniques.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const cycleTint = isTypeTag(data.cycle_tint) ? data.cycle_tint : DEFAULT_CYCLE_TINT;
    return {
      version: 14,
      tokens: Math.max(0, Math.floor(tokens)),
      dive_charge: clampInt(diveCharge, 0, DIVE_CHARGE_CAP),
      dive_charge_at: diveChargeAt,
      research_started_at: researchStartedAt,
      research_accrued_ms: Math.min(RESEARCH_CAP_MS, Math.max(0, researchAccruedMs ?? 0)),
      last_tend_bonus_ymd: lastTend,
      inventory: parseInventory(data.inventory, equipped, version < 5),
      equipped,
      dive_run: parseDiveRun(data.dive_run),
      highest_wave_cleared: Math.max(0, Math.floor(highestWaveCleared)),
      xp: Math.max(0, Math.floor(xp)),
      avatar_level: Math.max(1, Math.floor(avatarLevel)),
      clears_today: Math.max(0, Math.floor(clearsToday)),
      clears_ymd: clearsYmd,
      milestone_waves_claimed: milestoneWaves,
      campaign,
      conquered_cycles: conqueredCycles,
      cycle_power: cyclePowerValue,
      lifetime_waves_cleared: Math.max(0, Math.floor(lifetimeWaves)),
      bound_bosses: boundBosses,
      avatar_stars: avatarStars,
      avatar_star_tokens: avatarStarTokens,
      avatar_star_rolled_cycle: avatarStarRolled,
      final_clears_this_cycle: finalClears,
      uniques,
      cycle_tint: cycleTint,
    };
  } catch {
    return null;
  }
}

/**
 * Loose read of the campaign seat. v11 stored numeric phases (1 = trial,
 * 2 = main); v12 stores `'trial' | 'main'` — both migrate here. Anything
 * malformed → fresh trial wave 1.
 */
function parseCampaign(raw: unknown): CampaignState {
  if (isRecord(raw)) {
    const rawPhase = raw.phase;
    const waveRaw = finiteNumber(raw.wave_in_phase);
    if (waveRaw != null) {
      const phase: CampaignPhase | null =
        rawPhase === 'trial' || rawPhase === 'main'
          ? rawPhase
          : rawPhase === 1
            ? 'trial'
            : rawPhase === 2
              ? 'main'
              : null;
      if (phase != null) {
        const wave = Math.max(1, Math.floor(waveRaw));
        return {
          phase,
          wave_in_phase:
            phase === 'trial'
              ? Math.min(TRIAL_WAVE_COUNT, wave)
              : Math.min(MAIN_WAVE_COUNT, wave),
        };
      }
    }
  }
  return { phase: 'trial', wave_in_phase: 1 };
}

/** Loose read of bound-boss rows; malformed rows are dropped. v14 rows carry
 * `stars` + `frags`; legacy `{ id, bound_wave }` rows default to stars 0. */
function parseBoundBosses(raw: unknown): BoundBossRecord[] {
  if (!Array.isArray(raw)) return [];
  const rows: BoundBossRecord[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0) continue;
    const bound = finiteNumber(entry.bound_wave);
    const stars = Math.max(0, Math.min(BOUND_BOSS_MAX_STAR, Math.floor(finiteNumber(entry.stars) ?? 0)));
    const frags = Math.max(0, Math.floor(finiteNumber(entry.frags) ?? 0));
    rows.push({
      id: entry.id,
      stars,
      frags,
      bound_wave: bound == null ? null : Math.max(1, Math.floor(bound)),
    });
  }
  return rows;
}

/**
 * Normalize a stored bag into v6 stacks keyed by (id, star). Accepts legacy
 * string[] rows (star 0), v5 {id, count} rows (star 0), or v6 rows carrying a
 * star. When `subtractWorn` (versions 1–4, where worn copies were also listed
 * in the bag) one copy per equipped slot is removed.
 */
function parseInventory(
  raw: unknown,
  equipped: Partial<Record<ItemSlot, ItemRef>>,
  subtractWorn: boolean,
): ItemStack[] {
  const counts = new Map<string, number>();
  const bump = (id: string, star: number, n: number) => {
    const key = `${id}\u0000${star}`;
    const next = (counts.get(key) ?? 0) + n;
    if (next > 0) counts.set(key, next);
    else counts.delete(key);
  };
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string' && entry.length > 0) {
        bump(entry, 0, 1);
      } else if (isRecord(entry) && typeof entry.id === 'string' && typeof entry.count === 'number') {
        const star = typeof entry.star === 'number' && Number.isFinite(entry.star)
          ? clampInt(entry.star, 0, MERGE_MAX_STAR)
          : 0;
        bump(entry.id, star, Math.max(1, Math.floor(entry.count)));
      }
    }
  }
  if (subtractWorn) {
    for (const ref of Object.values(equipped)) {
      if (ref) bump(ref.id, ref.star, -1);
    }
  }
  return [...counts.entries()].map(([key, count]) => {
    const [id, star] = key.split('\u0000');
    return { id, count, star: Number(star) };
  });
}

/** Loose-shape read of equipped slots: v6 refs or legacy string ids → refs. */
function parseEquipped(raw: unknown): Partial<Record<ItemSlot, ItemRef>> {
  if (!isRecord(raw)) return {};
  const equipped: Partial<Record<ItemSlot, ItemRef>> = {};
  for (const slot of ['weapon', 'armor', 'cloak', 'trinket'] as const) {
    const value = raw[slot];
    if (typeof value === 'string' && value.length > 0) {
      equipped[slot] = { id: value, star: 0 };
    } else if (
      isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.star === 'number' &&
      Number.isFinite(value.star)
    ) {
      equipped[slot] = { id: value.id, star: clampInt(value.star, 0, MERGE_MAX_STAR) };
    }
  }
  return equipped;
}

/** Loose-shape read of the persisted run; anything malformed → no run. */
function parseDiveRun(raw: unknown): DiveRun | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.deepers !== 'number' || !Number.isFinite(raw.deepers)) return null;
  const deepers = clampInt(raw.deepers, 0, DIVE_DEEPER_MAX);
  const haul = Array.isArray(raw.haul)
    ? raw.haul.filter((id): id is string => typeof id === 'string')
    : [];
  if (haul.length === 0) return null;
  return { deepers, haul };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export async function savePlayStore(doc: PlayStoreDoc): Promise<void> {
  await AsyncStorage.setItem(PLAY_STORE_KEY, JSON.stringify(doc));
}

/**
 * Load the persisted doc, falling back to (and persisting) a fresh default so
 * offline timers are anchored even on a first open before any Claim.
 */
export async function loadPlayStore(now: number = Date.now()): Promise<PlayStoreDoc> {
  try {
    const raw = await AsyncStorage.getItem(PLAY_STORE_KEY);
    if (raw) {
      const parsed = parsePlayStore(raw, now);
      if (parsed) return parsed;
    }
  } catch {
    // Fall through to a fresh default below.
  }
  const fresh = defaultPlayStore(now);
  savePlayStore(fresh).catch(() => {});
  return fresh;
}
