/**
 * Rate limits for Edge Functions (wave98). One fixed-window counter lives in Postgres
 * (`rate_limit_hits`, behind the service-role-only RPC `rate_limit_hit`), so every
 * function and every RPC share the same mechanism.
 *
 * Fails OPEN on an infrastructure error: a broken limiter must not lock people out of
 * signing in. The error is logged without the key.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** First address of the caller. Cloudflare's header cannot be set by the client. */
export function clientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
  return (cf ?? forwarded ?? '').trim().slice(0, 64) || 'noip';
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** true = allowed. */
export async function allowRate(
  bucket: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await service.rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error('rate_limit_hit failed', bucket, error.code ?? 'unknown');
      return true;
    }
    return data !== false;
  } catch {
    console.error('rate_limit_hit threw', bucket);
    return true;
  }
}
