import { supabase } from '@/lib/supabase';
import type { CheckHistory, CheckStatus, VoiceCard, VoiceSource } from '@/lib/voice/types';

export interface Check {
  id: string;
  user_id: string;
  day: number;
  read_text: string;
  do_text: string;
  source: VoiceSource;
  status: CheckStatus;
  created_at: string;
}

export async function fetchChecks(userId: string): Promise<Check[]> {
  const { data, error } = await supabase
    .from('checks')
    .select('*')
    .eq('user_id', userId)
    .order('day', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Check[];
}

/** The router's view of a user's check history, oldest first. */
export function checksToHistory(checks: Check[]): CheckHistory[] {
  return checks.map((check) => ({
    day: check.day,
    status: check.status,
    read: check.read_text,
    do: check.do_text,
    source: check.source,
  }));
}

export interface RecordCheckInput {
  day: number;
  card: VoiceCard;
  source: VoiceSource;
  status: CheckStatus;
}

export async function recordCheck(userId: string, input: RecordCheckInput): Promise<Check> {
  const { data, error } = await supabase
    .from('checks')
    .insert({
      user_id: userId,
      day: input.day,
      read_text: input.card.read,
      do_text: input.card.do,
      source: input.source,
      status: input.status,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Check;
}
