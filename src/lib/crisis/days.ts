import { addDaysYmd, localYmd } from '@/lib/local-date';
import { supabase } from '@/lib/supabase';

/**
 * Local-calendar crisis flags for Nudge/cut safety gates.
 * Never after a crisis-flagged day (today or yesterday in the user's timezone).
 */
export async function crisisFlagsForWindow(
  userId: string,
  timeZone: string,
  now = new Date(),
): Promise<{ crisisToday: boolean; crisisYesterday: boolean }> {
  const today = localYmd(now, timeZone);
  const yesterday = addDaysYmd(today, -1);
  const since = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('crisis_flags')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', since);

  if (error) {
    console.log('[crisis] flags fetch error:', error);
    return { crisisToday: false, crisisYesterday: false };
  }

  const days = new Set((data ?? []).map((row) => localYmd(new Date(row.created_at), timeZone)));
  return {
    crisisToday: days.has(today),
    crisisYesterday: days.has(yesterday),
  };
}
