import { supabase } from '@/lib/supabase';

export type TalkStyle = 'quiet' | 'even' | 'loud';

export interface Me {
  id: string;
  name: string;
  handle: string;
  show_up: string;
  talk_style: TalkStyle;
  knocks_you_off: string;
  morning_cue: string;
  timezone: string;
  /** AI consent gate (Apple 5.1.2). null = never asked, true = granted, false = denied. */
  ai_consent: boolean | null;
  /** Raw jsonb; run it through normalizeRecipe before rendering. */
  recipe: unknown;
  /** Facts the user has told Sage (one string per fact). Depth-axis input. */
  facts: string[];
  /** Map of presence-milestone key -> ISO timestamp when its one-time celebration fired. */
  milestones_celebrated: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export type MeInsert = Omit<
  Me,
  'id' | 'ai_consent' | 'recipe' | 'facts' | 'milestones_celebrated' | 'created_at' | 'updated_at'
>;

export type AiConsent = 'granted' | 'denied' | 'pending';

/** Single source of truth for what a consent value means app-wide. */
export function aiConsentFor(me: Pick<Me, 'ai_consent'>): AiConsent {
  if (me.ai_consent === true) return 'granted';
  if (me.ai_consent === false) return 'denied';
  return 'pending';
}

export async function fetchMe(userId: string): Promise<Me | null> {
  const { data, error } = await supabase
    .from('me')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Creates (or updates) the me row for the signed-in user. Uses upsert keyed on
 * the primary key so an existing row is updated instead of colliding. Handle
 * uniqueness is still enforced by the unique index + check constraint, so a
 * duplicate/reserved handle surfaces as a Postgres error instead of overwriting
 * another user's row.
 */
export async function createMe(row: MeInsert): Promise<Me> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('me')
    .upsert({ ...row, id: user.id }, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function errorMessageForHandle(error: unknown): string {
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
