/**
 * LIVE card generation check through the real path — signed-in user →
 * ai-generate Edge Function → Gemini (server-held key + model). Proves the
 * generate path returns a usable full card three days running with topical
 * variety. Costs the signed-in user 3 quota units.
 *
 * Run: npx tsx scripts/card-live-check.ts
 */
import assert from 'node:assert/strict';

import { createLiveEdgeProvider, signInForLiveAi } from './live-ai';

async function main() {
  const session = await signInForLiveAi();
  const { routeVoiceCard } = await import('../src/lib/voice/router');
  const { buildVoiceConfig } = await import('../src/lib/voice/config');
  const { isTopicalRepeat } = await import('../src/lib/voice/filters');

  const config = buildVoiceConfig({ MODEL_PROVIDER: 'gemini' });
  const live = createLiveEdgeProvider(session, 'gemini');
  const providers = { gemini: live, local: live };

  const me = {
    name: 'Emci',
    show_up: 'finishing my resume',
    talk_style: 'even' as const,
    knocks_you_off: 'sleep, workload, people/conflict',
    morning_cue: 'make coffee',
    facts: ['I finish work at four', 'Tuesday is the heavy meeting day'],
    current_focus: 'habit' as const,
  };

  const cards: Array<{ read: string; do: string; day: number }> = [];
  let history: Array<{
    day: number;
    status: 'done';
    read?: string;
    do?: string;
  }> = [
    { day: 1, status: 'done' },
    { day: 2, status: 'done' },
    { day: 3, status: 'done' },
  ];

  for (let checkCount = 3; checkCount <= 5; checkCount += 1) {
    const result = await routeVoiceCard(
      { me, checkCount, history, aiConsent: true },
      { config, providers, isDev: true },
    );
    assert.equal(result.kind, 'card');
    assert.ok(result.card, `day ${checkCount + 1} card was dropped: ${JSON.stringify(result.dropped)}`);
    assert.equal(result.provider, 'gemini', `expected real gemini provider, got ${result.provider}`);
    assert.ok(result.card.read && result.card.read.length > 0, 'read must be non-empty');
    assert.ok(result.card?.do && result.card.do.length > 0, 'do must be non-empty');
    for (const prior of cards) {
      assert.notEqual(result.card.read, prior.read, 'exact Read repeat');
      assert.equal(
        isTopicalRepeat(result.card, [prior]),
        false,
        `Day ${result.day} Read is a topical paraphrase of day ${prior.day}:\n  prior: ${prior.read}\n  new:   ${result.card.read}`,
      );
    }
    cards.push({ read: result.card.read, do: result.card.do, day: result.day });
    history = [
      ...history,
      { day: result.day, status: 'done', read: result.card.read, do: result.card.do },
    ];
  }

  console.log('provider:', 'gemini (via ai-generate as', session.email + ')');
  for (const card of cards) {
    console.log(`\nDay ${card.day} Read: ${card.read}`);
    console.log(`Day ${card.day} Do  : ${card.do}`);
  }
  console.log('\nLive card generation PASSED — 3 days with topical variety through the real Edge Function path.');
}

main().catch((err) => { console.error(err); process.exit(1); });
