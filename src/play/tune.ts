/**
 * Grove Tune doc — local overrides only (GAME_SPEC §9c Dev Tune panel).
 *
 * Every knob the engines read has its Sane (ship) default here, and presets
 * swap the whole doc. The engines call `getTune()` lazily at use time, so
 * applying a preset changes live behavior on the next engine read (spec: live,
 * restart wave to apply). Writes are LOCAL — persisted to AsyncStorage under
 * its own key, never synced to other players, and the panel is PRE_LAUNCH_DEV
 * only. `applyPreset('sane')` is the Reset action.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TUNE_STORE_KEY = 'ato.play.tune.v1';

export type TunePresetId = 'sane' | 'juicy' | 'brutal' | 'brokenop';

export type TuneDoc = {
  /** Wave HP growth per wave past 1 (§9c wave_hp_per_level, default 0.12). */
  waveHpPerLevel: number;
  /** Enemy-count growth per wave (§9c wave_count_per_level, default 1.2). */
  waveCountPerLevel: number;
  /** Each run's starting scrap (§9c/GAME_DATA start_scrap, default 80). */
  startScrap: number;
  /** Tokens per clear (§9c token_clear_base, default 50). */
  tokenClearBase: number;
  /** Soft-cap multiplier for wave_power gear (§9c, default 2.0). */
  gearSoftcapWavePower: number;
  /** Soft-cap multiplier for other gear stats (§9c, default 1.5). */
  gearSoftcapOther: number;
  /** Strength of gear rolls past the soft cap (§9c, default 0.25). */
  diminishingAfterCap: number;
  /** Whole-% boost added to the Dive bust table per Deeper (default 0 —
   * negative = softer, positive = harsher; the §9c dive_bust_per_deeper knob). */
  diveBustBoostPct: number;
  /** Scrap per kill (§9c scrap_kill, default 3). */
  scrapKill: number;
  /** Clears before token rewards halve (§9c daily_clear_half_after, default 5). */
  dailyClearHalfAfter: number;
  /** Avatar auto-attack cooldown, seconds (§9c avatar_cooldown, default 0.7). */
  avatarCooldownMs: number;
  /** Global tower-cooldown scale (≥1 = slower, <1 = faster). Default 1.0. */
  towerCooldownScale: number;
  /** Root Veil slow strength, 0..1 fraction of speed kept (§9d slow_pct .35). */
  skillSlowPct: number;
  /** Root Veil cooldown, ms (§9d cooldown 12 → 12_000). */
  skillCooldownMs: number;
  /** God mode — leak does not fail the wave (brokenop only). */
  godMode: boolean;
  /** Forever-engine cycle-power growth step (cycle_power = 1 + cycles × this,
   * Sane 0.12). Not wired to a live system yet — tune-ready for the engine. */
  cyclePowerStep: number;
  /** Soft type-match bonus when an equipped Power's tag == the cycle tint
   *   (§9f locked default +0.20). Mismatch stays neutral (no −%). */
  typeMatchBonus: number;
  /** Avatar star drop chance on a Final clear (§9h, 25% once/cycle). */
  avatarStarDropPct: number;
  /** Final clears in a cycle before the Avatar star is guaranteed (pity). */
  avatarStarPityClears: number;
  /** +% base wave_power per Avatar star when a star token is spent (§9h). */
  avatarStarWavePowerStep: number;
  /** Skip-to-even gate (§9j): offer skip when GS ≥ this × recommended(next). */
  skipGsThreshold: number;
  /** Skip-to-even pay (§9j): fraction of a real clear's tokens/XP per skipped
   * wave (spec 40–50%). */
  skipPayFraction: number;
};

/** Sane = the ship defaults the engines shipped with. */
export const SANE_TUNE: TuneDoc = {
  waveHpPerLevel: 0.12,
  waveCountPerLevel: 1.2,
  startScrap: 80,
  tokenClearBase: 50,
  gearSoftcapWavePower: 2.0,
  gearSoftcapOther: 1.5,
  diminishingAfterCap: 0.25,
  diveBustBoostPct: 0,
  scrapKill: 3,
  dailyClearHalfAfter: 5,
  avatarCooldownMs: 700,
  towerCooldownScale: 1.0,
  skillSlowPct: 0.35,
  skillCooldownMs: 12_000,
  godMode: false,
  cyclePowerStep: 0.12,
  typeMatchBonus: 0.2,
  avatarStarDropPct: 0.25,
  avatarStarPityClears: 3,
  avatarStarWavePowerStep: 0.03,
  skipGsThreshold: 1.25,
  skipPayFraction: 0.45,
};

export const TUNE_PRESETS: Record<TunePresetId, TuneDoc> = {
  sane: SANE_TUNE,
  juicy: {
    ...SANE_TUNE,
    startScrap: 90,
    tokenClearBase: 80,
    dailyClearHalfAfter: 8,
    waveHpPerLevel: 0.1,
    diveBustBoostPct: -5,
    avatarCooldownMs: 600,
    towerCooldownScale: 0.9,
    skillCooldownMs: 9_000,
  },
  brutal: {
    ...SANE_TUNE,
    waveHpPerLevel: 0.2,
    waveCountPerLevel: 1.5,
    startScrap: 60,
    tokenClearBase: 60,
    diveBustBoostPct: 6,
    gearSoftcapWavePower: 1.2,
    gearSoftcapOther: 1.0,
    avatarCooldownMs: 800,
    towerCooldownScale: 1.1,
    skillCooldownMs: 14_000,
  },
  brokenop: {
    ...SANE_TUNE,
    waveHpPerLevel: 0.04,
    waveCountPerLevel: 0.8,
    startScrap: 200,
    tokenClearBase: 300,
    gearSoftcapWavePower: 8,
    gearSoftcapOther: 6,
    diminishingAfterCap: 0.1,
    diveBustBoostPct: -10,
    scrapKill: 20,
    dailyClearHalfAfter: 99,
    avatarCooldownMs: 200,
    towerCooldownScale: 0.4,
    skillCooldownMs: 3_000,
    godMode: true,
  },
};

// In-memory current doc. Starts Sane; the panel hydrates from AsyncStorage on
// mount and mutates this + persists, so engine reads reflect it immediately.
let current: TuneDoc = { ...SANE_TUNE };
let preset: TunePresetId | 'custom' = 'sane';

/** Current tune doc (the getTune() layer every engine reads). */
export function getTune(): TuneDoc {
  return current;
}

/** Which preset produced the current doc ('custom' after hand knobs). */
export function currentPreset(): TunePresetId | 'custom' {
  return preset;
}

/** Set the active preset (each preset is a full doc). `'sane'` = Reset. */
export function applyPreset(id: TunePresetId): TuneDoc {
  current = { ...TUNE_PRESETS[id] };
  preset = id;
  return current;
}

/** Mutate one knob; the doc becomes custom but keeps every other value. */
export function setKnob<K extends keyof TuneDoc>(key: K, value: TuneDoc[K]): TuneDoc {
  current = { ...current, [key]: value };
  preset = 'custom';
  return current;
}

/** Persist the current doc locally (never synced — this is a dev tool). */
export async function saveTune(): Promise<void> {
  try {
    await AsyncStorage.setItem(
      TUNE_STORE_KEY,
      JSON.stringify({ preset, doc: current }),
    );
  } catch {
    // Dev tool — a failed save just means next launch starts Sane.
  }
}

/** Load the last doc + preset; falls back to Sane (and persists it). */
export async function loadTune(): Promise<TuneDoc> {
  try {
    const raw = await AsyncStorage.getItem(TUNE_STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { preset?: TunePresetId; doc?: Partial<TuneDoc> };
      if (data?.doc && typeof data.doc === 'object') {
        current = { ...SANE_TUNE, ...data.doc };
        preset =
          data.preset && TUNE_PRESETS[data.preset] ? data.preset : 'custom';
        return current;
      }
    }
  } catch {
    // Fall through to Sane.
  }
  current = { ...SANE_TUNE };
  preset = 'sane';
  return current;
}
