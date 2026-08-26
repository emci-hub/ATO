import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export type SignupMode = 'invite_only' | 'public';

export interface InviteCode {
  code: string;
  max_uses: number;
  uses_count: number;
  status: 'active' | 'used' | 'revoked';
  created_at: string;
}

export interface Referral {
  id: string;
  handle: string;
  name: string;
}

const PENDING_INVITE_KEY = 'ato.pending_invite_code';

export async function fetchSignupMode(): Promise<SignupMode> {
  const { data, error } = await supabase
    .from('app_config')
    .select('signup_mode')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  return data?.signup_mode === 'public' ? 'public' : 'invite_only';
}

/** Peek only — does not consume. Rejects missing/used/invalid in invite_only. */
export async function assertInviteUsable(code: string): Promise<void> {
  const { error } = await supabase.rpc('assert_invite_usable', {
    p_code: code,
  });
  if (error) throw error;
}

export async function fetchMyInviteCodes(): Promise<InviteCode[]> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('code, max_uses, uses_count, status, created_at')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as InviteCode[];
}

/** Own-account list of who you referred. Never who referred you, never a tree. */
export async function fetchMyReferrals(): Promise<Referral[]> {
  const { data, error } = await supabase.rpc('my_referrals');
  if (error) throw error;
  return (data ?? []) as Referral[];
}

export async function setPendingInviteCode(code: string): Promise<void> {
  const trimmed = code.trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(PENDING_INVITE_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_INVITE_KEY, trimmed);
}

export async function getPendingInviteCode(): Promise<string> {
  return (await AsyncStorage.getItem(PENDING_INVITE_KEY)) ?? '';
}

export async function clearPendingInviteCode(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INVITE_KEY);
}

export function errorMessageForInvite(error: unknown): string | null {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  if (code === 'P0001' || message.includes('invite_required')) {
    return 'This app is invite-only. Enter a valid invite code to create an account.';
  }
  if (code === 'P0002' || message.includes('invite_invalid')) {
    return 'That invite code is missing, already used, or invalid.';
  }
  return null;
}
