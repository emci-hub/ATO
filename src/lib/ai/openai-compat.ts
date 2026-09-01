import { completeOpenAiChat } from './http';
import type { GenerateRequest } from './types';

export async function completeNvidia(
  request: GenerateRequest,
  options: { model: string; apiKey: string },
): Promise<string> {
  return completeOpenAiChat({
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    apiKey: options.apiKey,
    model: options.model,
    request,
    skipJsonMode: true,
    label: 'NVIDIA',
  });
}

export async function completePerplexity(
  request: GenerateRequest,
  options: { model: string; apiKey: string },
): Promise<string> {
  return completeOpenAiChat({
    url: 'https://api.perplexity.ai/chat/completions',
    apiKey: options.apiKey,
    model: options.model,
    request,
    extraBody: { disable_search: true },
    label: 'Perplexity',
  });
}
