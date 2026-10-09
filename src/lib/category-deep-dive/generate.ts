/**
 * Category deep dive — the one AI call (manual tap only).
 *
 * consent → claim on the server first (no claim = no call) → `generateText` →
 * `ai-generate` (keys stay server-side; the shared AI quota is claimed there
 * too) → `parseDiveBundle`. One retry on a rejected answer (the reason is
 * logged, never the text). Never throws to the screen: a failed outcome says
 * why.
 *
 * Bundle (emci, 2026-10-08): the same call also writes the person's next
 * strongest open category (`extra`), which opens free the next day — two
 * cards for barely more than the price of one, still under the 1024 cap.
 */
import { CATEGORY_DEEP_DIVE_META } from '@/lib/ai/call-sites';
import { generateText } from '@/lib/ai/generate';
import { shouldUseLocalAi } from '@/lib/ai/override';
import { logAiReject } from '@/lib/ai/reject-log';
import { refundAiTokens } from '@/lib/ato-tokens-server';

import { buildDiveBundlePrompt, diveOutputTokens, parseDiveBundle, type CategoryDive, type DiveSpec } from './dive';
import { claimCategoryDeepDive } from './store';

export type DiveOutcome =
  | { ok: true; dive: CategoryDive; extra: CategoryDive | null }
  | { ok: false; reason: 'consent' | 'no_leanings' | 'used' | 'tokens' | 'unavailable' | 'failed' };

export async function writeCategoryDeepDive(input: {
  main: DiveSpec;
  /** The next card to write in the same call (opens tomorrow), or none. */
  extra: DiveSpec | null;
  /** The person said yes to AI (the server refuses without it anyway). */
  consentGranted: boolean;
}): Promise<DiveOutcome> {
  if (!input.consentGranted) return { ok: false, reason: 'consent' };
  if (input.main.leans.length === 0) return { ok: false, reason: 'no_leanings' };
  if (await shouldUseLocalAi()) return { ok: false, reason: 'failed' };
  const claim = await claimCategoryDeepDive();
  if (claim !== 'ok') {
    return {
      ok: false,
      reason: claim === 'used' ? 'used' : claim === 'tokens' ? 'tokens' : claim === 'missing' ? 'unavailable' : 'failed',
    };
  }
  const bundle = input.extra && input.extra.leans.length > 0 ? [input.main, input.extra] : [input.main];
  for (let pass = 1; pass <= 2; pass += 1) {
    // The retry asks for the tapped card only: a cut-off two-card answer must
    // not be paid for twice in the same shape.
    const specs = pass === 1 ? bundle : [input.main];
    const prompt = buildDiveBundlePrompt(specs);
    try {
      const request = {
        prompt,
        temperature: 0.9,
        maxOutputTokens: diveOutputTokens(specs.length),
        responseFormat: 'json' as const,
      };
      const text = await generateText({ ...request }, CATEGORY_DEEP_DIVE_META);
      if (!text) break;
      const { dives, reason } = parseDiveBundle(text, specs);
      if (dives[0]) return { ok: true, dive: dives[0], extra: dives[1] ?? null };
      logAiReject('category_deep_dive', reason ?? 'unknown', pass);
    } catch (err) {
      console.log('[category-deep-dive] generate error:', err);
      break;
    }
  }
  // Charged at the claim but no card came back: give the tokens back (wave92).
  await refundAiTokens('deep_dive');
  return { ok: false, reason: 'failed' };
}
