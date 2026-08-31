import { supabase } from '@/lib/supabase';
import type { SageTitle } from '@/lib/sage-title';
import type { TraitAxis } from '@/lib/traits';

export async function saveSageTitle(userId: string, title: SageTitle): Promise<void> {
  const { error } = await supabase
    .from('me')
    .update({ sage_title: title })
    .eq('id', userId);
  if (error) throw error;
}

export async function insertTitleFlag(input: {
  userId: string;
  title: string;
  lede: string;
  axes: readonly TraitAxis[];
  fingerprint: string;
}): Promise<void> {
  const { error } = await supabase.from('sage_title_flags').insert({
    user_id: input.userId,
    title: input.title,
    lede: input.lede,
    axes: [...input.axes],
    fingerprint: input.fingerprint,
  });
  if (error) throw error;
}

export async function claimTitleGenerate(): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('claim_title_generate');
  if (error) throw error;
  if (!data || typeof data !== 'object') return { ok: false, reason: 'empty' };
  const row = data as { ok?: unknown; reason?: unknown };
  return { ok: row.ok === true, reason: typeof row.reason === 'string' ? row.reason : undefined };
}
