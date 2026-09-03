/**
 * LIVE style check — 3 fresh generations per surface through the real path
 * (signed-in user → ai-generate → Gemini with the server-held key + model),
 * using the shipped prompts (style checklist + approved anchors).
 *
 * Costs the signed-in user 12 quota units (4 surfaces × 3). Output is for a
 * human read; nothing is asserted beyond "the call returned text".
 * Run: npx tsx scripts/style-live-check.ts
 */
import { completeViaEdgeLive, signInForLiveAi, type LiveAiSession } from './live-ai';

const NOW_ISO = '2026-08-31T12:00:00.000Z';

async function main() {
  const session: LiveAiSession = await signInForLiveAi();
  const callGemini = (prompt: string, maxOutputTokens: number, temperature: number) =>
    completeViaEdgeLive(session, 'gemini', {
      prompt,
      maxOutputTokens,
      temperature,
      responseFormat: 'json',
    });

  const { buildPrompt, parseGeminiCard } = await import('../src/lib/voice/providers/prompt');
  const { buildExplorePrompt, parseExploreBody } = await import('../src/lib/explore/prompt');
  const { buildTitlePrompt, parseCombinedBody } = await import('../src/lib/sage-title');
  const { buildStoryPrompt, parseStoryBody, formatStoryTensionNote } = await import('../src/lib/sage-story');
  const { divergingAxesFromTracks } = await import('../src/lib/trait-history');
  const { applyEwmaAnswer } = await import('../src/lib/trait-stability');
  const { pickDawnReadCategory } = await import('../src/lib/dawn-category');
  const { TRAIT_AXES } = await import('../src/lib/traits');

  function stable(axis: string, track: 'report' | 'game', value: number) {
    let row = applyEwmaAnswer(null, axis as never, track, value, NOW_ISO);
    row = applyEwmaAnswer(row, axis as never, track, value, NOW_ISO);
    return applyEwmaAnswer(row, axis as never, track, value, NOW_ISO);
  }

  const tracks = [
    stable('conscientiousness', 'report', 0.8),
    stable('agreeableness', 'report', 0.7),
    stable('steadiness', 'report', 0.6),
    stable('autonomy', 'report', 0.72),
    stable('relatedness', 'report', 0.3),
    stable('playfulness', 'report', 0.65),
    // one told-vs-played divergence for the Story surface
    stable('extraversion', 'report', 0.7),
    stable('extraversion', 'game', 0.2),
  ];

  const me = {
    name: 'Emci',
    show_up: 'finishing my resume',
    talk_style: 'even' as const,
    knocks_you_off: 'sleep, workload, people/conflict',
    morning_cue: 'make coffee',
    facts: ['I finish work at four', 'Tuesday is the heavy meeting day'],
    current_focus: 'habit' as const,
  };

  const history = [
    { day: 1, status: 'done' as const },
    { day: 2, status: 'done' as const },
    { day: 3, status: 'done' as const },
  ];

  const dawnPick = pickDawnReadCategory(tracks, 4);

  // ---- Dawn Read (card) ----
  const cardPrompt = buildPrompt({
    me,
    day: 4,
    tone: 'even',
    history,
    crisisToday: false,
    previousHadCut: false,
    dawnReadCategory: dawnPick,
  });

  console.log('======================================================');
  console.log('SURFACE 1 — Dawn Read (Read + Do)');
  console.log('======================================================');
  for (let i = 1; i <= 3; i += 1) {
    const raw = await callGemini(cardPrompt, 500, 1.0);
    const parsed = parseGeminiCard(raw);
    console.log(`\n#${i} raw:`, raw.replace(/\s+/g, ' ').trim());
    if (parsed) {
      console.log(`#${i} Read: ${parsed.read}`);
      console.log(`#${i} Do  : ${parsed.do}`);
    }
  }

  // ---- Explore ----
  const exploreMe = { ...me, timezone: 'America/Edmonton', extraversion: 0.25 };
  const explorePrompt = buildExplorePrompt({
    me: exploreMe,
    focus: {
      traits: ['extraversion'],
      chips: ['morning_cue', 'show_up', 'current_focus'],
      signal: { kind: 'fact', detail: 'I finish work at four' },
    },
    reactionNotes: [],
  });

  console.log('\n======================================================');
  console.log('SURFACE 2 — Explore');
  console.log('======================================================');
  for (let i = 1; i <= 3; i += 1) {
    const raw = await callGemini(explorePrompt, 512, 0.9);
    const parsed = parseExploreBody(raw);
    console.log(`\n#${i} raw:`, raw.replace(/\s+/g, ' ').trim());
    if (parsed) console.log(`#${i} body: ${parsed}`);
  }

  // ---- Title + Category summaries (one call produces both) ----
  const titlePrompt = buildTitlePrompt(tracks, '2026-08-31');
  const titleResults: Array<{
    raw: string;
    title: string;
    lede: string;
    categories: string;
  }> = [];
  for (let i = 1; i <= 3; i += 1) {
    const raw = await callGemini(titlePrompt, 512, 0.9);
    const parsed = parseCombinedBody(raw);
    const cats = parsed
      ? Object.entries(parsed.categories)
          .map(([id, copy]) => {
            const full = copy.full && copy.full !== copy.line ? ` | ${copy.full}` : '';
            return `${id}: ${copy.line}${full}`;
          })
          .join(' ; ')
      : '';
    titleResults.push({
      raw,
      title: parsed?.title ?? '(parse fail)',
      lede: parsed?.lede ?? '',
      categories: cats,
    });
  }

  console.log('\n======================================================');
  console.log('SURFACE 3 — Title');
  console.log('======================================================');
  titleResults.forEach((r, idx) => {
    console.log(`\n#${idx + 1} raw:`, r.raw.replace(/\s+/g, ' ').trim());
    console.log(`#${idx + 1} title: ${r.title}`);
    console.log(`#${idx + 1} lede : ${r.lede}`);
  });

  console.log('\n======================================================');
  console.log('SURFACE 4 — Category summaries');
  console.log('======================================================');
  titleResults.forEach((r, idx) => {
    console.log(`\n#${idx + 1} categories: ${r.categories}`);
  });

  // ---- The Story ----
  const tension = formatStoryTensionNote(divergingAxesFromTracks(tracks));
  const storyPrompt = buildStoryPrompt({ tracks, divergenceNote: tension });

  console.log('\n======================================================');
  console.log('SURFACE 5 — The Story');
  console.log('======================================================');
  for (let i = 1; i <= 3; i += 1) {
    const raw = await callGemini(storyPrompt, 1024, 0.9);
    const parsed = parseStoryBody(raw);
    console.log(`\n#${i} raw:`, raw.replace(/\s+/g, ' ').trim());
    if (parsed) console.log(`#${i} story:\n${parsed}`);
  }

  console.log(`\n(TRAIT_AXES = ${TRAIT_AXES.length}; model chosen server-side by ai-generate; user = ${session.email})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
