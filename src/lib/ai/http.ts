/**
 * Error raised by the AI transport (edge.ts) when the ai-generate Edge
 * Function refuses or fails a call. The vendor-specific response extractors
 * that used to live here moved into the Edge Function with the keys.
 */
export class AiProviderError extends Error {}
