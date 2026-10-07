/**
 * "Preview as new user" (emci, 2026-10-07): root, pre-launch only. The app
 * behaves as an account with 0 answers, nothing is deleted, and turning it off
 * puts everything back.
 *
 * This file is the PURE half: the on/off state and the rules the Supabase
 * client's fetch applies to every request while previewing. It imports
 * nothing that touches the network, because `lib/supabase.ts` imports it.
 * Starting and stopping (phone storage snapshot, epoch bump) live in
 * `lib/preview-session.ts`.
 *
 * WHY THE NETWORK LAYER: the app has ~60 server calls that write. Guarding
 * each by hand would miss one, so every request goes through `previewRule`
 * instead, and it fails CLOSED:
 * - auth and plain reads pass;
 * - reads of per-account tables are narrowed to return nothing;
 * - reads of `me` come back with the answers, tokens and milestones cleared;
 * - a short list of read-only RPCs passes (two are rewritten to look new);
 * - every other RPC, every table write and every edge function (AI included)
 *   is refused before it leaves the phone.
 *
 * LEAK GUARDS: `isPreviewing()` is false unless PRE_LAUNCH_DEV and the dev
 * tools are on, so a public build can never be in preview. The flag is memory
 * only (an app restart ends it), and preview-session ends it on any account
 * change. check:preview-mode pins all of this.
 */
import { DEV_TOOLS_AVAILABLE, PRE_LAUNCH_DEV } from '@/lib/dev-mode';

let previewing = false;
let previewUserId: string | null = null;
const listeners = new Set<() => void>();

export function isPreviewing(): boolean {
  return PRE_LAUNCH_DEV && DEV_TOOLS_AVAILABLE && previewing;
}

/** Whose account the preview was started on; it ends if the signed-in account changes. */
export function previewOwner(): string | null {
  return isPreviewing() ? previewUserId : null;
}

/** Only preview-session.ts calls this. */
export function setPreviewState(on: boolean, userId: string | null): void {
  previewing = on && PRE_LAUNCH_DEV && DEV_TOOLS_AVAILABLE;
  previewUserId = previewing ? userId : null;
  for (const listener of listeners) listener();
}

export function subscribePreview(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What a refused request answers with. supabase-js turns it into `{ error }`. */
export const PREVIEW_BLOCKED_MESSAGE = 'Preview mode: nothing is saved.';
export const PREVIEW_BLOCKED_CODE = 'PREVIEW';

/**
 * Per-account tables. While previewing, a read of any of them is narrowed to
 * `user_id=is.null`, which matches no row (every one has a non-null user_id),
 * so PostgREST still answers in its own shape (list, single, count).
 */
export const PREVIEW_EMPTY_TABLES: ReadonlySet<string> = new Set([
  'trait_tracks',
  'trait_history',
  'trait_answers',
  'trait_flags',
  'trait_profile_snapshots',
  'trait_answer_changes',
  'ato_token_events',
  'token_events',
  'daily_insights',
  'daily_line_days',
  'daily_pick_answers',
  'question_packs',
  'question_items',
  'category_statements',
  'legend_generations',
  'trait_rolls',
  'trait_roll_snapshots',
  'checks',
  'crisis_flags',
  'explore_packs',
  'explore_entries',
  'explore_reactions',
  'sage_title_flags',
]);

/** `me` fields a brand-new account does not have yet. */
export const PREVIEW_ME_OVERLAY: Readonly<Record<string, unknown>> = {
  openness: null,
  conscientiousness: null,
  extraversion: null,
  agreeableness: null,
  steadiness: null,
  attachment_anxiety: null,
  attachment_avoidance: null,
  conflict_assertiveness: null,
  conflict_cooperativeness: null,
  autonomy: null,
  competence: null,
  relatedness: null,
  growth_mindset: null,
  locus_of_control: null,
  self_efficacy: null,
  playfulness: null,
  trait_sources: {},
  trait_touched_at: {},
  celebrated_milestone_ids: [],
  milestones_celebrated: {},
  question_deferred: [],
  sage_knows: {},
  sage_story: {},
  sage_title: {},
  ato_tokens: 0,
  tokens: 0,
};

/** RPCs that only read. Anything not listed is refused while previewing. */
export const PREVIEW_READ_RPCS: ReadonlySet<string> = new Set([
  'ai_provider_counts',
  'assert_invite_usable',
  'auth_has_password',
  'daily_pick_split',
  'handle_taken',
  'list_dev_access_grants',
  'my_dev_access',
  'my_referrals',
  'peer_checks',
  'peer_profile',
  'root_search_me',
  // Read, then rewritten to look like a new account:
  'home_bootstrap',
  'bank_answered',
]);

export type PreviewRule =
  | { kind: 'pass' }
  | { kind: 'block' }
  | { kind: 'narrow'; url: string }
  | { kind: 'patch-me' }
  | { kind: 'patch-rpc'; name: 'home_bootstrap' | 'bank_answered' };

const READ_METHODS = new Set(['GET', 'HEAD']);

/** The rule for one request while previewing. Pure. Unknown means blocked. */
export function previewRule(rawUrl: string, rawMethod: string | undefined): PreviewRule {
  const method = (rawMethod ?? 'GET').toUpperCase();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: 'block' };
  }
  const path = url.pathname;

  // Token refresh, sign-out and reading the user must keep working, or preview
  // would sign you out. Everything else on auth (password, email, linking) is
  // a change to the real account and is refused.
  if (path.startsWith('/auth/v1/')) {
    if (path === '/auth/v1/token' || path === '/auth/v1/logout') return { kind: 'pass' };
    if (path === '/auth/v1/user' && READ_METHODS.has(method)) return { kind: 'pass' };
    return { kind: 'block' };
  }
  // Edge functions: AI generation, account deletion, Apple link… never.
  if (path.startsWith('/functions/v1/')) return { kind: 'block' };

  const rpc = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(path)?.[1];
  if (rpc) {
    if (!PREVIEW_READ_RPCS.has(rpc)) return { kind: 'block' };
    if (rpc === 'home_bootstrap' || rpc === 'bank_answered') return { kind: 'patch-rpc', name: rpc };
    return { kind: 'pass' };
  }

  const table = /^\/rest\/v1\/([a-z0-9_]+)$/.exec(path)?.[1];
  if (table) {
    if (!READ_METHODS.has(method)) return { kind: 'block' };
    if (table === 'me') return { kind: 'patch-me' };
    if (PREVIEW_EMPTY_TABLES.has(table)) {
      url.searchParams.append('user_id', 'is.null');
      return { kind: 'narrow', url: url.toString() };
    }
    return { kind: 'pass' };
  }

  // Storage and anything else: reads only.
  return READ_METHODS.has(method) ? { kind: 'pass' } : { kind: 'block' };
}

/** `me` row(s) as a new account would read them. */
export function previewMe(body: unknown): unknown {
  const patch = (row: unknown) =>
    row && typeof row === 'object' ? { ...(row as Record<string, unknown>), ...PREVIEW_ME_OVERLAY } : row;
  return Array.isArray(body) ? body.map(patch) : patch(body);
}

/** A read-only RPC's answer as a new account would get it. */
export function previewRpc(name: 'home_bootstrap' | 'bank_answered', body: unknown): unknown {
  if (name === 'bank_answered') return { ids: [], fresh_starts: 0 };
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return { ...row, trait_tracks: [], checks: [], crisis_since: [] };
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string | undefined {
  if (init?.method) return init.method;
  if (typeof input === 'object' && !(input instanceof URL)) return (input as Request).method;
  return undefined;
}

function blockedResponse(): Response {
  return new Response(
    JSON.stringify({ message: PREVIEW_BLOCKED_MESSAGE, code: PREVIEW_BLOCKED_CODE, details: null, hint: null }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );
}

async function rewriteJson(response: Response, transform: (body: unknown) => unknown): Promise<Response> {
  if (!response.ok) return response;
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    return new Response(text, { status: response.status, headers: response.headers });
  }
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(JSON.stringify(transform(body)), { status: response.status, headers });
}

/**
 * The fetch the Supabase client uses. When preview is off it is exactly
 * `base`; when it is on, every request goes through `previewRule`.
 */
export function previewFetch(base: FetchLike): FetchLike {
  return async (input, init) => {
    if (!isPreviewing()) return base(input, init);
    const rule = previewRule(requestUrl(input), requestMethod(input, init));
    switch (rule.kind) {
      case 'pass':
        return base(input, init);
      case 'block':
        return blockedResponse();
      case 'narrow':
        return base(rule.url, init);
      case 'patch-me':
        return rewriteJson(await base(input, init), previewMe);
      case 'patch-rpc':
        return rewriteJson(await base(input, init), (body) => previewRpc(rule.name, body));
    }
  };
}
