import { supabase } from '@/lib/supabase';

/**
 * Logs a crisis flag: user + timestamp only, never the message content (plan:
 * crisis spec, logging). Lets you see if the trigger list needs tuning — not
 * for moderation of the user.
 */
export async function logCrisisFlag(userId: string): Promise<void> {
  const { error } = await supabase.from('crisis_flags').insert({ user_id: userId });
  if (error) throw error;
}
