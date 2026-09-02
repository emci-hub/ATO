/**
 * Unified transport for every Sage model call. Prompt builders stay elsewhere;
 * this layer only ships a prompt and returns the raw text the existing parsers
 * already know how to read.
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

export type AiResponseFormat = 'json' | 'text';

export interface GenerateRequest {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  responseFormat: AiResponseFormat;
}

/**
 * Every generateText call site must declare how its output may be shared or
 * batched. Values live in src/lib/ai/call-sites.ts; scripts/ai-provider-check.ts
 * fails when any call site is missing this metadata, so a new AI feature has
 * to make the call before it ships.
 */
export interface AiCallMetadata {
  /** Output is per-user (name / history / messages / tone) and cannot be shared. */
  personalized: boolean;
  /** A single generation could serve every user (no user-specific input). */
  cohortShareable: boolean;
  /** One generation per trait-profile bucket could serve every user in that bucket. */
  bucketShareable: boolean;
  /** A user is waiting live on this call; it cannot move to a schedule without a cache. */
  latencySensitive: boolean;
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isRemoteAiProviderId(value: unknown): value is RemoteAiProviderId {
  return typeof value === 'string' && (REMOTE_AI_PROVIDER_IDS as readonly string[]).includes(value);
}
