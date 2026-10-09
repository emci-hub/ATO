/**
 * Why an AI answer was rejected — the reason ONLY, never the text (emci,
 * 2026-10-08: "use the most out of the AI tokens"). Every rejection costs a
 * second paid call, so knowing which rule trips most tells us which prompt to
 * tighten. Sent to Sentry as an info message with tags (no user id beyond what
 * Sentry already has, no prompt, no answer). A no-op when Sentry is off.
 */
import { Sentry } from '@/lib/sentry';

import { reasonOnly } from './reject-reason';

export type AiSurface = 'legend_figure' | 'category_deep_dive' | 'story';

export function logAiReject(surface: AiSurface, reason: string, pass: number): void {
  try {
    Sentry.captureMessage('ai_answer_rejected', {
      level: 'info',
      tags: { ai_surface: surface, ai_reject_reason: reasonOnly(reason) || 'other', ai_pass: String(pass) },
    });
  } catch {
    // Logging must never break the card.
  }
}
