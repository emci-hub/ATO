/**
 * Sentry scrubber (wave98, S2). Crash reports must not carry who someone is or
 * anything they typed: emails, tokens, @handles, user ids in URLs, free text.
 *
 * Pure functions with no Sentry import so `check:sentry-scrub` can run them under tsx.
 * `sendDefaultPii` is already false; this removes what the SDK or our own error
 * messages (Supabase errors echo filters like `handle=eq.emci`) can still put in.
 */

const MAX_STRING = 200;
const REDACTED = '[redacted]';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const HANDLE = /(^|[^A-Za-z0-9_])@[A-Za-z0-9_]{2,20}\b/g;
const FILTER = /\b(handle|email|name|identifier|user_id|peer_id|id)=(eq|ilike|like|in|neq)\.[^&\s)]+/gi;

/** Keys whose values are free text or secrets: dropped, never truncated. */
// Whole name segments only ("user_name", "note"), so "react_native_context" or "passed" survive.
const SENSITIVE_KEY =
  /(^|[_.-])(password|passcode|secret|token|authorization|cookie|apikey|api[_-]key|prompt|answer|message|body|text|note|notes|email|handle|name)($|[_.-])/i;

interface ScrubOptions {
  /** Keep uuids (the Expo update id in contexts is one) and every key (SDK contexts). */
  sdk?: boolean;
}

export function scrubString(value: string, options: ScrubOptions = {}): string {
  let next = value
    .replace(JWT, REDACTED)
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(EMAIL, REDACTED)
    .replace(FILTER, (_m, key: string) => `${key}=${REDACTED}`);
  if (!options.sdk) next = next.replace(UUID, REDACTED);
  return next.replace(HANDLE, `$1@${REDACTED}`).slice(0, MAX_STRING);
}

/** Recursively scrub strings; drop sensitive keys; cap depth and array length. */
export function scrubValue(value: unknown, depth = 0, options: ScrubOptions = {}): unknown {
  if (typeof value === 'string') return scrubString(value, options);
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 5) return REDACTED;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubValue(item, depth + 1, options));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = !options.sdk && SENSITIVE_KEY.test(key) ? REDACTED : scrubValue(inner, depth + 1, options);
    }
    return out;
  }
  return REDACTED;
}

/** Keep method, status and the path (ids and queries removed) of a network breadcrumb. */
export function scrubUrl(url: string): string {
  const bare = url.split('?')[0].split('#')[0];
  return scrubString(bare);
}

interface LooseBreadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Returns null to drop the breadcrumb. */
function scrubBreadcrumbUnsafe<T extends object>(input: T): T | null {
  const crumb = input as LooseBreadcrumb;
  const category = crumb.category ?? '';
  if (category === 'console' || category.startsWith('ui.input')) return null;
  const next: LooseBreadcrumb = { ...crumb };
  if (typeof next.message === 'string') next.message = scrubString(next.message);
  if (next.data) {
    if (category === 'xhr' || category === 'fetch') {
      const data = next.data;
      next.data = {
        method: data.method,
        status_code: data.status_code,
        url: typeof data.url === 'string' ? scrubUrl(data.url) : undefined,
      };
    } else {
      next.data = scrubValue(next.data) as Record<string, unknown>;
    }
  }
  return next as unknown as T;
}

interface LooseEvent {
  user?: unknown;
  request?: unknown;
  message?: string;
  exception?: { values?: { value?: string }[] };
  extra?: unknown;
  contexts?: unknown;
  tags?: unknown;
  breadcrumbs?: LooseBreadcrumb[];
  [key: string]: unknown;
}

function scrubEventUnsafe<T extends object>(input: T): T {
  const next: LooseEvent = { ...(input as LooseEvent) };
  // Who: only the SDK's anonymous install id survives; no email, name or address.
  delete next.user;
  // What was requested: method and path only.
  if (next.request && typeof next.request === 'object') {
    const request = next.request as { url?: string; method?: string };
    next.request = {
      method: request.method,
      url: typeof request.url === 'string' ? scrubUrl(request.url) : undefined,
    };
  }
  if (typeof next.message === 'string') next.message = scrubString(next.message);
  if (next.exception?.values) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((entry) => ({
        ...entry,
        value: typeof entry.value === 'string' ? scrubString(entry.value) : entry.value,
      })),
    };
  }
  if (next.extra) next.extra = scrubValue(next.extra);
  if (next.contexts && typeof next.contexts === 'object') {
    // SDK contexts (os, app, expo_updates, …) keep their keys and ids so a crash still ties
    // to an OTA; only the device's own name ("Pat's iPhone") goes.
    const contexts = scrubValue(next.contexts, 0, { sdk: true }) as Record<string, unknown>;
    if (contexts.device && typeof contexts.device === 'object') {
      const { name: _deviceName, ...device } = contexts.device as Record<string, unknown>;
      contexts.device = device;
    }
    next.contexts = contexts;
  }
  if (next.tags) next.tags = scrubValue(next.tags);
  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = next.breadcrumbs
      .map((crumb) => scrubBreadcrumbUnsafe(crumb))
      .filter((crumb): crumb is LooseBreadcrumb => crumb !== null);
  }
  return next as unknown as T;
}

/** Never throws: if scrubbing itself fails, send the event with the user removed. */
export function scrubEvent<T extends object>(input: T): T {
  try {
    return scrubEventUnsafe(input);
  } catch {
    const { user: _user, request: _request, breadcrumbs: _crumbs, ...rest } = input as LooseEvent;
    return rest as unknown as T;
  }
}

/** Never throws: a breadcrumb that cannot be scrubbed is dropped. */
export function scrubBreadcrumb<T extends object>(input: T): T | null {
  try {
    return scrubBreadcrumbUnsafe(input);
  } catch {
    return null;
  }
}
