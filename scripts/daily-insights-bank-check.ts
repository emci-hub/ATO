/**
 * Daily insights banks — copy rules, counts, coverage, tone mix, zero AI.
 * Run: npm run check:daily-insights-bank
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { CATEGORY_DEFS } from '../src/lib/categories';
import {
  CONFLICT_BANK,
  DAILY_INSIGHTS_BANK_VERSION,
  DAILY_INSIGHTS_PROVISIONAL_CATEGORIES,
  DAILY_INSIGHTS_SHOW_PROVISIONAL,
  INSIGHT_LINE_MAX_WORDS,
  INSIGHT_SUB_MAX_WORDS,
  SMALL_TREAT_MAX,
  SUPERPOWER_BANK,
  TRY_TODAY_BANK,
  WHY_LINE_MAX_WORDS,
  duplicateSentences,
  mixedApostrophes,
  repeatedPhrases,
  taskSafetyViolations,
  titleViolation,
  tryTodayMode,
  validateInsightLine,
  whyLineFor,
} from '../src/lib/daily-insights';
import { STORY_MAP_CATEGORY_LEAN_TODO } from '../src/lib/story-v3/lean-phrases';
import { jokeCrossesBoundary } from '../src/lib/voice/card-joke';
import { CLINICAL_ADVICE, hasClinicalLabel, readerLabelHit } from '../src/lib/voice/clinical';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

// Round 3 (emci 2026-10-19): attachment LABELS are refused only when pinned on the reader
// (src/lib/voice/clinical.ts); the theory NAME "attachment style" stays a framework term.
for (const label of ['anxious-attachment', 'anxiously-attached', 'secure-attachment', 'securely-attached', 'anxious attachment', 'avoidant attachment']) {
  assert.ok(hasClinicalLabel(`Your ${label} shows.`), `a label on the reader fails: ${label}`);
  assert.ok(!hasClinicalLabel(`The book on ${label} sat unread on the shelf.`), `the word as a topic passes: ${label}`);
}
assert.ok(containsFrameworkTerm('Your attachment style shows.'), 'the theory name is still a framework term');
assert.ok(!containsFrameworkTerm('You are avoidant of small talk.'), '"avoidant" is no longer a framework word');
assert.ok(!containsFrameworkTerm('You get anxious and feel secure about it.'), 'anxious / secure alone are everyday words');

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
assert.equal(pkg.scripts['check:daily-insights-bank'], 'tsx ./scripts/daily-insights-bank-check.ts');
ok('wired as check:daily-insights-bank');

// v2 (2026-10-14): 🎯 lines rewritten for the task-safety rule, ids kept.
assert.equal(DAILY_INSIGHTS_BANK_VERSION, 2);
assert.equal(DAILY_INSIGHTS_SHOW_PROVISIONAL, false);
assert.equal(DAILY_INSIGHTS_PROVISIONAL_CATEGORIES, STORY_MAP_CATEGORY_LEAN_TODO);
ok('bank version 1, provisional flag off, provisional list reused from story-v3');

function clean(label: string, text: string, maxWords: number | null) {
  const hits = validateInsightLine(text, { maxWords });
  assert.deepEqual(hits, [], `${label}: ${hits.join(', ')} — "${text}"`);
}

// --- the validator itself catches what it should ----------------------------
assert.ok(validateInsightLine('Text her back.', { maxWords: 20 }).includes('gendered word'));
assert.ok(validateInsightLine('Ask the guy at work.', { maxWords: 20 }).includes('gendered word'));
assert.ok(validateInsightLine('Your attachment style shows.', { maxWords: 20 }).includes('framework term'));
assert.ok(validateInsightLine('You are gifted.', { maxWords: 20 }).includes('ability claim'));
assert.ok(validateInsightLine('Book a therapy slot.', { maxWords: 20 }).includes('clinical word'));
// emci 2026-10-19: restrict diagnoses and clinical advice, not vocabulary.
for (const fine of [
  'You get anxious before a big call.',
  'You feel insecure when the group chat goes quiet.',
  'Sunday-night anxiety, meet your Monday plan.',
  'Worried, nervous, lonely, scared, stressed, overwhelmed, sad or low all count.',
  'Your attachment to that hoodie is noted.',
  'Your group chat needs therapy more than you do.',
  'Healing cut on your thumb, healed plan by Friday.',
  'The property boundaries are not your problem today.',
  'A bit depressed about Monday, are we.',
  'Disorderly desk, orderly plan.',
  'Therapy would be cheaper than this group chat.',
  'Your therapist would have notes on that tab count.',
  // Round 3 (emci 2026-10-19): context, not blanket bans. These were refused before.
  'An anxiety attack is not a plan.',
  'That habit is toxic.',
  'Your securely-attached friend wins.',
  'A toxic group chat is not your fault.',
  'Trauma-bonded by a bad haircut, as one does.',
]) {
  assert.ok(!validateInsightLine(fine, { maxWords: 20 }).includes('clinical word'), `everyday words pass: ${fine}`);
  assert.ok(!validateInsightLine(fine, { maxWords: 20 }).includes('framework term'), `everyday words are not a framework: ${fine}`);
}
for (const bad of [
  'Your anxiety disorder is showing.',
  'Your avoidant attachment is showing.',
  'Your attachment style is showing.',
  'Your trauma explains the group chat.',
  'Your texting habit is toxic.',
  "That's so toxic of you.",
  'You might need a therapist for that.',
  'Stop your meds for a day.',
  'This could be a diagnosis.',
  'Set boundaries with the group chat.',
  'Trust your healing journey.',
  'That is so bipolar of you.',
  'Very narcissistic of you.',
  'You are clearly depressed.',
  "You're so depressed.",
  'Your anxious-attachment is showing.',
  'Your securely-attached side wins.',
  'Classic ADHD behavior.',
]) {
  const hits = validateInsightLine(bad, { maxWords: 20 });
  assert.ok(hits.includes('clinical word') || hits.includes('framework term'), `diagnosis / label / clinical advice fails: ${bad}`);
}

// Labels on the reader, not vocabulary (round 3): the shared rule in src/lib/voice/clinical.ts,
// pinned with pass/fail pairs. Each pair uses the same word: once as plain or contextual
// vocabulary (passes), once as a verdict about the reader (fails).
const LABEL_PAIRS: [pass: string, fail: string][] = [
  ['A toxic workplace finally let you leave on time.', "You're toxic when the plan changes."],
  ['My clingy cat sat on the laptop again.', "You're clingy when the chat goes quiet."],
  ['You may feel needy when the chat goes quiet.', 'You come across as a bit needy in group chats.'],
  ['Your attachment to old photos is a whole archive.', 'Your avoidant attachment style explains this.'],
  ['Avoidant of small talk, you head for the snacks.', 'You are so avoidant with friends.'],
  ['Bipolar weather again, so you packed two jackets.', 'You are clearly bipolar about weekends.'],
  ['The group chat needs therapy.', 'You need therapy for that habit.'],
  ['Trauma-bonded by a bad haircut, you both laughed.', 'Your trauma explains the group chat.'],
  ['The book on narcissism sat unread.', 'That is so narcissistic of you.'],
  ['A narcissist in a film made you laugh.', 'A classic narcissist move, honestly.'],
  ['The codependent houseplants share one pot.', 'You can be codependent with your best friend.'],
  ['Your red flag emoji game is strong.', "You're a walking red flag."],
  ['A depressing Monday, as usual.', 'You are so depressed lately.'],
  ['An anxiety attack of a to-do list.', 'You have panic attacks before calls.'],
  ['The ADHD-friendly timer helps the whole office.', 'You have ADHD, the tabs prove it.'],
  ['That disorderly desk has a system.', 'Your anxiety disorder is showing.'],
  ['A crazy week, honestly.', "You're crazy for replying that fast."],
  ['Neurotic dog energy from the neighbours again.', 'People like you are neurotic about plans.'],
  ['Your clingy cat is asleep on the keyboard.', 'Your clingy side is showing again.'],
  ['The group chat turned toxic, so you muted it.', 'Your texting is so toxic lately.'],
  ['Emotionally unavailable plants, the best kind.', "You're emotionally unavailable at dinner."],
  ['Symptoms of a Monday: three coffees.', 'Signs of depression in how you plan.'],
  ['The OCD joke landed badly at work.', "You're so OCD about the dishwasher."],
  ['You get anxious before a big call.', "You've been diagnosed by the group chat."],
];
for (const [pass, fail] of LABEL_PAIRS) {
  assert.equal(readerLabelHit(pass), null, `contextual use passes: "${pass}" (hit: ${readerLabelHit(pass)})`);
  assert.ok(readerLabelHit(fail) || CLINICAL_ADVICE.test(fail), `a label on the reader fails: "${fail}"`);
}
ok(`labels on the reader: ${LABEL_PAIRS.length} pass/fail pairs (same word, context vs verdict)`);

// Strong swearing (round 3, emci 2026-10-19): allowed in jokes and lines; slurs and explicit terms still fail.
for (const fine of ['Fuck, the calendar won again.', 'What the fuck is this inbox.', 'Shit, the plan moved.', 'Fucking Mondays, honestly.']) {
  assert.ok(!jokeCrossesBoundary(fine), `swearing passes: ${fine}`);
}
for (const bad of ['They fucked in the car before the meeting.', 'The neighbour is a cunt about the bins.', 'Some slut from accounts took the last coffee.']) {
  assert.ok(jokeCrossesBoundary(bad), `explicit or slur still fails: ${bad}`);
}
ok('strong swearing passes; slurs and explicit sex still cross the boundary');
// ATO is 18+ (emci 2026-10-19): dark and adult topics pass; only the harm filter refuses.
assert.ok(!validateInsightLine('Laugh till you die.', { maxWords: 20 }).includes('crosses a boundary'), 'a dark line passes');
assert.ok(!validateInsightLine('Text your ex.', { maxWords: 20 }).includes('crosses a boundary'), 'an adult topic passes');
assert.ok(validateInsightLine('Honestly, just go die.', { maxWords: 20 }).includes('crosses a boundary'), 'telling someone to die is refused');
for (const fine of ['Cut yourself some slack today.', 'Try not to hurt yourself laughing.', 'You graduated summa cum laude in overthinking.']) {
  assert.ok(!validateInsightLine(fine, { maxWords: 20 }).includes('crosses a boundary'), `ordinary speech is not harm: ${fine}`);
}
assert.ok(validateInsightLine('Go! Now!', { maxWords: 20 }).includes('more than one exclamation mark'));
assert.ok(validateInsightLine('one two three four five six', { maxWords: 5 })[0]?.startsWith('over 5 words'));
assert.deepEqual(validateInsightLine('Deadlines make you better.', { maxWords: 20 }), []);
ok('validator flags gender / framework / ability / clinical / dark / safety / ! / length');

// --- Phase 1: Try this today -------------------------------------------------
assert.equal(TRY_TODAY_BANK.length, 44);
const ids = new Set(TRY_TODAY_BANK.map((row) => row.id));
assert.equal(ids.size, 44, 'try-today ids are unique');
for (const def of CATEGORY_DEFS) {
  for (const lean of ['high', 'low'] as const) {
    for (const mode of ['strength', 'stretch'] as const) {
      const hits = TRY_TODAY_BANK.filter(
        (row) => row.categoryId === def.id && row.lean === lean && row.mode === mode,
      );
      assert.equal(hits.length, 1, `${def.id}.${lean}.${mode} needs exactly one line`);
      assert.equal(hits[0]!.id, `${def.id}.${lean}.${mode}`);
    }
  }
}
ok('44 lines: exactly one per category × lean × mode, ids match');

for (const row of TRY_TODAY_BANK) {
  clean(row.id, row.text, INSIGHT_LINE_MAX_WORDS);
  assert.equal(row.setting, 'any', `${row.id} setting`);
  const shouldBeProvisional = STORY_MAP_CATEGORY_LEAN_TODO.includes(row.categoryId);
  assert.equal(!!row.provisional, shouldBeProvisional, `${row.id} provisional flag`);
}
ok('every try-today line passes the copy rules; map-category lines are provisional');

// Rule 10b (emci 2026-10-14; by action and risk, not topic, 2026-10-19; round 3,
// 2026-10-19: cost, consent and risk): every task is small, practical, under 15
// minutes when a time is stated, safe and fine to skip. A small treat for yourself
// (up to SMALL_TREAT_MAX), an ordinary errand and a light, consenting contact are fine.
assert.equal(SMALL_TREAT_MAX, 10, 'a small treat is about the price of a coffee: 10 dollars / euros / pounds');
for (const row of TRY_TODAY_BANK) {
  assert.deepEqual(taskSafetyViolations(row.text), [], `${row.id}: ${row.text}`);
}
const refused: [string, RegExp][] = [
  // Spending beyond a small treat for yourself.
  ['Order takeout for the team.', /spends money/],
  ['Treat yourself to a new hoodie.', /spends money/],
  ['Pay for the next round.', /spends money/],
  ['Buy a coffee for the whole office.', /spends money/],
  ['Spend 50 dollars on yourself.', /spends money/],
  ['Spend $12 on a coffee for yourself.', /spends money/],
  ['Spend 5 dollars on a stranger.', /spends money/],
  ['Go shopping after work.', /spends money/],
  ['Buy yourself a new phone.', /spends money/],
  // Large or irreversible money moves.
  ['Book a massage after work.', /money move/],
  ['Send your friend 5 dollars.', /money move/],
  ['Tip someone.', /money move/],
  ['Sign up for the gym.', /money move/],
  ['Take out a loan for the trip.', /money move/],
  ['Invest in crypto before lunch.', /money move/],
  ['Buy some stocks.', /money move/],
  ['Lend a friend money.', /money move/],
  // A trip or a paid ride, not an ordinary errand.
  ['Drive somewhere new.', /a trip or a paid ride/],
  ['Take the train to a town you have never seen.', /a trip or a paid ride/],
  ['Go to the bar and say hi to a stranger.', /a trip or a paid ride/],
  ['Take an Uber home.', /a trip or a paid ride/],
  ['Fly somewhere this weekend.', /a trip or a paid ride/],
  // Alcohol or substances as the goal (the invitation itself is fine).
  ['Have a beer with lunch.', /alcohol/],
  ['After work, grab a drink with one person.', /alcohol/],
  ['Get drunk and call it research.', /alcohol/],
  ['Invite a friend for drinks.', /alcohol/],
  ['Sip a beer.', /alcohol/],
  ['Open a beer.', /alcohol/],
  ['Crack a cold one.', /alcohol/],
  ['Get high before the meeting.', /alcohol/],
  ['Bet a friend on the game tonight.', /gambling/],
  ['Buy a scratch card.', /gambling/],
  ['Quit your job. You know you want to.', /quits a job/],
  ['Hand in your notice before lunch.', /quits a job/],
  ['Tell your boss you quit.', /quits a job/],
  // No consent: an ex, someone who pulled back, a stranger.
  ['Text your ex.', /contacts an ex/],
  ['Just call your ex and ask why.', /contacts an ex/],
  ['Write a letter to your ex and send it.', /contacts an ex/],
  ['Text the person who ghosted you.', /has not invited contact/],
  ['Message someone who blocked you.', /has not invited contact/],
  ['DM a stranger and say hi.', /has not invited contact/],
  ['Show up unannounced at a friend’s place.', /has not invited contact/],
  // Body and safety.
  ['Skip lunch and see how long you last.', /risky/],
  ['Hold your breath as long as you can.', /risky/],
  ['Walk alone at night with no phone.', /risky/],
  ['Climb onto the roof.', /risky/],
  ['Fast today.', /risky/],
  ['Take an ice bath.', /risky/],
  ['Stay up all night.', /risky/],
  ['Get a tattoo on a whim.', /risky/],
  ['Meet someone from a dating app tonight.', /risky/],
  ['Meet a stranger from the internet.', /risky/],
  // A long block of time.
  ['Take a 20-minute walk.', /over 15 minutes/],
  ['Read for twenty minutes.', /over 15 minutes/],
  ['Spend an hour on the hard task.', /over 15 minutes/],
  ['Clean all afternoon.', /over 15 minutes/],
  ['Watch a movie.', /over 15 minutes/],
  ['Watch an episode.', /over 15 minutes/],
  ['Take a long walk.', /over 15 minutes/],
  ['Clean the whole kitchen.', /over 15 minutes/],
  ['Binge a show.', /over 15 minutes/],
  ['Meet up with a friend.', /over 15 minutes/],
  ['Go out with your coworkers.', /over 15 minutes/],
  ['Have lunch with a friend.', /over 15 minutes/],
  ['Visit your parents.', /over 15 minutes/],
];
for (const [text, re] of refused) {
  const hits = taskSafetyViolations(text);
  assert.ok(hits.some((h) => re.test(h)), `refused (${re}): "${text}" → ${hits.join(', ') || 'nothing'}`);
}
const harmless = [
  'Eat lunch away from your desk.',
  'Write down what you spent this week.',
  'Drink a glass of water before your next chat.',
  'Write down one good thing your ex taught you. Keep it to yourself.',
  'Name the bar you would open, and its worst cocktail.',
  'Picture your dream job for five minutes.',
  'Text a friend about the best pizza you ever had.',
  'Check your bank balance without flinching.',
  'Plan your weekend in three lines.',
  'Take a 10-minute walk at lunch.',
  'Cook something with what is already in the fridge.',
  'Let your coffee go cold on purpose.',
  'Sit in the car for two quiet minutes before you go in.',
  'Quit scrolling for five minutes.',
  // reviewer gaps 2026-10-19: quick messages, unsent letters and short timed tasks stay fine
  'Text a friend for a minute.',
  'Call a friend and say one nice thing.',
  'Write a letter to your ex. Do not send it.',
  'Watch a 5-minute clip and then stop.',
  'Take a long walk in 10 minutes flat.',
  'Clean one shelf.',
  'Tip your head back and stretch.',
  'Climb the stairs once.',
  'Fast-forward through the boring part of your to-do list.',
  'Sign up for nothing today.',
  // Round 3 (emci 2026-10-19): small treats, ordinary errands and light, consenting contact.
  'Buy yourself a coffee and drink it slowly.',
  'Pick up a fruit you like.',
  'Spend 5 dollars on yourself.',
  'Spend $8 on a coffee for yourself.',
  'Treat yourself to a pastry.',
  'Buy a coffee for a friend.',
  'Order a hot chocolate and drink it outside.',
  'Walk to the corner shop.',
  'Take the stairs.',
  'Take the bus one stop earlier.',
  'Take the bus home and look out the window.',
  'Invite a friend for a coffee this week.',
  'Invite a friend to dinner this week.',
  'Text someone you miss.',
  'Ask a coworker how their weekend was.',
  'Bring a friend along.',
  'Grab a coffee with a coworker.',
  'Commute without your headphones.',
  'Order your thoughts on paper.',
  'Spend ten minutes with zero chats.',
];
for (const text of harmless) {
  assert.deepEqual(taskSafetyViolations(text), [], `harmless or small task passes: "${text}"`);
}
ok(`task safety by action, cost, consent and risk: ${refused.length} risky actions refused, ${harmless.length} small or harmless tasks pass, every bank task passes`);

// Low Resilience / low Steadiness only ever get a strength task, every weekday.
for (let day = 11; day <= 17; day += 1) {
  const ymd = `2026-10-${day}`;
  assert.equal(tryTodayMode(ymd, 'cat_resilience', 'low'), 'strength', `${ymd} resilience low`);
  assert.equal(tryTodayMode(ymd, 'cat_steadiness', 'low'), 'strength', `${ymd} steadiness low`);
}
ok('low Resilience and low Steadiness get strength tasks on all seven weekdays');

const light = TRY_TODAY_BANK.filter((row) => row.tone === 'light').length;
const dark = TRY_TODAY_BANK.filter((row) => row.tone === 'dark').length;
assert.ok(light / TRY_TODAY_BANK.length >= 0.3, `light ${light}/44 under 30%`);
assert.ok(dark / TRY_TODAY_BANK.length >= 0.1, `dark ${dark}/44 under 10%`);
ok(`tone mix: ${light} light, ${dark} dark of 44 (≥30% / ≥10%)`);

for (const def of CATEGORY_DEFS) {
  for (const lean of ['high', 'low'] as const) {
    clean(`why ${def.id}.${lean}`, whyLineFor(def.id, lean), WHY_LINE_MAX_WORDS);
  }
}
ok('every "Why you" line passes the rules (cap 22 words)');

// --- Phase 2: Superpower / Kryptonite ---------------------------------------
const bars = CATEGORY_DEFS.filter((def) => def.shape === 'bar');
assert.equal(bars.length, 8);
assert.equal(SUPERPOWER_BANK.length, 16);
for (const def of bars) {
  for (const kind of ['superpower', 'kryptonite'] as const) {
    const hits = SUPERPOWER_BANK.filter((row) => row.categoryId === def.id && row.kind === kind);
    assert.equal(hits.length, 1, `${def.id} ${kind}`);
  }
}
for (const row of SUPERPOWER_BANK) {
  const def = CATEGORY_DEFS.find((d) => d.id === row.categoryId);
  assert.equal(def?.shape, 'bar', `${row.categoryId} is not a bar`);
  assert.ok(!row.provisional, `${row.categoryId} superpower row must not be provisional`);
  const label = `${row.categoryId}.${row.kind}`;
  clean(`${label} text`, row.text, INSIGHT_LINE_MAX_WORDS);
  clean(`${label} tip`, row.tip, INSIGHT_SUB_MAX_WORDS);
  clean(`${label} title`, row.title, null);
  assert.equal(titleViolation(row.title), null, `${label} title: ${titleViolation(row.title)}`);
}
ok('16 rows: both kinds for each of the 8 bars, no map category, all rules pass');

// --- Phase 3: Conflict style -------------------------------------------------
assert.equal(CONFLICT_BANK.length, 5);
assert.deepEqual(
  [...new Set(CONFLICT_BANK.map((row) => row.id))].sort(),
  ['deal_maker', 'peacekeeper', 'quiet_exit', 'straight_shooter', 'team_fixer'],
);
for (const row of CONFLICT_BANK) {
  clean(`${row.id} text`, row.text, INSIGHT_LINE_MAX_WORDS);
  clean(`${row.id} strength`, row.strength, INSIGHT_SUB_MAX_WORDS);
  clean(`${row.id} watchOut`, row.watchOut, INSIGHT_SUB_MAX_WORDS);
  clean(`${row.id} tryLine`, row.tryLine, INSIGHT_SUB_MAX_WORDS);
  clean(`${row.id} title`, row.title, null);
  assert.equal(titleViolation(row.title), null, `${row.id} title: ${titleViolation(row.title)}`);
}
ok('5 conflict styles, one per id, every field passes the rules');

// --- no repeated tag phrase, one apostrophe style per bank -------------------
const banks: Record<string, string[]> = {
  'try-today': TRY_TODAY_BANK.map((row) => row.text),
  superpower: SUPERPOWER_BANK.flatMap((row) => [row.title, row.text, row.tip]),
  conflict: CONFLICT_BANK.flatMap((row) => [row.title, row.text, row.strength, row.watchOut, row.tryLine]),
};
for (const [name, texts] of Object.entries(banks)) {
  assert.deepEqual(duplicateSentences(texts), [], `${name} repeats a sentence`);
  assert.equal(mixedApostrophes(texts), false, `${name} mixes apostrophe styles`);
  // emci 2026-10-14: no repeated phrases in a bank (any 3-word run, common words aside).
  assert.deepEqual(repeatedPhrases(texts), [], `${name} repeats a phrase`);
}
assert.deepEqual(repeatedPhrases(['Make one person laugh.', 'Make one person smile.']), ['make one person']);
ok('no repeated sentence or 3-word phrase inside a bank; one apostrophe style per bank');

// --- zero runtime AI in the new folders --------------------------------------
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const scanned = [
  ...walk(resolve(root, 'src/lib/daily-insights')),
  ...walk(resolve(root, 'src/components/daily-insights')),
  resolve(root, 'src/hooks/use-try-today.ts'),
];
const FORBIDDEN: { name: string; re: RegExp }[] = [
  { name: 'fetch(', re: /\bfetch\(/ },
  { name: 'supabase.functions', re: /supabase\.functions/ },
  { name: 'supabase import', re: /from '@\/lib\/supabase'/ },
  { name: 'ai-library import', re: /ai-library/ },
  { name: 'generateText', re: /\bgenerateText\b/ },
  { name: 'vendor name', re: /\b(openai|anthropic|xai)\b/i },
];
for (const file of scanned) {
  const src = readFileSync(file, 'utf8');
  for (const rule of FORBIDDEN) {
    assert.ok(!rule.re.test(src), `${file} contains ${rule.name}`);
  }
}
ok(`${scanned.length} daily-insights files: no fetch, Supabase, AI library or vendor names`);

console.log(`\n${passed} daily-insights-bank checks passed`);
