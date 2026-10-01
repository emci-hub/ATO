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
 *   Trial waves 1–5 on the Grove Path map, then Main waves 1–10 on the
 *   Divecore Main map. Clearing Main wave 10 → `conquered_cycles += 1`,
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

import { PLAY_EVERYTHING_FREE } from '@/lib/dev-mode';
import {
  STARTER_AVATAR_ID,
  legendElementOf,
  migrateLegendRecords,
} from '@/play/avatars';
import type { Element } from '@/play/kits';
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
import { starMergeSuccess, starMultScale } from '@/play/engine/star-table';
import { isTypeTag, type TypeTag } from '@/play/engine/type-match';
import { DEFAULT_AVATAR_HERO_ID, allHeroes, heroById, heroName } from '@/play/heroes-data';
import {
  PET_FEED_CATCH,
  PET_METER_MAX,
  PET_STAGES,
  PET_STAGE_MS,
  advancePet,
  expeditionBlock,
  expeditionStepsToday,
  expeditionLeftMs,
  logPetFind,
  parsePetExpedition,
  parsePetLogbook,
  petDiveBusted,
  petDiveSurfaced,
  ackPetReveals,
  canReleasePet,
  chooseEgg,
  petCareAct,
  petCareBand,
  petCareScore,
  petCareSkill,
  petOddsOpen,
  releasePet,
  warmEgg,
  feedPet,
  newPet,
  parsePet,
  parsePetHall,
  petAuraElement,
  PET_BUST_CUT_PP,
  PET_LUCKY_UPGRADE,
  petBustCutPp,
  petDayHolds,
  petLuckyChance,
  petTripBetter,
  petTripMult,
  petPounceBase,
  petRescueKeep,
  petStageLeftMs,
  petTokensForRound,
  petTokensLeft,
  petWaveCleared,
  rebirthBonus,
  rebirthPet,
  trainPet,
  type PetExpedition,
  type PetExpeditionBlock,
  type PetHallEntry,
  type PetLogbook,
  type PetState,
} from '@/play/pet';
import {
  CARE_ACT,
  SHARDS_PER_TICKET,
  DYE_STARS,
  DAILY_EGG_BONUS,
  EGGS_PER_DAY_MAX,
  EGG_TYPES,
  EMPTY_HERO_RECORD,
  FREE_EGGS_PER_DAY,
  GLIMMER_PITY,
  PITY_HARD,
  STONE_EVERY_DAYS,
  eggsUntilLegendary,
  nextEggPrice,
  pityAfterReveal,
  stoneSucceeds,
  addToBook,
  dyeApplies,
  emptyGradeCounts,
  gradeOdds,
  heroOfLine,
  heroStars,
  newEggSeed,
  nextGrade,
  parseGradeCounts,
  parseHeroBook,
  rollPet,
  roundSkillPoints,
  CARE_SKILL_SHARE,
  type CareBand,
  type EggType,
  type Grade,
  type PetHeroBook,
  type ShinyStyle,
} from '@/play/pet-eggs';
import {
  DEN_MAX_SLOTS,
  DEN_START_SLOTS,
  clampDenSlots,
  denSlotPrice,
  denSwapBlock,
  denUsed,
  isBlankSlot,
  petRevealed,
  wakePet,
  type DenSwapBlock,
} from '@/play/den';
import {
  MILESTONES,
  checkPetName,
  countDay,
  defaultSettings,
  emptyStats,
  parseSettings,
  parseStats,
  type MilestoneDef,
  type MilestoneId,
  type PlaySettings,
  type PlayStats,
  type Ribbon,
} from '@/play/play-settings';
import type { Difficulty, RoundOutcome } from '@/play/pet-game-rules';
import { EXPEDITION_STEPS, expeditionLengthMs, rollExpeditionReward } from '@/play/expedition-ladder';
import {
  DIVE_GEAR_COST,
  DIVE_OXYGEN_BUST,
  FOODS,
  NET_MIN_DEPTH,
  NO_DIVE_GEAR,
  PANTRY_MAX,
  PANTRY_OVERFLOW_SHELLS,
  SHELLS_PER_CLEAR,
  SHELLS_PER_REPLAY,
  findKind,
  freeDiveShells,
  isFoodId,
  pathBaseBust,
  pathTier,
  shellsOf,
  tierAt,
  type DiveGear,
  type DiveGearOwned,
  type DivePath,
  type FoodId,
} from '@/play/dive-loot';
import {
  COSMETIC_DUPE_SHELLS,
  NO_WEAR,
  cosmeticById,
  parseOwnedCosmetics,
  parsePetWear,
  type CosmeticSlot,
  type PetWear,
} from '@/play/pet-cosmetics';
import {
  BUFF_USES,
  FOCUSED_TRIP_MULT,
  NO_BUFFS,
  SNACK_BUST_PP,
  buffForMedal,
  grantBuff,
  parseBuffs,
  pumpedPounce,
  spendBuff,
  type BuffId,
  type Buffs,
  type PumpedState,
} from '@/play/play-buffs';
import {
  DAILY_LEVEL,
  dailyFor,
  dailyRewards,
  emptyRecords,
  medalFor,
  levelUnlocked,
  parseDaily,
  parseRecords,
  rankTitle,
  recordDaily,
  recordRound,
  EMPTY_DAILY,
  type DailyGames,
  type GameRecords,
  type Medal,
} from '@/play/game-records';
import {
  DIVECORE_POWERS_PER_DAY,
  POWER_OVERFLOW_SHELLS,
  isPowerFind,
  rollTierLucky,
} from '@/play/dive-loot';
import type { ShopTokenRow } from '@/play/shop';
import { devNoCaps, getTune } from '@/play/tune';
import {
  getItemDef,
  junkLookId,
  rarityRank,
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
export const DIVE_DEEPER_MAX = 4; // dive_deeper_max (5 with Oxygen, v22)
export const DIVE_DEEPER_MAX_OXYGEN = 5;
export const DIVE_BUST_TABLE = [0.18, 0.28, 0.4, 0.55] as const; // Deeper #1..#4
/** §7 floor: luck, the pet and buffs never take a bust chance below this
 * share of its table (path) value. */
export const DIVE_BUST_FLOOR = 0.5;

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
 * Main = Divecore Main map, waves 1–10 (real climb). Clearing Main wave 10
 * conquers the cycle. */
export const TRIAL_WAVE_COUNT = 5; // Trial waves 1..5 (Grove Path map)
export const MAIN_WAVE_COUNT = 10; // Main waves 1..10 (Divecore Main map)
/** Cycle-clear bonus (GAME_SPEC §9e "tokens/XP milestone bonus"). Sane flat
 * amounts so it reads as a milestone — tuned later. */
export const CYCLE_CLEAR_BONUS_TOKENS = 150;
export const CYCLE_CLEAR_BONUS_XP = 50;
/** Avatar star cap (§9h) — same soft ★5 feel as gear, max 5 stars. */
export const AVATAR_STAR_MAX = 5;

/** Bound HEROES allowed at once (Slice A2). Separate from the board's
 * `BOUND_BOSS_MAX_ON_BOARD` (2 placed towers in one fight) — this caps how many
 * heroes the save holds as bound towers, and only counts hero bindings, so the
 * cycle boss's own record never eats a hero slot. */
export const BOUND_HERO_MAX = 2;

/** Which hero a boss band's clear grants when the player owns it (Slice A2,
 * product lock: Final = Archangel, Scout = Crimson Oni). The Scout *mini* band
 * (Trial w5) grants nothing — it is the tutorial mini-boss. */
export const HERO_BY_BAND_KIND = {
  scout: 'oni',
  final: 'archangel',
} as const;
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

/** Trial catch-up XP multiplier (v16). Applied when the ACTIVE Avatar is more
 * than one level behind the highest owned Avatar and the fight phase is
 * Trial; Main (any wave) is always ×1. Tokens/drops are never touched. */
export const CATCHUP_XP_MULT = 2.5;

/** Risky merge (Dive-style, this step). Cap matches the StarTable's top row. */
export const MERGE_MAX_STAR = 5;
/**
 * Success % per current star (★0→1 70%, 1→2 55%, 2→3 40%, 3→4 28%, 4→5 18%)
 * and the per-star mult scale (+10% per star) are authored ONCE in the
 * StarTable (`engine/star-table.ts` ← `data/stars.json`). Dress shows the
 * honest next-star % and the store rolls merges from that same table — never a
 * flattened second copy.
 */

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
  /** v26 — a Snack buff rides this whole dive (−2 bust points). */
  snack?: boolean;
  /** Deeper presses survived so far (0 on the first find card, max 4 — 5
   * with Oxygen). */
  deepers: number;
  /** Find ids this run (items, food, shells, cosmetics — see dive-loot.ts).
   * Surface banks all of them; a bust loses them. */
  haul: string[];
  /** v22: a free dive's index that day (0 = first), or null for a charged
   * dive. Free dives keep only mood, shells and Logbook sightings. */
  free_n: number | null;
  /** v22: the next Deeper's find for each path, rolled in advance and saved
   * so the Lamp preview is exactly what you get (null = maxed / old save). */
  next: { safe: string; rich: string } | null;
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
 * `'trial' | 'main'`, Defend plays the seat's wave, Main wave 10 conquers a
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
 * v15 (Defend park) adds `avatar_park` — the Avatar's last dragged position
 * per map (board fractions 0..1), so re-entering Defend puts the Avatar where
 * the player left it instead of snapping to the old default.
 * v16 (Avatar swap) moves the Avatar (level/XP/stars/equipped) into per-id
 * `avatars[]` records with `active_avatar_id` naming who the board + Dress
 * use. Shared economy (bag `inventory`, `tokens`, `campaign`, Bound Bosses,
 * star tokens, uniques) stays at doc root. Each record carries its own
 * `park` (per map, board fractions) so swapping Avatars never yanks the board
 * position. Legacy root fields (xp / avatar_level / avatar_stars /
 * avatar_park) migrate into the starter record. The starter is always owned.
 * v21 (Dive + Pet loop, 2026-09-29) adds the solo expedition
 * (`pet_expedition`, `pet_expedition_ymd`, `pet_expedition_note`), the
 * `pet_logbook`, and `pet.deep_surfaces`. v20 saves open with all of them
 * empty (no expedition out, empty Logbook, 0 deep surfaces).
 * v22 (Dive + Pet main game, Part B) adds `shells`, `dive_gear`, the pet
 * `pet_pantry`, `pet_cosmetics` + `pet_wear`, the `pet_collection`, the
 * free-dive day counter, `pet.forms`, and `dive_run.free_n` / `.next`. v21
 * saves open with none of them (0 shells, no gear, empty pantry/wardrobe,
 * a Collection seeded from the Hall + the current pet).
 */

/** Campaign phase. `trial` (Grove Path, waves 1–5) then `main` (Divecore
 * Main, waves 1–10); a cleared Main 10 conquers a cycle and the seat resets
 * (Trial is skipped once `conquered_cycles ≥ 1`). */
export type CampaignPhase = 'trial' | 'main';

/** One Defend board map the Avatar can be parked on (mapId string, loose so
 * playStore never imports the board module). */
export type AvatarParkMapId = 'trial' | 'main';

/** Saved Avatar park position as board fractions (0..1). */
export type AvatarParkPoint = { x: number; y: number };

/** Map id → last dragged Avatar position. Absent = that map's MIDDLE default
 * once (then a drag saves it). */
export type AvatarPark = Partial<Record<AvatarParkMapId, AvatarParkPoint>>;

/** The default spawn — the MIDDLE of the board. Used for BOTH maps (Trial and
 * Main) when a map has no saved park yet (first-ever Defend, a Trial ↔ Main
 * switch, or a fresh Avatar), so new runs never snap to a corner or a tower
 * pad. A drag then saves the spot. */
export const DEFAULT_AVATAR_PARK: AvatarParkPoint = { x: 0.5, y: 0.5 };

/** The removed pre-v16 top-right default. A saved park equal to this is the
 * OLD weird corner, not a real drag — the migration drops it so the map falls
 * back to the MIDDLE instead of restoring it forever. */
const LEGACY_AVATAR_PARK: AvatarParkPoint = { x: 0.82, y: 0.12 };

/** Small epsilon for "is this point the old legacy default?" (float-safe). */
const PARK_EPSILON = 0.001;

/** The one spawn lookup BOTH maps share: a map's saved park, else the MIDDLE
 * default. No Trial/Main special case — same helper, same fallback. */
export function avatarParkFor(park: AvatarPark, mapId: AvatarParkMapId): AvatarParkPoint {
  return park[mapId] ?? DEFAULT_AVATAR_PARK;
}

/** Stable Avatar id (matches a row in `avatars.ts` / a future Hero def). */
export type AvatarId = string;

/** One owned Avatar (v16). Everything that differs per Avatar lives here;
 * the bag, tokens, campaign seat and Bound Bosses are shared at doc root. */
export type AvatarRecord = {
  /** Stable Avatar id (matches a row in `avatars.ts` / a future Hero def). */
  id: AvatarId;
  /** XP toward the next level, from Defend clears (this Avatar's own). */
  xp: number;
  /** Avatar meta level (start 1). +2% base wave_power per level. */
  level: number;
  /** Avatar stars earned (0..5) — +3% base wave_power each (§9h). */
  stars: number;
  /** Worn refs by slot — this Avatar's own 4 slots. Bag is shared. */
  equipped: Partial<Record<ItemSlot, ItemRef>>;
  /** Saved park per Defend map (board fractions) — restores this Avatar's
   * last spot on that map (empty = the map's middle default). */
  park: AvatarPark;
};

/** Roster row for the Dress picker / UI (read-model of `avatars[]`). */
export type AvatarRosterView = {
  id: AvatarId;
  level: number;
  stars: number;
  /** True when this Avatar is the active one (board + Dress use it). */
  active: boolean;
  /** True when this Avatar still earns Trial catch-up XP (one or more levels
   * behind the highest owned Avatar — `level ≤ highest − 1`). */
  catchup: boolean;
  /** Worn slots count (0..4) — per-Avatar equipped, bag is shared. */
  worn: number;
};

/** True when `level` still qualifies for Trial catch-up XP: at or below
 * `highestLevel - 1` (at least one level behind the top owned Avatar). The
 * moment it reaches the highest Avatar's level, XP is normal again. */
export function avatarCatchupEligible(level: number, highestLevel: number): boolean {
  return Math.max(1, Math.floor(level)) <= Math.max(1, Math.floor(highestLevel)) - 1;
}

/** A fresh default record for an Avatar id (level 1, no XP/stars, no gear,
 * no park — the park falls back to the map's middle until first drag). */
export function defaultAvatarRecord(id: AvatarId): AvatarRecord {
  return { id, xp: 0, level: 1, stars: 0, equipped: {}, park: {} };
}

/** The record for `id`, or the first record when `id` is unknown/corrupt. */
export function avatarRecordOf(doc: PlayStoreDoc, id: AvatarId): AvatarRecord {
  const found = doc.avatars.find((avatar) => avatar.id === id);
  return found ?? doc.avatars[0] ?? defaultAvatarRecord(STARTER_AVATAR_ID);
}

/** The active Avatar record — the one the board drags and Dress equips. */
export function activeAvatarOf(doc: PlayStoreDoc): AvatarRecord {
  return avatarRecordOf(doc, doc.active_avatar_id);
}

/** Highest level among OWNED Avatars (catch-up compares against this). */
export function highestAvatarLevel(doc: PlayStoreDoc): number {
  let highest = 1;
  for (const avatar of doc.avatars) highest = Math.max(highest, Math.max(1, avatar.level));
  return highest;
}

/** True when the ACTIVE Avatar currently earns Trial catch-up XP. */
export function activeAvatarCatchup(doc: PlayStoreDoc): boolean {
  const active = activeAvatarOf(doc);
  return avatarCatchupEligible(active.level, highestAvatarLevel(doc));
}

/** Replace one Avatar record (keeps array order; the starter can never be
 * removed, only its record updated). */
function replaceAvatarRecord(
  doc: PlayStoreDoc,
  id: AvatarId,
  record: AvatarRecord,
): PlayStoreDoc {
  const exists = doc.avatars.some((avatar) => avatar.id === id);
  return {
    ...doc,
    avatars: exists
      ? doc.avatars.map((avatar) => (avatar.id === id ? record : avatar))
      : [...doc.avatars, record],
  };
}

/** Patch the ACTIVE Avatar record with `patch` (the common write path for
 * every Avatar-only transition). */
export function patchActiveAvatar(
  doc: PlayStoreDoc,
  patch: Partial<Omit<AvatarRecord, 'id'>>,
): PlayStoreDoc {
  const active = activeAvatarOf(doc);
  return replaceAvatarRecord(doc, active.id, { ...active, ...patch });
}

/** Worn copies held by EVERY Avatar (the bag is shared, so "held" counts the
 * bag plus every Avatar's four slots — not just the active one's). */
export function wornCountAcrossAvatars(doc: PlayStoreDoc): number {
  let worn = 0;
  for (const avatar of doc.avatars) worn += wornItemCount(avatar.equipped);
  return worn;
}

/** Total owned items — bag stacks + every Avatar's worn copies. */
export function totalOwnedAcrossAvatars(doc: PlayStoreDoc): number {
  return bagItemCount(doc.inventory) + wornCountAcrossAvatars(doc);
}

/** Copies held per item id — the shared bag plus EVERY Avatar's worn gear.
 * The drop preview's honest "Owned ×N" reads this (an inactive Avatar's copy
 * still counts). */
export function ownedCountsAcross(doc: PlayStoreDoc): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stack of doc.inventory) {
    counts[stack.id] = (counts[stack.id] ?? 0) + stack.count;
  }
  for (const avatar of doc.avatars) {
    for (const ref of Object.values(avatar.equipped)) {
      if (ref) counts[ref.id] = (counts[ref.id] ?? 0) + 1;
    }
  }
  return counts;
}

/** Highest star tier held per item id (bag or any Avatar's worn copy) — the
 * drop preview's star-scaled stat line reads this. */
export function ownedBestStarsAcross(doc: PlayStoreDoc): Record<string, number> {
  const stars: Record<string, number> = {};
  for (const stack of doc.inventory) {
    stars[stack.id] = Math.max(stars[stack.id] ?? 0, stack.star);
  }
  for (const avatar of doc.avatars) {
    for (const ref of Object.values(avatar.equipped)) {
      if (ref) stars[ref.id] = Math.max(stars[ref.id] ?? 0, ref.star);
    }
  }
  return stars;
}

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
  /** Stable boss id (matches a row in `bound_bosses.json`). Since Slice A2
   * this may instead be a HERO id (heroes.json) bound as a tower — that hero's
   * tower def is A5/A6 content, so until it lands the id is def-less and no
   * def-driven read may assume `getBoundBossDef(id)` resolves. */
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
  version: 27;
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
  /** Active Dive run (null when no charge has been spent / run is over). */
  dive_run: DiveRun | null;
  /** Defend meta — highest wave cleared (start 0). Next wave = this + 1. */
  highest_wave_cleared: number;
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
  /** Unspent Avatar star tokens (shared wallet — spend on the ACTIVE Avatar). */
  avatar_star_tokens: number;
  /** The cycle's star has already rolled once this cycle (§9h once/cycle). */
  avatar_star_rolled_cycle: boolean;
  /** Final clears this cycle (pity guarantees the star on the 3rd). */
  final_clears_this_cycle: number;
  /** Unique item ids already granted (drop once, never again — §9i). */
  uniques: string[];
  /** Current cycle's boss tint (one family until ContentPack 2). */
  cycle_tint: TypeTag;
  /** Owned Avatars (v16) — every per-Avatar field lives on the record. The
   * bag/tokens/campaign/Bound Bosses above are shared across all of them. */
  avatars: AvatarRecord[];
  /** Which Avatar the board + Dress currently use (falls back to the first
   * record when the id is unknown/corrupt). */
  active_avatar_id: AvatarId;
  /** Soft-shop daily purchases (v17) — device-local day + per-row counts, so
   * a day-capped token row (e.g. the merge-fuel crate) can't be farmed. */
  shop_daily: ShopDaily;
  /** Heroes OWNED (v18, Slice A2) — hero ids from `heroes.json`. Seeded with
   * the starter hero (Corvus); a Final/Scout band clear adds its hero. */
  owned_hero_ids: string[];
  /** Which OWNED hero the Avatar is (v18, Slice A2). The Defend board draws
   * this hero's own sprite set (A3, `heroAvatarRole`), so this id names the art
   * AND the skill kit in play. */
  active_avatar_hero_id: string;
  /** One-shot "you own a hero" offer awaiting the player's decision (v18,
   * Slice A2). Set when a hero is first owned; the hero sheet shows it once and
   * every action (Avatar / bind / dismiss) clears it, so it can never re-fire
   * for an already-owned hero. */
  hero_offer: HeroOffer | null;
  /** The one active pet (v20, 2026-09-29) — see `pet.ts`. */
  pet: PetState;
  /** Retired pets, oldest first (v20). */
  pet_hall: PetHallEntry[];
  /** Rebirths so far — each is +2% permanent damage, capped at +10% (v20). */
  pet_rebirths: number;
  /** Mini-game tokens paid on `pet_tokens_ymd` (daily cap 30, v20). */
  pet_tokens_today: number;
  pet_tokens_ymd: string | null;
  /** Opt-in gentle hunger reminder (v20, default off). */
  pet_remind: boolean;
  /** Solo expedition out right now, or null (v21). */
  pet_expedition: PetExpedition | null;
  /** Device-local day the last expedition was sent (v21; v25 the ladder day). */
  pet_expedition_ymd: string | null;
  /** v25 — trips started on `pet_expedition_ymd` (the ladder step). */
  pet_expedition_steps: number;
  /** Item id the last expedition brought back, until the note is dismissed. */
  pet_expedition_note: string | null;
  /** The Play shell has already announced that return (once per return). */
  pet_expedition_toasted: boolean;
  /** Every find the pet's dives / expeditions made (v21, kept through rebirth). */
  pet_logbook: PetLogbook;
  /** v22 — Dive-gear currency (TD waves, dives, free dives). */
  shells: number;
  /** v22 — permanent Dive gear bought with shells. */
  dive_gear: DiveGearOwned;
  /** v22 — food found diving, at most PANTRY_MAX in total. */
  pet_pantry: Partial<Record<FoodId, number>>;
  /** v22 — owned pet cosmetics, and what the pet wears. */
  pet_cosmetics: string[];
  pet_wear: PetWear;
  /** v23 — Collection: per hero, every pet that has left (released / reborn):
   * copies (stars), shinies, grades and forms reached, and the 3★ dye switch.
   * The live pet is added on top in the view (`heroBookOf`). */
  pet_heroes: PetHeroBook;
  /** v23 — shards left by released / reborn pets, by grade. */
  pet_shards: Record<Grade, number>;
  /** v23 — trade-up tickets (5 shards → the next grade or better), by grade. */
  pet_tickets: Record<Grade, number>;
  /** v24 — Divecore settings: notifications, quiet hours, bedtime, chatter,
   * reveals, tutorial (see play-settings.ts). */
  play_settings: PlaySettings;
  /** v24 — Journal counters (counted from v24 on). */
  play_stats: PlayStats;
  /** v24 — claimed milestones, card ribbons, and heroes whose dye a milestone
   * unlocked early. */
  milestones: MilestoneId[];
  ribbons: Ribbon[];
  dye_unlocked: string[];
  /** v24 — every charge was spent since the last "charges full" notice. */
  charges_armed: boolean;
  /** v22 — free dives started on `free_dives_ymd` (shell fall-off). */
  free_dives_today: number;
  free_dives_ymd: string | null;
  /** v26 — medal buffs (uses left each). */
  buffs: Buffs;
  /** v26 — mini-game bests + medals per game per level. */
  game_records: GameRecords;
  /** v26 — the daily challenge (its day, bests and bonus flags). */
  daily_games: DailyGames;
  /** v26 — Powers banked from Divecore on `ymd` (the daily ceiling). */
  powers_today: { ymd: string | null; n: number };
  /* ---- v27 (Part D): the Den, egg pacing, Legendary pity, Shine Stones ---- */
  /** Resting pets (frozen — nothing ages them). The active pet is `pet`. */
  pet_den: PetState[];
  /** Den slots owned (the active pet counts as one; 6..12). */
  den_slots: number;
  /** Next Den id to hand out (a pet's `uid`). */
  pet_uid_next: number;
  /** Eggs picked on `eggs_ymd` (ticket eggs and "Change egg" not counted). */
  eggs_today: number;
  eggs_ymd: string | null;
  /** Eggs revealed since the last Legendary (any egg, tickets too). */
  eggs_since_legendary: number;
  /** Shine Stones held, misses since the last success (per player), Stones
   * ever used, and the seed of the saved Stone roll sequence. */
  shine_stones: number;
  glimmers: number;
  stones_used: number;
  stone_seq: number;
  /** Prism Stones — a Shop preview only; always 0 in this build. */
  prism_stones: number;
  /** Token-shop buys this week (Monday's YYYY-MM-DD), row id → count. */
  shop_weekly: ShopDaily;
};

/** A queued "hero owned" offer (Slice A2). `label` is the hero's display name
 * frozen at grant time, so the copy reads correctly even if a later content
 * pack renames the hero. */
export type HeroOffer = {
  hero_id: string;
  label: string;
};

/** Per-device-local-day shop purchase counts (v17). `ymd` mismatch = fresh. */
export type ShopDaily = {
  /** Device-local YYYY-MM-DD the counts belong to; null = never bought. */
  ymd: string | null;
  /** Token-shop row id → buys made that day. */
  counts: Record<string, number>;
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
  /** v22 — Dive-gear currency. */
  shells: number;
  /** v22 — Dive gear owned. */
  diveGear: DiveGearOwned;
  /** v22 — free dives started today (device-local). */
  freeDivesToday: number;
  dive: DiveChargeView;
  /** In-progress Dive run view (null run → not diving). */
  diveRun: DiveRunView;
  research: ResearchView;
  /** Daily tend bonus still available this device-local day. */
  tendBonusAvailable: boolean;
  /** Bagged copies stacked by (id, star) (worn excluded); Dress renders it. */
  inventory: readonly ItemStack[];
  /** Total owned items — bag + EVERY Avatar's worn copies (the bag is
   * shared, so an inactive Avatar's gear still counts toward the cap). */
  totalOwned: number;
  /** The ACTIVE Avatar's worn refs by slot; Dress renders it. */
  equipped: Readonly<Partial<Record<ItemSlot, ItemRef>>>;
  /** Raw additive mult sums from the ACTIVE Avatar's equipped items (§9c
   * same-stat adds, scaled +10% per worn star so a merged ★2 beats a ★1). */
  statSums: StatSums;
  /** The active Legend's element — every Avatar + hero attack uses it, and a
   * worn Power of the same element gets its stats raised (2026-09-28). */
  legendElement: Element;
  /** Owned Avatar roster (v16) — the Dress picker + catch-up badges read it. */
  avatars: readonly AvatarRosterView[];
  /** The Avatar the board + Dress currently use. */
  activeAvatarId: AvatarId;
  /** Active Avatar meta level (start 1) — drives the +2% wave_power HUD note. */
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
  /** Active Avatar stars earned (0..5). */
  avatarStars: number;
  /** Unspent Avatar star tokens (shared — spend on the active Avatar). */
  avatarStarTokens: number;
  /** This cycle's star already rolled (drives Final 25% + pity). */
  avatarStarRolledCycle: boolean;
  /** Final clears this cycle (pity fires on the 3rd). */
  finalClearsThisCycle: number;
  /** Unique item ids already granted (drop once). */
  uniques: readonly string[];
  /** Copies held per item id (bag + every Avatar's worn) — the drop preview's
   * "Owned ×N". */
  ownedCounts: Readonly<Record<string, number>>;
  /** Best star tier held per item id (bag or any Avatar's worn) — the drop
   * preview's star-scaled stat line. */
  ownedStars: Readonly<Record<string, number>>;
  /** Current cycle's boss tint. */
  cycleTint: TypeTag;
  /** Bound Bosses (fragments + stars) — the §9k tower roster. */
  boundBosses: readonly BoundBossView[];
  /** The ACTIVE Avatar's saved park per map (board fractions) — Defend
   * restores it. Empty map = the map's middle default until first drag. */
  avatarPark: AvatarPark;
  /** Token-shop buys made TODAY (device-local), row id → count. A stale stored
   * day reads as empty, so the shop's daily caps reset at local midnight. */
  shopCounts: Readonly<Record<string, number>>;
  /** v27 — token-shop buys made this week (the weekly caps). */
  shopWeekCounts: Readonly<Record<string, number>>;
  /** Heroes OWNED (Slice A2) — hero ids the player can set as Avatar or bind. */
  ownedHeroIds: readonly string[];
  /** The hero the player has set as their Avatar (Slice A2). Falls back to the
   * starter hero when the stored id is unknown/corrupt. */
  activeAvatarHeroId: string;
  /** Hero ids currently bound as towers (Slice A2) — the hero subset of
   * `boundBosses`, which is what the cap and the exclusivity rule read. */
  boundHeroIds: readonly string[];
  /** The queued "hero owned" offer awaiting a decision, or null. */
  heroOffer: HeroOffer | null;
  /** The pet as of now (aged through the clock guard, not yet saved). */
  pet: PetView;
  /** Rebirth damage bonus (0..0.10) — folds into every TD damage pass. */
  petRebirthBonus: number;
  /** v24 — Divecore settings, Journal, card ribbons, milestones. */
  settings: PlaySettings;
  stats: PlayStats;
  ribbons: readonly Ribbon[];
  milestones: { def: MilestoneDef; done: boolean; claimed: boolean }[];
  /** When the charges will be full again (null = full now), and whether all
   * were spent since the last "charges full" notice. */
  chargesFullAt: number | null;
  chargesArmed: boolean;
};

/** Read-model of the pet for the screens. */
export type PetView = {
  state: PetState;
  /** Time left in this stage (null at God). */
  stageLeftMs: number | null;
  /** Pounce damage at wave 1 (0 = no pounce yet). */
  pounceBase: number;
  /** Dive bust cut in percentage points, and finds kept on a bust. */
  bustCutPp: number;
  rescueKeep: number;
  /** Most-used Legend element (God aura), or null. */
  aura: Element | null;
  hall: readonly PetHallEntry[];
  rebirths: number;
  /** Mini-game tokens still available today. */
  tokensLeftToday: number;
  remind: boolean;
  /** Away on an expedition right now (v21) — every perk above reads 0. */
  away: boolean;
  /** Expedition status for the card: can go now / out / already went today /
   * too young (Egg, Baby). */
  expedition: 'ready' | 'away' | 'done_today' | 'locked';
  /** Counted time until it's back (only while away). */
  expeditionBackInMs: number | null;
  /** v25 — the current trip's length (null when home). */
  expeditionTripMs: number | null;
  /** v26 — the trip out's ladder length (before stage power / Focused). */
  expeditionStepMs: number | null;
  /** v25 — the next trip's length today (null = the ladder is done for today). */
  nextTripMs: number | null;
  /** v25 — trips started today (0-7). */
  tripsToday: number;
  /** "Your pet brought back X" — item id, until dismissed. */
  expeditionNote: string | null;
  /** That return still needs its one-time "Your pet is back" message. */
  expeditionNoteFresh: boolean;
  logbook: PetLogbook;
  /** v22 — food in the pantry, and its total (max PANTRY_MAX). */
  pantry: Partial<Record<FoodId, number>>;
  pantryTotal: number;
  /** v22 — owned cosmetics and what the pet wears. */
  cosmetics: readonly string[];
  wear: PetWear;
  /** v23 — the Collection (every pet that has left + this one once revealed). */
  heroes: PetHeroBook;
  /** v23 — shards and trade-up tickets, by grade. */
  shards: Record<Grade, number>;
  tickets: Record<Grade, number>;
  /** v23 — care score (0-100) and band: live in Egg/Baby, locked at Child. */
  careScore: number;
  careBand: CareBand;
  /** v23 — the odds can still move (Egg/Baby, not yet revealed). */
  oddsOpen: boolean;
  /** v23 — the grade odds for this pet right now (the ones the roll uses). */
  gradeOdds: Record<Grade, number>;
  /** v23 — the live pet wears its hero's 3★ dye. */
  dyeOn: boolean;
  /** v23 — Release is on offer (Child and up, not away). */
  canRelease: boolean;
  /** v26 — medal buffs (uses left), and Pumped's effect on the pounce right
   * now (`maxed` = a "Maxed aura": the cap leaves it nothing to add). */
  buffs: Buffs;
  pumped: PumpedState;
  /** v26 — what the pet's stage gives: bust points off (stage only, before
   * Deep/Snack), the lucky-upgrade chance, trip length share, better trips. */
  stagePower: { bustPp: number; lucky: number; tripMult: number; tripBetter: boolean };
  /** v26 — mini-game records, rank titles and today's daily challenge. */
  records: GameRecords;
  ranks: Record<'catch' | 'train', string>;
  daily: DailyGames;
  /** v27 — the Den: resting pets (frozen), slots owned / in use, the next
   * slot's price (null = at the most), and why a swap is blocked right now
   * (the mini-game overlay is added by the screen). */
  den: {
    resting: readonly PetState[];
    slots: number;
    used: number;
    nextSlotPrice: number | null;
    block: DenSwapBlock | null;
    /** Each resting pet's dye (by uid), the same rule as the active pet's. */
    dyeOn: Readonly<Record<number, boolean>>;
  };
  /** v27 — today's eggs (free, prices, the most). */
  eggDay: EggDayView;
  /** v27 — Legendary pity: eggs since the last Legendary, eggs until one is
   * certain (counting the next), and the Legendary % the NEXT picked egg
   * would roll with today's care band (the picker's odds). */
  pity: { since: number; untilLegendary: number; nextOdds: Record<Grade, number> };
  /** v27 — Shine Stones held, glimmers (5 = the next one is certain), Stones
   * ever used. */
  stones: { held: number; glimmers: number; used: number };
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
  /** The Safer path’s bust % (v22; before paths: the one %) — null when maxed. */
  bustPctNext: number | null;
  /** A Deeper press is still allowed. */
  canDeeper: boolean;
  /** Finds the pet saves if the next Deeper busts (0 = none). */
  rescueKeep: number;
  /** The pet is away on an expedition — not diving with you (v21). */
  petAway: boolean;
  /** v22 — exact bust % of the next Deeper for each path (null = maxed). */
  bustPct: Record<DivePath, number> | null;
  /** v22 — Deepers allowed this run (4, or 5 with Oxygen). */
  maxDeepers: number;
  /** v22 — this is a free dive (mood, shells, Logbook only). */
  free: boolean;
  /** v22 — Lamp: each path's next find (null without the Lamp). */
  preview: Record<DivePath, string> | null;
  /** v22 — Net: surfacing now adds one more find. */
  netOn: boolean;
  /** v22 — shells a free dive would pay if you surfaced now (null = charged). */
  freeShellsNow: number | null;
  /** v22 — no run and no charges: a free dive is on offer. */
  canFreeDive: boolean;
  /** v26 — a Snack buff rides this dive (its −2 is already in `bustPct`). */
  snack: boolean;
  /** v26 — Hearty meal uses left (+1 find on a charged surface). */
  hearty: number;
  /** v26 — Powers banked from Divecore today, and the daily ceiling. */
  powersToday: number;
  powersCap: number;
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
    version: 27,
    tokens: 0,
    dive_charge: DIVE_CHARGE_CAP, // start full; research claims can top back up
    dive_charge_at: now,
    research_started_at: now,
    research_accrued_ms: 0,
    last_tend_bonus_ymd: null,
    inventory: [],
    dive_run: null,
    highest_wave_cleared: 0,
    clears_today: 0,
    clears_ymd: null,
    milestone_waves_claimed: [],
    campaign: { phase: 'trial', wave_in_phase: 1 },
    conquered_cycles: 0,
    cycle_power: defaultCyclePower(),
    lifetime_waves_cleared: 0,
    bound_bosses: [],
    avatar_star_tokens: 0,
    avatar_star_rolled_cycle: false,
    final_clears_this_cycle: 0,
    uniques: [],
    cycle_tint: DEFAULT_CYCLE_TINT,
    avatars: [defaultAvatarRecord(STARTER_AVATAR_ID)],
    active_avatar_id: STARTER_AVATAR_ID,
    shop_daily: { ymd: null, counts: {} },
    // Slice A2: the starter hero is owned from the first launch, and starts as
    // the active Avatar hero (what `unit.avatar` already draws).
    owned_hero_ids: [DEFAULT_AVATAR_HERO_ID],
    active_avatar_hero_id: DEFAULT_AVATAR_HERO_ID,
    hero_offer: null,
    pet: newPet(now),
    pet_hall: [],
    pet_rebirths: 0,
    pet_tokens_today: 0,
    pet_tokens_ymd: null,
    pet_remind: false,
    pet_expedition: null,
    pet_expedition_ymd: null,
    pet_expedition_steps: 0,
    pet_expedition_note: null,
    pet_expedition_toasted: true,
    pet_logbook: {},
    shells: 0,
    dive_gear: { ...NO_DIVE_GEAR },
    pet_pantry: {},
    pet_cosmetics: [],
    pet_wear: { ...NO_WEAR },
    pet_heroes: {},
    pet_shards: emptyGradeCounts(),
    pet_tickets: emptyGradeCounts(),
    play_settings: defaultSettings(),
    play_stats: emptyStats(),
    milestones: [],
    ribbons: [],
    dye_unlocked: [],
    charges_armed: false,
    free_dives_today: 0,
    free_dives_ymd: null,
    buffs: { ...NO_BUFFS },
    game_records: emptyRecords(),
    daily_games: { ...EMPTY_DAILY },
    powers_today: { ymd: null, n: 0 },
    pet_den: [],
    den_slots: DEN_START_SLOTS,
    pet_uid_next: 1,
    eggs_today: 0,
    eggs_ymd: null,
    eggs_since_legendary: 0,
    shine_stones: 0,
    glimmers: 0,
    stones_used: 0,
    stone_seq: newEggSeed(),
    prism_stones: 0,
    shop_weekly: { ymd: null, counts: {} },
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
  const active = activeAvatarOf(doc);
  const highest = highestAvatarLevel(doc);
  return {
    tokens: doc.tokens,
    shells: doc.shells,
    diveGear: doc.dive_gear,
    freeDivesToday: freeDivesTodayOf(doc, now),
    dive: diveChargeAt(doc, now),
    diveRun: diveRunViewOf(doc, now),
    research: researchAt(doc, now),
    tendBonusAvailable: doc.last_tend_bonus_ymd !== localYmd(new Date(now)),
    inventory: doc.inventory,
    totalOwned: totalOwnedAcrossAvatars(doc),
    equipped: active.equipped,
    statSums: equippedStatSums(active.equipped, legendElementOf(active.id)),
    legendElement: legendElementOf(active.id),
    avatars: doc.avatars.map((avatar) => ({
      id: avatar.id,
      level: avatar.level,
      stars: avatar.stars,
      active: avatar.id === active.id,
      catchup: avatarCatchupEligible(avatar.level, highest),
      worn: wornItemCount(avatar.equipped),
    })),
    activeAvatarId: active.id,
    avatarLevel: active.level,
    clearsToday: doc.clears_today,
    campaign: doc.campaign,
    conqueredCycles: doc.conquered_cycles,
    cyclePower: doc.cycle_power,
    lifetimeWavesCleared: doc.lifetime_waves_cleared,
    avatarStars: active.stars,
    avatarStarTokens: doc.avatar_star_tokens,
    avatarStarRolledCycle: doc.avatar_star_rolled_cycle,
    finalClearsThisCycle: doc.final_clears_this_cycle,
    uniques: doc.uniques,
    ownedCounts: ownedCountsAcross(doc),
    ownedStars: ownedBestStarsAcross(doc),
    cycleTint: doc.cycle_tint,
    shopCounts:
      doc.shop_daily.ymd === localYmd(new Date(now)) ? doc.shop_daily.counts : {},
    shopWeekCounts: shopWeekCountsOf(doc, now),
    avatarPark: active.park,
    ownedHeroIds: doc.owned_hero_ids,
    activeAvatarHeroId: normalizedAvatarHeroId(doc),
    boundHeroIds: boundHeroIdsOf(doc),
    heroOffer: doc.hero_offer,
    pet: petViewOf(doc, now),
    petRebirthBonus: rebirthBonus(doc.pet_rebirths),
    settings: doc.play_settings,
    stats: doc.play_stats,
    ribbons: doc.ribbons,
    milestones: milestonesOf(doc, now),
    chargesFullAt: chargesFullAt(doc, now),
    chargesArmed: doc.charges_armed,
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

function diveRunViewOf(doc: PlayStoreDoc, now: number): DiveRunView {
  const run = doc.dive_run;
  // Same pet the Deeper roll will use: aged to now, and an expedition whose
  // time is up counts as home (the roll collects it first) — see `petAt`.
  const { pet, away } = petAt(doc, now);
  const rescueKeep = petRescueKeep(pet, away);
  const maxDeepers = diveMaxDeepers(doc);
  if (!run) {
    return {
      active: false,
      deepers: 0,
      haul: [],
      bustPct: null,
      bustPctNext: null,
      canDeeper: false,
      rescueKeep,
      petAway: away,
      maxDeepers,
      free: false,
      preview: null,
      netOn: false,
      freeShellsNow: null,
      canFreeDive: diveChargeAt(doc, now).current < 1,
      snack: doc.buffs.snack > 0,
      hearty: doc.buffs.hearty,
      powersToday: powersTodayOf(doc, now),
      powersCap: DIVECORE_POWERS_PER_DAY,
    };
  }
  const canDeeper = run.deepers < maxDeepers;
  const bustPct = canDeeper
    ? {
        safe: nextDeeperBustPct(doc, run, pet, away, 'safe'),
        rich: nextDeeperBustPct(doc, run, pet, away, 'rich'),
      }
    : null;
  return {
    active: true,
    deepers: run.deepers,
    haul: run.haul,
    bustPct,
    bustPctNext: bustPct ? bustPct.safe : null,
    canDeeper,
    rescueKeep: run.free_n != null ? 0 : rescueKeep,
    petAway: away,
    maxDeepers,
    free: run.free_n != null,
    preview: doc.dive_gear.lamp && canDeeper && run.next ? run.next : null,
    netOn: doc.dive_gear.net && run.deepers >= NET_MIN_DEPTH,
    freeShellsNow: run.free_n != null ? freeDiveShells(run.deepers, run.free_n) : null,
    canFreeDive: false,
    snack: run.snack === true,
    hearty: doc.buffs.hearty,
    powersToday: powersTodayOf(doc, now),
    powersCap: DIVECORE_POWERS_PER_DAY,
  };
}

/** Deepers allowed: 4, or 5 with Oxygen (v22). */
export function diveMaxDeepers(doc: PlayStoreDoc): number {
  return doc.dive_gear.oxygen ? DIVE_DEEPER_MAX_OXYGEN : DIVE_DEEPER_MAX;
}

/** The exact whole-% bust chance of the next Deeper on a path — one function
 * for the screen and the roll, so what is shown is always what is rolled. */
function nextDeeperBustPct(
  doc: PlayStoreDoc,
  run: DiveRun,
  pet: PetState,
  away: boolean,
  path: DivePath,
): number {
  const active = activeAvatarOf(doc);
  // v26: a Snack buff rides the whole dive; the half-table floor still holds.
  return effectiveBustPct(
    pathBaseBust(diveBustChanceAt(run.deepers), path),
    active.equipped,
    legendElementOf(active.id),
    petBustCutPp(pet, away) + (run.snack ? SNACK_BUST_PP : 0),
  );
}

function freeDivesTodayOf(doc: PlayStoreDoc, now: number): number {
  return doc.free_dives_ymd === localYmd(new Date(now)) ? doc.free_dives_today : 0;
}

/** Pre-roll the next Deeper's find on both paths (landing at `depth`). v26:
 * with the pet's lucky upgrade already in, so the Lamp shows what lands. */
function rollNext(
  doc: PlayStoreDoc,
  depth: number,
  rng: () => number,
  luck = 0,
): { safe: string; rich: string } | null {
  if (depth > diveMaxDeepers(doc)) return null;
  const oxygen = doc.dive_gear.oxygen;
  return {
    safe: rollTierLucky(pathTier(depth, 'safe', oxygen), luck, rng),
    rich: rollTierLucky(pathTier(depth, 'rich', oxygen), luck, rng),
  };
}

function pantryTotal(pantry: Partial<Record<FoodId, number>>): number {
  return Object.values(pantry).reduce<number>((a, n) => a + (n ?? 0), 0);
}

/** Powers banked from Divecore today (the v26 ceiling), by the token-cap day rule. */
export function powersTodayOf(doc: PlayStoreDoc, now: number): number {
  return petDayHolds(localYmd(new Date(now)), doc.powers_today.ymd) ? doc.powers_today.n : 0;
}

/** Bank finds of any kind: items to the bag, food to the pantry (a find that
 * doesn't fit is 1 shell), shells to the wallet, cosmetics to the wardrobe (a
 * duplicate is 5 shells). v26: Powers count toward the daily Divecore ceiling
 * (DIVECORE_POWERS_PER_DAY); each Power past it becomes POWER_OVERFLOW_SHELLS
 * shells. Returns the doc, the shells gained and the Powers converted. */
export function bankFinds(
  doc: PlayStoreDoc,
  ids: readonly string[],
  now: number = Date.now(),
): { doc: PlayStoreDoc; shells: number; powersConverted: number } {
  const items: string[] = [];
  const pantry = { ...doc.pet_pantry };
  const owned = [...doc.pet_cosmetics];
  const today = localYmd(new Date(now));
  const holds = petDayHolds(today, doc.powers_today.ymd);
  let powers = holds ? doc.powers_today.n : 0;
  let powersConverted = 0;
  let shells = 0;
  let stones = 0;
  for (const id of ids) {
    const kind = findKind(id);
    if (kind === 'item' && isPowerFind(id)) {
      if (powers < DIVECORE_POWERS_PER_DAY) {
        powers += 1;
        items.push(id);
      } else {
        powersConverted += 1;
        shells += POWER_OVERFLOW_SHELLS;
      }
    } else if (kind === 'item') items.push(id);
    else if (kind === 'food' && isFoodId(id)) {
      if (pantryTotal(pantry) < PANTRY_MAX) pantry[id] = (pantry[id] ?? 0) + 1;
      else shells += PANTRY_OVERFLOW_SHELLS;
    } else if (kind === 'shells') shells += shellsOf(id);
    else if (kind === 'stone') stones += 1;
    else if (kind === 'cosmetic') {
      if (owned.includes(id)) shells += COSMETIC_DUPE_SHELLS;
      else owned.push(id);
    }
  }
  return {
    doc: {
      ...doc,
      inventory: items.length > 0 ? addManyToBag(doc.inventory, items) : doc.inventory,
      pet_pantry: pantry,
      pet_cosmetics: owned,
      shells: doc.shells + shells,
      shine_stones: doc.shine_stones + stones,
      powers_today: { ymd: holds ? (doc.powers_today.ymd as string) : today, n: powers },
    },
    shells,
    powersConverted,
  };
}

/** Log a find the pet was there for (shells and Shine Stones are not Logbook
 * entries). */
function logFind(book: PetLogbook, id: string, depth: number): PetLogbook {
  const kind = findKind(id);
  return kind === 'shells' || kind === 'stone' ? book : logPetFind(book, id, depth);
}

/** A pet with its hero revealed, as a Collection entry (null before Child). */
function bookEntryOf(
  pet: PetState,
): { hero: string; grade: Grade; shiny: boolean; forms: string[]; style: ShinyStyle | null } | null {
  const hero = pet.hero ?? heroOfLine(pet.line);
  if (!hero || PET_STAGES.indexOf(pet.stage) < PET_STAGES.indexOf('child')) return null;
  return { hero, grade: pet.grade ?? 'common', shiny: pet.shiny, forms: pet.forms, style: pet.shiny_style };
}

/** The Collection: every pet that has left + the live pet and every Den pet
 * (once revealed) — v27: resting pets count too. */
export function heroBookOf(doc: PlayStoreDoc, pet: PetState = doc.pet): PetHeroBook {
  let book = doc.pet_heroes;
  for (const p of [pet, ...doc.pet_den]) {
    const entry = bookEntryOf(p);
    if (entry) book = addToBook(book, entry);
  }
  return book;
}

/** Does the live pet wear its hero's 3★ dye? (Never on a shiny.) */
export function petDyeOn(doc: PlayStoreDoc, pet: PetState = doc.pet): boolean {
  const hero = pet.hero ?? heroOfLine(pet.line);
  if (!hero || PET_STAGES.indexOf(pet.stage) < PET_STAGES.indexOf('child')) return false;
  const rec = heroBookOf(doc, pet)[hero];
  const stars = doc.dye_unlocked.includes(hero) ? DYE_STARS : heroStars(rec?.copies ?? 0);
  return dyeApplies(stars, rec?.dye ?? false, pet.shiny);
}

/** A hero's dye is unlocked: 3★, or early by a milestone. */
export function heroDyeUnlocked(doc: PlayStoreDoc, hero: string, book: PetHeroBook = heroBookOf(doc)): boolean {
  return doc.dye_unlocked.includes(hero) || heroStars(book[hero]?.copies ?? 0) >= DYE_STARS;
}

/** Pumped's effect on the pounce right now (v26). */
export function pumpedStateOf(doc: PlayStoreDoc, now: number): PumpedState {
  const { pet, away } = petAt(doc, now);
  return pumpedPounce(petPounceBase(pet, away), doc.buffs.pumped);
}

/** The pet aged to `now`, and whether it is still away. An expedition whose
 * time is up counts as home here — every transition collects it first
 * (`touchPet`), so the view and the rolls agree. */
export function petAt(doc: PlayStoreDoc, now: number): { pet: PetState; away: boolean } {
  const pet = advancePet(doc.pet, now);
  const away = doc.pet_expedition != null && expeditionLeftMs(pet, doc.pet_expedition) > 0;
  return { pet, away };
}

/** The pet as of `now` for the screens (aged, not saved). */
function petViewOf(doc: PlayStoreDoc, now: number): PetView {
  const { pet, away } = petAt(doc, now);
  const today = localYmd(new Date(now));
  const block: PetExpeditionBlock | null = away
    ? 'away'
    : expeditionBlock(pet, null, today, doc.pet_expedition_ymd, doc.pet_expedition_steps);
  const stepsToday = expeditionStepsToday(today, doc.pet_expedition_ymd, doc.pet_expedition_steps);
  return {
    state: pet,
    stageLeftMs: petStageLeftMs(pet),
    // v26: the pounce TD uses, Pumped included (capped; see play-buffs.ts).
    pounceBase: pumpedPounce(petPounceBase(pet, away), doc.buffs.pumped).pounce,
    bustCutPp: petBustCutPp(pet, away),
    rescueKeep: petRescueKeep(pet, away),
    aura: petAuraElement(pet),
    hall: doc.pet_hall,
    rebirths: doc.pet_rebirths,
    tokensLeftToday: petTokensLeft(today, doc.pet_tokens_ymd, doc.pet_tokens_today),
    remind: doc.pet_remind,
    away,
    expedition:
      block == null ? 'ready' : block === 'away' ? 'away' : block === 'done_today' ? 'done_today' : 'locked',
    expeditionBackInMs: away && doc.pet_expedition ? expeditionLeftMs(pet, doc.pet_expedition) : null,
    expeditionTripMs: doc.pet_expedition ? doc.pet_expedition.len_ms : null,
    // v26: the REAL next trip (stage power + a waiting Focused), and the
    // ladder length of the trip out (the phone notice is per ladder step).
    nextTripMs: stepsToday < EXPEDITION_STEPS ? tripLengthMs(stepsToday, pet, doc.buffs.focused > 0) : null,
    expeditionStepMs: doc.pet_expedition
      ? doc.pet_expedition.step >= 0
        ? expeditionLengthMs(doc.pet_expedition.step)
        : doc.pet_expedition.len_ms
      : null,
    tripsToday: stepsToday,
    expeditionNote: doc.pet_expedition_note,
    expeditionNoteFresh: doc.pet_expedition_note != null && !doc.pet_expedition_toasted,
    logbook: doc.pet_logbook,
    pantry: doc.pet_pantry,
    pantryTotal: pantryTotal(doc.pet_pantry),
    cosmetics: doc.pet_cosmetics,
    wear: doc.pet_wear,
    heroes: heroBookOf(doc, pet),
    shards: doc.pet_shards,
    tickets: doc.pet_tickets,
    careScore: petCareScore(pet),
    careBand: petCareBand(pet),
    oddsOpen: petOddsOpen(pet),
    gradeOdds: gradeOdds(petCareBand(pet), pet.ticket, pet.pity_from),
    dyeOn: petDyeOn(doc, pet),
    canRelease: canReleasePet(pet) && !away,
    buffs: doc.buffs,
    pumped: pumpedPounce(petPounceBase(pet, away), doc.buffs.pumped),
    stagePower: {
      bustPp: PET_BUST_CUT_PP[pet.stage],
      lucky: PET_LUCKY_UPGRADE[pet.stage],
      tripMult: petTripMult(pet),
      tripBetter: petTripBetter(pet),
    },
    records: doc.game_records,
    ranks: { catch: rankTitle(doc.game_records, 'catch'), train: rankTitle(doc.game_records, 'train') },
    daily: dailyFor(doc.daily_games, today),
    den: {
      resting: doc.pet_den,
      slots: doc.den_slots,
      used: denUsed(doc.pet_den),
      nextSlotPrice: denSlotPrice(doc.den_slots),
      block: denSwapBlock({ diving: doc.dive_run != null, away, gameOpen: false, active: doc.pet }),
      dyeOn: Object.fromEntries(doc.pet_den.map((p) => [p.uid, petDyeOn(doc, p)])),
    },
    eggDay: eggDayOf(doc, now),
    pity: {
      since: doc.eggs_since_legendary,
      untilLegendary: eggsUntilLegendary(doc.eggs_since_legendary),
      nextOdds: gradeOdds(petCareBand(pet), null, doc.eggs_since_legendary),
    },
    stones: { held: doc.shine_stones, glimmers: doc.glimmers, used: doc.stones_used },
  };
}

/* ---------------------------------------------------------------------------
 * Pet (v20, 2026-09-29) — doc-level transitions. The rules live in `pet.ts`;
 * every transition first ages the pet to `now` through the clock guard, so the
 * saved `seen_at` high-water mark moves with each write.
 * ------------------------------------------------------------------------- */

/** Age the pet to now and save the new high-water mark (app open), and
 * collect an expedition whose time is up: one find to the bag, a Logbook
 * entry (depth 0), and the "brought back" note (v21). Returns
 * the same doc when nothing changed. */
export function touchPet(
  doc: PlayStoreDoc,
  now: number,
  rng: () => number = Math.random,
): PlayStoreDoc {
  const pet = advancePet(doc.pet, now);
  // v24 Journal: a hatch or a reveal that happened in this aging, and a day
  // played; v27 the pity counter at a reveal and the every-5th-day Stone.
  doc = countPlayDay(settlePetAging(doc, doc.pet, pet), now);
  const armed = doc.charges_armed && !diveChargeAt(doc, now).full;
  if (armed !== doc.charges_armed) doc = { ...doc, charges_armed: armed };
  const exp = doc.pet_expedition;
  if (exp && expeditionLeftMs(pet, exp) <= 0) {
    // A solo dive: it can't bust, it always brings back one find — what, by
    // the ladder step (v25): food/shells early, finds later, a chance of a
    // Power only on the 2h and 4h trips (a trip from before keeps the old rule).
    const find = rollExpeditionReward(exp.step, rng, exp.better === true);
    const bankedRes = bankFinds({ ...doc, pet }, [find], now);
    const banked = bankedRes.doc;
    return {
      ...banked,
      pet_expedition: null,
      // v26: a Power past today's ceiling came back as shells — say so.
      pet_expedition_note: bankedRes.powersConverted > 0 ? `shells_${POWER_OVERFLOW_SHELLS}` : find,
      pet_expedition_toasted: false,
      pet_logbook: logFind(doc.pet_logbook, find, 0),
    };
  }
  return pet === doc.pet ? doc : { ...doc, pet };
}

/** v27: did this aging reveal an egg's pet (Baby → Child)? */
function revealedIn(prev: PetState, next: PetState): boolean {
  const child = PET_STAGES.indexOf('child');
  return prev.egg != null && PET_STAGES.indexOf(prev.stage) < child && PET_STAGES.indexOf(next.stage) >= child && next.grade != null;
}

/** Everything that rides on one aging of the ACTIVE pet (the only pet that
 * ever ages): the Journal's hatch / reveal tally and, at a reveal, the
 * Legendary pity counter (+1, or back to 0 on a Legendary). Does not store
 * `next` — the caller does. */
function settlePetAging(doc: PlayStoreDoc, prev: PetState, next: PetState): PlayStoreDoc {
  const stats = tallyPet(doc.play_stats, prev, next);
  const since = revealedIn(prev, next)
    ? pityAfterReveal(doc.eggs_since_legendary, next.grade as Grade)
    : doc.eggs_since_legendary;
  if (stats === doc.play_stats && since === doc.eggs_since_legendary) return doc;
  return { ...doc, play_stats: stats, eggs_since_legendary: since };
}

/** The Journal + pity fields after aging the active pet to `now`. */
function settledPetFields(doc: PlayStoreDoc, now: number): Pick<PlayStoreDoc, 'play_stats' | 'eggs_since_legendary'> {
  const settled = settlePetAging(doc, doc.pet, advancePet(doc.pet, now));
  return { play_stats: settled.play_stats, eggs_since_legendary: settled.eggs_since_legendary };
}

/** A day played (the Journal), and a Shine Stone on every 5th one (v27). */
function countPlayDay(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  const stats = countDay(doc.play_stats, localYmd(new Date(now)));
  if (stats === doc.play_stats) return doc;
  const stone = stats.days_played > doc.play_stats.days_played && stats.days_played % STONE_EVERY_DAYS === 0;
  return { ...doc, play_stats: stats, shine_stones: doc.shine_stones + (stone ? 1 : 0) };
}

export type ExpeditionSendResult = { ok: true } | { ok: false; reason: PetExpeditionBlock };

/** Send the pet on its next expedition of the day (Child and up) — each
 * trip longer than the last: 1m → 5m → 15m → 30m → 1h → 2h → 4h, then done
 * until the local day reset (v25). */
export function sendPetExpedition(
  doc: PlayStoreDoc,
  now: number,
): { doc: PlayStoreDoc; result: ExpeditionSendResult } {
  const touched = touchPet(doc, now);
  const today = localYmd(new Date(now));
  const block = expeditionBlock(
    touched.pet,
    touched.pet_expedition,
    today,
    touched.pet_expedition_ymd,
    touched.pet_expedition_steps,
  );
  if (block) return { doc: touched, result: { ok: false, reason: block } };
  const step = expeditionStepsToday(today, touched.pet_expedition_ymd, touched.pet_expedition_steps);
  // v26: stage power shortens the trip (Teen 90% · Adult 80% · God 70%) and
  // Adult/God bring back one step better; a Focused buff takes 25% more off.
  // Fixed now, so evolving or a clock change mid-trip can't change it.
  const focused = touched.buffs.focused > 0;
  const len = tripLengthMs(step, touched.pet, focused);
  return {
    doc: {
      ...touched,
      buffs: focused ? spendBuff(touched.buffs, 'focused') : touched.buffs,
      pet_expedition: { left_age_ms: touched.pet.total_age_ms, len_ms: len, step, better: petTripBetter(touched.pet) },
      pet_expedition_ymd: today,
      pet_expedition_steps: step + 1,
      play_stats: { ...touched.play_stats, expeditions: touched.play_stats.expeditions + 1 },
    },
    result: { ok: true },
  };
}

/** v26: a trip's real length — the ladder step × stage power × Focused. No
 * floor above a second, so "25% shorter" is true even on the 1-minute trip. */
export function tripLengthMs(step: number, pet: PetState, focused: boolean): number {
  return Math.max(1000, Math.round(expeditionLengthMs(step) * petTripMult(pet) * (focused ? FOCUSED_TRIP_MULT : 1)));
}

/** Clear the "Your pet brought back X" note. */
export function dismissExpeditionNote(doc: PlayStoreDoc): PlayStoreDoc {
  return doc.pet_expedition_note == null
    ? doc
    : { ...doc, pet_expedition_note: null, pet_expedition_toasted: true };
}

/** The shell has shown "Your pet is back" for this return (once per return). */
export function markExpeditionToasted(doc: PlayStoreDoc): PlayStoreDoc | null {
  return doc.pet_expedition_toasted ? null : { ...doc, pet_expedition_toasted: true };
}

/** Feed one food from the pantry (v22) — only when you tap Feed. Null when
 * refused: egg, away, already full, or none of that food. */
export function feedFromPantry(doc: PlayStoreDoc, now: number, food: FoodId): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  const { away } = petAt(touched, now);
  const have = touched.pet_pantry[food] ?? 0;
  if (away || touched.pet.stage === 'egg' || have < 1 || touched.pet.hunger >= PET_METER_MAX) return null;
  return {
    ...touched,
    pet: petCareAct(feedPet(touched.pet, FOODS[food].hearts), CARE_ACT.fed),
    pet_pantry: { ...touched.pet_pantry, [food]: have - 1 },
  };
}

export type CosmeticBuyResult = { ok: true } | { ok: false; reason: 'not_for_sale' | 'owned' | 'tokens' };

/** Buy a Wardrobe cosmetic with tokens (v22 token sink). */
export function buyCosmetic(doc: PlayStoreDoc, id: string): { doc: PlayStoreDoc; result: CosmeticBuyResult } {
  const def = cosmeticById(id);
  if (!def || def.price == null) return { doc, result: { ok: false, reason: 'not_for_sale' } };
  if (doc.pet_cosmetics.includes(id)) return { doc, result: { ok: false, reason: 'owned' } };
  if (doc.tokens < def.price) return { doc, result: { ok: false, reason: 'tokens' } };
  return {
    doc: { ...doc, tokens: doc.tokens - def.price, pet_cosmetics: [...doc.pet_cosmetics, id] },
    result: { ok: true },
  };
}

/** Wear an owned cosmetic in its slot, or take a slot off (`id` null). */
export function wearCosmetic(doc: PlayStoreDoc, slot: CosmeticSlot, id: string | null): PlayStoreDoc | null {
  if (id != null) {
    const def = cosmeticById(id);
    if (!def || def.slot !== slot || !doc.pet_cosmetics.includes(id)) return null;
  }
  if (doc.pet_wear[slot] === id) return null;
  return { ...doc, pet_wear: { ...doc.pet_wear, [slot]: id } };
}

export type DiveGearBuyResult = { ok: true } | { ok: false; reason: 'owned' | 'shells' | 'diving' };

/** Buy a permanent piece of Dive gear with shells (v22). */
export function buyDiveGear(doc: PlayStoreDoc, gear: DiveGear): { doc: PlayStoreDoc; result: DiveGearBuyResult } {
  if (doc.dive_gear[gear]) return { doc, result: { ok: false, reason: 'owned' } };
  // Not mid-dive: the run's pre-rolled next finds (Lamp) and its depth limit
  // were set with the gear it started with, so new gear starts next dive.
  if (doc.dive_run) return { doc, result: { ok: false, reason: 'diving' } };
  const cost = DIVE_GEAR_COST[gear];
  if (doc.shells < cost) return { doc, result: { ok: false, reason: 'shells' } };
  return {
    doc: { ...doc, shells: doc.shells - cost, dive_gear: { ...doc.dive_gear, [gear]: true } },
    result: { ok: true },
  };
}

/** Dev kit: +100 shells. */
export function devAddShells(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, shells: doc.shells + 100 };
}

/* ---------------------------------------------------------------------------
 * Eggs (v23, 2026-09-30) — see `pet-eggs.ts` for the rules and odds.
 * ------------------------------------------------------------------------- */

/** Eggs picked today (by the day rule — a clock set back can't reopen them). */
function eggsTodayOf(doc: PlayStoreDoc, now: number): number {
  return petDayHolds(localYmd(new Date(now)), doc.eggs_ymd) ? doc.eggs_today : 0;
}

/** Today's egg pacing for the picker (v27): eggs used, the free allowance
 * (2, or 3 once today's daily challenge is passed), the next egg's price
 * (0 = free, null = none left today) and the day's most. A ticket egg or a
 * "Change egg" blank brings its own egg — `prepaid` says so. */
export type EggDayView = {
  used: number;
  free: number;
  dailyEgg: boolean;
  nextPrice: number | null;
  max: number;
  prepaid: boolean;
};

export function eggDayOf(doc: PlayStoreDoc, now: number): EggDayView {
  const used = eggsTodayOf(doc, now);
  const dailyEgg = dailyFor(doc.daily_games, localYmd(new Date(now))).egg;
  return {
    used,
    free: FREE_EGGS_PER_DAY + (dailyEgg ? DAILY_EGG_BONUS : 0),
    dailyEgg,
    nextPrice: nextEggPrice(used, dailyEgg),
    max: EGGS_PER_DAY_MAX,
    prepaid: isBlankSlot(doc.pet) && doc.pet.prepaid,
  };
}

export type EggPickRefusal = 'not_blank' | 'ticket' | 'no_eggs_left' | 'shells';

/** What picking an egg now would cost, or why it can't: a ticket egg and a
 * "Change egg" blank are free and don't count; otherwise today's pacing. */
export function eggPickCost(
  doc: PlayStoreDoc,
  now: number,
  ticket: Grade | null,
): { ok: true; shells: number; counts: boolean } | { ok: false; reason: EggPickRefusal } {
  if (!isBlankSlot(doc.pet)) return { ok: false, reason: 'not_blank' };
  if (ticket != null && (ticket === 'common' || doc.pet_tickets[ticket] < 1)) return { ok: false, reason: 'ticket' };
  if (ticket != null || doc.pet.prepaid) return { ok: true, shells: 0, counts: false };
  const price = eggDayOf(doc, now).nextPrice;
  if (price == null) return { ok: false, reason: 'no_eggs_left' };
  if (doc.shells < price) return { ok: false, reason: 'shells' };
  return { ok: true, shells: price, counts: true };
}

/** Choose an egg from the empty picker, optionally spending a trade-up ticket
 * (the grade can't roll below it). The seed is stored now, and the pity
 * position stamped. v27: today's free eggs first, then shells, at most six a
 * day. Null when refused. */
export function chooseEggDoc(
  doc: PlayStoreDoc,
  now: number,
  egg: EggType,
  ticket: Grade | null,
  rng: () => number = Math.random,
): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  const cost = eggPickCost(touched, now, ticket);
  if (!cost.ok) return null;
  const chosen = chooseEgg(touched.pet, egg, newEggSeed(rng), ticket, now);
  if (!chosen) return null;
  const today = localYmd(new Date(now));
  const holds = petDayHolds(today, touched.eggs_ymd);
  const used = holds ? touched.eggs_today : 0;
  const uid = Math.max(1, touched.pet_uid_next);
  return {
    ...touched,
    pet: { ...chosen, uid, pity_from: touched.eggs_since_legendary },
    pet_uid_next: uid + 1,
    shells: touched.shells - cost.shells,
    eggs_today: used + (cost.counts ? 1 : 0),
    eggs_ymd: holds ? touched.eggs_ymd : today,
    pet_tickets: ticket ? { ...touched.pet_tickets, [ticket]: touched.pet_tickets[ticket] - 1 } : touched.pet_tickets,
  };
}

/** Tap the egg: +1 warmth (max 4). */
export function warmEggDoc(doc: PlayStoreDoc, now: number): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  const pet = warmEgg(touched.pet);
  return pet ? { ...touched, pet } : null;
}

/** The reveal animations were shown. */
export function ackPetRevealsDoc(doc: PlayStoreDoc, now: number): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  if (touched.pet.reveals.length === 0) return touched === doc ? null : touched;
  return { ...touched, pet: ackPetReveals(touched.pet) };
}

/** A pet leaving (release / rebirth): into the Collection, and a shard of
 * its grade (none before Child — the callers refuse that). */
function recordLeaving(doc: PlayStoreDoc, pet: PetState): Pick<PlayStoreDoc, 'pet_heroes' | 'pet_shards'> {
  const entry = bookEntryOf(pet);
  if (!entry) return { pet_heroes: doc.pet_heroes, pet_shards: doc.pet_shards };
  return {
    pet_heroes: addToBook(doc.pet_heroes, entry),
    pet_shards: { ...doc.pet_shards, [entry.grade]: doc.pet_shards[entry.grade] + 1 },
  };
}

/** Release a Child-or-older pet: Hall + Collection + 1 shard of its grade, no
 * rebirth bonus, back to the egg picker. Not while away. Null when refused. */
export function releasePetDoc(doc: PlayStoreDoc, now: number): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  if (touched.pet_expedition) return null;
  const next = releasePet(touched.pet, touched.pet_hall, touched.pet_rebirths, now);
  if (!next) return null;
  return {
    ...touched,
    ...recordLeaving(touched, touched.pet),
    pet: next.pet,
    pet_hall: next.hall,
    play_stats: { ...touched.play_stats, releases: touched.play_stats.releases + 1 },
  };
}

/** Trade 5 shards of a grade for a ticket of the next grade (or better). */
export function tradeUpShards(doc: PlayStoreDoc, grade: Grade): PlayStoreDoc | null {
  const up = nextGrade(grade);
  if (!up || doc.pet_shards[grade] < SHARDS_PER_TICKET) return null;
  return {
    ...doc,
    pet_shards: { ...doc.pet_shards, [grade]: doc.pet_shards[grade] - SHARDS_PER_TICKET },
    pet_tickets: { ...doc.pet_tickets, [up]: doc.pet_tickets[up] + 1 },
  };
}

/** Wear / take off a hero's 3★ dye (it never shows on a shiny). */
export function setHeroDye(doc: PlayStoreDoc, now: number, hero: string, on: boolean): PlayStoreDoc | null {
  const book = heroBookOf(doc, advancePet(doc.pet, now));
  if (!heroDyeUnlocked(doc, hero, book)) return null;
  const rec = doc.pet_heroes[hero] ?? EMPTY_HERO_RECORD;
  return { ...doc, pet_heroes: { ...doc.pet_heroes, [hero]: { ...rec, dye: on } } };
}

/** Dev kit: hatch now / reveal now — the end of the Egg or Baby stage. */
export function devPetEndStage(doc: PlayStoreDoc, now: number, stage: 'egg' | 'baby'): PlayStoreDoc {
  const pet = advancePet(doc.pet, now);
  if (pet.stage !== stage || pet.egg == null) {
    return { ...settlePetAging(doc, doc.pet, pet), pet };
  }
  const next = advancePet({ ...pet, stage_age_ms: PET_STAGE_MS[stage] - 1, seen_at: now - 1 }, now);
  return { ...settlePetAging(doc, doc.pet, next), pet: next };
}

/** Dev kit: force the grade / shiny. Before Child it pre-locks the result
 * (the hero from the seed), so the reveal shows it. */
export function devPetForce(doc: PlayStoreDoc, now: number, force: { grade?: Grade; shiny?: boolean }): PlayStoreDoc {
  const pet = advancePet(doc.pet, now);
  if (pet.egg == null) return { ...doc, pet };
  const hero = pet.hero ?? rollPetHero(pet);
  return {
    ...doc,
    pet: {
      ...pet,
      hero,
      grade: force.grade ?? pet.grade ?? 'common',
      shiny: force.shiny ?? pet.shiny,
      shiny_style: (force.shiny ?? pet.shiny) ? (pet.shiny_style ?? 'classic') : null,
      band: pet.band ?? petCareBand(pet),
    },
  };
}

function rollPetHero(pet: PetState): string {
  // Same first draw `rollPet` makes: the seed's hero.
  return rollPetFor(pet).hero;
}

function rollPetFor(pet: PetState) {
  return rollPet(pet.seed, pet.egg ?? 'knight', petCareBand(pet), pet.ticket, pet.pity_from);
}

/** Dev kit: set the Egg/Baby care to land in a band. */
export function devPetSetBand(doc: PlayStoreDoc, now: number, band: CareBand): PlayStoreDoc {
  const pet = advancePet(doc.pet, now);
  const eggMs = PET_STAGE_MS.egg;
  const set = {
    poor: { warm_ms: 0, care_skill: 0, care_acts: 0 },
    good: { warm_ms: eggMs, care_skill: 0, care_acts: 0 },
    great: { warm_ms: eggMs, care_skill: 12, care_acts: CARE_ACT.fed },
    perfect: { warm_ms: eggMs, care_skill: 25, care_acts: CARE_ACT.fed | CARE_ACT.trained | CARE_ACT.dived },
  }[band];
  return { ...doc, pet: { ...pet, ...set } };
}

/** Dev kit: +5 shards of a grade. */
export function devGiveShards(doc: PlayStoreDoc, grade: Grade): PlayStoreDoc {
  return { ...doc, pet_shards: { ...doc.pet_shards, [grade]: doc.pet_shards[grade] + SHARDS_PER_TICKET } };
}

/** Dev kit: empty the Collection, shards and tickets. */
export function devResetCollection(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, pet_heroes: {}, pet_shards: emptyGradeCounts(), pet_tickets: emptyGradeCounts() };
}

/* ---------------------------------------------------------------------------
 * Menus + settings (v24, 2026-09-30) — see play-settings.ts.
 * ------------------------------------------------------------------------- */

/** Journal: a hatch or a reveal between two ages of the same pet. */
export function tallyPet(stats: PlayStats, prev: PetState, next: PetState): PlayStats {
  let out = stats;
  if (prev.stage === 'egg' && prev.egg != null && next.stage !== 'egg') {
    out = { ...out, eggs_hatched: out.eggs_hatched + 1 };
  }
  if (prev.hero == null && next.hero != null && next.band != null && next.grade != null) {
    out = {
      ...out,
      pulled: { ...out.pulled, [next.grade]: out.pulled[next.grade] + 1 },
      shinies: out.shinies + (next.shiny ? 1 : 0),
    };
  }
  return out;
}

/** When the dive charges will be full again (null = full now). */
export function chargesFullAt(doc: PlayStoreDoc, now: number): number | null {
  const dive = diveChargeAt(doc, now);
  if (dive.full || dive.nextChargeAt == null) return null;
  return dive.nextChargeAt + (DIVE_CHARGE_CAP - dive.current - 1) * DIVE_CHARGE_REFILL_MS;
}

function milestoneInputOf(doc: PlayStoreDoc, now: number) {
  const book = heroBookOf(doc, advancePet(doc.pet, now));
  const recs = Object.values(book);
  return {
    heroesFound: recs.filter((r) => r.copies > 0).length,
    anyEpic: recs.some((r) => r.grades.includes('epic')),
    anyLegendary: recs.some((r) => r.grades.includes('legendary')),
    anyShiny: recs.some((r) => r.shinies > 0),
    anyFiveStar: recs.some((r) => heroStars(r.copies) >= 5),
    eggsHatched: doc.play_stats.eggs_hatched,
    insaneGold: doc.game_records.catch.insane.medal === 'gold' || doc.game_records.train.insane.medal === 'gold',
  };
}

export function milestonesOf(doc: PlayStoreDoc, now: number): { def: MilestoneDef; done: boolean; claimed: boolean }[] {
  const input = milestoneInputOf(doc, now);
  return MILESTONES.map((def) => ({ def, done: def.done(input), claimed: doc.milestones.includes(def.id) }));
}

/** Claim a reached milestone's reward (once). Rewards are looks / egg-grade
 * only: tickets, Wardrobe cosmetics, a dye unlocked early, a card ribbon. */
export function claimMilestone(doc: PlayStoreDoc, now: number, id: MilestoneId): PlayStoreDoc | null {
  const def = MILESTONES.find((m) => m.id === id);
  if (!def || doc.milestones.includes(id) || !def.done(milestoneInputOf(doc, now))) return null;
  const ticket = (d: PlayStoreDoc, g: Grade): PlayStoreDoc => ({ ...d, pet_tickets: { ...d.pet_tickets, [g]: d.pet_tickets[g] + 1 } });
  let next: PlayStoreDoc = { ...doc, milestones: [...doc.milestones, id] };
  const r = def.reward;
  const stones = (def.stones ?? 0) + (r.kind === 'stone' ? 1 : 0);
  if (stones > 0) next = { ...next, shine_stones: next.shine_stones + stones };
  if (r.kind === 'ticket') next = ticket(next, r.grade);
  if (r.kind === 'cosmetic') {
    next = next.pet_cosmetics.includes(r.id) ? ticket(next, r.fallback) : { ...next, pet_cosmetics: [...next.pet_cosmetics, r.id] };
  }
  if (r.kind === 'dye') {
    const book = heroBookOf(doc, advancePet(doc.pet, now));
    const hero = Object.keys(book).find((h) => book[h].grades.includes('legendary'));
    next = {
      ...next,
      dye_unlocked: hero && !next.dye_unlocked.includes(hero) ? [...next.dye_unlocked, hero] : next.dye_unlocked,
      ribbons: next.ribbons.includes('legend') ? next.ribbons : [...next.ribbons, 'legend'],
    };
  }
  if (r.kind === 'ribbon') {
    next = { ...next, ribbons: next.ribbons.includes(r.ribbon) ? next.ribbons : [...next.ribbons, r.ribbon] };
    if (r.plus) next = ticket(next, r.plus);
  }
  return next;
}

/** Change egg (menu): only while it is still an egg. Back to the egg picker —
 * the next egg gets a fresh seed. Nothing from the old seed was ever rolled
 * or shown (the roll happens at Child), and a spent ticket is refunded. */
export function changeEggDoc(doc: PlayStoreDoc, now: number): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  const pet = touched.pet;
  if (pet.stage !== 'egg' || pet.egg == null) return null;
  return {
    ...touched,
    // v27: the egg was already paid for (a free or bought egg), so the new
    // pick is free and doesn't count; a ticket egg gets its ticket back
    // instead.
    pet: { ...newPet(Math.max(now, pet.seen_at)), prepaid: pet.ticket == null },
    pet_tickets: pet.ticket ? { ...touched.pet_tickets, [pet.ticket]: touched.pet_tickets[pet.ticket] + 1 } : touched.pet_tickets,
  };
}

/* ---------------------------------------------------------------------------
 * The Den (v27, Part D) — see `den.ts`. One active pet ages; resting pets are
 * frozen (nothing here ever ages a pet in `pet_den`).
 * ------------------------------------------------------------------------- */

/** Why the active pet can't change right now (null = it can). The mini-game
 * overlay is UI state, so the screen passes `gameOpen`. */
export function denBlockOf(doc: PlayStoreDoc, now: number, gameOpen = false): DenSwapBlock | null {
  return denSwapBlock({ diving: doc.dive_run != null, away: petAt(doc, now).away, gameOpen, active: doc.pet });
}

export type DenRefusal = DenSwapBlock | 'full' | 'blank' | 'missing';
export type DenResult = { ok: true } | { ok: false; reason: DenRefusal };

/** A new egg: needs a free slot; the active pet rests in the Den and an empty
 * picker becomes the active pet. Nothing is spent until an egg is picked. */
export function newEggDoc(
  doc: PlayStoreDoc,
  now: number,
  gameOpen = false,
): { doc: PlayStoreDoc; result: DenResult } {
  const touched = touchPet(doc, now);
  const block = denBlockOf(touched, now, gameOpen);
  if (block) return { doc: touched, result: { ok: false, reason: block } };
  if (isBlankSlot(touched.pet)) return { doc: touched, result: { ok: false, reason: 'blank' } };
  if (denUsed(touched.pet_den) + 1 > touched.den_slots) return { doc: touched, result: { ok: false, reason: 'full' } };
  return {
    doc: {
      ...touched,
      pet_den: [...touched.pet_den, touched.pet],
      pet: newPet(Math.max(now, touched.pet.seen_at)),
    },
    result: { ok: true },
  };
}

/** Make a resting pet the active one. The active pet rests (an empty picker
 * that wasn't paid for is just closed). Waking: no time passed while it
 * rested, and before Child it takes today's pity position. */
export function activateDenPet(
  doc: PlayStoreDoc,
  now: number,
  uid: number,
  gameOpen = false,
): { doc: PlayStoreDoc; result: DenResult } {
  const touched = touchPet(doc, now);
  const block = denBlockOf(touched, now, gameOpen);
  if (block) return { doc: touched, result: { ok: false, reason: block } };
  const i = touched.pet_den.findIndex((p) => p.uid === uid);
  if (i < 0) return { doc: touched, result: { ok: false, reason: 'missing' } };
  const rest = touched.pet_den.filter((_, k) => k !== i);
  const outgoing = isBlankSlot(touched.pet) ? [] : [touched.pet];
  return {
    doc: {
      ...touched,
      pet: wakePet(touched.pet_den[i], now, touched.eggs_since_legendary),
      pet_den: [...rest, ...outgoing],
    },
    result: { ok: true },
  };
}

/** Release a resting Child-or-older pet: Hall + Collection + 1 shard of its
 * grade, exactly like releasing the active pet. Null when refused. */
export function releaseDenPet(doc: PlayStoreDoc, now: number, uid: number): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  const pet = touched.pet_den.find((p) => p.uid === uid);
  if (!pet) return null;
  const left = releasePet(pet, touched.pet_hall, touched.pet_rebirths, now);
  if (!left) return null;
  return {
    ...touched,
    ...recordLeaving(touched, pet),
    pet_den: touched.pet_den.filter((p) => p.uid !== uid),
    pet_hall: left.hall,
    play_stats: { ...touched.play_stats, releases: touched.play_stats.releases + 1 },
  };
}

export type DenSlotResult = { ok: true } | { ok: false; reason: 'max' | 'shells' };

/** Buy the next Den slot with shells (7th 100 … 12th 750). */
export function buyDenSlot(doc: PlayStoreDoc): { doc: PlayStoreDoc; result: DenSlotResult } {
  const price = denSlotPrice(doc.den_slots);
  if (price == null) return { doc, result: { ok: false, reason: 'max' } };
  if (doc.shells < price) return { doc, result: { ok: false, reason: 'shells' } };
  return { doc: { ...doc, shells: doc.shells - price, den_slots: doc.den_slots + 1 }, result: { ok: true } };
}

/** Change one pet — the active one or a resting one — by its Den id. Never
 * ages a resting pet. Null when no pet has that id. */
function withPetByUid(doc: PlayStoreDoc, uid: number, fn: (pet: PetState) => PetState | null): PlayStoreDoc | null {
  if (uid <= 0) return null;
  if (doc.pet.uid === uid) {
    const pet = fn(doc.pet);
    return pet ? { ...doc, pet } : null;
  }
  const i = doc.pet_den.findIndex((p) => p.uid === uid);
  if (i < 0) return null;
  const pet = fn(doc.pet_den[i]);
  return pet ? { ...doc, pet_den: doc.pet_den.map((p, k) => (k === i ? pet : p)) } : null;
}

/** Favourite / unfavourite a pet (the Den sorts favourites first). */
export function setPetFav(doc: PlayStoreDoc, now: number, uid: number, on: boolean): PlayStoreDoc | null {
  return withPetByUid(touchPet(doc, now), uid, (p) => (p.fav === on ? null : { ...p, fav: on }));
}

/** Name a resting pet (null clears it back to the default). */
export function renameDenPet(doc: PlayStoreDoc, now: number, uid: number, raw: string | null): PlayStoreDoc | null {
  if (raw == null) return withPetByUid(touchPet(doc, now), uid, (p) => ({ ...p, name: null }));
  const checked = checkPetName(raw);
  return checked.ok ? withPetByUid(touchPet(doc, now), uid, (p) => ({ ...p, name: checked.name })) : null;
}

/* ---------------------------------------------------------------------------
 * Shine Stones (v27, Part D) — see `pet-eggs.ts`.
 * ------------------------------------------------------------------------- */

export type StoneRefusal = 'no_stones' | 'missing' | 'not_revealed' | 'shiny';
export type StoneResult = { ok: true; shiny: boolean; glimmers: number } | { ok: false; reason: StoneRefusal };

/** Can this pet take a Shine Stone? (Revealed, not shiny.) */
export function stoneRefusal(doc: PlayStoreDoc, pet: PetState | undefined): StoneRefusal | null {
  if (!pet) return 'missing';
  if (!petRevealed(pet)) return 'not_revealed';
  if (pet.shiny) return 'shiny';
  if (doc.shine_stones < 1) return 'no_stones';
  return null;
}

/** Use a Shine Stone on a pet (active or resting). The roll is the next one
 * in the saved sequence — the same Stone always rolls the same, so closing
 * the app can't redo it. Hit: shiny (Classic), glimmers back to 0. Miss: a
 * glimmer (per player) and a glimmer glow on that pet. With 5 glimmers the
 * next Stone always works. */
export function applyShineStone(doc: PlayStoreDoc, now: number, uid: number): { doc: PlayStoreDoc; result: StoneResult } {
  const touched = touchPet(doc, now);
  const pet = touched.pet.uid === uid && uid > 0 ? touched.pet : touched.pet_den.find((p) => p.uid === uid);
  const refusal = stoneRefusal(touched, pet);
  if (refusal) return { doc: touched, result: { ok: false, reason: refusal } };
  const hit = stoneSucceeds(touched.stone_seq, touched.stones_used, touched.glimmers);
  const glimmers = hit ? 0 : touched.glimmers + 1;
  const next = withPetByUid(touched, uid, (p) =>
    hit ? { ...p, shiny: true, shiny_style: 'classic', glimmer: false } : { ...p, glimmer: true },
  );
  if (!next) return { doc: touched, result: { ok: false, reason: 'missing' } };
  return {
    doc: { ...next, shine_stones: touched.shine_stones - 1, stones_used: touched.stones_used + 1, glimmers },
    result: { ok: true, shiny: hit, glimmers },
  };
}

/** Use a trade-up ticket on the current egg or Baby (before the roll). */
export function applyTicketDoc(doc: PlayStoreDoc, now: number, grade: Grade): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  const pet = touched.pet;
  if (grade === 'common' || touched.pet_tickets[grade] < 1) return null;
  if (pet.egg == null || pet.hero != null || pet.ticket != null) return null;
  if (pet.stage !== 'egg' && pet.stage !== 'baby') return null;
  return {
    ...touched,
    pet: { ...pet, ticket: grade },
    pet_tickets: { ...touched.pet_tickets, [grade]: touched.pet_tickets[grade] - 1 },
  };
}

/** Name the pet (null clears it back to the default). */
export function renamePetDoc(doc: PlayStoreDoc, now: number, raw: string | null): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  if (touched.pet.egg == null && touched.pet.hero == null) return null;
  if (raw == null) return { ...touched, pet: { ...touched.pet, name: null } };
  const checked = checkPetName(raw);
  return checked.ok ? { ...touched, pet: { ...touched.pet, name: checked.name } } : null;
}

/** Change Divecore settings (the hunger toggle also keeps `pet_remind`). */
export function setPlaySettings(doc: PlayStoreDoc, patch: Partial<PlaySettings>): PlayStoreDoc {
  const settings: PlaySettings = {
    ...doc.play_settings,
    ...patch,
    notif: { ...doc.play_settings.notif, ...(patch.notif ?? {}) },
  };
  return { ...doc, play_settings: settings, pet_remind: settings.notif.hunger };
}

/** Reset Divecore progress: a brand-new Play save that keeps the settings.
 * Never touches the main app's data (a different store). */
export function resetDivecore(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  const fresh = defaultPlayStore(now);
  return { ...fresh, play_settings: doc.play_settings, pet_remind: doc.play_settings.notif.hunger };
}

export type PetRoundKind = 'catch' | 'train';
export type PetRoundResult = {
  counted: boolean;
  tokensGranted: number;
  /** v26 — the round's level and score, and what it earned. */
  level: Difficulty;
  score: number;
  medal: Medal | null;
  newRecord: boolean;
  prevBest: number;
  rankUp: boolean;
  rank: string;
  unlocked: Difficulty | null;
  buff: BuffId | null;
  daily: boolean;
  dailyBest: boolean;
  dailyBonusShells: number;
  /** v27 — this daily pass earned today's free egg / the first daily Gold's
   * Shine Stone. */
  dailyEgg: boolean;
  dailyStone: boolean;
};

/** v26 — how a round was played (Normal, score 0 when not given). */
export type RoundMeta = { level: Difficulty; score: number; daily: boolean };
const PLAIN_ROUND: RoundMeta = { level: 'normal', score: 0, daily: false };

/**
 * A finished mini-game round (v25: pass / fail — see pet-game-rules.ts).
 * A PASS counts: "Catch the food" feeds (+2 hunger), "Tap to train" trains
 * (+1 training, +2 mood), Baby care, and +5 tokens up to 30 a device-local
 * day. A fail counts for nothing.
 */
export function finishPetRound(
  doc: PlayStoreDoc,
  now: number,
  kind: PetRoundKind,
  outcome: RoundOutcome,
  meta: RoundMeta = PLAIN_ROUND,
): { doc: PlayStoreDoc; result: PetRoundResult } {
  // touchPet also brings home an expedition whose time is up (v21).
  const touchedDoc = touchPet(doc, now);
  const aged = touchedDoc.pet;
  // The daily challenge is always played on its fixed (Normal) rules.
  const level: Difficulty = meta.daily ? DAILY_LEVEL : meta.level;
  const score = Math.max(0, Math.floor(meta.score));
  const empty: PetRoundResult = {
    counted: false,
    tokensGranted: 0,
    level,
    score,
    medal: null,
    newRecord: false,
    prevBest: touchedDoc.game_records[kind][level].best,
    rankUp: false,
    rank: rankTitle(touchedDoc.game_records, kind),
    unlocked: null,
    buff: null,
    daily: meta.daily,
    dailyBest: false,
    dailyBonusShells: 0,
    dailyEgg: false,
    dailyStone: false,
  };
  if (aged.stage === 'egg' || !outcome.pass) {
    return { doc: touchedDoc, result: empty };
  }
  // Baby care (v23 → v25): skilled = passed with 70%+; and its activity. v26:
  // an Easy pass counts as a plain pass even at 70%+ — only Normal or harder
  // can be "skilled", so the easier level can't farm the egg care score (and
  // Hard/Insane never give more than Normal).
  const skillOutcome = level === 'easy' ? { pass: true, quality: Math.min(outcome.quality, CARE_SKILL_SHARE - 0.01) } : outcome;
  const cared = petCareAct(
    petCareSkill(aged, roundSkillPoints(skillOutcome)),
    kind === 'catch' ? CARE_ACT.fed : CARE_ACT.trained,
  );
  const pet = kind === 'catch' ? feedPet(cared, PET_FEED_CATCH) : trainPet(cared);
  const pay = petTokensForRound(localYmd(new Date(now)), doc.pet_tokens_ymd, doc.pet_tokens_today);
  // v26: records, medal → buff (refreshed, never stacked), daily challenge.
  // A level that isn't open (e.g. after a reset) earns no record, medal,
  // buff or unlock — care and tokens still count as a normal pass.
  const open = levelUnlocked(touchedDoc.game_records, kind, level);
  const rec = open
    ? recordRound(touchedDoc.game_records, kind, level, score, true)
    : { records: touchedDoc.game_records, medal: null, newRecord: false, prevBest: empty.prevBest, rankUp: false, unlocked: null };
  const buff = buffForMedal(kind, rec.medal);
  const today = localYmd(new Date(now));
  const daily = meta.daily
    ? recordDaily(touchedDoc.daily_games, today, kind, score, true)
    : { daily: touchedDoc.daily_games, newBest: false, bonusShells: 0 };
  // v27: a daily pass earns today's free egg (once a day); the first daily
  // Gold of the day (either game, on the daily's own rules) a Shine Stone.
  const rewards = meta.daily
    ? dailyRewards(daily.daily, today, medalFor(kind, DAILY_LEVEL, score, true))
    : { daily: daily.daily, egg: false, stone: false };
  return {
    doc: {
      ...touchedDoc,
      pet,
      tokens: doc.tokens + pay.tokens,
      pet_tokens_today: pay.paid,
      pet_tokens_ymd: pay.ymd,
      game_records: rec.records,
      buffs: buff ? grantBuff(touchedDoc.buffs, buff) : touchedDoc.buffs,
      daily_games: rewards.daily,
      shells: touchedDoc.shells + daily.bonusShells,
      shine_stones: touchedDoc.shine_stones + (rewards.stone ? 1 : 0),
    },
    result: {
      ...empty,
      counted: true,
      tokensGranted: pay.tokens,
      medal: rec.medal,
      newRecord: rec.newRecord,
      prevBest: rec.prevBest,
      rankUp: rec.rankUp,
      rank: rankTitle(rec.records, kind),
      unlocked: rec.unlocked,
      buff,
      dailyBest: daily.newBest,
      dailyBonusShells: daily.bonusShells,
      dailyEgg: rewards.egg,
      dailyStone: rewards.stone,
    },
  };
}

/** Dev kit: every buff at full uses. */
export function devGrantAllBuffs(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, buffs: { ...BUFF_USES } };
}

/** Dev kit: Gold on every level of both games (opens everything). */
export function devGoldAllGames(doc: PlayStoreDoc): PlayStoreDoc {
  const records = emptyRecords();
  for (const g of ['catch', 'train'] as const) {
    for (const d of Object.keys(records[g]) as Difficulty[]) records[g][d] = { best: 1, medal: 'gold' };
  }
  return { ...doc, game_records: records };
}

/** Rebirth a God pet: Hall entry, +2% (cap +10%), new egg. Null unless God. */
export function rebirthPetDoc(doc: PlayStoreDoc, now: number): PlayStoreDoc | null {
  const touched = touchPet(doc, now);
  // Not while it is away: the new egg would reset the age the expedition is
  // timed against (v21). Wait for it to come back.
  if (touched.pet_expedition) return null;
  const next = rebirthPet(touched.pet, touched.pet_hall, touched.pet_rebirths, now);
  if (!next) return null;
  return {
    ...touched,
    // The retiring pet goes to the Collection and leaves a shard (v23).
    ...recordLeaving(touched, touched.pet),
    pet: next.pet,
    pet_hall: next.hall,
    pet_rebirths: next.rebirths,
  };
}

export function setPetRemind(doc: PlayStoreDoc, on: boolean): PlayStoreDoc {
  return {
    ...doc,
    pet_remind: on,
    play_settings: { ...doc.play_settings, notif: { ...doc.play_settings.notif, hunger: on } },
  };
}

/** Dev kit: jump the pet to the end of its stage (it evolves on the next
 * age). Branch counters are kept, so a test can set them first. */
export function devPetFinishStage(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  const pet = advancePet(doc.pet, now);
  if (pet.stage === 'god') return { ...doc, pet };
  // One ms short of the end: the next age (1ms of real time) evolves it. The
  // clock mark is left alone (never moved backwards).
  const left = petStageLeftMs(pet) ?? 0;
  return { ...doc, pet: { ...pet, stage_age_ms: pet.stage_age_ms + left - 1 } };
}

/** Dev kit: straight to a stage (fresh counters). */
export function devPetSetStage(doc: PlayStoreDoc, now: number, stage: PetState['stage']): PlayStoreDoc {
  if (!(PET_STAGES as readonly string[]).includes(stage)) return doc;
  const pet = advancePet(doc.pet, now);
  return { ...doc, pet: { ...pet, stage, stage_age_ms: 0, mistakes: 0, training: 0, waves: 0, deep_surfaces: 0 } };
}

/** Dev kit: empty both meters (care-mistake / reminder testing). */
export function devPetStarve(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  const pet = advancePet(doc.pet, now);
  return { ...doc, pet: { ...pet, hunger: 0, mood: 0, hunger_empty_ms: 0, mood_empty_ms: 0 } };
}

/** Dev kit: a brand-new egg (hall and rebirths kept). */
export function devPetNewEgg(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return { ...doc, pet: newPet(now, doc.pet.line), pet_expedition: null };
}

/** Dev kit (v27): +5 Shine Stones. */
export function devAddStones(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, shine_stones: doc.shine_stones + 5 };
}

/** Dev kit (v27): set the pity counter (eggs since the last Legendary); an
 * active pet before Child takes the new position, as on activation. */
export function devSetPity(doc: PlayStoreDoc, now: number, since: number): PlayStoreDoc {
  const n = Math.max(0, Math.min(PITY_HARD - 1, Math.floor(since)));
  const pet = advancePet(doc.pet, now);
  return { ...settlePetAging(doc, doc.pet, pet), eggs_since_legendary: n, pet: wakePet(pet, now, n) };
}

/** Dev kit (v27): fill every free Den slot with a revealed Child (random
 * eggs, no care). Never touches the pity counter or the active pet. */
export function devFillDen(doc: PlayStoreDoc, now: number, rng: () => number = Math.random): PlayStoreDoc {
  const den = [...doc.pet_den];
  let uid = doc.pet_uid_next;
  while (denUsed(den) < doc.den_slots) {
    const egg = EGG_TYPES[Math.min(EGG_TYPES.length - 1, Math.floor(rng() * EGG_TYPES.length))];
    const picked = chooseEgg(newPet(now), egg, newEggSeed(rng), null, now);
    if (!picked) break;
    const baby: PetState = { ...picked, stage: 'baby', stage_age_ms: PET_STAGE_MS.baby - 1, seen_at: now - 1, uid };
    den.push(advancePet(baby, now));
    uid += 1;
  }
  return { ...doc, pet_den: den, pet_uid_next: uid };
}

/** Dev kit: bring an expedition back on the next action, and allow another
 * one today. */
export function devPetExpeditionReset(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  const pet = advancePet(doc.pet, now);
  // A departure age above the current age reads as "ready" (expeditionLeftMs),
  // so this works even for a pet younger than the 1h minimum.
  const exp = doc.pet_expedition ? { ...doc.pet_expedition, left_age_ms: pet.total_age_ms + doc.pet_expedition.len_ms + 1 } : null;
  return { ...doc, pet, pet_expedition: exp, pet_expedition_ymd: null, pet_expedition_steps: 0 };
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
  /** v22 — shells for the Dive gear (campaign 4, replay 1). */
  shellsGranted: number;
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
  /** True when Trial catch-up XP (×2.5) was applied to this win's XP: the
   * ACTIVE Avatar is one or more levels behind the highest owned Avatar
   * (level ≤ highest − 1) AND the fight phase was Trial (Main is ×1). */
  catchupXp: boolean;
  /** Item ids dropped from this wave's drop table (rolled on the win). */
  dropItems: string[];
  /** Hero first owned by this win (Slice A2) — a Main Scout band clear grants
   * Oni, a Main Final band clear grants Archangel. Null when this win granted no
   * hero (a replay, a non-band wave, or a band whose hero was already owned).
   * The same grant also queues `hero_offer` in the doc, which is what the hero
   * sheet renders. */
  heroOwned: { heroId: string; label: string } | null;
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

/** True when a worn Power's element matches the active Legend — that piece's
 * own stats are raised by `GEAR_MATCH_BONUS` (replaces the old board-wide +20%
 * cycle-tint "type match", 2026-09-28). */
export function gearMatchesLegend(itemId: string, legendElement: Element | null): boolean {
  if (!legendElement) return false;
  const def = getItemDef(itemId);
  return def?.core.kind === 'power' && def.core.type_tag === legendElement;
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
 * Conquered (Main wave 10 clear, campaign mode): `conquered_cycles += 1`,
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

  // Trial catch-up XP (v16): while the ACTIVE Avatar is one or more levels
  // behind the highest owned Avatar (level ≤ highest − 1), Trial fights
  // (campaign or replay) award ×2.5 XP so the alt can climb to the pack. The
  // moment it ties the highest level, XP is normal again. Tokens, drops and
  // the seat are untouched; Main (any wave) is always ×1 — no catch-up there.
  let catchupXp = false;
  if (phase === 'trial' && activeAvatarCatchup(doc)) {
    xpGranted = Math.floor(xpGranted * CATCHUP_XP_MULT);
    catchupXp = true;
  }

  // XP level-ups (clear XP + any conquer/catch-up bonus feed the same curve).
  const active = activeAvatarOf(doc);
  let xp = active.xp + xpGranted;
  let level = active.level;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }

  // Bag: milestone Rare Look (if fired) + this wave's drop roll(s).
  let inventory = doc.inventory;
  if (milestone) inventory = addCopiesToBag(inventory, milestone.itemId, 0, 1);
  if (dropItems.length > 0) inventory = addManyToBag(inventory, dropItems);

  // Hero ownership (Slice A2): a CAMPAIGN clear of a hero band first-owns its
  // hero — Main w5 (Scout) → Oni, Main w10 (Final) → Archangel — and queues the
  // one-shot "owned" offer. Replays never grant (the farm lane must not re-own
  // or re-offer), and `ownHero` is idempotent, so a re-clear of an owned band
  // stays silent. Product lock: the Final band is fightable free; the Premium
  // gate on USING it as Avatar/Bound Boss is TODO(A5) inside `ownHero`.
  let ownedHeroIds = doc.owned_hero_ids;
  let heroOffer = doc.hero_offer;
  let heroOwned: DefendWinResult['heroOwned'] = null;
  if (!isReplay && band) {
    const heroId = HERO_BY_BAND_KIND[band.kind as keyof typeof HERO_BY_BAND_KIND];
    const granted = heroId ? ownHero(doc, heroId) : null;
    if (granted?.gained) {
      ownedHeroIds = granted.doc.owned_hero_ids;
      heroOffer = granted.doc.hero_offer;
      heroOwned = { heroId, label: heroName(heroId) };
    }
  }

  const shellsGranted = isReplay ? SHELLS_PER_REPLAY : SHELLS_PER_CLEAR;
  const next: PlayStoreDoc = patchActiveAvatar(
    {
      ...doc,
      tokens: doc.tokens + tokensGranted,
      shells: doc.shells + shellsGranted,
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
      owned_hero_ids: ownedHeroIds,
      hero_offer: heroOffer,
      // Pet (v20): every cleared wave (campaign or replay) feeds the pet a
      // heart, counts toward its Battle form and tallies the Legend element
      // for the God aura — so TD-only players still raise it.
      pet: petWaveCleared(advancePet(doc.pet, now), legendElementOf(active.id)),
      // v26 Pumped: a use only on a wave where it actually changed the pounce
      // (never while it is a "Maxed aura", or with no pounce).
      buffs: pumpedStateOf(doc, now).boosted ? spendBuff(doc.buffs, 'pumped') : doc.buffs,
      // v24 Journal: a hatch / reveal that happens in this same aging counts;
      // v27 and so does its pity step.
      ...settledPetFields(doc, now),
    },
    { xp, level },
  );
  return {
    doc: next,
    result: {
      tokensGranted,
      shellsGranted,
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
      heroOwned,
      bossFragment,
      catchupXp,
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
  const active = activeAvatarOf(doc);
  if (doc.avatar_star_tokens < 1 || active.stars >= AVATAR_STAR_MAX) {
    return { doc, gainedStar: false };
  }
  return {
    doc: patchActiveAvatar(
      { ...doc, avatar_star_tokens: doc.avatar_star_tokens - 1 },
      { stars: active.stars + 1 },
    ),
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
 * `conquered_cycles ≥ 1` proves Main wave 10, and therefore every wave of the
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

/** Record the ACTIVE Avatar's parked position for a Defend map (v16 — park
 * is per Avatar so swapping never yanks the board). Board fractions clamp to
 * 0..1 so a corrupt drag can never park off-board. */
export function recordAvatarPark(
  doc: PlayStoreDoc,
  mapId: AvatarParkMapId,
  x: number,
  y: number,
): PlayStoreDoc {
  const active = activeAvatarOf(doc);
  return patchActiveAvatar(doc, {
    park: {
      ...active.park,
      [mapId]: {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      },
    },
  });
}

/* ---------------------------------------------------------------------------
 * Avatar roster (v16 — Dress "Active Avatar" swap).
 *
 * `avatars[]` are the OWNED Avatars; `active_avatar_id` picks who the board
 * and Dress use. Only the ACTIVE Avatar's record is written by gameplay (XP,
 * stars, equips, park) — the bag/tokens/campaign/Bound Bosses are shared.
 * Unlocking adds a fresh level-1 record; switching Avatars never moves gear
 * or the campaign seat.
 * ------------------------------------------------------------------------- */

/** Switch the active Avatar to an OWNED one. No-op when the id is unknown. */
export function setActiveAvatar(
  doc: PlayStoreDoc,
  id: AvatarId,
): { doc: PlayStoreDoc; ok: boolean } {
  if (!doc.avatars.some((avatar) => avatar.id === id)) {
    return { doc, ok: false };
  }
  return { doc: { ...doc, active_avatar_id: id }, ok: true };
}

/** Unlock an Avatar by adding a fresh default record (stub unlock — no real
 * cost until Hero/IAP). No-op when already owned. */
export function unlockAvatar(
  doc: PlayStoreDoc,
  id: AvatarId,
): { doc: PlayStoreDoc; gained: boolean } {
  if (doc.avatars.some((avatar) => avatar.id === id)) {
    return { doc, gained: false };
  }
  return {
    doc: { ...doc, avatars: [...doc.avatars, defaultAvatarRecord(id)] },
    gained: true,
  };
}

/** Dev kit only: bump the ACTIVE Avatar `levels` whole levels (XP reset to 0
 * at the new level — speeds catch-up smoke). */
export function devAddAvatarLevels(doc: PlayStoreDoc, levels: number): PlayStoreDoc {
  const active = activeAvatarOf(doc);
  return patchActiveAvatar(doc, {
    level: Math.max(1, active.level + Math.max(0, Math.floor(levels))),
    xp: 0,
  });
}

/** Dev kit only: reset the roster back to a fresh starter Avatar (active =
 * starter; bag/tokens/campaign/Bound Bosses are kept). */
export function devResetAvatars(doc: PlayStoreDoc): PlayStoreDoc {
  return {
    ...doc,
    avatars: [defaultAvatarRecord(STARTER_AVATAR_ID)],
    active_avatar_id: STARTER_AVATAR_ID,
  };
}

/* ---------------------------------------------------------------------------
 * Hero ownership + Avatar / Bound-Boss exclusivity (v18 — Slice A2).
 *
 * A HERO (heroes.json) is the sprite set + skill kit the player fights as; the
 * owned set is `owned_hero_ids` (seeded with the starter, Corvus) and
 * `active_avatar_hero_id` names the one in use. A hero becomes a Bound Boss by
 * gaining a `bound_bosses` record (stars ≥ 1) — its tower def lands in A5/A6,
 * so until then the record is intentionally def-less.
 *
 * The product lock is EXCLUSIVITY: the same hero can never be the active
 * Avatar AND a bound tower. Both setters enforce it, deliberately differently:
 *  - `setAvatarHero` AUTO-UNBINDS (the player asked for the Avatar; the bind is
 *    the thing given up, and it is reversible from the same sheet),
 *  - `bindHeroAsTower` REFUSES while the hero is the active Avatar, telling the
 *    player to unequip first — binding is additive, so silently stealing the
 *    Avatar out from under them would be the surprising move.
 * ------------------------------------------------------------------------- */

/** Hero ids BOUND as towers, in bind order — the hero subset of
 * `bound_bosses` that counts against `BOUND_HERO_MAX`. A hero id is one
 * `heroById` resolves; the cycle boss's own record (Ember) is not a hero, so it
 * never consumes a hero slot. `stars >= 1` is the same "bound" line the view
 * draws (`BoundBossView.unlocked`): a stars-0 record is fragments only, so it
 * must not eat a slot. */
export function boundHeroIdsOf(doc: PlayStoreDoc): string[] {
  return doc.bound_bosses
    .filter((record) => record.stars >= 1)
    .map((record) => record.id)
    .filter((id) => heroById(id) != null);
}

/** True when the save owns `heroId`. */
export function heroOwned(doc: PlayStoreDoc, heroId: string): boolean {
  return doc.owned_hero_ids.includes(heroId);
}

/** The active Avatar hero, falling back to the starter when the stored id is
 * unknown/corrupt (mirrors `avatarRecordOf`'s tolerant read). */
export function normalizedAvatarHeroId(doc: PlayStoreDoc): string {
  const id = doc.active_avatar_hero_id;
  return heroOwned(doc, id) && heroById(id) ? id : DEFAULT_AVATAR_HERO_ID;
}

/**
 * Own a hero. No-op when the id is unknown, already owned, or the starter.
 * Otherwise adds it to `owned_hero_ids` AND queues the one-shot offer the hero
 * sheet shows ("Archangel owned" → Set as Avatar / Bind as tower).
 *
 * Economy assumption (locked product call): the Final band grants Archangel and
 * the Scout band grants Oni for FREE on a campaign clear. TODO(A5): the Premium
 * gate — owning Final as Avatar/Bound Boss is gated per the existing economy —
 * belongs here, so when the paywall lands this becomes the one place to check.
 */
export function ownHero(
  doc: PlayStoreDoc,
  heroId: string,
): { doc: PlayStoreDoc; gained: boolean } {
  if (!heroById(heroId) || heroOwned(doc, heroId)) {
    return { doc, gained: false };
  }
  return {
    doc: {
      ...doc,
      owned_hero_ids: [...doc.owned_hero_ids, heroId],
      hero_offer: { hero_id: heroId, label: heroName(heroId) },
    },
    gained: true,
  };
}

/** Why `setAvatarHero` refused (null = it worked). */
export type HeroSetReason = 'unknown_hero' | 'not_owned';

/**
 * Set an OWNED hero as the Avatar. If that hero is currently bound as a tower,
 * the bind is given up in the same write (exclusivity). Refuses unknown or
 * unowned ids, and is a no-op when the hero is already the Avatar (so the UI
 * never re-writes state just to confirm). Clears the queued offer.
 */
export function setAvatarHero(
  doc: PlayStoreDoc,
  heroId: string,
): { doc: PlayStoreDoc; ok: boolean; reason: HeroSetReason | null } {
  if (!heroById(heroId)) return { doc, ok: false, reason: 'unknown_hero' };
  if (!heroOwned(doc, heroId)) return { doc, ok: false, reason: 'not_owned' };
  const bound = doc.bound_bosses.some((record) => record.id === heroId);
  if (normalizedAvatarHeroId(doc) === heroId && !bound) {
    return { doc: clearHeroOffer(doc), ok: true, reason: null };
  }
  return {
    doc: {
      ...doc,
      active_avatar_hero_id: heroId,
      // Exclusivity: an Avatar cannot also be a bound tower.
      bound_bosses: bound
        ? doc.bound_bosses.filter((record) => record.id !== heroId)
        : doc.bound_bosses,
      hero_offer: null,
    },
    ok: true,
    reason: null,
  };
}

/** Why `bindHeroAsTower` refused (null = it worked). */
export type HeroBindReason = 'unknown_hero' | 'not_owned' | 'active_avatar' | 'cap';

/**
 * Bind an OWNED hero as a Bound Boss tower (§9k roster entry, ★1).
 *
 * Refuses while the hero is the ACTIVE Avatar (`active_avatar` — the player is
 * told to set another Avatar first, or to use Set as Avatar's auto-unbind), and
 * once `BOUND_HERO_MAX` heroes are already bound (`cap`). Idempotent: a hero
 * that is already bound succeeds without duplicating the record. The ★1 record
 * is def-less until A5/A6 ships the hero's tower def, so nothing here may assume
 * `getBoundBossDef(id)` resolves.
 */
export function bindHeroAsTower(
  doc: PlayStoreDoc,
  heroId: string,
): { doc: PlayStoreDoc; ok: boolean; reason: HeroBindReason | null } {
  if (!heroById(heroId)) return { doc, ok: false, reason: 'unknown_hero' };
  if (!heroOwned(doc, heroId)) return { doc, ok: false, reason: 'not_owned' };
  const existing = doc.bound_bosses.find((record) => record.id === heroId);
  if (existing && existing.stars >= 1) {
    // Already bound — idempotent, and just clears the queued offer.
    return { doc: clearHeroOffer(doc), ok: true, reason: null };
  }
  if (normalizedAvatarHeroId(doc) === heroId) {
    return { doc, ok: false, reason: 'active_avatar' };
  }
  if (!devNoCaps() && boundHeroIdsOf(doc).length >= BOUND_HERO_MAX) {
    return { doc, ok: false, reason: 'cap' };
  }
  // A stars-0 record (fragments only, no tower yet) is upgraded in place so its
  // fragments survive the bind.
  const record: BoundBossRecord = existing
    ? { ...existing, stars: 1, bound_wave: existing.bound_wave ?? null }
    : { id: heroId, stars: 1, frags: 0, bound_wave: null };
  return {
    doc: {
      ...doc,
      bound_bosses: existing
        ? doc.bound_bosses.map((row) => (row.id === heroId ? record : row))
        : [...doc.bound_bosses, record],
      hero_offer: null,
    },
    ok: true,
    reason: null,
  };
}

/** Drop the queued hero offer without acting on it (the sheet's dismiss, and
 * every action path's exit). No-op when nothing is queued. */
export function clearHeroOffer(doc: PlayStoreDoc): PlayStoreDoc {
  return doc.hero_offer == null ? doc : { ...doc, hero_offer: null };
}

/** Dev kit only: own a hero without clearing its band, AND (re)queue its offer
 * so the hero sheet is testable repeatedly. `ownHero` is idempotent, so owning
 * an already-owned hero would otherwise be a no-op and the sheet could only be
 * exercised once per hero per save. */
export function devOwnHero(doc: PlayStoreDoc, heroId: string): PlayStoreDoc {
  if (!heroById(heroId)) return doc;
  const owned = ownHero(doc, heroId);
  return { ...owned.doc, hero_offer: { hero_id: heroId, label: heroName(heroId) } };
}

/** Dev kit only: own EVERY hero in `heroes.json` at once, queuing no offer (a
 * bulk grant has no single hero to offer a choice about). The queue is cleared
 * so a pending offer cannot outlive the bulk grant it was superseded by.
 * Returns the same doc when there is nothing left to grant. */
export function devOwnAllHeroes(doc: PlayStoreDoc): PlayStoreDoc {
  const owned = new Set(doc.owned_hero_ids);
  for (const hero of allHeroes()) owned.add(hero.id);
  if (owned.size === doc.owned_hero_ids.length && doc.hero_offer == null) return doc;
  return { ...doc, owned_hero_ids: [...owned], hero_offer: null };
}

/** Dev kit only: set an Avatar hero for testing, auto-owning it first so the
 * row works from a fresh save (the real `setAvatarHero` still refuses an
 * unowned hero — this is the dev speed hatch, not a looser rule). */
export function devSetAvatarHero(doc: PlayStoreDoc, heroId: string): PlayStoreDoc {
  if (!heroById(heroId)) return doc;
  const owned = heroOwned(doc, heroId) ? doc : ownHero(doc, heroId).doc;
  const next = setAvatarHero(owned, heroId);
  return next.ok ? next.doc : owned;
}

/** Dev kit only: drop a queued hero offer without acting on it. */
export function devClearHeroOffer(doc: PlayStoreDoc): PlayStoreDoc {
  return clearHeroOffer(doc);
}

/** Dev kit only: back to just the starter Hero — owned = Corvus, active =
 * Corvus, no offer. Hero BINDINGS are dropped too: a bound hero the save no
 * longer owns would break the "bound ⊆ owned" invariant the setters keep (the
 * cycle boss's own record is not a hero, so it is left alone). Returns the same
 * doc when it is already in that state. */
export function devClearOwnedHeroes(doc: PlayStoreDoc): PlayStoreDoc {
  const heroBinds = doc.bound_bosses.filter((record) => heroById(record.id) != null);
  const alreadyClear =
    doc.owned_hero_ids.length === 1 &&
    doc.owned_hero_ids[0] === DEFAULT_AVATAR_HERO_ID &&
    doc.active_avatar_hero_id === DEFAULT_AVATAR_HERO_ID &&
    heroBinds.length === 0 &&
    doc.hero_offer == null;
  if (alreadyClear) return doc;
  return {
    ...doc,
    owned_hero_ids: [DEFAULT_AVATAR_HERO_ID],
    active_avatar_hero_id: DEFAULT_AVATAR_HERO_ID,
    bound_bosses: doc.bound_bosses.filter((record) => heroById(record.id) == null),
    hero_offer: null,
  };
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

/** Player GS from the persisted doc (soft-capped bucket + ACTIVE Avatar level
 * + stars). Swap Avatars and GS follows the new active. */
export function gearScoreOf(doc: PlayStoreDoc): number {
  const active = activeAvatarOf(doc);
  const wavePowerBucket = bucketMultiplier(
    'wave_power',
    equippedStatSums(active.equipped, legendElementOf(active.id)),
  );
  return gearScore(wavePowerBucket, active.level, active.stars);
}

/**
 * Walk the campaign forward from the seat across normal waves that GS
 * overkills by the skip threshold; stop at the first boss band (Trial 5,
 * Main 5 / 10 — never auto-skipped) or the first wave whose recommended GS
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

  // XP feeds the same level curve as a real clear (skip is never a Trial
  // fight, so catch-up XP never applies to a skip).
  const active = activeAvatarOf(doc);
  let xp = active.xp + xpGranted;
  let level = active.level;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }

  const next: PlayStoreDoc = patchActiveAvatar(
    {
      ...doc,
      tokens: doc.tokens + tokensGranted,
      highest_wave_cleared: highestWave,
      lifetime_waves_cleared: lifetimeAfter,
      campaign: plan.toSeat,
      inventory,
      milestone_waves_claimed: [
        ...doc.milestone_waves_claimed,
        ...claimedNow,
      ],
    },
    { xp, level },
  );
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

/** Dev kit only: park the seat at the Final band (Main wave 10). */
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
  const active = activeAvatarOf(doc);
  const equipped: Partial<Record<ItemSlot, ItemRef>> = { ...active.equipped };
  for (const id of OVERGEAR_POWER_IDS) {
    const def = getItemDef(id);
    if (!def) continue;
    equipped[def.core.slot] = { id, star: MERGE_MAX_STAR };
  }
  return patchActiveAvatar(doc, {
    level: DEV_OVERGEAR_LEVEL,
    stars: AVATAR_STAR_MAX,
    equipped,
  });
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
  // Deeper #5 exists only with Oxygen (v22).
  const table = deeperIndex < DIVE_BUST_TABLE.length ? DIVE_BUST_TABLE[deeperIndex] : DIVE_OXYGEN_BUST;
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
  legendElement: Element | null = null,
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
    // StarTable scale (×1.0 at ★0, +0.1 per star) — a ★2 copy of a Power
    // really hits harder than its ★0 twin, in display AND combat math.
    // A Power whose element matches the active Legend gets its own stats
    // raised (tune `gearMatchBonus`, Sane 1.0 = doubled) — shown on the item, never an
    // invisible mult.
    const scale =
      starMultScale(slot.star) *
      (gearMatchesLegend(slot.id, legendElement) ? 1 + getTune().gearMatchBonus : 1);
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
  legendElement: Element | null = null,
  petCutPp: number = 0,
): number {
  const bucket = diveLuckBucket(equippedStatSums(equipped, legendElement));
  // The pet dive buddy (v20) takes whole points off AFTER the luck bend; the
  // 50%-of-table floor still holds, so the two together never zero it out.
  const bent = baseBust * (1 - LUCK_BUST_BEND_PER_TIER * (bucket - 1)) - Math.max(0, petCutPp) / 100;
  const floored = Math.max(DIVE_BUST_FLOOR * baseBust, bent);
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
  | { busted: true; changed?: false; bustPct: number; rescued: string[]; petCared: boolean }
  | { busted: false; changed?: false; bustPct: number; addedId: string }
  /** Nothing rolled: the real odds moved since the screen showed them (the
   * pet evolved or came back). The screen re-renders the new exact %. */
  | { busted: false; changed: true; bustPct: number };

/**
 * Spend 1 dive charge to start a run and roll the first find (Shallows). Null
 * when a run is in progress or no charge is available. The pet is aged (and a
 * finished expedition collected) first; with it along, the find goes in the
 * Logbook at depth 0. Both paths' next finds are pre-rolled (Lamp).
 */
export function startDive(
  doc: PlayStoreDoc,
  now: number,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; firstFind: string } | null {
  if (doc.dive_run) return null;
  const dive = diveChargeAt(doc, now);
  if (dive.current < 1) return null;
  const touched = touchPet(doc, now, rng);
  const { pet, away } = petAt(touched, now);
  const luck = petLuckyChance(pet, away);
  const firstFind = rollTierLucky('shallows', luck, rng);
  const snack = touched.buffs.snack > 0;
  return {
    doc: {
      ...touched,
      buffs: snack ? spendBuff(touched.buffs, 'snack') : touched.buffs,
      // Spend one derived charge; the refill timer restarts from now.
      dive_charge: dive.current - 1,
      dive_charge_at: now,
      // v24: the last charge spent arms the (opt-in) "charges full" notice.
      charges_armed: touched.charges_armed || dive.current - 1 === 0,
      play_stats: { ...touched.play_stats, dives: touched.play_stats.dives + 1 },
      dive_run: { deepers: 0, haul: [firstFind], free_n: null, next: rollNext(touched, 1, rng, luck), ...(snack ? { snack: true } : {}) },
      pet_logbook: away ? touched.pet_logbook : logFind(touched.pet_logbook, firstFind, 0),
    },
    firstFind,
  };
}

/**
 * A free dive (v22) — only when there is no run and no charge. Same odds and
 * paths; surfacing keeps only mood and shells (falling off with each free dive
 * that day), and finds are Logbook sightings. Never counts toward Deep.
 */
export function startFreeDive(
  doc: PlayStoreDoc,
  now: number,
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; firstFind: string } | null {
  if (doc.dive_run) return null;
  if (diveChargeAt(doc, now).current >= 1) return null;
  const touched = touchPet(doc, now, rng);
  const { pet, away } = petAt(touched, now);
  const luck = petLuckyChance(pet, away);
  const n = freeDivesTodayOf(touched, now);
  const firstFind = rollTierLucky('shallows', luck, rng);
  const snack = touched.buffs.snack > 0;
  return {
    doc: {
      ...touched,
      buffs: snack ? spendBuff(touched.buffs, 'snack') : touched.buffs,
      free_dives_today: n + 1,
      free_dives_ymd: localYmd(new Date(now)),
      play_stats: { ...touched.play_stats, dives: touched.play_stats.dives + 1 },
      dive_run: { deepers: 0, haul: [firstFind], free_n: n, next: rollNext(touched, 1, rng, luck), ...(snack ? { snack: true } : {}) },
      pet_logbook: away ? touched.pet_logbook : logFind(touched.pet_logbook, firstFind, 0),
    },
    firstFind,
  };
}

export type SurfaceResult = {
  doc: PlayStoreDoc;
  /** Everything brought up (the haul, plus the Net's find). */
  banked: string[];
  /** The Net's extra find, if any. */
  netFind: string | null;
  /** v26 — the Hearty meal's extra find, if any. */
  heartyFind: string | null;
  shellsGained: number;
  /** v26 — Powers past today's ceiling that became shells, and the count
   * after this surface (for "Powers today X/6"). */
  powersConverted: number;
  powersToday: number;
  petCared: boolean;
  free: boolean;
};

/** Surface: bank the haul (a free dive banks only its shells) and end the
 * run. Net (v22): +1 find from depth 2 or deeper. Dive care: with the pet
 * along, +2 mood; a charged surface from 3+ Deepers counts toward Deep. Never
 * training, never the stage clock. Null when idle. */
export function surfaceDive(
  doc: PlayStoreDoc,
  now: number,
  rng: () => number = Math.random,
): SurfaceResult | null {
  const run = doc.dive_run;
  if (!run) return null;
  const touched = touchPet(doc, now, rng);
  const { away } = petAt(touched, now);
  const luck = petLuckyChance(touched.pet, away);
  const free = run.free_n != null;
  const netFind =
    touched.dive_gear.net && run.deepers >= NET_MIN_DEPTH ? rollTierLucky(tierAt(run.deepers), luck, rng) : null;
  // v26 Hearty meal: +1 find on a charged-dive surface (a use per surface).
  const heartyFind = !free && touched.buffs.hearty > 0 ? rollTierLucky(tierAt(run.deepers), luck, rng) : null;
  const brought = [...run.haul, ...(netFind ? [netFind] : []), ...(heartyFind ? [heartyFind] : [])];
  let pet = touched.pet;
  if (!away) {
    const cared = petDiveSurfaced(pet, run.deepers);
    // Free dives never count toward Deep (emci, Part B).
    pet = free && cared !== pet ? { ...cared, deep_surfaces: pet.deep_surfaces } : cared;
    pet = petCareAct(pet, CARE_ACT.dived); // Baby care (v23)
  }
  let logbook = touched.pet_logbook;
  if (!away) {
    if (netFind) logbook = logFind(logbook, netFind, run.deepers);
    if (heartyFind) logbook = logFind(logbook, heartyFind, run.deepers);
  }
  const base: PlayStoreDoc = {
    ...touched,
    dive_run: null,
    pet,
    pet_logbook: logbook,
    buffs: heartyFind ? spendBuff(touched.buffs, 'hearty') : touched.buffs,
    play_stats: {
      ...touched.play_stats,
      surfaces: touched.play_stats.surfaces + 1,
      best_depth: Math.max(touched.play_stats.best_depth, run.deepers),
    },
  };
  let next: PlayStoreDoc;
  let shellsGained: number;
  let powersConverted = 0;
  if (free) {
    shellsGained = freeDiveShells(run.deepers, run.free_n ?? 0);
    next = { ...base, shells: base.shells + shellsGained };
  } else {
    const bankedDoc = bankFinds(base, brought, now);
    next = bankedDoc.doc;
    shellsGained = bankedDoc.shells;
    powersConverted = bankedDoc.powersConverted;
  }
  return {
    doc: next,
    banked: brought,
    netFind,
    heartyFind,
    shellsGained,
    powersConverted,
    powersToday: powersTodayOf(next, now),
    petCared: pet !== touched.pet,
    free,
  };
}

/**
 * Roll one Deeper press on a path. The pet is aged (and a finished expedition
 * collected) first, then the bust chance comes from `nextDeeperBustPct` — the
 * exact function the screen shows. Pass `expectedPct` (the % on screen for
 * that path): if the real odds moved since (the pet evolved or came back),
 * nothing is rolled and the outcome is `changed`. On a bust the whole haul is
 * lost (a charged dive's pet rescues its best finds from Adult) and the pet
 * gets +1 mood; on a safe roll the path's pre-rolled find is added and logged
 * at this depth. Null when idle or run is maxed.
 */
export function deeperDive(
  doc: PlayStoreDoc,
  now: number,
  path: DivePath = 'safe',
  rng: () => number = Math.random,
  expectedPct: number | null = null,
): { doc: PlayStoreDoc; outcome: DeeperOutcome } | null {
  const run = doc.dive_run;
  if (!run || run.deepers >= diveMaxDeepers(doc)) return null;
  const touched = touchPet(doc, now, rng);
  const { pet, away } = petAt(touched, now);
  const bustPct = nextDeeperBustPct(touched, run, pet, away, path);
  if (expectedPct != null && expectedPct !== bustPct) {
    return { doc: touched, outcome: { busted: false, changed: true, bustPct } };
  }
  const free = run.free_n != null;
  if (rng() < bustPct / 100) {
    // Pet rescue (v20): from Adult the pet saves the best find(s) of the lost
    // haul (1, 2 at God or Deep, never more than 2). A bust ends the dive, so
    // this is once per dive. Free dives have nothing to keep. The pet itself
    // is never lost.
    const rescued = free ? [] : bestFinds(run.haul, petRescueKeep(pet, away));
    const cared = away ? touched.pet : petCareAct(petDiveBusted(touched.pet), CARE_ACT.dived);
    const base: PlayStoreDoc = {
      ...touched,
      dive_run: null,
      pet: cared,
      play_stats: {
        ...touched.play_stats,
        busts: touched.play_stats.busts + 1,
        best_depth: Math.max(touched.play_stats.best_depth, run.deepers),
      },
    };
    return {
      doc: rescued.length > 0 ? bankFinds(base, rescued, now).doc : base,
      outcome: { busted: true, bustPct, rescued, petCared: cared !== touched.pet },
    };
  }
  const depth = run.deepers + 1;
  const luck = petLuckyChance(pet, away);
  const addedId = run.next?.[path] ?? rollTierLucky(pathTier(depth, path, touched.dive_gear.oxygen), luck, rng);
  return {
    doc: {
      ...touched,
      dive_run: {
        deepers: depth,
        haul: [...run.haul, addedId],
        free_n: run.free_n,
        next: rollNext(touched, depth + 1, rng, luck),
        ...(run.snack ? { snack: true } : {}),
      },
      pet_logbook: away ? touched.pet_logbook : logFind(touched.pet_logbook, addedId, depth),
      play_stats: { ...touched.play_stats, best_depth: Math.max(touched.play_stats.best_depth, depth) },
    },
    outcome: { busted: false, bustPct, addedId },
  };
}

/** The `n` best finds of a haul: Powers over Looks, then rarity, then the
 * later (deeper) find. Pure; `n` ≤ 0 → none. */
export function bestFinds(haul: readonly string[], n: number): string[] {
  if (n <= 0) return [];
  const score = (id: string) => {
    const def = getItemDef(id);
    // v22: cosmetics, then food, then shells rank after every item; v27 a
    // Shine Stone right after the items.
    if (!def) {
      const kind = findKind(id);
      return kind === 'stone' ? 45 : kind === 'cosmetic' ? 50 : kind === 'food' ? 60 : 70 + shellsOf(id) * -0.01;
    }
    return (def.core.kind === 'power' ? 0 : 10) + rarityRank(def.core.rarity);
  };
  return haul
    .map((id, index) => ({ id, index }))
    .sort((a, b) => score(a.id) - score(b.id) || b.index - a.index)
    .slice(0, n)
    .map((row) => row.id);
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

/** Equip one owned (bagged) copy of (id, star) into the ACTIVE Avatar's slot.
 * Blocked when total owned (bag + EVERY Avatar's worn) is over the soft cap
 * and the item is a Power going into an EMPTY slot (net-new gear — sell a
 * Look first). Swaps (slot holds a DIFFERENT ref) are always allowed, as are
 * Look equips, because neither adds to the total owned count. Equipping the
 * exact ref ALREADY worn is refused (`already_equipped`) — one per slot — so
 * spare copies of a worn item can only sit in the bag (or feed a merge, or
 * sell, if Look). Each Avatar's slots are its own; the bag is shared. */
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
  const active = activeAvatarOf(doc);
  const occupied = active.equipped[slot];
  if (occupied && occupied.id === itemId && occupied.star === star) {
    return { doc, outcome: { ok: false, reason: 'already_equipped' } };
  }
  const totalOwned = totalOwnedAcrossAvatars(doc);
  if (def.core.kind === 'power' && occupied == null && totalOwned >= INVENTORY_SOFT_CAP) {
    return { doc, outcome: { ok: false, reason: 'bag_full' } };
  }
  // Take one copy from the bag; if this is a swap, the old ref goes back to
  // its own (id, star) stack.
  let inventory = takeOneFromBag(doc.inventory, itemId, star);
  if (occupied) inventory = addCopiesToBag(inventory, occupied.id, occupied.star, 1);
  const equipped = { ...active.equipped, [slot]: { id: itemId, star } };
  return {
    doc: patchActiveAvatar({ ...doc, inventory }, { equipped }),
    outcome: { ok: true },
  };
}

/** Take an item off the ACTIVE Avatar's slot and return exactly one copy to
 * its bag stack (the matching (id, star) tier). */
export function unequipItem(
  doc: PlayStoreDoc,
  slot: ItemSlot,
): { doc: PlayStoreDoc } {
  const active = activeAvatarOf(doc);
  const ref = active.equipped[slot];
  if (!ref) return { doc };
  const equipped = { ...active.equipped };
  delete equipped[slot];
  // Only return known items; a corrupt id is dropped rather than bagged.
  const inventory = getItemDef(ref.id)
    ? addCopiesToBag(doc.inventory, ref.id, ref.star, 1)
    : doc.inventory;
  return {
    doc: patchActiveAvatar({ ...doc, inventory }, { equipped }),
  };
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
 * consumed as fuel. Roll the honest % from the StarTable (data/stars.json —
 * ★0→1 70% … 4→5 18%, cap ★5), the SAME table Dress shows. Success raises the
 * main one star; a fail spends the fuel and leaves the main untouched — an
 * equipped main is NEVER destroyed. Mult values scale +10% per star (see
 * `equippedStatSums`).
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

/** Honest success % (whole number) for raising `star` → `star + 1`, read
 * from the StarTable (`data/stars.json`), or null when `star` is at the cap
 * (nothing to roll). Never a flattened copy — Dress shows exactly what the
 * store rolls. */
export function mergeSuccessPct(star: number): number | null {
  if (!Number.isFinite(star) || star < 0) return null;
  const fraction = starMergeSuccess(star);
  if (fraction == null) return null;
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}

/** Does the ACTIVE Avatar's worn slot hold an item that can be merged with
 * bagged fuel? */
export function canMergeWorn(
  doc: PlayStoreDoc,
  slot: ItemSlot,
): boolean {
  const ref = activeAvatarOf(doc).equipped[slot];
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

  // Validate the main (the ACTIVE Avatar's worn copy or a bagged copy) and
  // that enough fuel of the same tier exists.
  const active = activeAvatarOf(doc);
  if (target.main === 'worn') {
    const worn = active.equipped[slot];
    if (!worn || worn.id !== target.id || worn.star !== target.star) return null;
    const fuel = doc.inventory.find((stack) => sameTier(stack, target.id, target.star));
    if (!fuel || fuel.count < 1) return null;
  } else {
    const stack = doc.inventory.find((stack) => sameTier(stack, target.id, target.star));
    if (!stack || stack.count < 2) return null;
  }

  // Roll from the SAME StarTable the UI shows (data/stars.json).
  const success = rng() < (starMergeSuccess(target.star) ?? 0);

  // Fuel always goes first.
  let inventory = takeOneFromBag(doc.inventory, target.id, target.star);
  let equipped = active.equipped;

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
      doc: patchActiveAvatar({ ...doc, inventory }, { equipped }),
      outcome: { success: true, pct, fromStar: target.star, toStar: target.star + 1 },
    };
  }

  // Fail: main untouched (bag main = the remaining copy of its stack), fuel gone.
  return {
    doc: patchActiveAvatar({ ...doc, inventory }, { equipped }),
    outcome: { success: false, pct, fromStar: target.star },
  };
}

/* ---------------------------------------------------------------------------
 * Shop — soft-token purchases (GAME_SPEC §9i shops, §18 F).
 *
 * The token shelf spends `tokens` on a real effect (one Dive charge, a
 * merge-fuel Power crate) or refuses as a "coming soon" stub. A row's
 * `daily_limit` is enforced against `shop_daily` for the device-local day, so
 * a small crate can't be farmed. The shelf NEVER sells wave_power or a
 * cycle_power skip (§9i: those would break the Conquered climb).
 *
 * The paid shelf is STUBS ONLY in v0 (`shop.ts` rows with `available: false`)
 * — this store has no IAP path at all, so nothing can charge Apple yet.
 * ------------------------------------------------------------------------- */

/** Why a token-shop purchase refused (the UI disables/labels accordingly). */
export type ShopRefusal =
  /** The row isn't priced yet / is a stub → "Coming soon". */
  | 'coming_soon'
  /** Not enough soft tokens. */
  | 'insufficient'
  /** Hit this row's per-day cap. */
  | 'daily_cap'
  /** v27 — hit this row's per-week cap. */
  | 'weekly_cap'
  /** Dive charges already at the 10 cap — buying would waste it. */
  | 'dive_full';

export type ShopPurchaseResult =
  | {
      ok: true;
      rowId: string;
      tokensSpent: number;
      /** Item granted by the buy (merge crate), else null. */
      grantedItemId: string | null;
      tokensNow: number;
      /** Dive charges after the buy (unchanged for non-charge rows). */
      diveChargeNow: number;
      /** Buys of this row made today AFTER this one. */
      boughtToday: number;
      /** v27 — Shine Stones held after the buy. */
      shineStonesNow: number;
    }
  | { ok: false; reason: ShopRefusal };

/**
 * Buy one token-shop row: spend `row.price` soft tokens and apply its effect.
 * Refuses (doc untouched) when unpriced/stub, unaffordable, day-capped, or
 * when a Dive-charge buy would exceed the charge cap. The daily counter resets
 * at the next device-local midnight (the stored `ymd` no longer matches).
 */
export function purchaseShopRow(
  doc: PlayStoreDoc,
  row: ShopTokenRow,
  now: number = Date.now(),
  rng: () => number = Math.random,
): { doc: PlayStoreDoc; result: ShopPurchaseResult } {
  if (row.kind === 'stub' || row.price == null || !(row.price > 0)) {
    return { doc, result: { ok: false, reason: 'coming_soon' } };
  }
  const todayYmd = localYmd(new Date(now));
  const counts = doc.shop_daily.ymd === todayYmd ? doc.shop_daily.counts : {};
  const bought = Math.max(0, Math.floor(counts[row.id] ?? 0));
  if (row.daily_limit != null && bought >= row.daily_limit) {
    return { doc, result: { ok: false, reason: 'daily_cap' } };
  }
  const week = localWeekYmd(now);
  const weekly = weekHolds(week, doc.shop_weekly.ymd) ? doc.shop_weekly.counts : {};
  const boughtWeek = Math.max(0, Math.floor(weekly[row.id] ?? 0));
  if (row.weekly_limit != null && boughtWeek >= row.weekly_limit) {
    return { doc, result: { ok: false, reason: 'weekly_cap' } };
  }
  if (doc.tokens < row.price) {
    return { doc, result: { ok: false, reason: 'insufficient' } };
  }

  // Apply the effect (refusals above leave the doc untouched).
  let next = doc;
  let grantedItemId: string | null = null;
  if (row.kind === 'dive_charge') {
    const current = diveChargeAt(doc, now).current;
    if (current >= DIVE_CHARGE_CAP) {
      return { doc, result: { ok: false, reason: 'dive_full' } };
    }
    next = {
      ...next,
      dive_charge: Math.min(DIVE_CHARGE_CAP, current + row.amount),
      dive_charge_at: now, // refill timer restarts from the buy
    };
  } else if (row.kind === 'merge_crate') {
    grantedItemId = rollPowerFind(rng);
    next = {
      ...next,
      inventory: addCopiesToBag(next.inventory, grantedItemId, 0, row.amount),
    };
  } else if (row.kind === 'shine_stone') {
    next = { ...next, shine_stones: next.shine_stones + row.amount };
  }

  next = {
    ...next,
    tokens: doc.tokens - row.price,
    shop_daily: {
      ymd: todayYmd,
      counts: { ...counts, [row.id]: bought + 1 },
    },
    shop_weekly: {
      ymd: weekHolds(week, doc.shop_weekly.ymd) ? doc.shop_weekly.ymd : week,
      counts: { ...weekly, [row.id]: boughtWeek + 1 },
    },
  };
  return {
    doc: next,
    result: {
      ok: true,
      rowId: row.id,
      tokensSpent: row.price,
      grantedItemId,
      tokensNow: next.tokens,
      diveChargeNow: next.dive_charge,
      boughtToday: bought + 1,
      shineStonesNow: next.shine_stones,
    },
  };
}

/** The Monday (device-local YYYY-MM-DD) of `now`'s week — the weekly limit's key. */
export function localWeekYmd(now: number): string {
  const d = new Date(now);
  return localYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)));
}

/** The stored week still counts: this week, or up to two weeks ahead (a
 * clock set back can't reopen a week; set far forward once, it starts
 * fresh) — the weekly twin of `petDayHolds`. */
export function weekHolds(thisWeek: string, storedWeek: string | null): boolean {
  if (storedWeek == null || storedWeek < thisWeek) return false;
  const ahead = (Date.parse(`${storedWeek}T00:00:00Z`) - Date.parse(`${thisWeek}T00:00:00Z`)) / 86_400_000;
  return Number.isFinite(ahead) && ahead <= 14;
}

/** Token-shop buys made this week, row id → count (the weekly caps). */
export function shopWeekCountsOf(doc: PlayStoreDoc, now: number): Readonly<Record<string, number>> {
  return weekHolds(localWeekYmd(now), doc.shop_weekly.ymd) ? doc.shop_weekly.counts : {};
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

/** Dev kit: clear today's shop purchase counts (re-test daily caps). */
export function devResetShopDaily(doc: PlayStoreDoc, now: number): PlayStoreDoc {
  return { ...doc, shop_daily: { ymd: localYmd(new Date(now)), counts: {} } };
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

/** Dev kit: take every slot off the ACTIVE Avatar (items stay in the bag). */
export function devClearEquipped(doc: PlayStoreDoc): PlayStoreDoc {
  return patchActiveAvatar(doc, { equipped: {} });
}

/** Dev kit: fill junk Looks until total owned (bag + every Avatar's worn) is
 * just over the soft cap (81), so the §9 "bag full — sell a Look" path is
 * testable. No-op when already over. */
export function devFillJunkLooks(doc: PlayStoreDoc): PlayStoreDoc {
  const junk = junkLookId();
  if (!junk) return doc;
  const totalOwned = totalOwnedAcrossAvatars(doc);
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

/**
 * Parse a persisted doc, migrating any older version forward (v1 … v18).
 *
 * Exported for the offline migration check (`scripts/check-heroes.ts`): a doc
 * version bump otherwise ships unverified, and a save that silently fails to
 * load costs the player their whole economy. Pure + total — returns null for an
 * unreadable/unknown-version doc instead of throwing.
 */
export function parsePlayStore(raw: string, now: number): PlayStoreDoc | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    // v1 (pre-inventory) … v11 (forever stubs) all migrate to v12: legacy
    // copies are star 0, equipped string ids become refs with star 0, Defend
    // meta defaults to 0 clears / 0 XP / level 1 / no daily count / no
    // milestone flags, and the campaign seat (v11 numeric phases 1/2 → v12
    // string phases 'trial'/'main') + conquered cycles + cycle_power +
    // lifetime clears + bound bosses default to fresh values. v1–v4 also
    // stored `inventory` as a string[] of owned ids WITH worn copies included,
    // so those subtract one per equipped slot. v16 (Avatar swap) moves every
    // per-Avatar field into `avatars[]` records (the root xp / avatar_level /
    // avatar_stars / avatar_park from v15 migrate onto the starter record).
    const version = data?.version;
    if (
      version !== 1 && version !== 2 && version !== 3 && version !== 4 &&
      version !== 5 && version !== 6 && version !== 7 && version !== 8 &&
      version !== 9 && version !== 10 && version !== 11 && version !== 12 &&
      version !== 13 && version !== 14 && version !== 15 && version !== 16 &&
      version !== 17 && version !== 18 && version !== 19 && version !== 20 &&
      version !== 21 && version !== 22 && version !== 23 && version !== 24 && version !== 25 &&
      version !== 26 && version !== 27
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
    // Legacy root equipped (v1–v15) seeds the starter record AND is subtracted
    // from v1–v4 bags (worn copies used to be listed in the bag too).
    const legacyEquipped = parseEquipped(data.equipped);
    const highestWaveCleared = finiteNumber(data.highest_wave_cleared) ?? 0;
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
    const avatarStarTokens = Math.max(0, Math.floor(finiteNumber(data.avatar_star_tokens) ?? 0));
    const avatarStarRolled = data.avatar_star_rolled_cycle === true;
    const finalClears = Math.max(0, Math.floor(finiteNumber(data.final_clears_this_cycle) ?? 0));
    const uniques = Array.isArray(data.uniques)
      ? data.uniques.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const cycleTint = isTypeTag(data.cycle_tint) ? data.cycle_tint : DEFAULT_CYCLE_TINT;
    // v16 (Avatar swap): per-id records. Older saves (≤15) keep the single
    // root Avatar → migrated onto the starter record.
    const legacy = {
      xp: Math.max(0, Math.floor(finiteNumber(data.xp) ?? 0)),
      level: Math.max(1, Math.floor(finiteNumber(data.avatar_level) ?? 1)),
      stars: Math.max(
        0,
        Math.min(AVATAR_STAR_MAX, Math.floor(finiteNumber(data.avatar_stars) ?? 0)),
      ),
      equipped: legacyEquipped,
      park: parseAvatarPark(data.avatar_park),
    };
    // v19 (elemental Legends, 2026-09-28): the ten old Legend ids fold onto the
    // five elemental ones BEFORE parsing — parseAvatars keeps any id and would
    // otherwise add a fresh level-1 starter beside the renamed old one,
    // splitting the player's progress. `migrateLegendRecords` merges records
    // that land on the same Legend (highest level + its xp, max stars, the
    // ACTIVE record's worn gear). Worn gear is NOT in the bag (equipping takes
    // the copy out), so every loadout the merge does not keep comes back as
    // `returnedEquipped` and is put back in the bag below — nothing is lost.
    const legendRows =
      version >= 16 && version < 19 && Array.isArray(data.avatars)
        ? migrateLegendRecords(
            data.avatars.filter(
              (row): row is Record<string, unknown> & { id: string; xp: number; level: number; stars: number } =>
                isRecord(row) && typeof row.id === 'string',
            ).map((row) => ({
              ...row,
              id: row.id as string,
              xp: finiteNumber(row.xp) ?? 0,
              level: finiteNumber(row.level) ?? 1,
              stars: finiteNumber(row.stars) ?? 0,
              equipped: row.equipped,
              park: row.park,
            })),
            typeof data.active_avatar_id === 'string' ? data.active_avatar_id : null,
          )
        : null;
    const { avatars, activeAvatarId } = version >= 16
      ? parseAvatars(
          legendRows ? legendRows.rows : data.avatars,
          starterRecordFromLegacy(legacy),
          legendRows ? legendRows.activeId : data.active_avatar_id,
        )
      : { avatars: [starterRecordFromLegacy(legacy)], activeAvatarId: STARTER_AVATAR_ID };
    // v17 (Shop stubs): per-day token-shop purchase counts. Older saves default
    // to none bought today.
    const shopDaily = parseShopDaily(data.shop_daily);
    // v18 (Slice A2): owned heroes + the active Avatar hero + the one-shot own
    // offer. Older saves start with the starter hero owned and active — the
    // board's Avatar is unchanged, so nothing about an old save shifts.
    const ownedHeroIds = parseOwnedHeroIds(data.owned_hero_ids);
    const activeAvatarHeroId = parseAvatarHeroId(data.active_avatar_hero_id, ownedHeroIds);
    const heroOffer = parseHeroOffer(data.hero_offer);
    // v20 (pet, 2026-09-29): older saves get a fresh egg (seen now, so no
    // time before the update counts), an empty Hall, no rebirths, reminder off.
    const pet = version >= 20 ? parsePet(data.pet, now) : newPet(now);
    const petRebirths = Math.max(0, Math.floor(finiteNumber(data.pet_rebirths) ?? 0));
    // v21 (Dive + Pet loop): expedition, its day and note, and the Logbook.
    // Older saves: none out, never sent, no note, empty Logbook.
    const v21 = version >= 21;
    const v22 = version >= 22;
    const v23 = version >= 23;
    const v24 = version >= 24;
    const v26 = version >= 26;
    const v27 = version >= 27;
    const hall = parsePetHall(data.pet_hall);
    // v27 (Part D): older saves — the pet is the active one in slot 1 and the
    // Den is empty with 6 slots; the pity counter, eggs today, Stones and
    // glimmers all start at 0.
    const den = parseDen(v27 ? data.pet_den : null, pet, now, v27 ? finiteNumber(data.pet_uid_next) : null);
    // v23 (eggs): the Collection becomes a per-hero book. Older saves: every
    // Hall pet counts as one copy (stars carry over), Common, with its form;
    // the old `line:form` Collection keys add their forms. The live pet is
    // added on top in the view.
    const heroBook = v23
      ? parseHeroBook(data.pet_heroes, (id) => heroById(id) != null)
      : legacyHeroBook(hall, v22 ? data.pet_collection : null);
    const cosmetics = v22 ? parseOwnedCosmetics(data.pet_cosmetics) : [];
    return {
      version: 27,
      tokens: Math.max(0, Math.floor(tokens)),
      dive_charge: clampInt(diveCharge, 0, DIVE_CHARGE_CAP),
      dive_charge_at: diveChargeAt,
      research_started_at: researchStartedAt,
      research_accrued_ms: Math.min(RESEARCH_CAP_MS, Math.max(0, researchAccruedMs ?? 0)),
      last_tend_bonus_ymd: lastTend,
      inventory: returnWornToBag(
        parseInventory(data.inventory, legacyEquipped, version < 5),
        legendRows ? legendRows.returnedEquipped : [],
      ),
      dive_run: parseDiveRun(data.dive_run),
      highest_wave_cleared: Math.max(0, Math.floor(highestWaveCleared)),
      clears_today: Math.max(0, Math.floor(clearsToday)),
      clears_ymd: clearsYmd,
      milestone_waves_claimed: milestoneWaves,
      campaign,
      conquered_cycles: conqueredCycles,
      cycle_power: cyclePowerValue,
      lifetime_waves_cleared: Math.max(0, Math.floor(lifetimeWaves)),
      bound_bosses: boundBosses,
      avatar_star_tokens: avatarStarTokens,
      avatar_star_rolled_cycle: avatarStarRolled,
      final_clears_this_cycle: finalClears,
      uniques,
      cycle_tint: cycleTint,
      avatars,
      active_avatar_id: activeAvatarId,
      shop_daily: shopDaily,
      owned_hero_ids: ownedHeroIds,
      active_avatar_hero_id: activeAvatarHeroId,
      hero_offer: heroOffer,
      pet: den.pet,
      pet_hall: hall,
      pet_rebirths: petRebirths,
      pet_tokens_today: Math.max(0, Math.floor(finiteNumber(data.pet_tokens_today) ?? 0)),
      pet_tokens_ymd: typeof data.pet_tokens_ymd === 'string' ? data.pet_tokens_ymd : null,
      pet_remind: data.pet_remind === true,
      pet_expedition: v21 ? parsePetExpedition(data.pet_expedition) : null,
      pet_expedition_ymd: v21 && typeof data.pet_expedition_ymd === 'string' ? data.pet_expedition_ymd : null,
      // v25: older saves — the day's one trip counts as step 1 (no bonus
      // ladder on top of it); another day's date resets it anyway.
      pet_expedition_steps:
        version >= 25
          ? Math.max(0, Math.min(7, Math.floor(finiteNumber(data.pet_expedition_steps) ?? 0)))
          : v21 && typeof data.pet_expedition_ymd === 'string'
            ? 1
            : 0,
      pet_expedition_note: v21 && typeof data.pet_expedition_note === 'string' ? data.pet_expedition_note : null,
      // Missing = already announced (never re-toast an old note).
      pet_expedition_toasted: !(v21 && data.pet_expedition_toasted === false),
      pet_logbook: v21 ? parsePetLogbook(data.pet_logbook) : {},
      shells: v22 ? Math.max(0, Math.floor(finiteNumber(data.shells) ?? 0)) : 0,
      dive_gear: v22 ? parseDiveGear(data.dive_gear) : { ...NO_DIVE_GEAR },
      pet_pantry: v22 ? parsePantry(data.pet_pantry) : {},
      pet_cosmetics: cosmetics,
      pet_wear: v22 ? parsePetWear(data.pet_wear, cosmetics) : { ...NO_WEAR },
      pet_heroes: heroBook,
      pet_shards: v23 ? parseGradeCounts(data.pet_shards) : emptyGradeCounts(),
      pet_tickets: v23 ? parseGradeCounts(data.pet_tickets) : emptyGradeCounts(),
      // v24: older saves keep their hunger-reminder choice; egg + expedition
      // notices on, charges full off; the tutorial is skipped for a save that
      // already has progress.
      play_settings: parseSettings(
        data.play_settings,
        v24
          ? null
          : {
              remind: data.pet_remind === true,
              hasProgress: hall.length > 0 || pet.hero != null || Math.floor(lifetimeWaves) > 0,
            },
      ),
      play_stats: v24 ? parseStats(data.play_stats) : emptyStats(),
      milestones: v24 && Array.isArray(data.milestones)
        ? [...new Set(data.milestones.filter((m): m is MilestoneId => MILESTONES.some((d) => d.id === m)))]
        : [],
      ribbons: v24 && Array.isArray(data.ribbons)
        ? [...new Set(data.ribbons.filter((r): r is Ribbon => r === 'collector' || r === 'legend'))]
        : [],
      dye_unlocked: v24 && Array.isArray(data.dye_unlocked)
        ? [...new Set(data.dye_unlocked.filter((h): h is string => typeof h === 'string' && heroById(h) != null))]
        : [],
      charges_armed: v24 && data.charges_armed === true,
      free_dives_today: v22 ? Math.max(0, Math.floor(finiteNumber(data.free_dives_today) ?? 0)) : 0,
      free_dives_ymd: v22 && typeof data.free_dives_ymd === 'string' ? data.free_dives_ymd : null,
      // v26 (Part C): older saves start with no buffs, no records (Easy and
      // Normal open), no daily bests, and nothing counted toward today's
      // Power ceiling.
      buffs: v26 ? parseBuffs(data.buffs) : { ...NO_BUFFS },
      game_records: v26 ? parseRecords(data.game_records) : emptyRecords(),
      daily_games: v26 ? parseDaily(data.daily_games) : { ...EMPTY_DAILY },
      powers_today: v26 ? parsePowersToday(data.powers_today) : { ymd: null, n: 0 },
      pet_den: den.resting,
      // Never fewer slots than the pets held (nothing is lost).
      den_slots: Math.max(clampDenSlots(v27 ? data.den_slots : null), Math.min(DEN_MAX_SLOTS, denUsed(den.resting))),
      pet_uid_next: den.uidNext,
      eggs_today: v27 ? Math.max(0, Math.min(EGGS_PER_DAY_MAX, Math.floor(finiteNumber(data.eggs_today) ?? 0))) : 0,
      eggs_ymd: v27 && typeof data.eggs_ymd === 'string' ? data.eggs_ymd : null,
      eggs_since_legendary: v27
        ? Math.max(0, Math.min(PITY_HARD - 1, Math.floor(finiteNumber(data.eggs_since_legendary) ?? 0)))
        : 0,
      shine_stones: v27 ? Math.max(0, Math.floor(finiteNumber(data.shine_stones) ?? 0)) : 0,
      glimmers: v27 ? Math.max(0, Math.min(GLIMMER_PITY, Math.floor(finiteNumber(data.glimmers) ?? 0))) : 0,
      stones_used: v27 ? Math.max(0, Math.floor(finiteNumber(data.stones_used) ?? 0)) : 0,
      stone_seq: v27 && finiteNumber(data.stone_seq) != null ? (finiteNumber(data.stone_seq) as number) >>> 0 : newEggSeed(),
      prism_stones: 0,
      shop_weekly: v27 ? parseShopDaily(data.shop_weekly) : { ymd: null, counts: {} },
    };
  } catch {
    return null;
  }
}

/** v27: the Den's resting pets, and Den ids made whole — every chosen pet
 * gets a unique id (an old save's pet becomes id 1). A blank picker never
 * rests, and the Den never holds more than its most. */
function parseDen(
  raw: unknown,
  active: PetState,
  now: number,
  storedNext: number | null,
): { pet: PetState; resting: PetState[]; uidNext: number } {
  const rows = Array.isArray(raw) ? raw : [];
  const resting = rows
    .filter(isRecord)
    .map((row) => parsePet(row, now))
    .filter((p) => !isBlankSlot(p))
    .slice(0, DEN_MAX_SLOTS - 1);
  const seen = new Set<number>();
  let next = Math.max(1, Math.floor(storedNext ?? 1));
  for (const p of [active, ...resting]) if (p.uid > 0) next = Math.max(next, p.uid + 1);
  const fix = (p: PetState): PetState => {
    if (isBlankSlot(p)) return p.uid === 0 ? p : { ...p, uid: 0 };
    if (p.uid > 0 && !seen.has(p.uid)) {
      seen.add(p.uid);
      return p;
    }
    const uid = next++;
    seen.add(uid);
    return { ...p, uid };
  };
  const pet = fix(active);
  return { pet, resting: resting.map(fix), uidNext: next };
}

/** The legacy (≤ v15) single Avatar as a starter record — the migration seed
 * for old saves. */
function starterRecordFromLegacy(legacy: {
  xp: number;
  level: number;
  stars: number;
  equipped: Partial<Record<ItemSlot, ItemRef>>;
  park: AvatarPark;
}): AvatarRecord {
  return { id: STARTER_AVATAR_ID, ...legacy };
}

/** Put every worn item from loadouts the v19 Legend merge did not keep back
 * into the bag (equipping removes a copy from the bag, so a dropped loadout's
 * items would otherwise vanish). Invalid refs are skipped by `parseEquipped`. */
function returnWornToBag(inventory: ItemStack[], loadouts: readonly unknown[]): ItemStack[] {
  let bag = inventory;
  for (const raw of loadouts) {
    for (const ref of Object.values(parseEquipped(raw))) {
      if (ref) bag = addCopiesToBag(bag, ref.id, ref.star, 1);
    }
  }
  return bag;
}

/** Loose read of a v16 `avatars` array. Malformed rows are dropped; the
 * starter record is ALWAYS present (prepended when missing); the active id
 * (passed from the doc root `active_avatar_id`) falls back to the first owned
 * record. When nothing parses, falls back to the legacy starter seed so a
 * corrupt save still opens. */
function parseAvatars(
  raw: unknown,
  legacy: ReturnType<typeof starterRecordFromLegacy>,
  activeRaw?: unknown,
): { avatars: AvatarRecord[]; activeAvatarId: AvatarId } {
  const seen = new Set<string>();
  const rows: AvatarRecord[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0) continue;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const level = Math.max(1, Math.floor(finiteNumber(entry.level) ?? 1));
      rows.push({
        id: entry.id,
        xp: Math.max(0, Math.floor(finiteNumber(entry.xp) ?? 0)),
        level,
        stars: Math.max(0, Math.min(AVATAR_STAR_MAX, Math.floor(finiteNumber(entry.stars) ?? 0))),
        equipped: parseEquipped(entry.equipped),
        park: parseAvatarPark(entry.park),
      });
    }
  }
  if (!seen.has(STARTER_AVATAR_ID)) {
    rows.unshift(legacy);
    seen.add(STARTER_AVATAR_ID);
  }
  if (rows.length === 0) {
    rows.push(legacy);
    seen.add(STARTER_AVATAR_ID);
  }
  const activeId = typeof activeRaw === 'string' && seen.has(activeRaw) ? activeRaw : rows[0].id;
  return { avatars: rows, activeAvatarId: activeId };
}

/**
 * Loose read of a saved avatar park (map id → board fractions).
 *
 * A row is KEPT only when it is a real in-range drag: finite x/y inside 0..1
 * and NOT the removed pre-v16 top-right default. Anything else (missing,
 * malformed, out-of-range/corrupt, or the old weird corner) is DROPPED, so the
 * map falls back to the shared MIDDLE spawn (`avatarParkFor`) — never to a
 * corner or a clamped edge.
 */
function parseAvatarPark(raw: unknown): AvatarPark {
  if (!isRecord(raw)) return {};
  const park: AvatarPark = {};
  for (const key of ['trial', 'main'] as const) {
    const point = raw[key];
    if (!isRecord(point)) continue;
    const x = finiteNumber(point.x);
    const y = finiteNumber(point.y);
    if (x == null || y == null) continue;
    // Corrupt / out-of-range → treat as missing (MIDDLE), never clamp to an edge.
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    // The removed legacy top-right default is not a real park → drop it.
    if (
      Math.abs(x - LEGACY_AVATAR_PARK.x) < PARK_EPSILON &&
      Math.abs(y - LEGACY_AVATAR_PARK.y) < PARK_EPSILON
    ) {
      continue;
    }
    park[key] = { x, y };
  }
  return park;
}

/** Loose read of the v17 shop daily counts. A malformed day/row is dropped;
 * anything unknown → no purchases today (caps fresh). */
function parseShopDaily(raw: unknown): ShopDaily {
  if (!isRecord(raw)) return { ymd: null, counts: {} };
  const ymd = typeof raw.ymd === 'string' && raw.ymd.length > 0 ? raw.ymd : null;
  const counts: Record<string, number> = {};
  if (isRecord(raw.counts)) {
    for (const [key, value] of Object.entries(raw.counts)) {
      const n = finiteNumber(value);
      if (key.length > 0 && n != null && n > 0) counts[key] = Math.floor(n);
    }
  }
  return { ymd, counts };
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

/** Loose read of the v18 owned-hero list. Unknown ids are dropped (a save made
 * by a build whose heroes.json has since changed must not carry a hero code
 * can't resolve) and the starter hero is ALWAYS present — the board always has
 * an Avatar to draw. */
function parseOwnedHeroIds(raw: unknown): string[] {
  const owned = new Set<string>([DEFAULT_AVATAR_HERO_ID]);
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string' && heroById(entry)) owned.add(entry);
    }
  }
  return [...owned];
}

/** Loose read of the v18 active Avatar hero. Falls back to the starter when the
 * id is missing, unknown, or not owned — the invariant the setters keep. */
function parseAvatarHeroId(raw: unknown, ownedHeroIds: readonly string[]): string {
  return typeof raw === 'string' && heroById(raw) && ownedHeroIds.includes(raw)
    ? raw
    : DEFAULT_AVATAR_HERO_ID;
}

/** Loose read of the v18 queued hero offer. A malformed/unknown row clears
 * rather than throwing — a broken offer must never block the sheet. */
function parseHeroOffer(raw: unknown): HeroOffer | null {
  if (!isRecord(raw) || typeof raw.hero_id !== 'string' || !heroById(raw.hero_id)) return null;
  const label =
    typeof raw.label === 'string' && raw.label.length > 0 ? raw.label : heroName(raw.hero_id);
  return { hero_id: raw.hero_id, label };
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

/** Loose-shape read of the persisted run; anything malformed → no run. v21
 * runs have no `free_n` / `next`: a charged dive with no preview. */
function parseDiveRun(raw: unknown): DiveRun | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.deepers !== 'number' || !Number.isFinite(raw.deepers)) return null;
  const deepers = clampInt(raw.deepers, 0, DIVE_DEEPER_MAX_OXYGEN);
  const haul = Array.isArray(raw.haul)
    ? raw.haul.filter((id): id is string => typeof id === 'string')
    : [];
  if (haul.length === 0) return null;
  const freeN = finiteNumber(raw.free_n);
  const next =
    isRecord(raw.next) && typeof raw.next.safe === 'string' && typeof raw.next.rich === 'string'
      ? { safe: raw.next.safe, rich: raw.next.rich }
      : null;
  const run: DiveRun = { deepers, haul, free_n: freeN == null ? null : Math.max(0, Math.floor(freeN)), next };
  if (raw.snack === true) run.snack = true;
  return run;
}

function parsePowersToday(raw: unknown): { ymd: string | null; n: number } {
  if (!isRecord(raw)) return { ymd: null, n: 0 };
  const n = finiteNumber(raw.n);
  return {
    ymd: typeof raw.ymd === 'string' ? raw.ymd : null,
    n: n == null ? 0 : Math.max(0, Math.min(DIVECORE_POWERS_PER_DAY, Math.floor(n))),
  };
}

function parseDiveGear(raw: unknown): DiveGearOwned {
  const out = { ...NO_DIVE_GEAR };
  if (!isRecord(raw)) return out;
  for (const k of Object.keys(out) as DiveGear[]) out[k] = raw[k] === true;
  return out;
}

function parsePantry(raw: unknown): Partial<Record<FoodId, number>> {
  const out: Partial<Record<FoodId, number>> = {};
  if (!isRecord(raw)) return out;
  let total = 0;
  for (const [id, n] of Object.entries(raw)) {
    if (!isFoodId(id)) continue;
    const count = Math.min(PANTRY_MAX - total, Math.max(0, Math.floor(finiteNumber(n) ?? 0)));
    if (count > 0) {
      out[id] = count;
      total += count;
    }
  }
  return out;
}

/** v22 → v23: the hero book from the Hall (one copy each, Common, its form)
 * and the old `line:form` Collection keys (forms only). Nothing is lost. */
function legacyHeroBook(hall: readonly PetHallEntry[], collection: unknown): PetHeroBook {
  let book: PetHeroBook = {};
  for (const h of hall) {
    if (!h.hero || heroById(h.hero) == null) continue;
    book = addToBook(book, { hero: h.hero, grade: h.grade, shiny: h.shiny, forms: [h.branch] });
  }
  if (Array.isArray(collection)) {
    for (const key of collection) {
      if (typeof key !== 'string') continue;
      const [line, branch] = key.split(':');
      const hero = heroOfLine(line ?? '');
      if (!hero || heroById(hero) == null || !branch) continue;
      const rec = book[hero] ?? { copies: 0, shinies: 0, grades: [], forms: [], dye: false };
      book = { ...book, [hero]: { ...rec, forms: [...new Set([...rec.forms, branch])] } };
    }
  }
  return book;
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
 * Airport free loop — own EVERY hero in `heroes.json` on Play load (no Premium
 * gate while invite-only). Idempotent: a save that already owns the full roster
 * is returned unchanged, and no one-shot offer is queued (a bulk grant has no
 * single hero to offer a choice about). Gated by `PLAY_EVERYTHING_FREE`.
 */
function airportFree(doc: PlayStoreDoc): PlayStoreDoc {
  if (!PLAY_EVERYTHING_FREE) return doc;
  const owned = new Set(doc.owned_hero_ids);
  for (const hero of allHeroes()) owned.add(hero.id);
  if (owned.size === doc.owned_hero_ids.length) return doc;
  return { ...doc, owned_hero_ids: [...owned] };
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
      if (parsed) return airportFree(parsed);
    }
  } catch {
    // Fall through to a fresh default below.
  }
  const fresh = defaultPlayStore(now);
  const result = airportFree(fresh);
  savePlayStore(result).catch(() => {});
  return result;
}
