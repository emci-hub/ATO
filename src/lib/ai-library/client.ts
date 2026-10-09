/**
 * Shared library — the phone's three calls (wave93). Never sends card text:
 *
 *   serveLibraryCard  free: an unseen card from the bucket (library_serve)
 *   writeLibraryCard  the server writes a new card (`ai-library` Edge Function):
 *                     paid (5 tokens), the free Legends reveal, or a root seed
 *   reportLibraryCard "Report this card" (two different people retire it)
 *
 * 'missing' = wave93 / the function isn't live yet: callers fall back to how
 * things worked before (nothing breaks on an older server).
 */
import { supabase } from '@/lib/supabase';

import { LIBRARY_VERSION, sharedCardLine, type LibraryKind } from './types';

export interface LibraryServed<T> {
  id: string;
  angle: string;
  card: T;
  /** Others who got this same card (only from 5 people up), or null. */
  others: number | null;
}

export type ServeResult<T> =
  | { ok: true; served: LibraryServed<T> }
  | { ok: false; reason: 'empty' | 'daily' | 'crisis' | 'missing' | 'failed' };

export type WriteResult<T> =
  | { ok: true; served: LibraryServed<T> | null; written: number }
  | { ok: false; reason: 'tokens' | 'quota' | 'consent' | 'crisis' | 'bucket' | 'missing' | 'failed' };

const MISSING_RE = /PGRST202|Could not find the function|404|not found/i;

function readServed<T>(raw: unknown, readCard: (raw: unknown) => T | null): LibraryServed<T> | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.ok !== true || typeof row.id !== 'string') return null;
  const card = readCard(row.card);
  if (!card) return null;
  return {
    id: row.id,
    angle: typeof row.angle === 'string' ? row.angle : 'x',
    card,
    others: typeof row.others === 'number' && row.others >= 4 ? row.others : null,
  };
}

export async function serveLibraryCard<T>(
  kind: LibraryKind,
  bucket: string,
  readCard: (raw: unknown) => T | null,
): Promise<ServeResult<T>> {
  try {
    const { data, error } = await supabase.rpc('library_serve', {
      p_kind: kind,
      p_bucket: bucket,
      p_version: LIBRARY_VERSION[kind],
    });
    if (error) return { ok: false, reason: MISSING_RE.test(`${error.code ?? ''} ${error.message ?? ''}`) ? 'missing' : 'failed' };
    const row = data as { ok?: unknown; reason?: unknown } | null;
    if (row?.ok !== true) {
      const reason = row?.reason;
      return { ok: false, reason: reason === 'daily' || reason === 'crisis' || reason === 'empty' ? reason : 'failed' };
    }
    const served = readServed(data, readCard);
    // A card shape this app doesn't know counts as a miss, never a crash.
    return served ? { ok: true, served } : { ok: false, reason: 'empty' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export async function writeLibraryCard<T>(
  kind: LibraryKind,
  bucket: string,
  mode: 'paid' | 'free_legend' | 'seed',
  readCard: (raw: unknown) => T | null,
): Promise<WriteResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-library', { body: { kind, bucket, mode } });
    let body: unknown = data;
    if (error) {
      const context = (error as { context?: unknown }).context;
      if (context && typeof (context as Response).json === 'function') {
        const status = (context as Response).status;
        if (status === 404) return { ok: false, reason: 'missing' };
        body = await (context as Response).json().catch(() => null);
      } else {
        return { ok: false, reason: MISSING_RE.test(error.message ?? '') ? 'missing' : 'failed' };
      }
    }
    const row = body as { ok?: unknown; reason?: unknown; served?: unknown; written?: unknown } | null;
    if (row?.ok !== true) {
      const r = row?.reason;
      const known = ['tokens', 'quota', 'consent', 'crisis', 'bucket'] as const;
      return { ok: false, reason: (known as readonly unknown[]).includes(r) ? (r as (typeof known)[number]) : 'failed' };
    }
    return {
      ok: true,
      served: row.served ? readServed(row.served, readCard) : null,
      written: typeof row.written === 'number' ? row.written : 0,
    };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Look-ahead (wave94): tell the server which groups this reader will need
 * (keys only, never text). The hourly fill writes them so the next tap is free
 * and instant. Best effort: a failure changes nothing on screen.
 */
export async function wantLibraryCards(kind: LibraryKind, buckets: readonly string[]): Promise<boolean> {
  const list = [...new Set(buckets)].filter((b) => /^[a-z0-9_|:=+,.!-]{3,300}$/.test(b)).slice(0, 11);
  if (list.length === 0) return false;
  try {
    const { data, error } = await supabase.rpc('library_want', {
      p_kind: kind,
      p_buckets: list,
      p_version: LIBRARY_VERSION[kind],
    });
    return !error && (data as { ok?: unknown } | null)?.ok === true;
  } catch {
    return false;
  }
}

/** Team size for a deep-dive group (only from 5 people up, never who), or null. */
export async function fetchTeamSize(bucket: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('library_team_size', { p_bucket: bucket });
    return !error && typeof data === 'number' && data >= 5 ? data : null;
  } catch {
    return null;
  }
}

export async function reportLibraryCard(cardId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('library_report', { p_card_id: cardId });
    return !error && (data as { ok?: unknown } | null)?.ok === true;
  } catch {
    return false;
  }
}

export { sharedCardLine };

export const LIBRARY_REPORT_LABEL = 'Report this card';
export const LIBRARY_REPORT_CONFIRM = 'Tap again to report';
export const LIBRARY_REPORTED = 'Thanks. Two reports take a card out for everyone.';
/** The group is queued for the hourly fill: say so instead of offering a paid card first. */
export const LIBRARY_QUEUED = 'Being written for you, free. Check back in about an hour.';
