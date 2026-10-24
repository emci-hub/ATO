import { supabase } from '@/lib/supabase';
import type { SageStory } from '@/lib/sage-story';

export async function saveSageStory(userId: string, story: SageStory): Promise<void> {
  const { error } = await supabase
    .from('me')
    .update({ sage_story: story })
    .eq('id', userId);
  if (error) throw error;
}
// The Story is free templates: no client-side charge (`claimStoryGenerate` was removed in roadmap A5).
