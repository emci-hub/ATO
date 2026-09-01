import { bornOnFromParts, errorMessageForAge, signupAgeMessage } from '@/lib/age';
import { slugifyCity } from '@/lib/around/slug';
import type {
  CurrentFocus,
  EnergyPattern,
  RecoveryStyle,
  SupportStyle,
} from '@/lib/intake';
import { clearPendingInviteCode, errorMessageForInvite } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import { localYmd } from '@/lib/local-date';
import {
  applySageKnowsDismiss,
  applySageKnowsNotQuite,
  applySageKnowsStillFits,
  applyRankingWeek,
  applyScenarioWeek,
  parseSageKnowsState,
  sageKnowsWeekKey,
  type SageKnowsState,
} from '@/lib/sage-knows';
import { applyForcedPickWrite, applyRankingWrite } from '@/lib/ranking';
import { applyScenarioWrite, type ExtraAxis, type ScenarioPole } from '@/lib/scenario';
import {
  mergeTraitWrite,
  confirmTraitSource,
  traitPatch,
  traitStateFromRow,
  allowedAxesForSource,
  type TraitAxis,
  type TraitSource,
} from '@/lib/traits';
import { withoutFactAt } from '@/lib/facts';
import { historyDiff } from '@/lib/trait-history';
import { insertTraitHistory } from '@/lib/trait-history-store';
import {
  applyEwmaAnswer,
  shouldWriteReportTrack,
  trackFor,
  trackKindForSource,
  type TraitTrack,
} from '@/lib/trait-stability';
import { fetchTraitTracks, upsertTraitTracks } from '@/lib/trait-tracks-store';
import { earnTokensQuiet } from '@/lib/tokens-server';
import { containsFrameworkTerm, FACT_FRAMEWORK_MESSAGE } from '@/lib/voice/framework-fence';
import { voicePresetOf, type VoicePreset } from '@/lib/voice/preset';

export type TalkStyle = 'quiet' | 'even' | 'loud';

export type Me = {
  id: string;
  name: string;
  handle: string;
  show_up: string | null;
  talk_style: TalkStyle | null;
  knocks_you_off: string | null;
  morning_cue: string | null;
  /** Chip phrase. Times the evening Check push (wiring later). Null on skipped intake rows. */
  evening_wind_down: string | null;
  /** Self-report. Null on pre-intake rows. Never a diagnosis. */
  energy_pattern: EnergyPattern | null;
  recovery_style: RecoveryStyle | null;
  support_style: SupportStyle | null;
  current_focus: CurrentFocus | null;
  /** Per-axis write source. Direct is sticky over inferred. Null axes have no key. */
  trait_sources: Record<string, string>;
  /** Per-axis ISO timestamp of last successful write. Null axes have no key. */
  trait_touched_at: Record<string, string>;
  /** Rotation, weekly slot, and per-axis streak for Does Sage know you? */
  sage_knows: SageKnowsState;
  timezone: string;
  /**
   * Typed city slug for Around (e.g. calgary). Never from GPS.
   * Null on accounts created before the field existed.
   */
  city: string | null;
  /**
   * Self-reported date of birth (`YYYY-MM-DD`). Age is computed from this.
   * Null only on accounts created before the field existed.
   */
  born_on: string | null;
  /** AI consent gate (Apple 5.1.2). null = never asked, true = granted, false = denied. */
  ai_consent: boolean | null;
  /** Raw jsonb; run it through normalizeRecipe before rendering. */
  recipe: unknown;
  /** Facts the user has told Sage (one string per fact). Depth-axis input. */
  facts: string[];
  /** Map of presence-milestone key -> ISO timestamp when its one-time celebration fired. */
  milestones_celebrated: Record<string, string>;
  /** Hidden. FK to the ME row that invited this user. Never shown publicly. */
  referred_by: string | null;
  /**
   * Cosmetic Founder badge on You. Default false. Flipped by root only —
   * not Dev/Admin, no extra app access.
   */
  is_founder: boolean;
  /**
   * Visibility for Around faces. Plan name `show`; column is `visible`
   * because SHOW is reserved. Default true. Colors still count when false.
   */
  visible: boolean;
  /** Sage voice. Defaults to close_friend when the column is missing. */
  voice_preset: VoicePreset;
  /** Earned-only notes balance. Never purchased. */
  tokens: number;
  /** Cached Sage title from stable report-track axes. */
  sage_title: unknown;
  /** Cached Sage Story from settled categories. Empty object when none. */
  sage_story: unknown;
  /** Opt-in to the Close Friends category-share pool. Off by default. */
  close_friends_share: boolean;
  /** Weekly You/Sage category spotlight {weekKey, categoryId}. */
  category_spotlight: unknown;
  created_at: string;
  updated_at: string;
} & Record<TraitAxis, number | null>;

export type MeInsert = Omit<
  Me,
  | 'id'
  | 'ai_consent'
  | 'recipe'
  | 'facts'
  | 'milestones_celebrated'
    | 'referred_by'
    | 'is_founder'
    | 'born_on'
    | 'city'
    | 'evening_wind_down'
    | 'energy_pattern'
    | 'recovery_style'
    | 'support_style'
    | 'current_focus'
    | 'openness'
    | 'conscientiousness'
    | 'extraversion'
    | 'agreeableness'
    | 'steadiness'
    | 'attachment_anxiety'
    | 'attachment_avoidance'
    | 'conflict_assertiveness'
    | 'conflict_cooperativeness'
    | 'autonomy'
    | 'competence'
    | 'relatedness'
    | 'growth_mindset'
    | 'locus_of_control'
    | 'self_efficacy'
    | 'playfulness'
    | 'trait_sources'
    | 'trait_touched_at'
    | 'sage_knows'
    | 'visible'
    | 'tokens'
    | 'sage_title'
    | 'sage_story'
    | 'close_friends_share'
    | 'category_spotlight'
    | 'created_at'
    | 'updated_at'
> & {
  invite_code?: string;
  /** Required for a new ME row. YYYY-MM-DD. */
  born_on: string;
  /** Typed city slug. Saved after signup; not part of complete_signup. */
  city?: string | null;
  evening_wind_down: string | null;
  energy_pattern: EnergyPattern | null;
  recovery_style: RecoveryStyle | null;
  support_style: SupportStyle | null;
  current_focus: CurrentFocus | null;
};

export type AiConsent = 'granted' | 'denied' | 'pending';

/** Single source of truth for what a consent value means app-wide. */
export function aiConsentFor(me: Pick<Me, 'ai_consent'>): AiConsent {
  if (me.ai_consent === true) return 'granted';
  if (me.ai_consent === false) return 'denied';
  return 'pending';
}

function withVisible(row: Me): Me {
  const sources =
    row.trait_sources && typeof row.trait_sources === 'object' && !Array.isArray(row.trait_sources)
      ? row.trait_sources
      : {};
  const touched =
    row.trait_touched_at && typeof row.trait_touched_at === 'object' && !Array.isArray(row.trait_touched_at)
      ? row.trait_touched_at
      : {};
  return {
    ...row,
    visible: row.visible !== false,
    is_founder: row.is_founder === true,
    trait_sources: sources,
    trait_touched_at: touched,
    sage_knows: parseSageKnowsState(row.sage_knows),
    voice_preset: voicePresetOf(row.voice_preset),
    tokens: typeof row.tokens === 'number' && Number.isFinite(row.tokens) ? Math.max(0, Math.floor(row.tokens)) : 0,
    close_friends_share: row.close_friends_share === true,
    category_spotlight: row.category_spotlight ?? {},
    sage_story: row.sage_story ?? {},
  };
}

function weekKeyFor(me: Pick<Me, 'timezone'>, now: Date = new Date()): string {
  return sageKnowsWeekKey(localYmd(now, me.timezone || 'UTC'));
}

export async function fetchMe(userId: string): Promise<Me | null> {
  const { data, error } = await supabase
    .from('me')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? withVisible(data as Me) : null;
}

/**
 * Creates (or updates) the me row for the signed-in user via complete_signup.
 * In invite_only mode a valid unused code is required and consumed atomically
 * with the insert — a handle collision rolls the consume back. Clients cannot
 * set referred_by themselves.
 */
export async function createMe(row: MeInsert): Promise<Me> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { invite_code, ...profile } = row;
  const { data, error } = await supabase
    .rpc('complete_signup', {
      p_name: profile.name,
      p_handle: profile.handle,
      p_show_up: profile.show_up,
      p_talk_style: profile.talk_style,
      p_knocks_you_off: profile.knocks_you_off,
      p_morning_cue: profile.morning_cue,
      p_timezone: profile.timezone,
      p_invite_code: invite_code?.trim() ? invite_code.trim() : null,
      p_born_on: profile.born_on,
      p_evening_wind_down: profile.evening_wind_down,
      p_energy_pattern: profile.energy_pattern,
      p_recovery_style: profile.recovery_style,
      p_support_style: profile.support_style,
      p_current_focus: profile.current_focus,
    })
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Not authenticated');
  await clearPendingInviteCode();
  const created = withVisible(data as Me);
  const citySlug = profile.city?.trim() ? profile.city.trim() : null;
  if (citySlug) return setCity(created.id, citySlug);
  return created;
}

/**
 * Post-onboarding write of `born_on`. Re-runs the same parse + 16+ check
 * onboarding uses. The Around 18+ gate still reads the stored date.
 */
export async function setBornOn(userId: string, bornOn: string): Promise<Me> {
  const [year = '', month = '', day = ''] = bornOn.split('-');
  const parsed = bornOnFromParts(year, month, day);
  if (!parsed.ok) {
    throw Object.assign(new Error(parsed.message), { code: 'P0004' });
  }
  const blocked = signupAgeMessage(parsed.bornOn);
  if (blocked) {
    throw Object.assign(new Error(blocked), { code: 'P0005' });
  }

  const { data, error } = await supabase
    .from('me')
    .update({ born_on: parsed.bornOn })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return withVisible(data as Me);
}

/** Typed city slug for Around. Null clears it. Never from GPS. */
export async function setCity(userId: string, city: string | null): Promise<Me> {
  const slug = city ? slugifyCity(city) : null;
  const { data, error } = await supabase
    .from('me')
    .update({ city: slug })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.log('[me] setCity error:', error);
    throw error;
  }
  return withVisible(data as Me);
}

/** Sage voice. close_friend is the default. Does not bypass sage.txt rules. */
export async function setVoicePreset(userId: string, voicePreset: VoicePreset): Promise<Me> {
  const { data, error } = await supabase
    .from('me')
    .update({ voice_preset: voicePreset })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return withVisible(data as Me);
}

/** Around face visibility. Colors still count when this is false. */
export async function setVisible(userId: string, visible: boolean): Promise<Me> {
  const { data, error } = await supabase
    .from('me')
    .update({ visible })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.log('[me] setVisible error:', error);
    throw error;
  }
  return withVisible(data as Me);
}

export async function setCloseFriendsShare(userId: string, enabled: boolean): Promise<Me> {
  const { data, error } = await supabase
    .from('me')
    .update({ close_friends_share: enabled })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return withVisible(data as Me);
}

export async function saveCategorySpotlight(
  userId: string,
  spotlight: { weekKey: string; categoryId: string },
): Promise<Me> {
  const { data, error } = await supabase
    .from('me')
    .update({ category_spotlight: spotlight })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return withVisible(data as Me);
}

/** Post-onboarding edit of the 9 core intake fields. Same chip values as signup. */
export type IntakePatch = Partial<{
  talk_style: TalkStyle;
  show_up: string;
  knocks_you_off: string;
  morning_cue: string;
  evening_wind_down: string;
  energy_pattern: EnergyPattern;
  recovery_style: RecoveryStyle;
  support_style: SupportStyle;
  current_focus: CurrentFocus;
}>;

export async function updateIntake(userId: string, patch: IntakePatch): Promise<Me> {
  const { data, error } = await supabase
    .from('me')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return withVisible(data as Me);
}

export { FACT_FRAMEWORK_MESSAGE };

async function persistMergedTraits(
  current: Me,
  merged: ReturnType<typeof mergeTraitWrite>,
  extra: Record<string, unknown> = {},
  answers: Array<{
    axis: TraitAxis;
    sample: number;
    source: Exclude<TraitSource, 'self_confirm'>;
  }> = [],
): Promise<{ me: Me; wrote: boolean }> {
  const previous = traitStateFromRow(current);
  const nowIso = new Date().toISOString();
  let nextMerged = merged;
  const trackUpdates: TraitTrack[] = [];

  if (answers.length > 0) {
    const tracks = await fetchTraitTracks(current.id).catch(() => [] as TraitTrack[]);
    for (const answer of answers) {
      const kind = trackKindForSource(answer.source);
      const prev = trackFor(tracks, answer.axis, kind);
      const next = applyEwmaAnswer(prev, answer.axis, kind, answer.sample, nowIso);
      trackUpdates.push(next);
      if (kind === 'report') {
        nextMerged = {
          ...nextMerged,
          values: { ...nextMerged.values, [answer.axis]: next.value },
        };
      }
    }
  }

  const rows = historyDiff(previous, nextMerged);
  for (const answer of answers) {
    if (answer.source !== 'self_game') continue;
    const updated = trackUpdates.find((row) => row.axis === answer.axis && row.track === 'game');
    if (!updated) continue;
    if (rows.some((row) => row.axis === answer.axis && row.source === 'self_game')) continue;
    rows.push({ axis: answer.axis, value: updated.value, source: 'self_game' });
  }

  if (rows.length === 0 && trackUpdates.length === 0 && Object.keys(extra).length === 0) {
    return { me: current, wrote: false };
  }

  const patch = { ...traitPatch(nextMerged), ...extra };
  const next =
    rows.length > 0 || Object.keys(extra).length > 0
      ? await persistMe(current.id, patch)
      : current;
  if (rows.length > 0) {
    await insertTraitHistory(current.id, rows).catch((err) => {
      console.log('[traits] history insert error:', err);
    });
  }
  if (trackUpdates.length > 0) {
    await upsertTraitTracks(current.id, trackUpdates).catch((err) => {
      console.log('[traits] track upsert error:', err);
    });
  }
  return { me: next, wrote: rows.length > 0 || trackUpdates.length > 0 };
}

function reportSample(
  merged: ReturnType<typeof mergeTraitWrite>,
  axis: TraitAxis,
  source: Exclude<TraitSource, 'self_confirm' | 'self_game'>,
): Array<{ axis: TraitAxis; sample: number; source: Exclude<TraitSource, 'self_confirm'> }> {
  const sample = merged.values[axis];
  if (sample == null || !Number.isFinite(sample)) return [];
  return [{ axis, sample, source }];
}

function gameSample(
  axis: TraitAxis,
  pole: ScenarioPole,
): Array<{ axis: TraitAxis; sample: number; source: Exclude<TraitSource, 'self_confirm'> }> {
  return [{ axis, sample: pole === 'high' ? 0.8 : 0.2, source: 'self_game' }];
}

function collectAnswers(
  current: ReturnType<typeof traitStateFromRow>,
  incoming: Partial<Record<TraitAxis, number | null>>,
  source: Exclude<TraitSource, 'self_confirm'>,
  allowed: readonly TraitAxis[],
): Array<{ axis: TraitAxis; sample: number; source: Exclude<TraitSource, 'self_confirm'> }> {
  const out: Array<{
    axis: TraitAxis;
    sample: number;
    source: Exclude<TraitSource, 'self_confirm'>;
  }> = [];
  for (const axis of allowed) {
    const raw = incoming[axis];
    if (raw == null || !Number.isFinite(raw)) continue;
    if (source === 'self_game') {
      out.push({ axis, sample: raw, source });
      continue;
    }
    if (!shouldWriteReportTrack(current.sources[axis], source)) continue;
    out.push({ axis, sample: raw, source });
  }
  return out;
}

/**
 * Optional-phase write. Source-aware merge: a later inferred write never
 * overwrites an axis already set by a direct source. Only `allowed` axes
 * are written. last_touched bumps on a successful write. Confirm-upgrade
 * is `confirmTraits` — this path cannot take `self_confirm`.
 */
export async function updateTraits(
  userId: string,
  incoming: Partial<Record<TraitAxis, number | null>>,
  source: Exclude<TraitSource, 'self_confirm'>,
  allowed: readonly TraitAxis[] = allowedAxesForSource(source),
): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const state = traitStateFromRow(current);
  const merged = mergeTraitWrite(state, incoming, source, allowed);
  const answers = collectAnswers(state, incoming, source, allowed);
  return (await persistMergedTraits(current, merged, {}, answers)).me;
}

/**
 * Confirm-upgrade persist. Source becomes `self_confirm` and last_touched
 * bumps. The stored 0–1 number is never in this signature and never changes.
 */
export async function confirmTraits(userId: string, axes: readonly TraitAxis[]): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const confirmed = confirmTraitSource(traitStateFromRow(current), axes);
  const patch = traitPatch(confirmed);
  const { data, error } = await supabase
    .from('me')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return withVisible(data as Me);
}

async function persistMe(
  userId: string,
  patch: Record<string, unknown>,
): Promise<Me> {
  const { data, error } = await supabase.from('me').update(patch).eq('id', userId).select().single();
  if (error) throw error;
  return withVisible(data as Me);
}

/** Still fits — confirm-upgrade + streak. Number does not move. */
export async function recordSageKnowsFits(userId: string, axis: TraitAxis): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const now = new Date();
  const confirmed = confirmTraitSource(traitStateFromRow(current), [axis], now.toISOString());
  const knows = applySageKnowsStillFits(
    parseSageKnowsState(current.sage_knows),
    axis,
    weekKeyFor(current, now),
    now.toISOString(),
  );
  return persistMe(userId, { ...traitPatch(confirmed), sage_knows: knows });
}

/** Not quite — Settings write on one axis + streak reset. */
export async function recordSageKnowsCorrection(
  userId: string,
  axis: TraitAxis,
  value: number,
): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const now = new Date();
  const state = traitStateFromRow(current);
  const merged = mergeTraitWrite(
    state,
    { [axis]: value },
    'self_settings',
    [axis],
    now.toISOString(),
  );
  const knows = applySageKnowsNotQuite(
    parseSageKnowsState(current.sage_knows),
    axis,
    weekKeyFor(current, now),
  );
  return (await persistMergedTraits(current, merged, { sage_knows: knows }, [
    { axis, sample: value, source: 'self_settings' },
  ])).me;
}

/** Dismiss ends this week's turn. Does not deal another axis. */
export async function recordSageKnowsDismiss(userId: string, axis: TraitAxis): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const knows = applySageKnowsDismiss(
    parseSageKnowsState(current.sage_knows),
    axis,
    weekKeyFor(current),
  );
  return persistMe(userId, { sage_knows: knows });
}

/** Ranking save — `self_tap` on one axis + claims this week's Home/Sage slot. */
export async function recordRanking(
  userId: string,
  axis: TraitAxis,
  order: readonly string[],
): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const now = new Date();
  const merged = applyRankingWrite(
    traitStateFromRow(current),
    axis,
    order,
    now.toISOString(),
  );
  const knows = applyRankingWeek(
    parseSageKnowsState(current.sage_knows),
    axis,
    weekKeyFor(current, now),
    'answered',
  );
  const { me: next, wrote } = await persistMergedTraits(
    current,
    merged,
    { sage_knows: knows },
    reportSample(merged, axis, 'self_tap'),
  );
  if (wrote) earnTokensQuiet('game_round');
  return next;
}

/** Ranking dismiss ends this week's turn. Does not write an axis. */
export async function recordRankingDismiss(userId: string, axis: TraitAxis): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const knows = applyRankingWeek(
    parseSageKnowsState(current.sage_knows),
    axis,
    weekKeyFor(current),
    'dismissed',
  );
  return persistMe(userId, { sage_knows: knows });
}

/** Scenario pick — `self_game` on one extra axis + claims the game-invite week. */
export async function recordScenario(
  userId: string,
  axis: ExtraAxis,
  pole: ScenarioPole,
): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const now = new Date();
  const merged = applyScenarioWrite(
    traitStateFromRow(current),
    axis,
    pole,
    now.toISOString(),
  );
  const knows = applyScenarioWeek(
    parseSageKnowsState(current.sage_knows),
    axis,
    weekKeyFor(current, now),
    'answered',
  );
  const { me: next, wrote } = await persistMergedTraits(
    current,
    merged,
    { sage_knows: knows },
    gameSample(axis, pole),
  );
  if (wrote) earnTokensQuiet('game_round');
  return next;
}

/** Standalone ranking — same self_tap merge, does not claim the weekly Ask. */
export async function recordStandaloneRanking(
  userId: string,
  axis: TraitAxis,
  order: readonly string[],
): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const merged = applyRankingWrite(
    traitStateFromRow(current),
    axis,
    order,
    new Date().toISOString(),
  );
  const { me: next, wrote } = await persistMergedTraits(
    current,
    merged,
    {},
    reportSample(merged, axis, 'self_tap'),
  );
  if (wrote) earnTokensQuiet('game_round');
  return next;
}

/** Compare-two pick from RANKING_ROUNDS poles. self_tap. No weekly slot. */
export async function recordForcedPick(
  userId: string,
  axis: TraitAxis,
  pole: 'high' | 'low',
): Promise<{ me: Me; wrote: boolean }> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const merged = applyForcedPickWrite(
    traitStateFromRow(current),
    axis,
    pole,
    new Date().toISOString(),
  );
  const result = await persistMergedTraits(
    current,
    merged,
    {},
    reportSample(merged, axis, 'self_tap'),
  );
  if (result.wrote) earnTokensQuiet('game_round');
  return result;
}
export async function recordStandaloneScenario(
  userId: string,
  axis: ExtraAxis,
  pole: ScenarioPole,
): Promise<{ me: Me; wrote: boolean }> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const merged = applyScenarioWrite(
    traitStateFromRow(current),
    axis,
    pole,
    new Date().toISOString(),
  );
  const result = await persistMergedTraits(current, merged, {}, gameSample(axis, pole));
  if (result.wrote) earnTokensQuiet('game_round');
  return result;
}

/** Scenario dismiss ends this week's turn. Does not write an axis. */
export async function recordScenarioDismiss(userId: string, axis: ExtraAxis): Promise<Me> {
  const current = await fetchMe(userId);
  if (!current) throw new Error('Not authenticated');
  const knows = applyScenarioWeek(
    parseSageKnowsState(current.sage_knows),
    axis,
    weekKeyFor(current),
    'dismissed',
  );
  return persistMe(userId, { sage_knows: knows });
}

export const RESERVED_HANDLES = [
  'ato',
  'sage',
  'admin',
  'support',
  'you',
  'astrollogs',
] as const;

export function normalizeHandle(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
}

export function handleFormatError(raw: string): string | null {
  const handle = normalizeHandle(raw);
  if (!handle) return 'Pick a handle.';
  if ((RESERVED_HANDLES as readonly string[]).includes(handle)) {
    return 'That handle is reserved.';
  }
  return null;
}

/**
 * Live uniqueness check for the account step. Reserved names fail here too.
 * createMe still enforces unique/reserved at insert (race after this check).
 */
export async function checkHandleAvailable(
  raw: string,
): Promise<{ ok: true; handle: string } | { ok: false; message: string }> {
  const format = handleFormatError(raw);
  if (format) return { ok: false, message: format };
  const handle = normalizeHandle(raw);
  const { data, error } = await supabase.rpc('public_profile', { p_handle: handle });
  if (error) return { ok: false, message: "Couldn't check that handle. Try again." };
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length > 0) return { ok: false, message: 'That handle is already taken' };
  return { ok: true, handle };
}

export function errorMessageForHandle(error: unknown): string {
  const inviteMessage = errorMessageForInvite(error);
  if (inviteMessage) return inviteMessage;
  const ageMessage = errorMessageForAge(error);
  if (ageMessage) return ageMessage;
  const code = (error as { code?: string })?.code;
  if (code === '23505') return 'That handle is already taken';
  if (code === '23514') return 'That handle is reserved';
  return 'Something went wrong saving your profile. Try again.';
}

/**
 * Records the AI consent choice on the me row. RLS restricts the update to the
 * row owned by the signed-in user. Returns the refreshed row.
 */
export async function setAiConsent(userId: string, consent: boolean): Promise<Me> {
  const { data, error } = await supabase
    .from('me')
    .update({ ai_consent: consent })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.log('[me] setAiConsent error:', error);
    throw error;
  }
  return data;
}

/**
 * Marks a presence milestone (e.g. "7" or "21") as celebrated with the current
 * timestamp. Idempotent per milestone: returns the refreshed row. Called only
 * when a milestone celebration fires, so each threshold shows exactly once.
 */
export async function markMilestoneCelebrated(
  userId: string,
  milestone: string,
): Promise<Me> {
  const { data: current } = await supabase
    .from('me')
    .select('milestones_celebrated')
    .eq('id', userId)
    .single();
  const celebrated: Record<string, string> =
    current?.milestones_celebrated && typeof current.milestones_celebrated === 'object'
      ? (current.milestones_celebrated as Record<string, string>)
      : {};
  celebrated[milestone] = new Date().toISOString();

  const { data, error } = await supabase
    .from('me')
    .update({ milestones_celebrated: celebrated })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Appends a fact the user told Sage. Depth-axis input; Stage 7's "Teach Sage
 * this" will call this. Idempotent by exact string.
 */
export async function addFact(userId: string, fact: string): Promise<Me> {
  const trimmed = fact.trim();
  if (!trimmed) throw new Error('Fact cannot be empty');
  if (containsFrameworkTerm(trimmed)) throw new Error(FACT_FRAMEWORK_MESSAGE);

  const { data: current } = await supabase
    .from('me')
    .select('facts')
    .eq('id', userId)
    .single();
  const facts = Array.isArray(current?.facts) ? (current.facts as string[]) : [];
  if (!facts.includes(trimmed)) facts.push(trimmed);

  const { data, error } = await supabase
    .from('me')
    .update({ facts })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Removes one stored fact by index. Same ME update as addFact — no new
 * write channel. Empty `facts` after the last delete is valid.
 */
export async function removeFact(userId: string, index: number): Promise<Me> {
  const { data: current } = await supabase
    .from('me')
    .select('facts')
    .eq('id', userId)
    .single();
  const facts = withoutFactAt(current?.facts, index);

  const { data, error } = await supabase
    .from('me')
    .update({ facts })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
