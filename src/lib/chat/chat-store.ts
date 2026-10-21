/**
 * Circle chat I/O (Step 14). Every call is a wave108 RPC; the phone only ever sends ciphertext, the
 * two public keys, and (on a report) the reporter's own decrypted copy. Never throws.
 * Signed out → 'signed_out'; wave108 not applied (PGRST202) → 'off'; anything else → 'error'.
 */
import { supabase } from '@/lib/supabase';
import {
  CHAT_REPORT_REASON_IDS,
  type ChatLevel,
  type ChatReportReason,
} from '@/lib/chat/chat-rules';
import type { SealedRow } from '@/lib/chat/chat-crypto';

export type ChatCall<T> = { kind: 'ok'; value: T } | { kind: 'signed_out' } | { kind: 'off' } | { kind: 'error' };

const MISSING_RE = /PGRST202|Could not find the function/i;

async function call<T>(fn: string, args: Record<string, unknown> | undefined, read: (data: unknown) => T | null): Promise<ChatCall<T>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { kind: 'signed_out' };
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return MISSING_RE.test(`${error.code ?? ''} ${error.message ?? ''}`) ? { kind: 'off' } : { kind: 'error' };
    const value = read(data);
    return value == null ? { kind: 'error' } : { kind: 'ok', value };
  } catch {
    return { kind: 'error' };
  }
}

type OkShape = { ok?: unknown; reason?: unknown; key?: unknown; level?: unknown; id?: unknown; at?: unknown } | null;

const LEVELS: readonly ChatLevel[] = ['none', 'warned', 'chat_off', 'banned'];
const asLevel = (v: unknown): ChatLevel => (LEVELS.find((l) => l === v) ?? 'none');

export function publishChatKey(publicKey: string): Promise<ChatCall<boolean>> {
  return call('chat_set_key', { p_public_key: publicKey }, (d) => ((d as OkShape)?.ok === true ? true : (d as OkShape) ? false : null));
}

export type PeerKey = { ok: true; key: string | null; level: ChatLevel } | { ok: false };

export function fetchPeerKey(peer: string): Promise<ChatCall<PeerKey>> {
  return call('chat_peer_key', { p_peer: peer }, (d) => {
    const r = d as OkShape;
    if (!r) return null;
    if (r.ok !== true) return { ok: false } as const;
    return { ok: true, key: typeof r.key === 'string' ? r.key : null, level: asLevel(r.level) } as const;
  });
}

export const CHAT_SEND_NO = ['not_friends', 'chat_off', 'too_long', 'key_changed', 'rate_limited'] as const;
export type ChatSendNo = (typeof CHAT_SEND_NO)[number];

export function sendSealed(
  peer: string,
  row: { ciphertext: string; nonce: string; senderKey: string; recipientKey: string },
): Promise<ChatCall<{ ok: true; id: string; at: string } | { ok: false; reason: ChatSendNo }>> {
  return call(
    'chat_send',
    { p_peer: peer, p_ciphertext: row.ciphertext, p_nonce: row.nonce, p_sender_key: row.senderKey, p_recipient_key: row.recipientKey },
    (d) => {
      const r = d as OkShape;
      if (!r) return null;
      if (r.ok === true && typeof r.id === 'string' && typeof r.at === 'string') return { ok: true, id: r.id, at: r.at } as const;
      const why = CHAT_SEND_NO.find((x) => x === r.reason);
      return why ? ({ ok: false, reason: why } as const) : null;
    },
  );
}

export type StoredRow = SealedRow & { id: string; at: string };

/** Newest first from the server; returned oldest first for the screen. */
export function fetchThread(peer: string, before: string | null): Promise<ChatCall<StoredRow[]>> {
  return call('chat_thread', { p_peer: peer, p_before: before, p_limit: 50 }, (d) => {
    if (!Array.isArray(d)) return null;
    const rows: StoredRow[] = [];
    for (const x of d as Record<string, unknown>[]) {
      if (
        typeof x.id === 'string' &&
        typeof x.mine === 'boolean' &&
        typeof x.ciphertext === 'string' &&
        typeof x.nonce === 'string' &&
        typeof x.sender_key === 'string' &&
        typeof x.recipient_key === 'string' &&
        typeof x.created_at === 'string'
      ) {
        rows.push({
          id: x.id,
          mine: x.mine,
          ciphertext: x.ciphertext,
          nonce: x.nonce,
          senderKey: x.sender_key,
          recipientKey: x.recipient_key,
          at: x.created_at,
        });
      }
    }
    return rows.reverse();
  });
}

export const CHAT_REPORT_NO = ['bad_reason', 'not_found', 'bad_context', 'rate_limited'] as const;
export type ChatReportNo = (typeof CHAT_REPORT_NO)[number];

export function reportChatMessage(
  peer: string,
  reason: ChatReportReason,
  messageId: string,
  context: { id: string; mine: boolean; text: string; at: string }[],
): Promise<ChatCall<{ ok: true } | { ok: false; reason: ChatReportNo }>> {
  if (!CHAT_REPORT_REASON_IDS.includes(reason)) return Promise.resolve({ kind: 'error' });
  return call('chat_report', { p_peer: peer, p_reason: reason, p_message_id: messageId, p_messages: context }, (d) => {
    const r = d as OkShape;
    if (!r) return null;
    if (r.ok === true) return { ok: true } as const;
    const why = CHAT_REPORT_NO.find((x) => x === r.reason);
    return why ? ({ ok: false, reason: why } as const) : null;
  });
}

export function fetchMyChatStatus(): Promise<ChatCall<{ level: ChatLevel; unseenWarning: boolean }>> {
  return call('chat_my_status', undefined, (d) => {
    const r = d as { level?: unknown; unseen_warning?: unknown } | null;
    if (!r) return null;
    return { level: asLevel(r.level), unseenWarning: r.unseen_warning === true };
  });
}

export async function ackChatWarning(): Promise<void> {
  await call('chat_ack_warning', undefined, () => true);
}

/** Same silent block as the Circle menu (wave104 circle_block). */
export function blockFromChat(peer: string): Promise<ChatCall<boolean>> {
  return call('circle_block', { p_peer: peer }, (d) => ((d as OkShape)?.ok === true ? true : (d as OkShape) ? false : null));
}
