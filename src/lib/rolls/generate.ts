import { generateText } from '@/lib/ai/generate';
import { ROLL_META } from '@/lib/ai/call-sites';

import { claimRollGeneration } from './store';

/**
 * One generation call for a roll item (a category read or the story —
 * legend matching is deterministic, never an AI call). Binds
 * composeRoll's injected `generateRollText` dependency
 * (src/lib/rolls/compose.ts) to the real shared generateText, with its own
 * declared quota metadata (ROLL_META, check:ai's invariant).
 *
 * Claims roll_generations_daily_cap (wave48) BEFORE the generateText call —
 * a dedicated, per-generation bound layered in front of the shared
 * Sage/Explore quota generateText/ai-generate claims on every call
 * regardless of feature (confirmed by tracing the dispatch code — the
 * client never sends a callType, so ai-generate always defaults to 'sage').
 * Same pattern src/lib/questions/generate.ts's generateQuestionBatch would
 * need if Infinite Questions' own claim_questions_batch didn't already do
 * this for it.
 *
 * MUST NEVER THROW — composeRoll's `generateRollText` dep contract is
 * "returns null on any failure, degrades that one item to not-ready, never
 * fails the whole roll." `claimRollGeneration` (store.ts) throws on any
 * Supabase/RPC error (network blip, or the RPC not existing yet if wave48
 * isn't applied) — found in review: an earlier version let that propagate
 * uncaught, which would abort the ENTIRE roll from a single transient
 * failure, after claimRoll had already spent the day's 1/day composition
 * attempt. Both the claim and the generation itself are wrapped so any
 * failure degrades to null instead.
 */
export async function generateRollItemText(prompt: string): Promise<string | null> {
  try {
    const claim = await claimRollGeneration();
    if (!claim.ok) return null;
    return await generateText({
      prompt,
      temperature: 0.9,
      maxOutputTokens: 1024,
      responseFormat: 'json',
    }, ROLL_META);
  } catch (err) {
    console.log('[rolls] generateRollItemText error:', err);
    return null;
  }
}
