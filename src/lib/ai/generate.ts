import { AI_CONFIG, isRemoteReady } from './config';
import { completeGemini } from './gemini';
import { completeNvidia, completePerplexity } from './openai-compat';
import { completeViaEdge, isEdgeProvider } from './edge';
import { resolveActiveProvider } from './override';
import type { AiProviderId, GenerateRequest } from './types';

async function logQuiet(provider: AiProviderId): Promise<void> {
  try {
    const { logAiProviderCall } = await import('./usage');
    await logAiProviderCall(provider);
  } catch {
    // Checks / unsigned-in: skip.
  }
}

async function completeFor(
  provider: Exclude<AiProviderId, 'local'>,
  request: GenerateRequest,
): Promise<string> {
  if (provider === 'gemini') {
    return completeGemini(request, {
      model: AI_CONFIG.geminiModel,
      apiKey: AI_CONFIG.geminiApiKey ?? '',
    });
  }
  if (provider === 'nvidia') {
    return completeNvidia(request, {
      model: AI_CONFIG.nvidiaModel,
      apiKey: AI_CONFIG.nvidiaApiKey ?? '',
    });
  }
  if (provider === 'perplexity') {
    return completePerplexity(request, {
      model: AI_CONFIG.perplexityModel,
      apiKey: AI_CONFIG.perplexityApiKey ?? '',
    });
  }
  if (isEdgeProvider(provider)) {
    return completeViaEdge(provider, request);
  }
  throw new Error(`Unknown AI provider: ${provider}`);
}

/**
 * One-shot, non-streaming. Returns the raw model text (JSON string or prose)
 * so existing parse* functions stay unchanged. Null when local / unconfigured
 * / the vendor call failed.
 */
export async function generateText(request: GenerateRequest): Promise<string | null> {
  const provider = await resolveActiveProvider();
  if (provider === 'local' || !isRemoteReady(AI_CONFIG, provider)) return null;

  try {
    const text = await completeFor(provider, request);
    void logQuiet(provider);
    return text;
  } catch (err) {
    void logQuiet(provider);
    console.log('[ai] generate error:', err);
    return null;
  }
}
