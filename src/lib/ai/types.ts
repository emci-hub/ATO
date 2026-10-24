/**
 * Provider ids for the developer AI lab and the self-tracked usage counts.
 * No model call is made from the phone: every call runs in the `ai-library`
 * Edge Function (the old `ai-generate` client path was removed in roadmap A5).
 */

export const AI_PROVIDER_IDS = [
  'gemini',
  'nvidia',
  'perplexity',
  'claude',
  'grok',
  'deepseek',
  'local',
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const REMOTE_AI_PROVIDER_IDS = [
  'gemini',
  'nvidia',
  'perplexity',
  'claude',
  'grok',
  'deepseek',
] as const;

export type RemoteAiProviderId = (typeof REMOTE_AI_PROVIDER_IDS)[number];

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}
