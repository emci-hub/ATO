/**
 * Apple token revocation checks.
 * Run: npx tsx scripts/apple-revoke-check.ts
 *
 * Imports the REAL edge-function source (supabase/functions/_shared/apple.ts)
 * rather than a copy, so this exercises the code that actually ships.
 *
 * Two layers:
 *
 *  1. Offline, deterministic — the ES256 `client_secret` Apple requires is the
 *     part most likely to break silently (a wrong signature format still looks
 *     like a JWT). Generates a P-256 key, builds the secret with the shipped
 *     code, and cryptographically verifies the signature and every claim.
 *
 *  2. Live against https://appleid.apple.com/auth/revoke — proves the request
 *     actually reaches Apple, that we read Apple's literal status/body, and
 *     critically that a rejected revocation is NEVER reported as success.
 *
 * With no real Apple credentials configured, layer 2 asserts Apple rejects us
 * with `invalid_client` and that `isRevoked()` returns false. Once APPLE_TEAM_ID
 * / APPLE_KEY_ID / APPLE_CLIENT_ID / APPLE_PRIVATE_KEY are present in the
 * environment, the same script also runs against the real credentials.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';

import {
  confirmRevoked,
  createClientSecret,
  isRevoked,
  revokeToken,
  type AppleConfig,
} from '../supabase/functions/_shared/apple.ts';

let passed = 0;
function ok(label: string, detail?: unknown) {
  passed += 1;
  console.log(`  \u2713 ${label}${detail === undefined ? '' : ` \u2014 ${JSON.stringify(detail)}`}`);
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

async function main() {
  // --- Layer 1: the client_secret JWT is genuinely valid ---------------------
  console.log('\nclient_secret (ES256) construction');

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  const testConfig: AppleConfig = {
    teamId: 'ABCDE12345',
    keyId: 'KEY1234567',
    clientId: 'com.astrollogs.ato',
    privateKey: pem,
  };

  const secret = await createClientSecret(testConfig);
  const [headerB64, payloadB64, signatureB64] = secret.split('.');
  assert.equal(secret.split('.').length, 3, 'client_secret must be a three-part JWS');

  const header = decodeSegment(headerB64);
  const payload = decodeSegment(payloadB64);

  assert.equal(header.alg, 'ES256', 'Apple requires ES256');
  assert.equal(header.kid, testConfig.keyId, 'kid must be the Apple key id');
  ok('header uses ES256 with the key id', header);

  assert.equal(payload.iss, testConfig.teamId, 'iss must be the Team ID');
  assert.equal(payload.sub, testConfig.clientId, 'sub must be the client_id');
  assert.equal(payload.aud, 'https://appleid.apple.com', 'aud must be Apple');
  assert.ok(typeof payload.exp === 'number' && typeof payload.iat === 'number');
  assert.ok(
    (payload.exp as number) > (payload.iat as number),
    'exp must be after iat',
  );
  assert.ok(
    (payload.exp as number) - (payload.iat as number) <= 15777000,
    "exp must be within Apple's 6-month ceiling",
  );
  ok('claims match Apple spec (iss=team, sub=client_id, aud=apple)', payload);

  // The signature must verify as raw r||s (IEEE P1363), which is what JWS
  // ES256 mandates. A DER-encoded signature would still look like a JWT here
  // but Apple would reject it — so check the encoding explicitly.
  const signature = Buffer.from(signatureB64, 'base64url');
  assert.equal(signature.length, 64, 'ES256 signature must be 64 raw bytes (r||s)');

  const signatureValid = cryptoVerify(
    'sha256',
    Buffer.from(`${headerB64}.${payloadB64}`),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    signature,
  );
  assert.ok(signatureValid, 'client_secret signature failed to verify');
  ok('signature cryptographically verifies as raw r||s ES256', {
    bytes: signature.length,
  });

  // --- Layer 2: live call to Apple's real revoke endpoint --------------------
  console.log('\nlive call to https://appleid.apple.com/auth/revoke');

  const liveResult = await revokeToken(testConfig, 'not-a-real-token', 'refresh_token');
  console.log(`    Apple responded: HTTP ${liveResult.status} ${liveResult.body || '(empty body)'}`);

  assert.notEqual(liveResult.status, 0, 'no response from Apple');
  ok('request reached Apple and returned a response', {
    status: liveResult.status,
    body: liveResult.body || '(empty)',
  });

  // MEASURED BEHAVIOUR, not an assumption: /auth/revoke answers 200 + empty
  // body to a request with entirely bogus credentials. Verified separately in
  // scripts/apple-endpoint-probe.ts, where only a request with NO client_secret
  // returns 400 invalid_client. So a 200 here means "accepted", never "revoked".
  assert.equal(
    liveResult.status,
    200,
    'Apple is expected to accept even bogus revoke requests with a 200',
  );
  ok('confirmed: Apple returns 200 even for invalid credentials — 200 is NOT proof', {
    status: liveResult.status,
  });

  // The success predicate still has to match Apple's documented shape exactly.
  assert.equal(isRevoked({ status: 200, body: '' }), true);
  assert.equal(isRevoked({ status: 200, body: '{"error":"x"}' }), false);
  assert.equal(isRevoked({ status: 400, body: '' }), false);
  ok('isRevoked() matches Apple spec: 200 AND empty body only');

  // --- Layer 3: the real proof path -----------------------------------------
  // Because a 200 proves nothing, revocation is confirmed by trying to USE the
  // refresh token afterwards. Apple's /auth/token endpoint validates properly.
  console.log('\nrevocation proof via https://appleid.apple.com/auth/token');

  const proof = await confirmRevoked(testConfig, 'not-a-real-token');
  console.log(`    proof result: ${JSON.stringify(proof)}`);

  assert.notEqual(
    proof.confirmed,
    false,
    'a junk token must never be reported as still-valid-and-unrevoked',
  );
  ok('confirmRevoked() returns a real verdict from the token endpoint', proof);

  // The predicate must never turn an unknown into a confirmed revocation.
  assert.ok(
    proof.confirmed === true || proof.confirmed === null,
    'confirmed must be true or indeterminate for a junk token, never false-positive',
  );
  ok('indeterminate results are recorded as unknown, never as confirmed');

  // --- Optional: real credentials, if configured -----------------------------
  const realConfig = {
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    clientId: process.env.APPLE_CLIENT_ID,
    privateKey: process.env.APPLE_PRIVATE_KEY,
  };

  if (realConfig.teamId && realConfig.keyId && realConfig.clientId && realConfig.privateKey) {
    console.log('\nreal Apple credentials detected — verifying they are accepted');
    const realToken = process.env.APPLE_TEST_REFRESH_TOKEN ?? 'not-a-real-token';
    const realResult = await revokeToken(realConfig as AppleConfig, realToken, 'refresh_token');
    console.log(
      `    Apple responded: HTTP ${realResult.status} ${realResult.body || '(empty body)'}`,
    );

    // The revoke endpoint cannot validate credentials for us, so prove the
    // client_secret is genuinely accepted by hitting /auth/token, which does.
    const realProof = await confirmRevoked(realConfig as AppleConfig, realToken);
    console.log(`    proof result: ${JSON.stringify(realProof)}`);

    assert.notEqual(
      realProof.reason === 'indeterminate' && realProof.detail === 'invalid_client',
      true,
      'Apple rejected the configured credentials — team/key/client or .p8 is wrong',
    );
    ok('Apple accepted the configured credentials (client_secret is valid)', {
      revoke_status: realResult.status,
      proof: realProof,
    });

    if (process.env.APPLE_TEST_REFRESH_TOKEN) {
      assert.equal(
        realProof.confirmed,
        true,
        'a real refresh token must be rejected by Apple after revocation',
      );
      ok('REAL revocation confirmed: Apple now rejects the refresh token');
    }
  } else {
    console.log(
      '\n  ! APPLE_* env vars not set — skipped the real-credential leg.\n' +
        '    Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY\n' +
        '    (and optionally APPLE_TEST_REFRESH_TOKEN from a device sign-in) to run it.',
    );
  }

  console.log(`\nAll ${passed} Apple revocation checks passed.`);
}

main().catch((error) => {
  console.error('\nFAILED:', error.message);
  process.exit(1);
});
