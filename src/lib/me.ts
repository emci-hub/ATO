import { errorMessageForAge } from '@/lib/age';
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
  parseSageKnowsState,
  sageKnowsWeekKey,
  type SageKnowsState,
} from '@/lib/sage-knows';
import { applyRankingWrite } from '@/lib/ranking';
import {
  mergeTraitWrite,
  confirmTraitSource,
  traitPatch,
  traitStateFromRow,
  allowedAxesForSource,
  type TraitAxis,
  type TraitSource,
} from '@/lib/traits';
import { containsFrameworkTerm, FACT_FRAMEWORK_MESSAGE } from '@/lib/voice/framework-fence';

export type TalkStyle = 'quiet' | 'even' | 'loud';

export interface Me {
  id: string;
  name: string;
  handle: string;
  show_up: string;
  talk_style: TalkStyle;
  knocks_you_off: string;
  morning_cue: string;
  /** Chip phrase. Times the evening Check push (wiring later). Null on pre-intake rows. */
  evening_wind_down: string | null;
  /** Self-report. Null on pre-intake rows. Never a diagnosis. */
  energy_pattern: EnergyPattern | null;
  recovery_style: RecoveryStyle | null;
  support_style: SupportStyle | null;
  current_focus: CurrentFocus | null;
  /** Optional 0–1 self-report. Null when skipped. Never a diagnosis. */
  openness: number | null;
  conscientiousness: number | null;
  extraversion: number | null;
  agreeableness: number | null;
  steadiness: number | null;
  attachment_anxiety: number | null;
  attachment_avoidance: number | null;
  conflict_assertiveness: number | null;
  conflict_cooperativeness: number | null;
  autonomy: number | null;
  competence: number | null;
  relatedness: number | null;
  growth_mindset: number | null;
  locus_of_control: number | null;
  self_efficacy: number | null;
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
   * Visibility for Around faces. Plan name `show`; column is `visible`
   * because SHOW is reserved. Default true. Colors still count when false.
   */
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export type MeInsert = Omit<
  Me,
  | 'id'
  | 'ai_consent'
  | 'recipe'
  | 'facts'
  | 'milestones_celebrated'
    | 'referred_by'
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
    | 'trait_sources'
    | 'trait_touched_at'
    | 'sage_knows'
    | 'visible'
    | 'created_at'
    | 'updated_at'
> & {
  invite_code?: string;
  /** Required for a new ME row. YYYY-MM-DD. */
  born_on: string;
  /** Typed city slug. Saved after signup; not part of complete_signup. */
  city?: string | null;
  evening_wind_down: string;
  energy_pattern: EnergyPattern;
  recovery_style: RecoveryStyle;
  support_style: SupportStyle;
  current_focus: CurrentFocus;
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
    trait_sources: sources,
    trait_touched_at: touched,
    sage_knows: parseSageKnowsState(row.sage_knows),
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

/** Typed city slug for Around. Null clears it. Never from GPS. */
export async function setCity(userId: string, city: string | null): Promise<Me> {
  const slug = city ? slugifyCity(city) : null;
  const { data, error } = await supabase
    .from('me')
    .update({ city: slug })
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
  const merged = mergeTraitWrite(traitStateFromRow(current), incoming, source, allowed);
  const patch = traitPatch(merged);
  const { data, error } = await supabase
    .from('me')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return withVisible(data as Me);
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
  const merged = mergeTraitWrite(
    traitStateFromRow(current),
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
  return persistMe(userId, { ...traitPatch(merged), sage_knows: knows });
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
  return persistMe(userId, { ...traitPatch(merged), sage_knows: knows });
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

  if (error) throw error;
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
