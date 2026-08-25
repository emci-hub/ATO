import { supabase } from '@/lib/supabase';

/**
 * Persisted Sage exchanges. The Sage tab shows a live conversation; rows land
 * here so (a) history survives app restarts and (b) a Sage response is a
 * reportable target (floor requirement: report/block work on Sage too).
 * Rows are own-only under RLS.
 */

export interface SageMessage {
  id: string;
  user_id: string;
  role: 'user' | 'sage';
  text: string;
  created_at: string;
}

export async function fetchSageMessages(): Promise<SageMessage[]> {
  const { data, error } = await supabase
    .from('sage_messages')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SageMessage[];
}

export async function addSageMessage(role: 'user' | 'sage', text: string): Promise<SageMessage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('sage_messages')
    .insert({ user_id: user.id, role, text })
    .select()
    .single();
  if (error) throw error;
  return data as SageMessage;
}
