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
  created_at: string;
  updated_at: string;
}

export type MeInsert = Omit<
  Me,
  'id' | 'ai_consent' | 'recipe' | 'created_at' | 'updated_at'
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
