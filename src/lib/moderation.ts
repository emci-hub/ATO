import { supabase } from '@/lib/supabase';

/**
 * Moderation data layer (Stage 7): reports, blocks, mutes.
 *
 * - Block: blocked_by/blocked_user pair. Messages INSERT policy rejects sends
 *   from BOTH parties once a block exists, and the messages SELECT policy hides
 *   the blocked user's lines from the blocker. Both parties may read a block
 *   row so each side renders the right send-disabled state.
 * - Mute: local to the muter only. Only the muter can read their own rows;
 *   the muted user is never notified.
 * - Report: `from / target / reason / at`, target is a message_id (chat or
 *   sage) or a user_id. Rows are admin-visible only (queried in the Supabase
 *   dashboard); the app only ever inserts.
 */

export interface BlockRow {
  blocked_by: string;
  blocked_user: string;
  created_at: string;
}

export interface MuteRow {
  muter: string;
  muted_user: string;
  created_at: string;
}

export type ReportTarget =
  | { kind: 'message'; messageId: string }
  | { kind: 'user'; userId: string };

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Something else' },
] as const;

/** All block rows I'm a party to (I blocked them, or they blocked me). */
export async function fetchMyBlocks(): Promise<BlockRow[]> {
  const { data, error } = await supabase.from('blocks').select('*');
  if (error) throw error;
  return (data ?? []) as BlockRow[];
}

/** Only my own mute rows — mutes are local to the muter. */
export async function fetchMyMutes(): Promise<MuteRow[]> {
  const { data, error } = await supabase.from('mutes').select('*');
  if (error) throw error;
  return (data ?? []) as MuteRow[];
}

export async function blockUser(peerId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('blocks').insert({ blocked_by: user.id, blocked_user: peerId });
  if (error) throw error;
}

export async function unblockUser(peerId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocked_by', user.id)
    .eq('blocked_user', peerId);
  if (error) throw error;
}

export async function muteUser(peerId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('mutes').insert({ muter: user.id, muted_user: peerId });
  if (error) throw error;
}

export async function unmuteUser(peerId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('mutes')
    .delete()
    .eq('muter', user.id)
    .eq('muted_user', peerId);
  if (error) throw error;
}

/**
 * File a report. `target` is a message (chat or sage response) or a user.
 * The row lands in `reports` and is visible to admins in the Supabase
 * dashboard; the reporter never reads it back.
 */
export async function submitReport(target: ReportTarget, reason: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row: { from: string; message_id?: string; user_id?: string; reason: string } =
    target.kind === 'message'
      ? { from: user.id, message_id: target.messageId, reason }
      : { from: user.id, user_id: target.userId, reason };

  const { error } = await supabase.from('reports').insert(row);
  if (error) throw error;
}
