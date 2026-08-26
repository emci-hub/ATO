/**
 * AI capacity plumbing. Caps live in app_config; claims are atomic in
 * claim_ai_call() on the server. A modified client that skips this call can
 * still hit Gemini only because the model key is already EXPO_PUBLIC — the
 * app path cannot exceed the cap, and usage rows cannot be reset by the client.
 */

export const QUOTA_EMPTY_MESSAGE = "Sage's out of things to say for today, back tomorrow";

export type QuotaDecision = { ok: true } | { ok: false; reason: 'quota' };

export function decisionFromClaim(data: unknown): QuotaDecision {
  if (data && typeof data === 'object' && (data as { ok?: unknown }).ok === true) {
    return { ok: true };
  }
  return { ok: false, reason: 'quota' };
}
