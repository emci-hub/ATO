import { supabase } from '@/lib/supabase';

import { QUESTIONS_BANK } from './bank';

/**
 * Recent/known question text for this user (core loop redesign §2 bank-first
 * fill, §3 layer 1 exact/near-duplicate exclusion): every Infinite
 * Questions / ongoing-round prompt already served (question_items.prompt,
 * RLS-scoped to the caller, same query `fetchAskedQuestionTexts` in
 * category-batch-store.ts already proves), plus every frozen-intake
 * QUESTIONS_BANK prompt. The intake itself is never persisted to
 * question_items (answered directly off `QuestionDraft`, see answer.ts), and
 * an ongoing round only ever composes once the 50-question intake is
 * complete (progressive-unlock.ts), so treating the whole static bank as
 * "already answered" is always correct at that point in the flow, not a
 * heuristic.
 *
 * Matches `ComposeOngoingRoundDeps['fetchRecentTexts']` (ongoing-round.ts) —
 * no userId param, same as `fetchAskedQuestionTexts`.
 */
export async function fetchRecentTexts(): Promise<string[]> {
  const { data, error } = await supabase
    .from('question_items')
    .select('prompt')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const asked = (data ?? [])
    .map((row) => (row as { prompt: unknown }).prompt)
    .filter((text): text is string => typeof text === 'string' && text.length > 0);
  return [...asked, ...QUESTIONS_BANK.map((draft) => draft.prompt)];
}
