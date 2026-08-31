import { supabase } from '@/lib/supabase';
import type { SageStory } from '@/lib/sage-story';

export async function saveSageStory(userId: string, story: SageStory): Promise<void> {
  const { error } = await supabase
    .from('me')
    .update({ sage_story: story })
    .eq('id', userId);
  if (error) throw error;
}

export async function claimStoryGenerate(): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('claim_story_generate');
  if (error) throw error;
  if (!data || typeof data !== 'object') return { ok: false, reason: 'empty' };
  const row = data as { ok?: unknown; reason?: unknown };
  return { ok: row.ok === true, reason: typeof row.reason === 'string' ? row.reason : undefined };
}
