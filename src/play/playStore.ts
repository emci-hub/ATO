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
 * - Inventory — every research find now grants a real item id rolled from the
 *   stub table (`src/play/data/items.json`, one roll per dumped cycle,
 *   appended to `inventory`). Dress (step 4) consumes it: 4 slots, one item per
 *   slot, mult buckets summed per stat (same-stat add, §9c soft-caps).
 * - Dive — push-your-luck (GAME_SPEC §7, step 3): spend 1 charge → find card →
 *   Surface banks the whole haul into `inventory`, or Deeper rolls the bust
 *   table (18/28/40/55%, max 4 Deepers). The in-progress haul lives in
 *   `dive_run` so killing the app mid-run keeps the same decision on relaunch.
 *   Equipped `dive_luck` bends the bust % (§7: bust × (1 − 0.15·(luck_bucket−1)),
 *   floored at half the table value) — never hidden, always shown as-is.
 * - Daily tend bonus — +10 tokens once per device-local day on the first Claim
 *   (later also Dress/Decor), tracked by `last_tend_bonus_ymd`.
 *
 * Everything is a pure function of the persisted doc + `now`, so timers survive
 * app kills (AsyncStorage) and the module stays testable. AsyncStorage only —
 * no Supabase `play_*` tables until the optional sync step (see
 * PLAY_DEEPSEEK_HANDOFF.md).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getItemDef,
  junkLookId,
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
export const INVENTORY_SOFT_CAP = 80; // soft cap 80 item rows
export const LOOK_SELL_TOKENS = 3; // GAME_DATA look_sell_tokens

/** Gear mult soft-caps (§9c table) — same-stat adds, past-cap at 25% strength. */
const GEAR_SOFT_CAP_MULT: Record<ItemStat, number> = {
  wave_power: 2.0,
  tower_speed: 1.75,
  token_earn: 1.5,
  dive_luck: 1.5,
  research_yield: 1.5,
};
const GEAR_DIMINISHING_RATE = 0.25; // §9c "past the cap, extra rolls add at 25% strength"
/** §7 luck tiers: each whole +5% equipped dive_luck is one bucket. */
const LUCK_BUCKET_STEP = 0.05;
const LUCK_BUCKET_MAX = 5;
/** §7 bust bend per luck tier and floor ("floored at 50% of table bust"). */
const LUCK_BUST_BEND_PER_TIER = 0.15;

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
 * `equipped` (step 4). Still to come behind later bumps: Defend adds
 * `highest_wave_cleared`. v1–v3 docs parse to v4 (empty bag / no run / nothing
 * equipped) so nothing on a device resets.
 */
export type PlayStoreDoc = {
  version: 4;
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
  /** Owned item ids (Grove stub table) — the whole collection, worn or bagged. */
  inventory: string[];
  /** Worn items by slot (one per slot); ids reference the collection. */
  equipped: Partial<Record<ItemSlot, string>>;
  /** Active Dive run (null when no charge has been spent / run is over). */
  dive_run: DiveRun | null;
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
  /** Whole owned collection (worn + bagged); Dress renders it. */
  inventory: readonly string[];
  /** Worn item ids by slot; Dress renders it. */
  equipped: Readonly<Partial<Record<ItemSlot, string>>>;
  /** Raw additive mult sums from equipped items (§9c same-stat adds). */
  statSums: StatSums;
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
    version: 4,
    tokens: 0,
    dive_charge: DIVE_CHARGE_CAP, // start full; research claims can top back up
    dive_charge_at: now,
    research_started_at: now,
    research_accrued_ms: 0,
    last_tend_bonus_ymd: null,
    inventory: [],
    equipped: {},
    dive_run: null,
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
    bustPctNext: canDeeper ? effectiveBustPct(DIVE_BUST_TABLE[run.deepers], doc.equipped) : null,
    canDeeper,
  };
}

export function canClaimResearch(view: PlayView): boolean {
  return view.research.readyFinds >= 1;
}

/* ---------------------------------------------------------------------------
 * Equipped gear buckets (GAME_SPEC §9c).
 *
 * Each equipped item contributes its mult_a / mult_b. Same stat adds into one
 * bucket; different stats stay separate and multiply later (Defend). The raw
 * sums are the display truth ("+8% wave power"); `bucketMultiplier` applies
 * the §9c soft-cap — past the cap (wave_power ×2.0 from gear, others ×1.5)
 * extra rolls add at 25% strength. `effectiveBustPct` bends a Dive bust % via
 * the §7 dive_luck tier formula; it is what the screen always shows.
 * ------------------------------------------------------------------------- */

/** Raw additive sums per stat from the equipped items (0 when none). */
export function equippedStatSums(
  equipped: Readonly<Partial<Record<ItemSlot, string>>>,
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
    const def = getItemDef(slot);
    if (!def) continue;
    for (const mult of [def.mult_a, def.mult_b]) {
      if (mult) sums[mult.stat] += mult.value;
    }
  }
  return sums;
}

/** §9c soft-capped multiplier for one stat from its raw additive sum. */
export function bucketMultiplier(stat: ItemStat, sums: StatSums): number {
  const addCap = GEAR_SOFT_CAP_MULT[stat] - 1;
  const raw = sums[stat];
  return 1 + Math.min(raw, addCap) + GEAR_DIMINISHING_RATE * Math.max(0, raw - addCap);
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
  equipped: Readonly<Partial<Record<ItemSlot, string>>>,
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
  // stub table. Real ids go into inventory; the UI only ever sees names.
  const items = Array.from({ length: research.readyFinds }, () => rollResearchFind(rng));

  const next: PlayStoreDoc = {
    ...doc,
    tokens: doc.tokens + tendTokens + dailyBonusTokens,
    ...nextDive,
    inventory: [...doc.inventory, ...items],
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
  const firstFind = rollResearchFind(rng);
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

/** Bank the current haul into inventory and end the run. Null when idle. */
export function surfaceDive(
  doc: PlayStoreDoc,
): { doc: PlayStoreDoc; banked: string[] } | null {
  const run = doc.dive_run;
  if (!run) return null;
  return {
    doc: { ...doc, dive_run: null, inventory: [...doc.inventory, ...run.haul] },
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
  const bustChance = effectiveBustPct(DIVE_BUST_TABLE[run.deepers], doc.equipped) / 100;
  if (rng() < bustChance) {
    const bustPct = Math.round(bustChance * 100);
    return { doc: { ...doc, dive_run: null }, outcome: { busted: true, bustPct } };
  }
  const addedId = rollResearchFind(rng);
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
 * `inventory` is the whole owned collection (worn or bagged). Equipping writes
 * a slot pointer; unequipping clears it — neither changes the row count. The
 * §9 soft cap (80 rows) gates NEW Power equips while over: you must sell a
 * Look for `LOOK_SELL_TOKENS` first. Looks are the discard fodder (Power items
 * are never sellable). Row count can exceed the cap from Claim / Dive; those
 * keep working.
 * ------------------------------------------------------------------------- */

export type EquipOutcome =
  | { ok: true }
  | { ok: false; reason: 'not_owned' | 'bag_full' };

export type SellOutcome =
  | { ok: true; gainedTokens: number; name: string }
  | { ok: false; reason: 'not_owned' | 'not_look' | 'equipped' };

/** Equip an owned item into its slot. Blocked when over the soft cap and the
 * item is a Power (bag full — sell a Look first). Looks may still swap. */
export function equipItem(
  doc: PlayStoreDoc,
  itemId: string,
): { doc: PlayStoreDoc; outcome: EquipOutcome } {
  if (!doc.inventory.includes(itemId)) {
    return { doc, outcome: { ok: false, reason: 'not_owned' } };
  }
  const def = getItemDef(itemId);
  if (!def) return { doc, outcome: { ok: false, reason: 'not_owned' } };
  if (def.core.kind === 'power' && doc.inventory.length >= INVENTORY_SOFT_CAP) {
    return { doc, outcome: { ok: false, reason: 'bag_full' } };
  }
  return {
    doc: { ...doc, equipped: { ...doc.equipped, [def.core.slot]: itemId } },
    outcome: { ok: true },
  };
}

/** Take an equipped item off; it stays in the collection. */
export function unequipItem(
  doc: PlayStoreDoc,
  slot: ItemSlot,
): { doc: PlayStoreDoc } {
  if (!doc.equipped[slot]) return { doc };
  const equipped = { ...doc.equipped };
  delete equipped[slot];
  return { doc: { ...doc, equipped } };
}

/** Sell one Look for a tiny token gain. Powers are never sellable; you must
 * unequip a worn Look before selling it. */
export function sellItem(
  doc: PlayStoreDoc,
  itemId: string,
): { doc: PlayStoreDoc; outcome: SellOutcome } {
  if (!doc.inventory.includes(itemId)) {
    return { doc, outcome: { ok: false, reason: 'not_owned' } };
  }
  const def = getItemDef(itemId);
  if (!def) return { doc, outcome: { ok: false, reason: 'not_owned' } };
  if (def.core.kind !== 'look') {
    return { doc, outcome: { ok: false, reason: 'not_look' } };
  }
  if (doc.equipped[def.core.slot] === itemId) {
    return { doc, outcome: { ok: false, reason: 'equipped' } };
  }
  return {
    doc: {
      ...doc,
      tokens: doc.tokens + LOOK_SELL_TOKENS,
      inventory: doc.inventory.filter((id) => id !== itemId),
    },
    outcome: { ok: true, gainedTokens: LOOK_SELL_TOKENS, name: def.core.name },
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
  return { doc: { ...doc, inventory: [...doc.inventory, grantedId] }, grantedId };
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
  return { doc: { ...doc, inventory: [...doc.inventory, grantedId] }, grantedId };
}

/** Dev kit: take every slot off (items stay in the collection). */
export function devClearEquipped(doc: PlayStoreDoc): PlayStoreDoc {
  return { ...doc, equipped: {} };
}

/** Dev kit: fill junk Looks up to just over the soft cap, so the §9 "bag full"
 * sell path is testable. No-op when already over the cap. */
export function devFillJunkLooks(doc: PlayStoreDoc): PlayStoreDoc {
  const junk = junkLookId();
  if (!junk || doc.inventory.length >= INVENTORY_SOFT_CAP + 1) return doc;
  const needed = INVENTORY_SOFT_CAP + 1 - doc.inventory.length;
  return {
    ...doc,
    inventory: [...doc.inventory, ...Array.from({ length: needed }, () => junk)],
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
    // v1 (pre-inventory), v2 (inventory), v3 (dive_run) and v4 (equipped) all
    // parse; older versions migrate with empty bag / no run / nothing equipped
    // so a device that already banked tokens keeps them across updates.
    const version = data?.version;
    if (version !== 1 && version !== 2 && version !== 3 && version !== 4) return null;
    const tokens = finiteNumber(data.tokens);
    const diveCharge = finiteNumber(data.dive_charge);
    const diveChargeAt = finiteNumber(data.dive_charge_at);
    const researchStartedAt = finiteNumber(data.research_started_at);
    const researchAccruedMs = finiteNumber(data.research_accrued_ms);
    const lastTend = typeof data.last_tend_bonus_ymd === 'string' ? data.last_tend_bonus_ymd : null;
    if (tokens == null || diveCharge == null || diveChargeAt == null || researchStartedAt == null) {
      return null;
    }
    const inventory = Array.isArray(data.inventory)
      ? data.inventory.filter((id): id is string => typeof id === 'string')
      : [];
    return {
      version: 4,
      tokens: Math.max(0, Math.floor(tokens)),
      dive_charge: clampInt(diveCharge, 0, DIVE_CHARGE_CAP),
      dive_charge_at: diveChargeAt,
      research_started_at: researchStartedAt,
      research_accrued_ms: Math.min(RESEARCH_CAP_MS, Math.max(0, researchAccruedMs ?? 0)),
      last_tend_bonus_ymd: lastTend,
      inventory,
      equipped: parseEquipped(data.equipped),
      dive_run: parseDiveRun(data.dive_run),
    };
  } catch {
    return null;
  }
}

/** Loose-shape read of equipped slots; bad values drop to un-equipped. */
function parseEquipped(raw: unknown): Partial<Record<ItemSlot, string>> {
  if (!isRecord(raw)) return {};
  const equipped: Partial<Record<ItemSlot, string>> = {};
  for (const slot of ['weapon', 'armor', 'cloak', 'trinket'] as const) {
    const value = raw[slot];
    if (typeof value === 'string') equipped[slot] = value;
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
