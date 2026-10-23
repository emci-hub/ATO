/**
 * Filter behaviour, verified on REAL examples (emci 2026-10-20: "do not assume filters comply
 * because the name sounds right"). Each filter gets acceptable lines, including sensitive-but-fine
 * content (death, drinking, money, strong swearing, a dark absurd joke, an honest weakness), and
 * problematic lines (self-harm or drunk-driving encouragement, a slur, explicit sex, a verdict on
 * the reader, a risky task, a struggle-side line on a public snippet). The governing rule is
 * docs/copy-review-rules.md: meaning, never a word or a topic.
 * Run: npm run check:filter-behavior
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { taskSafetyViolations, validateInsightLine } from '../src/lib/daily-insights';
import { titleViolation } from '../src/lib/legend-figures/story';
import { isShareableLean } from '../src/lib/legends64/identity';
import { JOKE_HARM_FILTER, jokeCrossesBoundary } from '../src/lib/voice/card-joke';
import { CLINICAL_ADVICE, readerLabelHit } from '../src/lib/voice/clinical';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:filter-behavior'], 'tsx ./scripts/filter-behavior-check.ts');
ok('wired as check:filter-behavior');

function run(
  name: string,
  fails: (text: string) => boolean,
  acceptable: string[],
  problematic: string[],
) {
  assert.ok(acceptable.length >= 3 && problematic.length >= 3, `${name}: needs at least 3 of each`);
  for (const text of acceptable) assert.equal(fails(text), false, `${name} must ACCEPT: "${text}"`);
  for (const text of problematic) assert.equal(fails(text), true, `${name} must REFUSE: "${text}"`);
  ok(`${name}: ${acceptable.length} acceptable lines pass, ${problematic.length} problematic lines fail`);
}

// 1. readerLabelHit + CLINICAL_ADVICE: a verdict or clinical advice about the reader, never the topic.
run(
  'reader label / clinical advice',
  (text) => readerLabelHit(text) != null || CLINICAL_ADVICE.test(text),
  [
    'Death, taxes and an unread group chat are the three certainties.',
    'You may avoid hard conversations until they pile up, and then they arrive all at once.',
    'You get anxious before a big call, then handle it better than you expected.',
    'Drinks with the team ran long and your inbox noticed.',
    'The group chat needs therapy more than you do.',
    'Fuck, you really did reply in four seconds.',
    'This is not a diagnosis, just a Tuesday.',
    'You may feel needy when the chat goes quiet.',
  ],
  [
    'You are clearly bipolar about weekends.',
    'Your trauma explains the group chat.',
    'You have ADHD, the tabs prove it.',
    'You need therapy for that habit.',
    'Stop your meds for a day.',
    'People like you are needy.',
    'You were diagnosed with anxiety years ago.',
  ],
);

// 2. JOKE_HARM_FILTER: encouragement, slurs, explicit terms. Never a topic or a swear word.
run(
  'joke harm filter',
  jokeCrossesBoundary,
  [
    'Death is just the world’s longest unsubscribe.',
    'My liver and I have an understanding about Fridays.',
    'This meeting is killing me, and the cake is gone.',
    'Fuck, the calendar won again.',
    'What the fuck is this inbox.',
    'You graduated summa cum laude in overthinking.',
    'He lost the money, the lease and the argument, in that order.',
    'The funeral had better snacks than the wedding.',
    // Found by this check (2026-10-20): a MENTION of drunk driving is not encouragement.
    'Drunk driving cost my uncle his licence and his dignity.',
    'Never drink and drive; the taxi is cheaper than the lawyer.',
    'The drunk driver in the film was the most responsible person on screen.',
    "Don't drink and drive.",
    'Drunk driving cost him his licence.',
    "Don't just drink and drive, call the taxi.",
  ],
  [
    "Don't be a wimp, drink and drive.",
    'Nobody will notice, just drink and drive.',
    'Drink and drive, you will be fine.',
    'Drive home drunk, nothing ever happens.',
    'Just drive after a few beers, it is fine.',
    'Honestly, just go die.',
    'You should just kill yourself over the group chat.',
    'Have a few drinks and drive home, you will be fine.',
    'Some retard replied all again.',
    'They fucked in the car before the meeting.',
    'The neighbour is a cunt about the bins.',
  ],
);
assert.ok(JOKE_HARM_FILTER.length > 0);

// 3. Task action rules: the ACTION, cost, consent, time and safety decide, never the topic.
const taskRefused = (text: string) => taskSafetyViolations(text).length > 0;
run(
  'task action rules',
  taskRefused,
  [
    'Buy yourself a coffee and drink it slowly.',
    'Text someone you miss.',
    'Walk to the corner shop.',
    'Write down what you spent this week.',
    'Invite a friend for a coffee this week.',
    'Take the stairs.',
    'Read one obituary of someone who lived well.',
    'Pour yourself a glass of water.',
    // Found by this check (2026-10-20): donating an object costs no money.
    'Donate your old jacket to a charity shop.',
    'Look up what a funeral costs and close the tab.',
  ],
  [
    'Meet your online match at their place.',
    'Go for a run until it hurts.',
    'Donate 200 dollars to a stranger.',
    'Lend a friend 500 dollars.',
    'Meet a stranger from the internet for coffee.',
    'Get drunk with a friend tonight.',
    'Text your ex.',
    'Bet 20 dollars on the game.',
    'Quit your job today.',
    'Skip dinner tonight.',
  ],
);

// 4. The composite line validator keeps the same split for stored lines.
const lineRefused = (text: string) => validateInsightLine(text, { maxWords: 30 }).length > 0;
run(
  'insight line validator',
  lineRefused,
  [
    'Fuck, the plan moved again.',
    'Laugh till you die.',
    'You may overspend on snacks when the day goes sideways.',
    'Your group chat needs therapy.',
  ],
  ['Honestly, just go die.', 'Your anxiety disorder is showing.', 'Trust your healing journey.', 'You are a narcissist.'],
);

// 5. Privacy: a struggle-side lean never prints on a public snippet (isShareableLean).
{
  const shareable: [Parameters<typeof isShareableLean>[0], Parameters<typeof isShareableLean>[1]][] = [
    ['extraversion', 'low'],
    ['extraversion', 'high'],
    ['openness', 'high'],
    ['steadiness', 'high'],
  ];
  const private_: [Parameters<typeof isShareableLean>[0], Parameters<typeof isShareableLean>[1]][] = [
    ['steadiness', 'low'],
    ['attachment_anxiety', 'high'],
    ['attachment_avoidance', 'low'],
    ['self_efficacy', 'low'],
  ];
  for (const [axis, lean] of shareable) assert.equal(isShareableLean(axis, lean), true, `shareable: ${axis}:${lean}`);
  for (const [axis, lean] of private_) assert.equal(isShareableLean(axis, lean), false, `private: ${axis}:${lean}`);
  ok(`public snippet privacy (isShareableLean): ${shareable.length} shareable leans pass, ${private_.length} struggle-side leans stay private`);
}

// 6. Shareable titles (legend-figures titleViolation): worry/struggle tone and labels stay off a share image.
run(
  'shareable titles',
  (title) => titleViolation(title, 'Marie Curie physicist radium') != null,
  ['the patient rebuilder', 'the stubborn optimist', 'the relentless tinkerer', 'the unhurried planner'],
  ['the lonely wanderer', 'the anxious overthinker', 'the broken dreamer', 'the needy planner', 'the avoidant host'],
);

console.log(`\n${passed} filter-behavior checks passed`);
