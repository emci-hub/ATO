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

const MESSAGE_COLUMNS = 'id, user_id, role, text, created_at';

let memoryCache: { userId: string; rows: SageMessage[] } | null = null;

function setCache(userId: string, rows: SageMessage[]) {
  memoryCache = { userId, rows };
}

/** Last successful fetch for this user, if any. Lets Sage paint instantly on remount. */
export function peekSageMessages(userId: string): SageMessage[] | null {
  if (!memoryCache || memoryCache.userId !== userId) return null;
  return memoryCache.rows;
}

export async function fetchSageMessages(userId: string): Promise<SageMessage[]> {
  const { data, error } = await supabase
    .from('sage_messages')
    .select(MESSAGE_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as SageMessage[];
  setCache(userId, rows);
  return rows;
}

export async function addSageMessage(role: 'user' | 'sage', text: string): Promise<SageMessage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('sage_messages')
    .insert({ user_id: user.id, role, text })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  const row = data as SageMessage;
  if (memoryCache && memoryCache.userId === user.id) {
    memoryCache = { userId: user.id, rows: [...memoryCache.rows, row] };
  }
  return row;
}
