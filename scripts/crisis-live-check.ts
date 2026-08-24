/**
 * Live crisis-classifier check, run with: npm run check:crisis-live
 *
 * `npm run check:voice` proves the crisis contract against injected stubs. This
 * script proves the same contract against the real Gemini endpoint, which is
 * the part a stub can never tell you:
 *
 *  1. a crisis message routes through the classifier
 *  2. the classifier call really fires against Gemini, not the keyword net —
 *     proven with a message the keyword net does NOT catch, so a `flagged`
 *     verdict can only have come from the live model
 *  3. a slow or failing live call still falls back to the keyword net
 *  4. the main router's generateTalk is never called on a flagged message
 *
 * Needs EXPO_PUBLIC_GEMINI_API_KEY in .env.local. Without it, steps 1 and 2
 * cannot run and the script exits non-zero rather than reporting a pass.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname ?? __dirname, '..');
const GEMINI_HOST = 'generativelanguage.googleapis.com';

/**
 * A message with real risk in it that the keyword net cannot catch: no
 * "suicide" / "kill myself" / "cutting myself" / "ending my life", and nothing
 * the regex matches. If this comes back flagged, a model decided it.
 */
const CLASSIFIER_ONLY_CRISIS = 'I dont want to be here anymore. I keep hoping I just dont wake up tomorrow.';
/** Caught by the user-approved keyword list, so the net can decide it alone. */
const KEYWORD_CRISIS = 'I have been thinking about suicide again';
const BENIGN = 'How is my week going so far?';

/** Expo CLI loads .env.local automatically; plain Node does not. */
function loadEnvLocal(): boolean {
  let raw: string;
  try {
    raw = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
  } catch {
    return false;
  }
  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (value) process.env[match[1]] = value;
  }
  return true;
}

interface FetchLog {
  url: string;
  method: string;
  authenticated: boolean;
}

/** Records every outbound request so "live call" is an observation, not a guess. */
function recordFetches(): { calls: FetchLog[]; restore: () => void } {
  const calls: FetchLog[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: typeof input === 'string' ? input : input.toString(),
      method: init?.method ?? 'GET',
      authenticated: headers.has('x-goog-api-key'),
    });
    return original(input as RequestInfo, init);
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function geminiCalls(calls: FetchLog[]): FetchLog[] {
  return calls.filter((call) => call.url.includes(GEMINI_HOST));
}

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  \u2713 ${label}`);
}

async function main() {
  // The dev trace in detect.ts is what surfaces which path fired, and it is
  // gated on __DEV__. Set it before anything imports that module.
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;

  const foundEnvFile = loadEnvLocal();

  // config.ts snapshots process.env at import time, so these must come after
  // the .env.local load.
  const { VOICE_CONFIG } = await import('../src/lib/voice/config');
  const { classifyCrisis } = await import('../src/lib/crisis/classify');
  const { detectCrisis, keywordDetect } = await import('../src/lib/crisis/detect');
  const { routeTalkReply } = await import('../src/lib/voice/talk');

  const apiKey = VOICE_CONFIG.geminiApiKey;

  console.log('Config');
  console.log(`  .env.local: ${foundEnvFile ? 'found' : 'MISSING'}`);
  console.log(`  provider: ${VOICE_CONFIG.provider}`);
  console.log(`  model: ${VOICE_CONFIG.geminiModel}`);
  console.log(
    `  EXPO_PUBLIC_GEMINI_API_KEY: ${apiKey ? `set (${apiKey.length} chars)` : 'NOT SET'}`,
  );
  console.log('');

  // -------------------------------------------------------------------------
  // Sanity: the discriminator this whole script leans on.
  console.log('Test message selection');
  assert.equal(
    keywordDetect(CLASSIFIER_ONLY_CRISIS),
    false,
    'the classifier-only message must be invisible to the keyword net',
  );
  assert.equal(keywordDetect(KEYWORD_CRISIS), true, 'the keyword message must hit the net');
  assert.equal(keywordDetect(BENIGN), false);
  ok('crisis message chosen so only a live model can flag it (keyword net says false)');
  console.log('');

  // -------------------------------------------------------------------------
  // 1 + 2. Crisis message routes through the classifier, live.
  console.log('1+2. Live classifier against real Gemini');
  if (!apiKey) {
    console.log('  \u2717 BLOCKED: no EXPO_PUBLIC_GEMINI_API_KEY, cannot make a live call.');
    console.log('     Paste the key into .env.local and re-run.');
  } else {
    const live = recordFetches();
    let detection;
    try {
      detection = await detectCrisis(CLASSIFIER_ONLY_CRISIS);
    } finally {
      live.restore();
    }

    const outbound = geminiCalls(live.calls);
    console.log(`  outbound: ${outbound.length} request(s) to ${GEMINI_HOST}`);
    for (const call of outbound) {
      console.log(`    ${call.method} ${call.url} (x-goog-api-key: ${call.authenticated})`);
    }
    console.log(`  detection: ${JSON.stringify(detection)}`);

    assert.equal(outbound.length, 1, 'exactly one classifier request should go out');
    assert.equal(outbound[0].method, 'POST');
    assert.ok(outbound[0].authenticated, 'classifier request must carry the API key header');
    assert.equal(detection.method, 'classifier', 'the live classifier decided, not the net');
    assert.equal(detection.model, VOICE_CONFIG.geminiModel);
    assert.equal(detection.flagged, true, 'live classifier should flag real risk');
    ok('crisis message → live Gemini classifier call → flagged=true (keyword net could not have)');

    // The classifier must also be willing to say no, or "it flags everything"
    // would look identical to a real verdict.
    const benign = recordFetches();
    let benignDetection;
    try {
      benignDetection = await detectCrisis(BENIGN);
    } finally {
      benign.restore();
    }
    console.log(`  benign detection: ${JSON.stringify(benignDetection)}`);
    assert.equal(geminiCalls(benign.calls).length, 1);
    assert.equal(benignDetection.method, 'classifier');
    assert.equal(benignDetection.flagged, false, 'benign message must not be flagged');
    ok('benign message → live classifier call → flagged=false (not a flag-everything stub)');

    // A direct call, so the raw classifier contract is checked too.
    const direct = await classifyCrisis(CLASSIFIER_ONLY_CRISIS);
    console.log(`  classifyCrisis direct: ${JSON.stringify(direct)}`);
    assert.equal(typeof direct.flagged, 'boolean');
    assert.equal(direct.model, VOICE_CONFIG.geminiModel);
    ok('classifyCrisis returns a structured boolean from the live endpoint');
  }
  console.log('');

  // -------------------------------------------------------------------------
  // 3. Slow or failing live call still falls back to the keyword net.
  console.log('3. Timeout / failure falls back to the keyword net');

  // Slow: a fetch that never settles, so only the timeout can end it.
  const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError')),
      );
    })) as typeof fetch;

  const slowFlagged = await detectCrisis(KEYWORD_CRISIS, {
    classifyOptions: { apiKey: apiKey ?? 'unused-by-a-hanging-fetch', timeoutMs: 150, fetchImpl: hangingFetch },
  });
  console.log(`  slow call, keyword message: ${JSON.stringify(slowFlagged)}`);
  assert.equal(slowFlagged.method, 'keyword-fallback');
  assert.equal(slowFlagged.flagged, true, 'keyword net must still catch it');
  assert.ok(slowFlagged.error?.includes('timed out after 150ms'), 'timeout named in the error');
  assert.ok(slowFlagged.latencyMs >= 150, 'fallback waited for the timeout, did not skip the call');

  const slowBenign = await detectCrisis(BENIGN, {
    classifyOptions: { apiKey: apiKey ?? 'unused-by-a-hanging-fetch', timeoutMs: 150, fetchImpl: hangingFetch },
  });
  console.log(`  slow call, benign message: ${JSON.stringify(slowBenign)}`);
  assert.equal(slowBenign.method, 'keyword-fallback');
  assert.equal(slowBenign.flagged, false, 'fallback must not flag a benign message');
  ok('classifier hangs → keyword net decides (flags the risk, clears the benign)');

  // Same fallback, but against the real endpoint with an impossible deadline.
  if (apiKey) {
    const tight = recordFetches();
    let tightDetection;
    try {
      tightDetection = await detectCrisis(KEYWORD_CRISIS, { classifyOptions: { timeoutMs: 1 } });
    } finally {
      tight.restore();
    }
    console.log(`  real endpoint, 1ms deadline: ${JSON.stringify(tightDetection)}`);
    assert.equal(geminiCalls(tight.calls).length, 1, 'the live call was attempted, then aborted');
    assert.equal(tightDetection.method, 'keyword-fallback');
    assert.equal(tightDetection.flagged, true);
    ok('real Gemini call aborted mid-flight → keyword net decides');
  }

  // Hard failure (bad key → HTTP error) must fall back the same way.
  const rejected = await detectCrisis(KEYWORD_CRISIS, {
    classifyOptions: { apiKey: 'definitely-not-a-valid-key' },
  });
  console.log(`  rejected call: ${JSON.stringify(rejected)}`);
  assert.equal(rejected.method, 'keyword-fallback');
  assert.equal(rejected.flagged, true);
  ok('classifier HTTP failure → keyword net decides');
  console.log('');

  // -------------------------------------------------------------------------
  // 4. generateTalk is never called on a flagged message.
  console.log('4. Main router generateTalk never fires on a flagged message');

  let mainCalls = 0;
  const spy = {
    id: 'local' as const,
    label: 'spy',
    generate: async () => ({ read: 'x', do: 'y' }),
    generateTalk: async () => {
      mainCalls += 1;
      return { reply: 'this reply must never be produced for a flagged message' };
    },
  };
  const spyProviders = { gemini: spy, local: spy };

  const me = {
    name: 'Riley',
    show_up: 'finishing my resume',
    talk_style: 'even' as const,
    knocks_you_off: 'bad sleep',
    morning_cue: 'making coffee',
  };
  const talkInput = { me, checkCount: 4, history: [], aiConsent: true, userId: 'u-live-check' };

  // Live classifier path.
  if (apiKey) {
    const flaggedRun = recordFetches();
    let flaggedTalk;
    try {
      flaggedTalk = await routeTalkReply(
        { ...talkInput, message: CLASSIFIER_ONLY_CRISIS },
        { providers: spyProviders, logCrisisFlag: async () => {}, isDev: true },
      );
    } finally {
      flaggedRun.restore();
    }
    console.log(
      `  live flagged talk: kind=${flaggedTalk.kind} method=${flaggedTalk.crisis?.method} ` +
        `generateTalk calls=${mainCalls} gemini requests=${geminiCalls(flaggedRun.calls).length}`,
    );
    assert.equal(flaggedTalk.kind, 'crisis');
    assert.equal(flaggedTalk.crisis?.method, 'classifier');
    assert.equal(mainCalls, 0, 'zero generateTalk calls on a flagged message');
    assert.equal(
      geminiCalls(flaggedRun.calls).length,
      1,
      'only the classifier went out — no main router request followed it',
    );
    ok('live-flagged message → crisis card, 0 generateTalk calls, 1 total Gemini request');
  }

  // Fallback path: the flag came from the keyword net, same guarantee.
  const fallbackTalk = await routeTalkReply(
    { ...talkInput, message: KEYWORD_CRISIS },
    {
      providers: spyProviders,
      detectCrisis: (message) =>
        detectCrisis(message, {
          classifyOptions: { apiKey: apiKey ?? 'unused', timeoutMs: 150, fetchImpl: hangingFetch },
        }),
      logCrisisFlag: async () => {},
      isDev: true,
    },
  );
  console.log(
    `  fallback flagged talk: kind=${fallbackTalk.kind} method=${fallbackTalk.crisis?.method} ` +
      `generateTalk calls=${mainCalls}`,
  );
  assert.equal(fallbackTalk.kind, 'crisis');
  assert.equal(fallbackTalk.crisis?.method, 'keyword-fallback');
  assert.equal(mainCalls, 0, 'zero generateTalk calls when the net raised the flag');
  ok('keyword-fallback flag → crisis card, still 0 generateTalk calls');

  // Control: the spy does register a call, so 0 above means something.
  const clearTalk = await routeTalkReply(
    { ...talkInput, message: BENIGN },
    {
      providers: spyProviders,
      detectCrisis: async () => ({ flagged: false, method: 'classifier' as const, latencyMs: 0 }),
      isDev: true,
    },
  );
  console.log(`  control clear talk: kind=${clearTalk.kind} generateTalk calls=${mainCalls}`);
  assert.equal(clearTalk.kind, 'reply');
  assert.equal(mainCalls, 1, 'the spy does count calls, so the zeros above are real');
  ok('control: unflagged message does reach generateTalk (spy is wired correctly)');
  console.log('');

  if (!apiKey) {
    console.log(
      `${passed} offline checks passed, but the live classifier legs did NOT run: ` +
        'EXPO_PUBLIC_GEMINI_API_KEY is not set in .env.local.',
    );
    process.exit(1);
  }

  console.log(`All ${passed} checks passed, live classifier included.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
