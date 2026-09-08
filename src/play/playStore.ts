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
export const INVENTORY_SOFT_CAP = 80; // soft cap: total items across stacks (sum of counts)
export const LOOK_SELL_TOKENS = 3; // GAME_DATA look_sell_tokens

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
 * `equipped` (step 4); v5 re-shaped `inventory` from a string[] of owned ids
 * (worn included) into `ItemStack[]` of bagged copies (worn excluded); v6
 * (this step) added a `star` tier to every stack copy and changed `equipped`
 * from slot → id into slot → `{ id, star }` so a worn merge result survives.
 * v1–v5 docs migrate (legacy copies are star 0). Still to come behind later
 * bumps: Defend adds `highest_wave_cleared`.
 */
export type PlayStoreDoc = {
  version: 6;
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
    version: 6,
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
    // v1 (pre-inventory) … v5 (stacked bags, slot→id equipped) all migrate to
    // v6: legacy copies are star 0, and equipped string ids become refs with
    // star 0. v1–v4 also stored `inventory` as a string[] of owned ids WITH
    // worn copies included, so those subtract one copy per equipped slot.
    const version = data?.version;
    if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6) {
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
    return {
      version: 6,
      tokens: Math.max(0, Math.floor(tokens)),
      dive_charge: clampInt(diveCharge, 0, DIVE_CHARGE_CAP),
      dive_charge_at: diveChargeAt,
      research_started_at: researchStartedAt,
      research_accrued_ms: Math.min(RESEARCH_CAP_MS, Math.max(0, researchAccruedMs ?? 0)),
      last_tend_bonus_ymd: lastTend,
      inventory: parseInventory(data.inventory, equipped, version < 5),
      equipped,
      dive_run: parseDiveRun(data.dive_run),
    };
  } catch {
    return null;
  }
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
