import type { GenerateRequest } from './types';
import { AiProviderError } from './http';
import type { RemoteAiProviderId } from './types';

const EDGE_PROVIDERS = new Set<RemoteAiProviderId>(['claude', 'grok']);

export function isEdgeProvider(id: string): id is 'claude' | 'grok' {
  return EDGE_PROVIDERS.has(id as RemoteAiProviderId);
}

/**
 * Claude and Grok keys stay on the server. Dynamic import so Node unit checks
 * that never call this path do not load the Supabase client.
 */
export async function completeViaEdge(
  provider: 'claude' | 'grok',
  request: GenerateRequest,
): Promise<string> {
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.functions.invoke('ai-generate', {
    body: {
      provider,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      responseFormat: request.responseFormat,
    },
  });

  if (error) {
    // The Edge Function's JSON body (e.g. { error: 'claude_key_missing' })
    // lives on the unconsumed Response in `context`, not `message` — the SDK
    // sets `message` to a fixed generic string for every non-2xx. Duck-type
    // FunctionsHttpError by name/context shape instead of importing the class,
    // since @supabase/functions-js is only a transitive (undeclared) dep.
    const context = (error as { name?: string; context?: unknown }).context;
    if (error.name === 'FunctionsHttpError' && context && typeof (context as Response).json === 'function') {
      try {
        const body: unknown = await (context as Response).json();
        const bodyError =
          body && typeof body === 'object' ? (body as { error?: unknown }).error : null;
        if (typeof bodyError === 'string' && bodyError) {
          throw new AiProviderError(bodyError);
        }
      } catch (parseErr) {
        if (parseErr instanceof AiProviderError) throw parseErr;
      }
    }
    throw new AiProviderError(error.message || 'ai-generate failed');
  }
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    throw new AiProviderError((data as { error: string }).error);
  }
  const text = data && typeof data === 'object' ? (data as { text?: unknown }).text : null;
  if (typeof text !== 'string' || !text.trim()) {
    throw new AiProviderError('ai-generate returned no text');
  }
  return text;
}
