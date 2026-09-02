import type { GenerateRequest, RemoteAiProviderId } from './types';
import { AiProviderError } from './http';
import { isRemoteAiProviderId } from './types';

/** Every remote vendor is served by the ai-generate Edge Function. */
export function isEdgeProvider(id: string): id is RemoteAiProviderId {
  return isRemoteAiProviderId(id);
}

/**
 * All vendor keys stay on the server (Edge Function secrets). Dynamic import
 * so Node unit checks that never call this path do not load the Supabase
 * client.
 */
export async function completeViaEdge(
  provider: RemoteAiProviderId,
  request: GenerateRequest,
  options: { ping?: boolean } = {},
): Promise<string> {
  const { supabase } = await import('@/lib/supabase');
  // The Edge Function claims the caller's quota itself (claim_ai_call), so the
  // client must NOT also claim for edge providers — see claimAiCall.
  // ping: true asks for the server's fixed connectivity probe (no claim).
  const { data, error } = await supabase.functions.invoke('ai-generate', {
    body: {
      provider,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      responseFormat: request.responseFormat,
      ping: options.ping === true,
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
