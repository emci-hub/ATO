import { supabase } from '@/lib/supabase';

/**
 * Chat data layer (Stage 7). One thread per Circle connection; a thread only
 * ever exists between two connected users. History stays — delete-a-line is
 * delete-for-me via `deleted_for`, enforced server-side by the messages SELECT
 * policy and executed through a security-definer RPC so only the sender can
 * mark their own line.
 */

export interface ChatThread {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  text: string;
  deleted_for: string[];
  created_at: string;
}

/**
 * Resolves the canonical thread between me and `peerId`, creating it if this
 * is the first message. Requires an active connection in both directions
 * (enforced inside the RPC); after an unfriend the existing thread stays
 * readable but no new messages can be sent (messages INSERT policy requires
 * a live connection).
 */
export async function getOrCreateThread(peerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_thread', { p_peer: peerId });
  if (error) throw error;
  return data as string;
}

export async function fetchThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendChatMessage(threadId: string, text: string): Promise<ChatMessage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, sender_id: user.id, text })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

/** Delete-a-line: only the sender may hide a line for themselves. */
export async function deleteMessageForMe(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_message_for_me', { p_message_id: messageId });
  if (error) throw error;
}
