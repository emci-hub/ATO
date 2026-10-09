/**
 * Category deep dive — the one AI call (manual tap only).
 *
 * consent → claim on the server first (no claim = no call) → `generateText` →
 * `ai-generate` (keys stay server-side; the shared AI quota is claimed there
 * too) → `parseDive`. One retry on a rejected answer. Never throws to the
 * screen: null means "no card this time", with the reason.
 */
import { CATEGORY_DEEP_DIVE_META } from '@/lib/ai/call-sites';
import { generateText } from '@/lib/ai/generate';
import { shouldUseLocalAi } from '@/lib/ai/override';
import type { CategoryDef } from '@/lib/categories';

import { buildDivePrompt, parseDive, type CategoryDive, type DiveLean } from './dive';
import { claimCategoryDeepDive } from './store';

export type DiveOutcome =
  | { ok: true; dive: CategoryDive }
  | { ok: false; reason: 'consent' | 'no_leanings' | 'used' | 'unavailable' | 'failed' };

export async function writeCategoryDeepDive(input: {
  def: CategoryDef;
  leans: readonly DiveLean[];
  /** The person said yes to AI (the server refuses without it anyway). */
  consentGranted: boolean;
}): Promise<DiveOutcome> {
  if (!input.consentGranted) return { ok: false, reason: 'consent' };
  if (input.leans.length === 0) return { ok: false, reason: 'no_leanings' };
  if (await shouldUseLocalAi()) return { ok: false, reason: 'failed' };
  const claim = await claimCategoryDeepDive();
  if (claim !== 'ok') return { ok: false, reason: claim === 'used' ? 'used' : claim === 'missing' ? 'unavailable' : 'failed' };
  const prompt = buildDivePrompt(input.def, input.leans);
  for (let pass = 1; pass <= 2; pass += 1) {
    try {
      const request = { prompt, temperature: 0.9, maxOutputTokens: 800, responseFormat: 'json' as const };
      const text = await generateText({ ...request }, CATEGORY_DEEP_DIVE_META);
      if (!text) break;
      const dive = parseDive(text, input.def, input.leans);
      if (dive) return { ok: true, dive };
    } catch (err) {
      console.log('[category-deep-dive] generate error:', err);
      break;
    }
  }
  return { ok: false, reason: 'failed' };
}
