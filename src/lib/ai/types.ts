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
  'local',
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const REMOTE_AI_PROVIDER_IDS = [
  'gemini',
  'nvidia',
  'perplexity',
  'claude',
  'grok',
] as const;

export type RemoteAiProviderId = (typeof REMOTE_AI_PROVIDER_IDS)[number];

export type AiResponseFormat = 'json' | 'text';

export interface GenerateRequest {
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  responseFormat: AiResponseFormat;
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function isRemoteAiProviderId(value: unknown): value is RemoteAiProviderId {
  return typeof value === 'string' && (REMOTE_AI_PROVIDER_IDS as readonly string[]).includes(value);
}
