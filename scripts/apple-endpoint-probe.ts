/**
 * Characterises how Apple's /auth/revoke endpoint responds to malformed input,
 * so we know exactly how much a 200 actually proves.
 * Run: npx tsx scripts/apple-endpoint-probe.ts
 *
 * Result as measured on 2026-08-25:
 *
 *   no params at all                  -> HTTP 400 {"error":"invalid_client"}
 *   client_id only                    -> HTTP 400 {"error":"invalid_client"}
 *   garbage client_secret             -> HTTP 200 (empty body)
 *   well-formed JWT, unknown team/key -> HTTP 200 (empty body)
 *   unregistered client_id            -> HTTP 200 (empty body)
 *
 * Conclusion: /auth/revoke returns Apple's documented "success" shape (200 with
 * an empty body) for any request that merely carries a `client_secret` field,
 * including a literal "this-is-not-a-jwt" against an app that does not exist.
 * It only 400s when the secret is absent entirely — the endpoint deliberately
 * refuses to be an oracle about which client IDs or tokens are real.
 *
 * Therefore a 200 from /auth/revoke means "request accepted", NOT "token
 * revoked". Actual proof of revocation comes from `confirmRevoked()`, which
 * tries to USE the refresh token afterwards against /auth/token — an endpoint
 * that does validate. Re-run this probe if Apple's behaviour ever appears to
 * change; the revocation logic depends on it.
 */
const URL_REVOKE = 'https://appleid.apple.com/auth/revoke';

async function probe(label: string, params: Record<string, string>) {
  const response = await fetch(URL_REVOKE, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = (await response.text()).trim();
  console.log(`${label.padEnd(38)} -> HTTP ${response.status} ${body || '(empty body)'}`);
}

async function main() {
  await probe('no params at all', {});
  await probe('client_id only', { client_id: 'com.astrollogs.ato' });
  await probe('garbage client_secret', {
    client_id: 'com.astrollogs.ato',
    client_secret: 'this-is-not-a-jwt',
    token: 'x',
    token_type_hint: 'refresh_token',
  });
  await probe('well-formed JWT, unknown team/key', {
    client_id: 'com.astrollogs.ato',
    client_secret:
      'eyJhbGciOiJFUzI1NiIsImtpZCI6IktFWTEyMzQ1NjcifQ.eyJpc3MiOiJBQkNERTEyMzQ1In0.AAAA',
    token: 'x',
    token_type_hint: 'refresh_token',
  });
  await probe('unregistered client_id', {
    client_id: 'com.definitely.not.a.real.app.xyz',
    client_secret: 'this-is-not-a-jwt',
    token: 'x',
    token_type_hint: 'refresh_token',
  });
}

main();
