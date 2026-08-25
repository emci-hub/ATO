/**
 * Sign in with Apple server-side helpers (Deno / Supabase Edge Functions).
 *
 * Apple's REST API needs a `client_secret` that is an ES256-signed JWT built
 * from the .p8 signing key — there is no static secret to paste. Everything
 * here returns Apple's literal HTTP status and body rather than a boolean, so
 * callers record what Apple actually said instead of assuming success.
 *
 * Docs: https://developer.apple.com/documentation/signinwithapplerestapi
 */

export interface AppleConfig {
  teamId: string;
  keyId: string;
  /** The bundle ID for native iOS sign-in (NOT the Services ID, which is web). */
  clientId: string;
  /** Contents of AuthKey_XXXXXXXXXX.p8, PEM including header/footer. */
  privateKey: string;
}

export interface AppleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Apple's raw answer. `status` 200 with an empty `body` is the success case. */
export interface AppleHttpResult {
  status: number;
  body: string;
}

const APPLE_AUDIENCE = 'https://appleid.apple.com';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

/** Reads Apple config from edge function secrets. Throws a precise error naming
 *  the missing variable so a misconfiguration is never mistaken for a failed
 *  revocation. */
export function appleConfigFromEnv(): AppleConfig {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');

  const missing = [
    ['APPLE_TEAM_ID', teamId],
    ['APPLE_KEY_ID', keyId],
    ['APPLE_CLIENT_ID', clientId],
    ['APPLE_PRIVATE_KEY', privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Apple config missing: ${missing.join(', ')}`);
  }

  return {
    teamId: teamId!,
    keyId: keyId!,
    clientId: clientId!,
    privateKey: privateKey!,
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

/** PEM (with or without header/footer and newlines) -> raw PKCS#8 bytes. */
function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    // Secrets pasted through a shell often carry literal "\n" instead of newlines.
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Builds the ES256 client secret JWT Apple requires.
 *
 * Apple caps the lifetime at 6 months; we mint a short-lived one per request
 * because it's generated on demand and a short window limits blast radius if
 * a log ever captures it.
 */
export async function createClientSecret(
  config: AppleConfig,
  lifetimeSeconds = 300,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + lifetimeSeconds,
    aud: APPLE_AUDIENCE,
    sub: config.clientId,
  };

  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(config.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  // WebCrypto ECDSA emits IEEE P1363 (raw r||s), which is exactly the JWS
  // ES256 signature format. No DER unwrapping needed.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Exchanges the one-time authorization code from the native sign-in for a
 * refresh token. This is the step that makes later revocation possible at all:
 * Supabase's `signInWithIdToken` never touches the authorization code, so it is
 * still unused here, and Supabase does not expose an Apple refresh token.
 */
export async function exchangeAuthorizationCode(
  config: AppleConfig,
  authorizationCode: string,
): Promise<AppleTokenResponse> {
  const clientSecret = await createClientSecret(config);

  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  });

  const text = await response.text();
  try {
    return JSON.parse(text) as AppleTokenResponse;
  } catch {
    return { error: 'invalid_response', error_description: text.slice(0, 500) };
  }
}

/**
 * Revokes a token at Apple. Returns Apple's literal status and body.
 *
 * Per Apple's docs the endpoint answers 200 with an EMPTY body once the token
 * is invalidated (or was already invalidated). Any body content means failure.
 */
export async function revokeToken(
  config: AppleConfig,
  token: string,
  tokenTypeHint: 'refresh_token' | 'access_token',
): Promise<AppleHttpResult> {
  const clientSecret = await createClientSecret(config);

  const response = await fetch(APPLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      token,
      token_type_hint: tokenTypeHint,
    }),
  });

  return { status: response.status, body: (await response.text()).trim() };
}

/**
 * True only for Apple's documented success shape: 200 AND an empty body.
 *
 * IMPORTANT: this is necessary but NOT sufficient proof of revocation. Apple's
 * /auth/revoke returns 200 with an empty body for essentially any request that
 * includes a `client_secret` form field at all — verified against the live
 * endpoint: a literal "this-is-not-a-jwt" secret with an unregistered client_id
 * and a junk token still answers 200. Only a request with NO client_secret
 * returns 400 invalid_client. The endpoint deliberately refuses to act as an
 * oracle about which tokens or client IDs exist.
 *
 * Use `confirmRevoked` for actual proof.
 */
export function isRevoked(result: AppleHttpResult): boolean {
  return result.status === 200 && result.body === '';
}

/**
 * Attempts to use a refresh token. Apple's /auth/token endpoint DOES validate
 * properly, so this is the honest signal that /auth/revoke refuses to give.
 */
export async function refreshTokenGrant(
  config: AppleConfig,
  refreshToken: string,
): Promise<AppleTokenResponse> {
  const clientSecret = await createClientSecret(config);

  const response = await fetch(APPLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const text = await response.text();
  try {
    return JSON.parse(text) as AppleTokenResponse;
  } catch {
    return { error: 'invalid_response', error_description: text.slice(0, 500) };
  }
}

export type RevocationProof =
  /** Apple refused the refresh token afterwards — genuinely revoked. */
  | { confirmed: true; reason: 'token_rejected'; appleError: string }
  /** Apple still issued a token afterwards — revocation did NOT take effect. */
  | { confirmed: false; reason: 'token_still_valid' }
  /** Could not determine (network/config problem), recorded as unknown. */
  | { confirmed: null; reason: 'indeterminate'; detail: string };

/**
 * Proves revocation by trying to USE the refresh token after revoking it.
 *
 * Apple's token endpoint validates for real, unlike the revoke endpoint:
 *  * `invalid_grant` -> the token no longer works. Revocation confirmed.
 *  * a fresh access_token -> the token is still live. Revocation did NOT work,
 *    regardless of the 200 that /auth/revoke returned.
 */
export async function confirmRevoked(
  config: AppleConfig,
  refreshToken: string,
): Promise<RevocationProof> {
  const result = await refreshTokenGrant(config, refreshToken);

  if (result.access_token) return { confirmed: false, reason: 'token_still_valid' };
  if (result.error === 'invalid_grant') {
    return { confirmed: true, reason: 'token_rejected', appleError: result.error };
  }
  return {
    confirmed: null,
    reason: 'indeterminate',
    detail: result.error ?? 'no access_token and no error',
  };
}

/** Reads the `sub` claim without verifying the signature. Only safe because
 *  this token came directly from Apple's token endpoint over TLS in the same
 *  request — never use this on a token supplied by a client. */
export function unverifiedSubFromIdToken(idToken: string): string | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
    const claims = JSON.parse(json) as { sub?: string };
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}
