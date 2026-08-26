/**
 * Floor-requirements Sentry probe. Run: npm run check:sentry
 *
 * Posts a real JS error to the project DSN and asserts ingest accepted it.
 * Look up the printed event id in Sentry Issues (project ato-app).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const FLOOR_TEST_ERROR_MESSAGE = 'ATO floor-requirements Sentry test';

async function main() {
  const dsn = loadEnv().EXPO_PUBLIC_SENTRY_DSN;
  assert.ok(dsn, 'EXPO_PUBLIC_SENTRY_DSN missing from .env.local');

  const parsed = new URL(dsn);
  const key = parsed.username;
  const projectId = parsed.pathname.replace(/^\//, '');
  assert.ok(key && projectId, 'DSN is missing key or project id');

  const eventId = randomUUID().replace(/-/g, '');
  const stamp = new Date().toISOString();
  const storeUrl = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`;

  const response = await fetch(storeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=ato-sentry-check/1.0.0, sentry_key=${key}`,
    },
    body: JSON.stringify({
      event_id: eventId,
      timestamp: stamp,
      platform: 'javascript',
      level: 'error',
      logger: 'ato-sentry-check',
      environment: 'floor-sweep',
      exception: {
        values: [
          {
            type: 'Error',
            value: `${FLOOR_TEST_ERROR_MESSAGE} ${stamp}`,
          },
        ],
      },
      tags: { source: 'sentry-check' },
    }),
  });

  const body = await response.text();
  assert.equal(response.status, 200, `Sentry ingest ${response.status}: ${body}`);
  const parsedBody = JSON.parse(body) as { id?: string };
  assert.equal(parsedBody.id, eventId, 'Sentry did not echo the event id');

  console.log(`  ✓ Sentry accepted JS test error — event id ${eventId}`);
  console.log(`    message: ${FLOOR_TEST_ERROR_MESSAGE} ${stamp}`);
  console.log(`    project: ato-app (confirm in Issues)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
