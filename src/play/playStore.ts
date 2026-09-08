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
 *   appended to `inventory`). Dress (step 4) is the consumer; no soft cap here.
 * - Daily tend bonus — +10 tokens once per device-local day on the first Claim
 *   (later also Dress/Decor), tracked by `last_tend_bonus_ymd`.
 *
 * Everything is a pure function of the persisted doc + `now`, so timers survive
 * app kills (AsyncStorage) and the module stays testable. AsyncStorage only —
 * no Supabase `play_*` tables until the optional sync step (see
 * PLAY_DEEPSEEK_HANDOFF.md).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { rollResearchFind } from '@/play/items';

export const PLAY_STORE_KEY = 'ato.play.store.v1';

/** Dive charge energy (GAME_DATA currencies.dive_charge). */
export const DIVE_CHARGE_CAP = 10;
export const DIVE_CHARGE_REFILL_MS = 10 * 60 * 1000; // refill_seconds: 600

/** Research idle earn (GAME_DATA research_default). */
export const RESEARCH_CYCLE_MS = 30 * 60 * 1000; // duration_seconds: 1800
export const RESEARCH_CAP_MS = 10 * 60 * 60 * 1000; // offline_cap_seconds: 36000
export const RESEARCH_MAX_CYCLES = RESEARCH_CAP_MS / RESEARCH_CYCLE_MS; // 20
export const RESEARCH_DIVE_CHARGE_CHANCE = 0.35; // per Claim, not per cycle

/** Tend / daily tend bonus (GAME_SPEC §5). */
export const TEND_MIN_TOKENS = 15;
export const TEND_MAX_TOKENS = 40;
export const DAILY_TEND_BONUS_TOKENS = 10;

/**
 * Persisted shape. Versioned under one key; add fields behind a version bump.
 * v2 added `inventory` (step 2b); still to come behind later bumps: Dress adds
 * `equipped`, Defend adds `highest_wave_cleared`. v1 docs parse to v2 with an
 * empty bag so nothing already on a device resets.
 */
export type PlayStoreDoc = {
  version: 2;
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
  /** Bag of granted item ids (Grove stub table) — Dress consumes this later. */
  inventory: string[];
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
  research: ResearchView;
  /** Daily tend bonus still available this device-local day. */
  tendBonusAvailable: boolean;
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
    version: 2,
    tokens: 0,
    dive_charge: DIVE_CHARGE_CAP, // start full; research claims can top back up
    dive_charge_at: now,
    research_started_at: now,
    research_accrued_ms: 0,
    last_tend_bonus_ymd: null,
    inventory: [],
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
    research: researchAt(doc, now),
    tendBonusAvailable: doc.last_tend_bonus_ymd !== localYmd(new Date(now)),
  };
}

export function canClaimResearch(view: PlayView): boolean {
  return view.research.readyFinds >= 1;
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
    // v1 (pre-inventory) and v2 both parse; v1 migrates with an empty bag so a
    // device that already banked tokens keeps them on the 2b update.
    if (data?.version !== 1 && data?.version !== 2) return null;
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
      version: 2,
      tokens: Math.max(0, Math.floor(tokens)),
      dive_charge: clampInt(diveCharge, 0, DIVE_CHARGE_CAP),
      dive_charge_at: diveChargeAt,
      research_started_at: researchStartedAt,
      research_accrued_ms: Math.min(RESEARCH_CAP_MS, Math.max(0, researchAccruedMs ?? 0)),
      last_tend_bonus_ymd: lastTend,
      inventory,
    };
  } catch {
    return null;
  }
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
