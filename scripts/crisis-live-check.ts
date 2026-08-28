/**
 * LIVE end-to-end check of the Talk crisis-keyword path.
 *
 * Confirms a real keyword-flagged message short-circuits BEFORE any Gemini
 * call on the actual Talk pipeline (routeTalkReply → the default keyword-only
 * detector → main router), and that the main router never fires. Uses a spy
 * provider for the main router and a fetch wrapper that counts every Gemini
 * HTTP request, so "zero model calls on a flag" is proven by counting actual
 * requests — not just by which provider was selected.
 *
 * Run: npx tsx scripts/crisis-live-check.ts
 */
import assert from 'node:assert/strict';

import type { VoiceProvider } from '../src/lib/voice/providers/types';
import type { CheckHistory, VoiceMe } from '../src/lib/voice/types';

interface RequestCount {
  gemini: number;
}
const requests: RequestCount = { gemini: 0 };

const realFetch = globalThis.fetch;

/** Global fetch patch that counts any request to the Gemini API. */
function countingFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  if (String(input).includes('generativelanguage.googleapis.com')) {
    requests.gemini += 1;
  }
  return realFetch(input, init);
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
    record(check, false, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  // Patch global fetch for the whole test so ANY Gemini request is counted —
  // a regression that re-adds a classifier or a main call would be caught.
  globalThis.fetch = countingFetch as typeof fetch;
  try {
    await execute();
  } finally {
    globalThis.fetch = realFetch;
  }
}

async function execute() {
  const { routeTalkReply } = await import('../src/lib/voice/talk');
  const { buildVoiceConfig } = await import('../src/lib/voice/config');
  const { detectCrisis, keywordDetect } = await import('../src/lib/crisis/detect');

  const config = buildVoiceConfig({
    MODEL_PROVIDER: 'local', // main router uses the deterministic local provider
  });

  const ME: VoiceMe = {
    name: 'Riley',
    show_up: 'finishing my resume',
    talk_style: 'even',
    knocks_you_off: 'bad sleep',
    morning_cue: 'make coffee',
  };
  const HISTORY: CheckHistory[] = [
    { day: 1, status: 'done' },
    { day: 2, status: 'done' },
    { day: 3, status: 'done' },
    { day: 4, status: 'done' },
  ];

  console.log('\nLive crisis-keyword check — keyword-only detection on the real Talk pipeline');
  console.log('Detection: static keyword list (user-reviewed). No classifier, no Gemini call.');

  // Spy main-router provider, so any main-router call is counted separately.
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

  // Real keyword-only detection, with Gemini requests counted at the fetch layer.
  let flagLogged = 0;
  const detectReal = async (message: string) => detectCrisis(message);

  // -------------------------------------------------------------------------
  console.log('\n[1] Keyword-flagged message through Talk');
  const CRISIS_MESSAGE = "I've been thinking about suicide all day.";
  assert.equal(keywordDetect(CRISIS_MESSAGE), true, 'test message is from the user-approved keyword set');

  requests.gemini = 0;
  mainCalls = 0;
  flagLogged = 0;

  const crisisResult = await routeTalkReply(
    {
      me: ME,
      message: CRISIS_MESSAGE,
      checkCount: 4,
      history: HISTORY,
      aiConsent: true,
      userId: 'live-keyword-u1',
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

  run('keyword-flagged message → kind === "crisis" (static card branch)', () => {
    assert.equal(crisisResult.kind, 'crisis');
    assert.equal(crisisResult.crisis?.flagged, true);
    assert.equal(crisisResult.reply, undefined, 'no AI reply produced for a flagged message');
  });

  run('detection method is "keyword" (classifier fully out of the loop)', () => {
    assert.equal(crisisResult.crisis?.method, 'keyword');
  });

  run('flagged → flag logged, zero main-router generateTalk calls', () => {
    assert.equal(flagLogged, 1, 'crisis flag must be logged');
    assert.equal(mainCalls, 0, 'spy prove: generateTalk must NOT have fired');
  });

  run('flagged → ZERO Gemini HTTP requests (no classifier, no main call)', () => {
    assert.equal(requests.gemini, 0, `expected 0 Gemini requests, saw ${requests.gemini}`);
  });

  // -------------------------------------------------------------------------
  console.log('\n[2] Benign message through the same path');
  const BENIGN_MESSAGE = "How's my week going?";
  assert.equal(keywordDetect(BENIGN_MESSAGE), false, 'benign test message is not in the keyword set');

  requests.gemini = 0;
  mainCalls = 0;
  flagLogged = 0;

  const benignResult = await routeTalkReply(
    {
      me: ME,
      message: BENIGN_MESSAGE,
      checkCount: 4,
      history: HISTORY,
      aiConsent: true,
      userId: 'live-keyword-u2',
    },
    {
      config,
      providers: { gemini: spyProvider, local: spyProvider },
      detectCrisis: detectReal,
      isDev: true,
    },
  );

  run('benign message → keyword detection returns false', () => {
    assert.equal(benignResult.kind, 'reply');
  });

  run('benign message → Talk proceeds to the main router (generateTalk fires)', () => {
    assert.equal(benignResult.reply, 'SPY-SHOULD-NOT-APPEAR', 'reply came from the main router call');
    assert.equal(mainCalls, 1, 'exactly one main-router generateTalk call');
  });

  run('benign path fires no Gemini requests either (local spy provider)', () => {
    assert.equal(requests.gemini, 0, `expected 0 Gemini requests, saw ${requests.gemini}`);
  });

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
