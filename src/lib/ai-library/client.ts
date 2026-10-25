/**
 * Shared-library leftovers the phone still uses: team size and "Report this
 * card". Cards themselves come from the on-device story library. The phone
 * does not ask the server to serve or write one.
 */
import { supabase } from '@/lib/supabase';

import { sharedCardLine } from './types';

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
