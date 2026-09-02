import type { AiProviderId } from './types';

export interface ProviderLimit {
  label: string;
  /** Seeded free-tier / published baseline. Null when none is published. */
  rpm: number | null;
  rpd: number | null;
  note: string;
}

/**
 * Reference ceilings shown next to self-tracked counts. Not billed numbers.
 * Editable later — these are today's known free-tier baselines.
 */
export const PROVIDER_LIMITS: Record<AiProviderId, ProviderLimit> = {
  gemini: {
    label: 'Gemini Flash',
    rpm: 12,
    rpd: 1000,
    note: '~10–15 requests/min, ~500–1,500 requests/day (Flash free-tier baseline). Midpoints seeded here.',
  },
  nvidia: {
    label: 'NVIDIA',
    rpm: 40,
    rpd: null,
    note: '~40 requests/min on build.nvidia.com.',
  },
  perplexity: {
    label: 'Perplexity Sonar',
    rpm: null,
    rpd: null,
    note: 'No fixed RPM published. $5/month API credit is the real ceiling — track spend, not a request cap.',
  },
  claude: {
    label: 'Claude',
    rpm: null,
    rpd: null,
    note: 'No free tier. Paid per-token. Call count is a rough spend-risk proxy only.',
  },
  grok: {
    label: 'Grok',
    rpm: null,
    rpd: null,
    note: 'No free tier. Paid per-token. Call count is a rough spend-risk proxy only.',
  },
  deepseek: {
    label: 'DeepSeek',
    rpm: null,
    rpd: null,
    note: 'No free tier. Paid per-token. Call count is a rough spend-risk proxy only.',
  },
  local: {
    label: 'Local (deterministic)',
    rpm: null,
    rpd: null,
    note: 'No network calls. Banked / composed copy only.',
  },
};
