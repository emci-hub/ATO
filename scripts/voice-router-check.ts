/**
 * Stage 4 + 5 acceptance checks, run with: npm run check:voice
 *
 * Verifies the router's contract end-to-end against the real bank file and the
 * deterministic local provider:
 *  - check_count < 3 → first_cards.md bank, dev flag says bank file (no model call)
 *  - check_count >= 3 → generated, in sage.txt's register
 *  - Day 4 read/do are NOT string-identical to Day 3's
 *  - repeats / vague Dos / cruel cuts are dropped before showing
 *  - AI consent gate (Apple 5.1.2)
 *  - crisis: keyword-list detection; zero main calls on flag
 *  - Talk: consent gate, crisis short-circuit, style-differentiated tone
 */
import assert from 'node:assert/strict';

import { bankCard, parseBank } from '../src/lib/voice/bank';
import { buildVoiceConfig } from '../src/lib/voice/config';
import { BANK_MARKDOWN } from '../src/lib/voice/content.generated';
import { detectCrisis, keywordDetect, normalizeCrisis } from '../src/lib/crisis/detect';
import { filterCard, hasCut, isCruelCut, isVagueDo } from '../src/lib/voice/filters';
import { localProvider } from '../src/lib/voice/providers/local';
import type { VoiceProvider } from '../src/lib/voice/providers/types';
import { deriveTone, routeVoiceCard } from '../src/lib/voice/router';
import { routeTalkReply } from '../src/lib/voice/talk';
import type { CheckHistory, RouteVoiceCardInput, VoiceCard, VoiceMe } from '../src/lib/voice/types';

const CUE = 'making coffee';

const ME: VoiceMe = {
  name: 'Riley',
  show_up: 'finishing my resume',
  talk_style: 'even',
  knocks_you_off: 'bad sleep',
  morning_cue: CUE,
};

function mkHistory(records: Array<Partial<CheckHistory> & { day: number; status: 'done' | 'skipped' }>): CheckHistory[] {
  return records.map((r) => ({ day: r.day, status: r.status, read: r.read, do: r.do, source: r.source }));
}

function input(checkCount: number, history: CheckHistory[], extra?: Partial<RouteVoiceCardInput>): RouteVoiceCardInput {
  return { me: ME, checkCount, history, ...extra };
}

const localConfig = buildVoiceConfig({ MODEL_PROVIDER: 'local' });
const dev = { isDev: true };

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

async function main() {
// ---------------------------------------------------------------------------
console.log('Bank parse');
const bank = parseBank(BANK_MARKDOWN.replace(/\r\n/g, '\n'));
for (const day of [1, 2, 3]) {
  for (const style of ['quiet', 'even', 'loud'] as const) {
    assert.ok(bank[day]?.[style]?.read, `day ${day} ${style} read missing`);
    assert.ok(bank[day]?.[style]?.do, `day ${day} ${style} do missing`);
  }
}
ok('all 9 bank cards parse (days 1–3 × quiet/even/loud)');

const day1Even = bankCard(1, 'even', CUE)!;
assert.equal(day1Even.do, `After you ${CUE}, write down one thing you're walking into today.`);
assert.ok(!day1Even.do.includes('{morning_cue}') && !day1Even.read.includes('{morning_cue}'));
ok('bank card substitutes {morning_cue} at render time');

// ---------------------------------------------------------------------------
console.log('Bank path: check_count < 3');
for (let checkCount = 0; checkCount < 3; checkCount += 1) {
  const result = await routeVoiceCard(input(checkCount, []), { config: localConfig, ...dev });
  assert.equal(result.source, 'bank');
  assert.equal(result.provider, null);
  assert.equal(result.day, checkCount + 1);
  assert.ok(result.dev, 'dev trace present');
  assert.equal(result.dev!.fromBankFile, true, 'bank path flagged as from bank file');
  assert.equal(result.dev!.fromModel, false, 'bank path must NOT be flagged as a model call');
  assert.equal(result.dev!.checkCount, checkCount);
  const expected = bankCard(checkCount + 1, ME.talk_style, CUE)!;
  assert.equal(result.card!.read, expected.read);
  assert.equal(result.card!.do, expected.do);
}
ok('check_count 0/1/2 → bank file, dev flag fromBankFile=true / fromModel=false');

console.log('Bank path: energy_pattern + support_style pick the slot');
const cueOwn = 'make coffee';
const nightSpace = {
  ...ME,
  talk_style: 'loud' as const,
  morning_cue: cueOwn,
  energy_pattern: 'night_owl' as const,
  support_style: 'space' as const,
};
const morningNudge = {
  ...ME,
  talk_style: 'quiet' as const,
  morning_cue: 'put on music',
  energy_pattern: 'morning' as const,
  support_style: 'nudge' as const,
};
const nightCard = await routeVoiceCard(
  { me: nightSpace, checkCount: 0, history: [] },
  { config: localConfig, ...dev },
);
const nudgeCard = await routeVoiceCard(
  { me: morningNudge, checkCount: 0, history: [] },
  { config: localConfig, ...dev },
);
assert.equal(nightCard.source, 'bank');
assert.equal(nightCard.dev!.fromModel, false);
assert.ok(nightCard.card!.do.includes(cueOwn));
assert.ok(!nightCard.card!.do.includes('{morning_cue}'));
assert.equal(nightCard.card!.do, bankCard(1, 'quiet', cueOwn)!.do);
assert.equal(nudgeCard.card!.do, bankCard(1, 'loud', 'put on music')!.do);
assert.notEqual(nightCard.card!.read, nudgeCard.card!.read);
ok('two intake answer sets → different Day 1 bank cards; cue phrase is in the Do');

// ---------------------------------------------------------------------------
console.log('Consent gate (Apple 5.1.2)');
const d1 = mkHistory([{ day: 1, status: 'done' }, { day: 2, status: 'done' }, { day: 3, status: 'done' }]);
assert.equal(deriveTone(d1), 'lift');

// Never asked + check_count >= 3 → the router must NOT call a model.
const pending = await routeVoiceCard(input(3, d1), { config: localConfig, ...dev });
assert.equal(pending.consent, 'pending');
assert.equal(pending.source, 'bank');
assert.equal(pending.provider, null);
assert.equal(pending.card, null, 'no bank card exists for day 4 → nothing shown, no model call');
assert.equal(pending.dev!.fromModel, false, 'pending consent must not fire a model call');
ok('aiConsent null at check_count >= 3 → consent pending, no model call, card null');

// Explicitly denied → bank-only forever, never a model call.
const denied = await routeVoiceCard(input(3, d1, { aiConsent: false }), { config: localConfig, ...dev });
assert.equal(denied.consent, 'denied');
assert.equal(denied.source, 'bank');
assert.equal(denied.provider, null);
assert.equal(denied.card, null);
assert.equal(denied.dev!.fromModel, false);
ok('aiConsent false at check_count >= 3 → consent denied, bank only, no model call');

// Denied but still inside the bank window → starter cards keep working.
const deniedDay3 = await routeVoiceCard(input(2, mkHistory([{ day: 1, status: 'done' }, { day: 2, status: 'done' }]), { aiConsent: false }), { config: localConfig, ...dev });
assert.equal(deniedDay3.consent, 'denied');
assert.equal(deniedDay3.source, 'bank');
assert.ok(deniedDay3.card, 'denied user still gets the Day 3 bank card');
assert.equal(deniedDay3.card!.read, bankCard(3, ME.talk_style, CUE)!.read);
ok('aiConsent false inside bank window → Day 1–3 starter cards still work');

// Granted + check_count >= 3 → generation is allowed.
const granted = await routeVoiceCard(input(3, d1, { aiConsent: true }), { config: localConfig, ...dev });
assert.equal(granted.consent, 'granted');
assert.equal(granted.source, 'generated');
assert.ok(granted.card);
ok('aiConsent true at check_count >= 3 → consent granted, generation proceeds');

// ---------------------------------------------------------------------------
console.log('Generated path: check_count >= 3');
const day4 = await routeVoiceCard(input(3, d1, { aiConsent: true }), { config: localConfig, ...dev });
assert.equal(day4.source, 'generated');
assert.equal(day4.provider, 'local');
assert.equal(day4.consent, 'granted');
assert.equal(day4.dev!.fromBankFile, false);
assert.equal(day4.dev!.fromModel, true);

const day3Bank = bankCard(3, ME.talk_style, CUE)!;
assert.notEqual(day4.card!.read, day3Bank.read, 'Day 4 read must differ from Day 3 read');
assert.notEqual(day4.card!.do, day3Bank.do, 'Day 4 do must differ from Day 3 do');
ok('Day 4 generated read+do are not string-identical to Day 3 bank card');

const day5 = await routeVoiceCard(input(4, mkHistory([
  { day: 1, status: 'done' }, { day: 2, status: 'done' },
  { day: 3, status: 'done' }, { day: 4, status: 'done' },
]), { aiConsent: true }), { config: localConfig, ...dev });
assert.notEqual(day5.card!.read, day4.card!.read);
assert.notEqual(day5.card!.do, day4.card!.do);
ok('consecutive generated days do not repeat');

// ---------------------------------------------------------------------------
console.log('Filters');
assert.equal(isVagueDo('Just be productive.'), true, 'platitude Do is vague');
assert.equal(isVagueDo('After you making coffee, write down the one task you would regret skipping, then start it.'), false);
ok('vague Do detection');

assert.equal(isCruelCut('Two skips this week. Not a verdict.'), false, 'habit cut is not cruel');
assert.equal(isCruelCut("You're so lazy, you never finish anything."), true);
ok('cruel cut detection');

const shown = [{ read: 'Some earlier read.', do: 'Some earlier do.' }];
assert.equal(filterCard({ read: 'Some earlier READ.', do: 'Fresh do.' }, { shownCards: shown, crisisToday: false, previousHadCut: false }), 'repeat');
assert.equal(filterCard({ read: 'Nice work.', do: 'Just be productive.' }, { shownCards: [], crisisToday: false, previousHadCut: false }), 'vague-do');
assert.equal(filterCard({ read: 'You are a failure.', do: 'After you making coffee, write one line.' }, { shownCards: [], crisisToday: false, previousHadCut: false }), 'cruel-cut');
assert.equal(filterCard({ read: 'The skips are piling up again.', do: 'After you making coffee, do one thing.' }, { shownCards: [], crisisToday: true, previousHadCut: false }), 'cut-after-crisis');
assert.equal(filterCard({ read: 'The skips are piling up again.', do: 'After you making coffee, do one thing.' }, { shownCards: [], crisisToday: false, previousHadCut: true }), 'cut-streak');
ok('repeat / vague-do / cruel-cut / cut-after-crisis / cut-streak all drop');

// ---------------------------------------------------------------------------
console.log('Voice rules through the router');
const skipped = mkHistory([
  { day: 1, status: 'done' }, { day: 2, status: 'done' },
  { day: 3, status: 'skipped', read: 'Day 3, and the skips are landing on the same kind of day. That is the pattern.', do: 'After you making coffee, do the smallest version.' },
]);
assert.equal(deriveTone(skipped), 'cut');
assert.equal(hasCut(skipped[2].read ?? ''), true);

const afterCut = await routeVoiceCard(input(3, skipped, { aiConsent: true }), { config: localConfig, ...dev });
assert.ok(afterCut.card, 'a card is still shown');
assert.ok(!hasCut(afterCut.card!.read), 'no two cuts in a row');
ok('no two cuts in a row (local provider downgrades cut → even)');

const crisis = await routeVoiceCard(input(3, skipped, { crisisToday: true, aiConsent: true }), { config: localConfig, ...dev });
assert.ok(crisis.card);
assert.ok(!hasCut(crisis.card!.read), 'no cut after crisis');
ok('no cut after crisis');

// ---------------------------------------------------------------------------
console.log('Everything dropped → nothing shown');
const badProvider: VoiceProvider = {
  id: 'local',
  label: 'bad',
  generate: async () => ({ read: "You're a hopeless failure.", do: 'Just be productive.' }),
  generateTalk: async () => ({ reply: 'bad' }),
};
const dropped = await routeVoiceCard(input(3, d1, { aiConsent: true }), { config: localConfig, providers: { gemini: badProvider, local: badProvider }, ...dev });
assert.equal(dropped.card, null);
assert.ok(dropped.dropped.length > 0);
ok('all candidates dropped → card is null (nothing shown)');

// ---------------------------------------------------------------------------
console.log('Crisis detection: keyword list only');

// The user-approved keyword list + regex is the SOLE detection mechanism.
assert.equal(normalizeCrisis('I want to END this.'), 'i want to end this');
assert.equal(keywordDetect('thinking about suicide all day'), true, 'keyword: suicide');
assert.equal(keywordDetect('I want to kill myself'), true, 'keyword: kill myself');
assert.equal(keywordDetect('cutting myself again'), true, 'keyword: cutting myself');
assert.equal(keywordDetect('thinking about ending my life'), true, 'keyword: ending my life');
assert.equal(keywordDetect('I had an overdose last night'), true, 'regex: overdose');
assert.equal(keywordDetect('I might self-harm'), true, 'regex: self-harm');
assert.equal(keywordDetect('how was your day'), false, 'benign message not flagged');
assert.equal(keywordDetect('I am so tired of this project'), false, 'frustration not flagged');
ok('keyword list: user-approved phrases + regex, benign messages pass');

// detectCrisis is pure keyword now — no model, no fallback path, never throws.
const viaKeywordTrue = await detectCrisis('thinking about suicide all day');
assert.equal(viaKeywordTrue.flagged, true);
assert.equal(viaKeywordTrue.method, 'keyword');

const viaKeywordFalse = await detectCrisis('how was your day');
assert.equal(viaKeywordFalse.flagged, false);
assert.equal(viaKeywordFalse.method, 'keyword');
ok('detectCrisis is keyword-only (method always "keyword", no model involved)');

// Router short-circuit (Dawn path) still wired.
const crisisResult = await routeVoiceCard(input(3, d1, { aiConsent: true, crisisDetected: true }), { config: localConfig, ...dev });
assert.equal(crisisResult.kind, 'crisis');
assert.equal(crisisResult.source, 'crisis');
assert.equal(crisisResult.card, null);
assert.equal(crisisResult.provider, null);
assert.equal(crisisResult.dev!.fromModel, false, 'crisis must never fire a model call');
assert.equal(crisisResult.dev!.fromBankFile, false);
assert.equal(crisisResult.dev!.providerLabel, 'crisis-card (no model call)');
ok('crisisDetected → static crisis result, no model call, even with consent granted');

// ---------------------------------------------------------------------------
console.log('Talk router: consent, crisis gate, tone, zero main calls on flag');

function makeTalkMe(style: VoiceMe['talk_style'], name: string): VoiceMe {
  return { ...ME, name, talk_style: style };
}

// Consent gate — Talk stays off unless granted.
const talkDenied = await routeTalkReply(
  { me: ME, message: 'hi', checkCount: 4, history: d1, aiConsent: false },
  { config: localConfig, ...dev },
);
assert.equal(talkDenied.kind, 'consent-denied');
const talkPending = await routeTalkReply(
  { me: ME, message: 'hi', checkCount: 4, history: d1, aiConsent: null },
  { config: localConfig, ...dev },
);
assert.equal(talkPending.kind, 'consent-pending');
ok('Talk consent gate: denied → talk off, pending → not asked');

// Crisis flagged → static card, flag logged, ZERO main-router generateTalk calls.
let mainCalls = 0;
let flagLogged = 0;
const spyProvider: VoiceProvider = {
  id: 'local',
  label: 'spy',
  generate: async () => ({ read: 'x', do: 'y' }),
  generateTalk: async () => {
    mainCalls += 1;
    return { reply: 'should never happen' };
  },
};
const flaggedTalk = await routeTalkReply(
  { me: ME, message: 'I\u2019ve been thinking about suicide', checkCount: 4, history: d1, aiConsent: true, userId: 'u1' },
  {
    config: localConfig,
    providers: { gemini: spyProvider, local: spyProvider },
    logCrisisFlag: async () => {
      flagLogged += 1;
    },
    ...dev,
  },
);
assert.equal(flaggedTalk.kind, 'crisis');
assert.equal(flaggedTalk.crisis?.method, 'keyword');
assert.equal(flagLogged, 1, 'crisis flag logged');
assert.equal(mainCalls, 0, 'zero main-router model calls on a flagged message');
ok('flagged message → static crisis result via keyword list, flag logged, zero main-router calls');

// Not flagged → reply generated (main call happens).
const clearTalk = await routeTalkReply(
  { me: makeTalkMe('even', 'Riley'), message: 'How\u2019s my week going?', checkCount: 4, history: d1, aiConsent: true },
  { config: localConfig, providers: { gemini: spyProvider, local: spyProvider }, ...dev },
);
assert.equal(clearTalk.kind, 'reply');
assert.ok(clearTalk.reply && clearTalk.reply.length > 0);
assert.equal(mainCalls, 1, 'main call happened for a clear message');
ok('clear message → reply generated via the main router call');

// Cap hit → honest empty, zero generateTalk calls.
let quotaCalls = 0;
const quotaSpy: VoiceProvider = {
  id: 'local',
  label: 'quota-spy',
  generate: async () => ({ read: 'x', do: 'y' }),
  generateTalk: async () => {
    quotaCalls += 1;
    return { reply: 'should never happen' };
  },
};
const quotaTalk = await routeTalkReply(
  { me: ME, message: 'How\u2019s my week going?', checkCount: 4, history: d1, aiConsent: true },
  {
    config: localConfig,
    providers: { gemini: quotaSpy, local: quotaSpy },
    claimAiCall: async () => ({ ok: false, reason: 'quota' }),
    ...dev,
  },
);
assert.equal(quotaTalk.kind, 'quota');
assert.equal(quotaTalk.reply, undefined);
assert.equal(quotaCalls, 0, 'quota must not call generateTalk');
ok('server deny → quota kind, no model call, no raw error');

// Two users, different talk_style, SAME prompt → visibly different tone.
const quietReply = await routeTalkReply(
  { me: makeTalkMe('quiet', 'Mia'), message: 'How\u2019s my week going?', checkCount: 4, history: d1, aiConsent: true },
  { config: localConfig, ...dev },
);
const loudReply = await routeTalkReply(
  { me: makeTalkMe('loud', 'Leo'), message: 'How\u2019s my week going?', checkCount: 4, history: d1, aiConsent: true },
  { config: localConfig, ...dev },
);
assert.ok(quietReply.reply && loudReply.reply);
assert.notEqual(quietReply.reply, loudReply.reply, 'replies differ');
assert.ok(!quietReply.reply!.includes('!'), 'quiet tone has no exclamation');
assert.ok(loudReply.reply!.includes('!'), 'loud tone has an exclamation');
assert.ok(loudReply.reply!.length > quietReply.reply!.length, 'loud is punchier');
ok('two talk_style users → visibly different tone on the same prompt');

// ---------------------------------------------------------------------------
console.log('gemini default + no-key fallback');
const geminiNoKey = buildVoiceConfig({ MODEL_PROVIDER: 'gemini' });
const fallback = await routeVoiceCard(input(3, d1, { aiConsent: true }), { config: geminiNoKey, ...dev });
assert.equal(fallback.provider, 'local', 'no gemini key → local provider fallback');
assert.ok(fallback.dev!.providerLabel.includes('local'));
ok('MODEL_PROVIDER=gemini default; without a key it falls back to local, not a rewrite');

console.log(`\nAll ${passed} checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
