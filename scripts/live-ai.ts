/**
 * Shared transport for the LIVE AI checks (card-live / talk-live / style-live).
 *
 * Since 2026-09-02 no vendor key exists outside the ai-generate Edge Function,
 * so a live check has to travel the same road the app does: sign in as a real
 * user, invoke `ai-generate` with that JWT, and let the server pick the key
 * and the model. Every call here claims one unit of that user's quota
 * (20/day) exactly like the app would.
 *
 * Identity: `ATO_LIVE_EMAIL` / `ATO_LIVE_PASSWORD` from .env.local, defaulting
 * to the fixed dev-test user whose credentials live in
 * src/lib/dev-test-user.ts (parsed from the source so the password stays
 * single-sourced; that module cannot be imported here because it pulls in
 * react-native).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { GenerateRequest, RemoteAiProviderId } from '../src/lib/ai/types';

const ROOT = path.resolve(__dirname, '..');

/** Loads .env.local into process.env (KEY=VALUE lines, `#` comments). */
export function loadDotEnvLocal(): void {
  const file = path.join(ROOT, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

function devTestCredentials(): { email: string; password: string } {
  const src = readFileSync(path.join(ROOT, 'src/lib/dev-test-user.ts'), 'utf8');
  const email = /export const DEV_TEST_EMAIL = '([^']+)'/.exec(src)?.[1];
  const password = /export const DEV_TEST_PASSWORD = '([^']+)'/.exec(src)?.[1];
  if (!email || !password) {
    throw new Error('Could not read DEV_TEST_EMAIL / DEV_TEST_PASSWORD from src/lib/dev-test-user.ts');
  }
  return { email, password };
}

export interface LiveAiSession {
  client: SupabaseClient;
  userId: string;
  email: string;
}

/** Password sign-in with a non-persisting Node client; returns a JWT-scoped client. */
export async function signInForLiveAi(): Promise<LiveAiSession> {
  loadDotEnvLocal();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  }
  // Lazy: only read the (now-removed) dev-test-user.ts constants when no
  // env override is supplied, so ATO_LIVE_EMAIL/ATO_LIVE_PASSWORD alone are
  // enough to run this — the eager version threw even when both were set.
  const email = process.env.ATO_LIVE_EMAIL || devTestCredentials().email;
  const password = process.env.ATO_LIVE_PASSWORD || devTestCredentials().password;

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`live sign-in failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  return { client, userId: data.session.user.id, email };
}

/**
 * One real ai-generate call. Mirrors src/lib/ai/edge.ts completeViaEdge, but
 * against a Node client (the app module imports react-native storage).
 */
export async function completeViaEdgeLive(
  session: LiveAiSession,
  provider: RemoteAiProviderId,
  request: GenerateRequest,
): Promise<string> {
  const { data, error } = await session.client.functions.invoke('ai-generate', {
    body: {
      provider,
      prompt: request.prompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      responseFormat: request.responseFormat,
    },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context && typeof (context as Response).json === 'function') {
      const body = (await (context as Response).json().catch(() => null)) as { error?: unknown } | null;
      if (body && typeof body.error === 'string') throw new Error(`ai-generate: ${body.error}`);
    }
    throw new Error(`ai-generate: ${error.message || 'failed'}`);
  }
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    throw new Error(`ai-generate: ${(data as { error: string }).error}`);
  }
  const text = data && typeof data === 'object' ? (data as { text?: unknown }).text : null;
  if (typeof text !== 'string' || !text.trim()) throw new Error('ai-generate returned no text');
  return text;
}

// createLiveEdgeProvider() was removed 2026-09-14 with the voice provider
// layer. It wrapped the Edge Function in a VoiceProvider so a live check
// could drive the card/Talk path for one named vendor; both of those paths
// are gone. The transport above (signInForLiveAi + completeViaEdgeLive) is
// what live checks actually use, and it is unchanged.
