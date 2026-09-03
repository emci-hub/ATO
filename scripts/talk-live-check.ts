/**
 * LIVE Talk exchange check through the real path — signed-in user →
 * ai-generate Edge Function → Gemini (server-held key + model).
 *
 * Proves a full, untruncated reply comes back via routeTalkReply →
 * generateTalk on the real vendor, not the local fallback, and that Talk
 * answers the typed line instead of echoing the Home card. Costs the
 * signed-in user 2 quota units.
 *
 * Run: npx tsx scripts/talk-live-check.ts
 */
import assert from 'node:assert/strict';

import { createLiveEdgeProvider, signInForLiveAi } from './live-ai';

async function main() {
  const session = await signInForLiveAi();
  const { routeTalkReply } = await import('../src/lib/voice/talk');
  const { buildVoiceConfig } = await import('../src/lib/voice/config');

  const config = buildVoiceConfig({ MODEL_PROVIDER: 'gemini' });
  const live = createLiveEdgeProvider(session, 'gemini');
  const providers = { gemini: live, local: live };

  const me = {
    name: 'Emci',
    show_up: 'finishing my resume',
    talk_style: 'even' as const,
    knocks_you_off: 'bad sleep',
    morning_cue: 'make coffee',
  };
  const history = [
    { day: 1, status: 'done' as const },
    { day: 2, status: 'done' as const },
    { day: 3, status: 'done' as const },
    { day: 4, status: 'done' as const },
  ];

  const result = await routeTalkReply(
    {
      me,
      message: "How's my week going?",
      checkCount: 4,
      history,
      aiConsent: true,
    },
    { config, providers, isDev: true },
  );

  assert.equal(result.kind, 'reply', `expected a reply, got kind=${result.kind}`);
  assert.equal(result.provider, 'gemini', `expected the REAL gemini provider, got ${result.provider}`);
  assert.ok(result.reply && result.reply.length > 0, 'reply must not be empty');
  assert.ok(
    !result.reply!.includes('\u0000') && !result.reply!.includes('* *'),
    'reply must not be garbled',
  );

  // The prompt demands "~4 sentences max"; a truncated reply would be cut
  // mid-word or end abruptly on a fragment. A full reply ends with sentence
  // punctuation.
  const trimmed = result.reply!.trim();
  assert.ok(
    /[.!?]["']?$/.test(trimmed),
    `reply looks truncated (no terminal punctuation): ${JSON.stringify(trimmed.slice(-80))}`,
  );
  assert.ok(
    trimmed.split(/(?<=[.!?])\s+/).length <= 6,
    `reply exceeds the ~4-sentence budget: ${JSON.stringify(trimmed)}`,
  );

  console.log('kind     :', result.kind);
  console.log('provider :', result.provider, '(via ai-generate as', session.email + ')');
  console.log('dev trace:', JSON.stringify(result.dev));
  console.log('reply    :', result.reply);
  console.log('\nLive Talk exchange 1 PASSED — full reply through the real Edge Function path.');

  const homeCard = {
    read: 'Sleep disrupted the streak. Protect the baseline with one sticky-note step.',
    do: 'After you make coffee, write one sticky note and keep it visible.',
  };
  const direct = await routeTalkReply(
    {
      me,
      message: 'Should my gf get flowers today or later this week?',
      checkCount: 4,
      history,
      todayCard: homeCard,
      recentTurns: [
        { role: 'user', text: 'Yesterday was noisy.' },
        { role: 'sage', text: 'A noisy day still counts if the check landed.' },
      ],
      aiConsent: true,
    },
    { config, providers, isDev: true },
  );
  assert.equal(direct.kind, 'reply');
  assert.equal(direct.provider, 'gemini');
  const answer = direct.reply!.toLowerCase();
  assert.ok(
    /flower|today|later|wait|week|gift|her/.test(answer),
    `Talk must answer the flowers question, got: ${direct.reply}`,
  );
  assert.ok(
    !/sticky-?note/.test(answer) && !/protect the baseline/.test(answer),
    `Talk must not mirror the Home card, got: ${direct.reply}`,
  );
  console.log('Talk Q      :', 'Should my gf get flowers today or later this week?');
  console.log('Home Read   :', homeCard.read);
  console.log('Talk answer :', direct.reply);
  console.log('\nLive Talk exchange 2 PASSED — direct answer, not a Home-card echo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
