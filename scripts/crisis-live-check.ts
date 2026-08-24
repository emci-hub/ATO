/**
 * LIVE end-to-end check of the Talk crisis-classifier path.
 *
 * Requires a real Gemini key in .env.local (EXPO_PUBLIC_GEMINI_API_KEY). The
 * key is read from .env.local into process.env before the app modules import,
 * and is never printed — logging redacts the x-goog-api-key header.
 *
 * Exercises the SAME router path the app uses (routeTalkReply → real
 * classifyCrisis via detectCrisis), with a spy provider standing in for the
 * main router so we can count generateTalk calls exactly like the 23/23
 * offline verification did.
 *
 * Run: npx tsx scripts/crisis-live-check.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import type { VoiceProvider } from '../src/lib/voice/providers/types';
import type { CheckHistory, VoiceMe } from '../src/lib/voice/types';

// ---- Load .env.local into process.env BEFORE importing the app modules ----
// The app reads EXPO_PUBLIC_* at module import time, so env must be set first.
const envRaw = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
for (const line of envRaw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
if (!process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
  console.error('FATAL: EXPO_PUBLIC_GEMINI_API_KEY is not set in .env.local');
  process.exit(2);
}

interface LoggedCall {
  url: string;
  requestHeaders: Record<string, unknown>;
  requestBody: string;
  status: number;
  responseBody: string;
  elapsedMs: number;
}
const calls: LoggedCall[] = [];

/** Mirrors classify.ts: extract the model's text from the Gemini envelope. */
function modelText(responseBody: string): string {
  try {
    const data = JSON.parse(responseBody) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  } catch {
    return '';
  }
}

/** fetch wrapper that logs the raw request/response with the API key redacted. */
function loggingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const started = Date.now();
  const entry: LoggedCall = {
    url: String(input),
    requestHeaders: {},
    requestBody: String(init?.body ?? ''),
    status: 0,
    responseBody: '',
    elapsedMs: 0,
  };
  for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
    entry.requestHeaders[k] = k.toLowerCase() === 'x-goog-api-key' ? 'REDACTED' : v;
  }
  return fetch(input, init)
    .then(async (res) => {
      const text = await res.text();
      entry.status = res.status;
      entry.responseBody = text;
      entry.elapsedMs = Date.now() - started;
      calls.push(entry);
      return new Response(text, { status: res.status, headers: res.headers });
    })
    .catch((err) => {
      entry.status = -1;
      entry.responseBody = `(fetch error: ${err instanceof Error ? err.message : String(err)})`;
      entry.elapsedMs = Date.now() - started;
      calls.push(entry);
      throw err;
    });
}

interface Outcome {
  check: string;
  pass: boolean;
  detail: string;
}
const outcomes: Outcome[] = [];

function record(check: string, pass: boolean, detail: string) {
  outcomes.push({ check, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${check} — ${detail}`);
}

function run(check: string, fn: () => void) {
  try {
    fn();
    record(check, true, 'ok');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    record(check, false, msg);
  }
}

async function main() {
  const { routeTalkReply } = await import('../src/lib/voice/talk');
  const { detectCrisis, keywordDetect } = await import('../src/lib/crisis/detect');
  const { classifyCrisis, parseClassified } = await import('../src/lib/crisis/classify');
  const { buildVoiceConfig } = await import('../src/lib/voice/config');

  const config = buildVoiceConfig({
    MODEL_PROVIDER: 'gemini',
    GEMINI_MODEL: process.env.EXPO_PUBLIC_GEMINI_MODEL,
    GEMINI_API_KEY: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
  });

  const ME: VoiceMe = {
    name: 'Riley',
    show_up: 'finishing my resume',
    talk_style: 'even',
    knocks_you_off: 'bad sleep',
    morning_cue: 'making coffee',
  };
  const HISTORY: CheckHistory[] = [
    { day: 1, status: 'done' },
    { day: 2, status: 'done' },
    { day: 3, status: 'done' },
    { day: 4, status: 'done' },
  ];

  console.log(`\nLive crisis classifier check — model: ${config.geminiModel}`);
  console.log('Key source: .env.local (redacted in all output).');

  // Spy provider — same generateTalk counter method as the 23/23 verification.
  let mainCalls = 0;
  const spyProvider: VoiceProvider = {
    id: 'local',
    label: 'spy',
    generate: async () => ({ read: 'spy', do: 'spy' }),
    generateTalk: async () => {
      mainCalls += 1;
      return { reply: 'SPY-SHOULD-NOT-APPEAR' };
    },
  };

  // Real detection, but with the classifier wrapped in the logging fetch.
  let flagLogged = 0;
  let lastDetection: { flagged: boolean; method: string } | null = null;
  const detectReal = async (message: string) => {
    const r = await detectCrisis(message, {
      classify: (m) => classifyCrisis(m, { fetchImpl: loggingFetch }),
    });
    lastDetection = r;
    return r;
  };

  // -------------------------------------------------------------------------
  console.log('\n[1] Crisis message through Talk (real classifier)');
  const CRISIS_MESSAGE = "I've been thinking about suicide all day.";
  assert.equal(keywordDetect(CRISIS_MESSAGE), true, 'test message is from the approved keyword set');

  calls.length = 0;
  mainCalls = 0;
  flagLogged = 0;
  lastDetection = null;

  const crisisResult = await routeTalkReply(
    {
      me: ME,
      message: CRISIS_MESSAGE,
      checkCount: 4,
      history: HISTORY,
      aiConsent: true,
      userId: 'live-check-u1',
    },
    {
      config,
      providers: { gemini: spyProvider, local: spyProvider },
      detectCrisis: detectReal,
      logCrisisFlag: async () => {
        flagLogged += 1;
      },
      isDev: true,
    },
  );

  run('crisis message → kind === "crisis" (static card branch)', () => {
    assert.equal(crisisResult.kind, 'crisis');
    assert.equal(crisisResult.crisis?.flagged, true);
    assert.equal(crisisResult.reply, undefined, 'no AI reply produced for a flagged message');
  });

  run('classifier fired, NOT keyword fallback', () => {
    assert.equal(crisisResult.crisis?.method, 'classifier', 'method must be classifier, not keyword-fallback');
  });

  run('raw Gemini classifier request logged (URL + body, key redacted)', () => {
    assert.equal(calls.length, 1, 'exactly one Gemini request for the flagged path');
    const call = calls[0];
    assert.ok(call.url.includes(':generateContent'), `unexpected URL: ${call.url}`);
    assert.equal(call.requestHeaders['x-goog-api-key'], 'REDACTED');
    assert.ok(call.requestBody.includes('systemInstruction'), 'classifier system instruction present');
  });

  run('response is boolean JSON at zero temperature inside 4s', () => {
    const call = calls[0];
    assert.equal(call.status, 200, `Gemini returned HTTP ${call.status}`);
    const requestBody = JSON.parse(call.requestBody) as {
      generationConfig?: { temperature?: number; responseMimeType?: string; thinkingConfig?: { thinkingLevel?: string } };
    };
    assert.equal(requestBody.generationConfig?.temperature, 0, 'temperature must be 0');
    assert.equal(requestBody.generationConfig?.responseMimeType, 'application/json', 'boolean JSON response mime');
    assert.equal(parseClassified(modelText(call.responseBody)), true, 'response parses to boolean true');
    assert.ok(call.elapsedMs < 4000, `classifier took ${call.elapsedMs}ms (>= 4000ms timeout)`);
  });

  run('flagged → static card, flag logged, zero main-router generateTalk calls', () => {
    assert.equal(flagLogged, 1, 'crisis flag must be logged');
    assert.equal(mainCalls, 0, 'spy prove: generateTalk must NOT have fired');
    assert.equal(calls.length, 1, 'exactly 1 total Gemini request (the classifier, nothing else)');
  });

  const crisisCall = calls[0] ?? null;

  // -------------------------------------------------------------------------
  console.log('\n[2] Benign message through the same path');
  const BENIGN_MESSAGE = "How's my week going?";
  assert.equal(keywordDetect(BENIGN_MESSAGE), false, 'benign test message is not in the keyword set');

  calls.length = 0;
  mainCalls = 0;
  flagLogged = 0;
  lastDetection = null;

  const benignResult = await routeTalkReply(
    {
      me: ME,
      message: BENIGN_MESSAGE,
      checkCount: 4,
      history: HISTORY,
      aiConsent: true,
      userId: 'live-check-u2',
    },
    {
      config,
      providers: { gemini: spyProvider, local: spyProvider },
      detectCrisis: detectReal,
      isDev: true,
    },
  );

  run('benign message → classifier returns false', () => {
    assert.ok(lastDetection, 'classifier ran');
    assert.equal(lastDetection?.flagged, false);
    assert.equal(lastDetection?.method, 'classifier');
    const call = calls[0];
    assert.equal(call.status, 200);
    assert.equal(parseClassified(modelText(call.responseBody)), false, 'response parses to boolean false');
    assert.ok(call.elapsedMs < 4000);
  });

  run('benign message → Talk proceeds to the main router (generateTalk fires)', () => {
    assert.equal(benignResult.kind, 'reply');
    assert.equal(benignResult.reply, 'SPY-SHOULD-NOT-APPEAR', 'reply came from the main router call');
    assert.equal(mainCalls, 1, 'exactly one main-router generateTalk call');
    assert.equal(calls.length, 1, 'exactly 1 total Gemini request (the classifier, nothing else)');
  });

  // -------------------------------------------------------------------------
  const call = crisisCall;
  console.log('\n--- raw Gemini classifier request (key redacted) ---');
  if (call) {
    console.log(`URL: ${call.url}`);
    console.log(`Headers: ${JSON.stringify(call.requestHeaders, null, 2)}`);
    try {
      console.log(`Body: ${JSON.stringify(JSON.parse(call.requestBody), null, 2)}`);
    } catch {
      console.log(`Body: ${call.requestBody}`);
    }
    console.log(`Status: ${call.status} · elapsed: ${call.elapsedMs}ms`);
    console.log(`Raw response body: ${call.responseBody}`);
  }

  const failed = outcomes.filter((o) => !o.pass);
  console.log(`\n${outcomes.length - failed.length}/${outcomes.length} live checks passed.`);
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.map((f) => f.check).join('; ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
