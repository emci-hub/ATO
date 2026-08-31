import { supabase } from '@/lib/supabase';

export interface CategoryShareStatus {
  allowed: boolean;
  mine: boolean;
  viaPool: boolean;
}

export async function fetchCategoryShareStatus(peerId: string): Promise<CategoryShareStatus | null> {
  const { data, error } = await supabase.rpc('category_share_status', { p_peer: peerId });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    allowed: row.allowed === true,
    mine: row.mine === true,
    viaPool: row.via_pool === true,
  };
}

export async function setCategoryShare(peerId: string, enabled: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { error } = await supabase.from('category_share').upsert(
    { user_id: user.id, peer_id: peerId, enabled, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,peer_id' },
  );
  if (error) throw error;
}

export async function fetchPeerCategoryPack(peerId: string): Promise<unknown | null> {
  const { data, error } = await supabase.rpc('peer_category_pack', { p_user_id: peerId });
  if (error) throw error;
  return data ?? null;
}
