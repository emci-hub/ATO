/**
 * Shared provider error for the voice layer. The name is historical: this
 * module used to hold a client-side Gemini adapter, which was deleted once
 * every vendor call moved into the ai-generate Edge Function (2026-09-02).
 * The error class stays because remote.ts and the router still throw and
 * match on it.
 */
export class GeminiProviderError extends Error {}
