import { supabase } from '@/lib/supabase';
import {
  GRANTABLE_CAPABILITIES,
  isGrantableCapability,
  type DevCapability,
} from '@/lib/dev-access';

export interface DevAccessSnapshot {
  isRoot: boolean;
  capabilities: DevCapability[];
}

export interface MeSearchRow {
  id: string;
  handle: string;
  name: string;
  paused: boolean;
}

export interface DevGrantRow {
  capability: DevCapability;
  granted_at: string;
}

function rpcMessage(error: { message?: string } | null): string {
  return error?.message || 'request_failed';
}

export async function fetchMyDevAccess(): Promise<DevAccessSnapshot> {
  const { data, error } = await supabase.rpc('my_dev_access');
  if (error) throw new Error(rpcMessage(error));
  const raw = data as { is_root?: boolean; capabilities?: unknown } | null;
  const caps = Array.isArray(raw?.capabilities)
    ? raw.capabilities.filter((cap): cap is DevCapability => typeof cap === 'string' && isGrantableCapability(cap))
    : [];
  return {
    isRoot: raw?.is_root === true,
    capabilities: caps,
  };
}

export async function searchMeAccounts(query: string): Promise<MeSearchRow[]> {
  const { data, error } = await supabase.rpc('root_search_me', { p_query: query });
  if (error) throw new Error(rpcMessage(error));
  return (data ?? []) as MeSearchRow[];
}

export async function listDevAccessGrants(handle: string): Promise<DevGrantRow[]> {
  const { data, error } = await supabase.rpc('list_dev_access_grants', { p_handle: handle });
  if (error) throw new Error(rpcMessage(error));
  return ((data ?? []) as { capability: string; granted_at: string }[])
    .filter((row): row is DevGrantRow => isGrantableCapability(row.capability))
    .map((row) => ({ capability: row.capability, granted_at: row.granted_at }));
}

export async function saveDevAccessGrants(handle: string, capabilities: DevCapability[]): Promise<void> {
  const next = capabilities.filter((cap) => GRANTABLE_CAPABILITIES.includes(cap));
  const { error } = await supabase.rpc('set_dev_access_grants', {
    p_handle: handle,
    p_capabilities: next,
  });
  if (error) throw new Error(rpcMessage(error));
}

export async function pauseProfile(handle: string): Promise<void> {
  const { error } = await supabase.rpc('root_pause_profile', { p_handle: handle });
  if (error) throw new Error(rpcMessage(error));
}

export async function unpauseProfile(handle: string): Promise<void> {
  const { error } = await supabase.rpc('root_unpause_profile', { p_handle: handle });
  if (error) throw new Error(rpcMessage(error));
}

export async function deleteProfile(handle: string, confirmHandle: string): Promise<void> {
  const { error } = await supabase.rpc('root_delete_profile', {
    p_handle: handle,
    p_confirm_handle: confirmHandle,
  });
  if (error) throw new Error(rpcMessage(error));
}
