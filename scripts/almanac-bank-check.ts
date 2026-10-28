/**
 * Almanac content pipeline (ATO-BUILD PHASE-11c). Run: npm run check:almanac-bank
 *
 * Offline. Reads docs/almanac-review.md and the generated bank and proves:
 * - the generated file is fresh (it is exactly what the loader writes from the ticked rows) and
 *   is not a DRAFT MODE file;
 * - every non-retired row, ticked or not, passes the rules (length, slots + alt, fence, label,
 *   clear voice for tries, Pick shape, gentle days), so emci never ticks a row that cannot ship;
 * - no duplicate text, the 64 shipped Picks included; ids are unique and never leave the ledger;
 * - the draft covers what the app needs (19 base Picks per trait, every event has all four phases,
 *   every season and month has a card, every micro-event has a card, 15+ tries visible per band,
 *   32 archetype names);
 * - each rule has a pass/fail pair, so a loosened rule fails here.
 * Nothing is ticked yet, so the shipped bank must be empty (ALMANAC_COPY_REVIEWED = false).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ALMANAC_BANK, ALMANAC_BANK_VERSION, ALMANAC_COPY_REVIEWED } from '../src/lib/almanac';
import { GENERATED_BANK_VERSION, GENERATED_CARDS } from '../src/lib/almanac/bank.generated';
import { EVENT_IDS, MICRO_IDS } from '../src/lib/almanac/events';
import { DAILY_PICKS, LEGACY_PICK_COUNT } from '../src/lib/daily-pick/bank';
import { TRAIT_AXES } from '../src/lib/traits';
import {
  ARC_IDS,
  DRAFT_MARK,
  MAX_ARCHETYPE_CHARS,
  OUT_TS,
  REVIEW_FILE,
  duplicateProblems,
  ledgerProblems,
  parseBody,
  parseTarget,
  planLoad,
  readGenerated,
  readReviewFile,
  renderTs,
  rowProblems,
  type DocKind,
  type DocRow,
  type Entry,
  type Target,
} from './load-almanac';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const ROOT = path.resolve(__dirname, '..');
const BANDS = TRAIT_AXES.flatMap((axis) => [`${axis}:high`, `${axis}:low`]);
const PHASES = ['teaser', 'lead', 'peak', 'fade'] as const;
/** The only events whose peak is a shared Pick (a regional or opt-in event cannot be the one Pick everybody answers). */
const PICK_EVENTS = ['new_year', 'valentines', 'halloween', 'christmas'];
const MIN_BASE_PICKS_PER_TRAIT = 19;
const MIN_TRY_PER_BAND = 15;

// ---------------------------------------------------------------- the rules under test

export function coverageProblems(entries: readonly Entry[]): string[] {
  const live = entries.filter((e) => e.row.mark !== 'r');
  const out: string[] = [];
  const count = (f: (e: Entry) => boolean) => live.filter(f).length;

  for (const axis of TRAIT_AXES) {
    const n = count((e) => e.row.kind === 'basepick' && e.target.axis === axis);
    if (n < MIN_BASE_PICKS_PER_TRAIT) out.push(`${axis}: ${n} base Picks (need ${MIN_BASE_PICKS_PER_TRAIT})`);
  }
  for (const id of EVENT_IDS) {
    for (const phase of PHASES) {
      if (count((e) => e.target.event === id && e.target.phase === phase) === 0) out.push(`event ${id} has no ${phase} card`);
    }
    const picks = count((e) => e.row.kind === 'pick' && e.target.event === id);
    if (PICK_EVENTS.includes(id) && picks < 3) out.push(`global event ${id} has ${picks} peak Picks (need 3)`);
    if (!PICK_EVENTS.includes(id) && picks > 0) out.push(`event ${id} is regional or opt-in, so it gets lines, not a Pick`);
  }
  for (const arc of ARC_IDS) {
    const cards = count((e) => e.target.arc === arc && e.row.kind === 'line');
    if (arc.startsWith('week_')) {
      if (count((e) => e.target.arc === arc) > 0) out.push(`${arc}: week arcs get no cards`);
    } else if (cards === 0) out.push(`${arc} has no line card`);
  }
  for (const id of MICRO_IDS) {
    if (count((e) => e.target.event === id && !e.target.phase) === 0) out.push(`micro-event ${id} has no card`);
  }
  for (const band of BANDS) {
    const visible = count((e) => e.row.kind === 'try' && (!e.target.axes || e.target.axes.some((k) => k === band)));
    if (visible < MIN_TRY_PER_BAND) out.push(`${band}: ${visible} try cards visible (need ${MIN_TRY_PER_BAND})`);
    if (count((e) => e.row.kind === 'try' && e.target.axes?.[0] === band) === 0) out.push(`${band} has no try card of its own`);
    const names = count((e) => e.row.kind === 'archetype' && e.target.axes?.[0] === band);
    if (names !== 1) out.push(`${band}: ${names} archetype names (need exactly 1)`);
  }
  if (count((e) => e.row.kind === 'reflect') === 0) out.push('no reflect cards');
  if (count((e) => e.row.kind === 'week') === 0) out.push('no week recap');
  if (count((e) => e.row.kind === 'year') === 0) out.push('no year recap');
  for (const arc of ARC_IDS.filter((a) => a.startsWith('month_'))) {
    if (count((e) => e.row.kind === 'month' && e.target.arc === arc) === 0) out.push(`${arc} has no month recap`);
  }
  return out;
}

function rowCheck(kind: DocKind, heading: string, body: string): string[] {
  const row: DocRow = { line: 1, mark: ' ', id: null, kind, targetRaw: heading, body };
  const target = parseTarget(kind, heading);
  if (typeof target === 'string') return [target];
  return rowProblems(row, target, parseBody(kind, body));
}

function passes(kind: DocKind, heading: string, body: string) {
  assert.deepEqual(rowCheck(kind, heading, body), [], `should pass: ${kind} | ${heading} | ${body}`);
}

function fails(kind: DocKind, heading: string, body: string, why: RegExp) {
  const problems = rowCheck(kind, heading, body);
  assert.ok(problems.some((p) => why.test(p)), `should fail (${why}): ${kind} | ${heading} | ${body}\n  got: ${problems.join(' / ') || 'nothing'}`);
}

function entryOf(id: string, text: string, mark: ' ' | 'x' | 'r' = ' '): Entry {
  const row: DocRow = { line: 1, mark, id, kind: 'line', targetRaw: 'any', body: text };
  return { row, target: { slug: 'any' } as Target, parsed: parseBody('line', text) };
}

// ---------------------------------------------------------------- the doc

const doc = readReviewFile(readFileSync(path.join(ROOT, REVIEW_FILE), 'utf8'));
assert.deepEqual(doc.unreadable, [], `unreadable rows in ${REVIEW_FILE}:\n  ${doc.unreadable.slice(0, 10).join('\n  ')}`);
ok(`${REVIEW_FILE}: ${doc.rows.length} rows, every heading and row readable`);

const draft = planLoad(doc.rows, { all: true });
assert.deepEqual(draft.problems, [], `rows with problems:\n  ${draft.problems.slice(0, 20).join('\n  ')}`);
ok('every non-retired row passes the rules, ticked or not, and has an id that matches its heading');

// The 64 wave82 Picks only: the 304 appended by PHASE-11d ARE this doc's base Pick rows.
const shippedPicks = DAILY_PICKS.slice(0, LEGACY_PICK_COUNT).map((p) => p.prompt);
const dupes = duplicateProblems(draft.entries, shippedPicks);
assert.deepEqual(dupes, [], `duplicates:\n  ${dupes.slice(0, 20).join('\n  ')}`);
ok(`no duplicate text across the doc and the ${shippedPicks.length} shipped Picks`);

const generated = readGenerated();
assert.ok(generated.length > 0, `${OUT_TS} is missing: run npm run load:almanac`);
const ledger = ledgerProblems(draft.entries, generated);
assert.deepEqual(ledger, [], `ids left the doc:\n  ${ledger.join('\n  ')}`);
ok('ledger: every id ever generated is still in the doc (retired = [r], never deleted)');

const cover = coverageProblems(draft.entries);
assert.deepEqual(cover, [], `coverage:\n  ${cover.slice(0, 20).join('\n  ')}`);
ok('coverage: 19 base Picks per trait, 4 phases per event, every arc, 11 micro-events, 15+ tries per band, 32 names');

// ---------------------------------------------------------------- what ships

const shipping = planLoad(doc.rows, { all: false });
assert.deepEqual(shipping.problems, [], `ticked rows with problems:\n  ${shipping.problems.slice(0, 20).join('\n  ')}`);
assert.ok(!generated.includes(DRAFT_MARK), `${OUT_TS} was written in DRAFT MODE: run npm run load:almanac without --all`);
assert.equal(generated, renderTs(shipping.entries, shipping.picked, false), `${OUT_TS} is stale: run npm run load:almanac and commit it`);
assert.equal(GENERATED_CARDS.length, shipping.picked.filter((e) => e.row.kind !== 'basepick' && e.row.kind !== 'archetype').length);
assert.ok(GENERATED_CARDS.every((c) => c.reviewed), 'only reviewed cards ship');
ok('generated file is fresh, not a DRAFT MODE file, and holds exactly the ticked rows');

const ticked = doc.rows.filter((r) => r.mark === 'x').length;
if (ticked === 0) {
  assert.equal(ALMANAC_COPY_REVIEWED, false, 'nothing is ticked, so ALMANAC_COPY_REVIEWED stays false');
  assert.equal(GENERATED_CARDS.length, 0, 'nothing is ticked, so nothing ships');
  assert.equal(GENERATED_BANK_VERSION, 0);
}
assert.equal(ALMANAC_BANK.length, GENERATED_CARDS.length, 'the engine bank is the generated bank');
assert.equal(ALMANAC_BANK_VERSION, GENERATED_BANK_VERSION, 'the engine bank version is the generated one');
ok(`engine wired to the generated bank (${ticked} ticked, ALMANAC_COPY_REVIEWED = ${String(ALMANAC_COPY_REVIEWED)})`);

// ---------------------------------------------------------------- pass/fail pairs

// length and formatting
passes('line', 'any', 'A short line.');
fails('line', 'any', 'x'.repeat(121), /max 120/);
fails('line', 'any', 'Tell everyone #day', /hashtag/);
fails('line', 'any', 'Wow!!', /hashtag or shouting/);
fails('line', 'any', 'Two  spaces here', /stray spaces/);
fails('line', 'any', '', /empty|could not|is empty/);
ok('pairs: length, hashtag, shouting, stray spaces');

// slots and alt
passes('line', 'any', 'Hi {name}, welcome. ~~ Welcome.');
fails('line', 'any', 'Hi {name}, welcome.', /needs an alt/);
fails('line', 'any', 'Hi {color}. ~~ Hi.', /unknown slot/);
fails('line', 'any', 'Hi {name}. ~~ Hi {name}.', /alt\) must not use slots/);
fails('line', 'any', `${'x'.repeat(105)} {lastPick} ~~ Short.`, /at its longest/);
passes('line', 'halloween/lead', '{eventName} is close, day {daysInto}.');
fails('line', 'any', '{eventName} is close.', /needs an alt/);
fails('line', 'any', 'A { brace here', /stray brace/);
ok('pairs: slot needs an alt, unknown slot, alt has no slots, worst-case length, event slots, stray brace');

// the fence and labels
fails('line', 'any', 'Your MBTI type is INTJ.', /names the model/);
fails('line', 'any', 'You have depression and need help.', /label on the reader/);
passes('line', 'any', 'A calm day with a long walk in it.');
ok('pairs: framework fence, label or diagnosis on the reader');

// clear voice for tries
passes('try', 'any', 'Pick one thing to finish today, so it stops sitting in your head.');
fails('try', 'any', 'Notice how you feel today, so you know what you need.', /try \(clear voice\)/);
fails('try', 'any', 'Pick one thing, and you always finish it, so it works.', /try \(clear voice\)/);
fails('try', 'any', 'Set healthy boundaries today, so you feel better.', /try \(clear voice\)/);
fails('try', 'any', `Pick ${'a '.repeat(60)}thing, so it works.`, /too long|max 120|try \(clear voice\)/);
ok('pairs: a try opens with an allowed verb, no absolute, no therapy-speak, no overlong');

// weekdays
passes('reflect', 'any@0', 'What did the week teach you?');
fails('try', 'any@0', 'Pick one thing today, so it is done.', /weekdays are for reflect and line/);
fails('reflect', 'any@9', 'What did the week teach you?', /weekdays must be 0-6/);
ok('pairs: weekdays only on reflect and line, 0-6');

// base Picks
passes('basepick', 'openness', 'A coworker brings in a snack from far away. || I’ll try it [H] || I’ll stick to mine [L]');
fails('basepick', 'openness', 'A snack from far away. || I’ll try it [H] || I’ll try it too [H]', /one \[H\] and one \[L\]/);
fails('basepick', 'openness', 'A snack from far away. || I’ll try it || I’ll stick to mine', /one \[H\] and one \[L\]/);
fails('basepick', 'openness', 'A snack from far away. || I’ll try it [H]', /prompt \|\| option \|\| option/);
fails('basepick', 'openness', `A snack. || ${'x'.repeat(41)} [H] || No [L]`, /over 40 characters/);
fails('basepick', 'openness', 'A snack for {name}. || Yes [H] || No [L]', /no slots/);
fails('basepick', 'openness', 'A snack. || Yes [H] || Just a day for me [out]', /no \[out\]/);
fails('basepick', 'curiosity', 'A snack. || Yes [H] || No [L]', /must be a trait/);
ok('pairs: base Pick shape (one H, one L, 40 chars, no slots, no out)');

// event Picks and gentle days
passes('pick', 'halloween/peak', 'The doorbell rings. || Open it || Hide');
passes('pick', 'valentines/peak', 'A card aisle. || Buying one || A regular day for me [out]');
fails('pick', 'valentines/peak', 'A card aisle. || Buying one || Walking by', /exactly one \[out\]/);
fails('pick', 'valentines/peak', 'A card aisle. || Buying one [out] || Walking by [out]', /exactly one \[out\]/);
fails('pick', 'halloween/peak', 'The doorbell rings. || Open it || Hide [out]', /gentle days only/);
fails('pick', 'halloween/peak', 'The doorbell rings. || Open it [H] || Hide [L]', /no trait value/);
fails('pick', 'openness:high', 'The doorbell rings. || Open it || Hide', /no trait lean|needs an event heading/);
fails('pick', 'christmas/peak', 'A gift swap. || Wrapping || Skipping', /exactly one \[out\]/);
ok('pairs: event Picks carry no value or lean; gentle days have exactly one [out]; [out] only on gentle days');

// archetypes
passes('archetype', 'openness:high', 'The Wanderer');
fails('archetype', 'openness:high', 'x'.repeat(MAX_ARCHETYPE_CHARS + 1), /over 32/);
fails('archetype', 'openness:high', 'The {name}', /no slots/);
fails('archetype', 'openness:high+autonomy:low', 'The Pair', /one band/);
ok('pairs: archetype name length, no slots, one band');

// headings and ids
assert.equal(typeof parseTarget('line', 'halloween/peak'), 'object');
assert.equal(typeof parseTarget('line', 'halloween/soon'), 'string', 'unknown phase refused');
assert.equal(typeof parseTarget('line', 'not_an_event'), 'string', 'unknown target refused');
assert.equal(typeof parseTarget('line', 'week_openness'), 'object', 'week arcs are known targets');
assert.equal(typeof parseTarget('line', 'full_moon'), 'object', 'micro-events are known targets');
ok('pairs: headings (event/phase, micro-event, arc) known or refused');

// duplicates
assert.deepEqual(duplicateProblems([entryOf('a', 'One line.'), entryOf('b', 'Another line.')]), []);
assert.equal(duplicateProblems([entryOf('a', 'One line.'), entryOf('b', '  one   LINE. ')]).length, 1, 'same text with other spacing and case');
assert.equal(duplicateProblems([entryOf('a', 'Fresh text.')], ['fresh text.']).length, 1, 'same text as a shipped Pick');
assert.deepEqual(duplicateProblems([entryOf('a', 'One line.'), entryOf('b', 'one line.', 'r')]), [], 'a retired row is not a duplicate');
ok('pairs: duplicates (case and spacing blind, shipped Picks included, retired exempt)');

// ledger
const ledgerFile = renderTs([entryOf('alm_line_any_01', 'One line.')], [], false);
assert.deepEqual(ledgerProblems([entryOf('alm_line_any_01', 'One line.')], ledgerFile), []);
assert.equal(ledgerProblems([entryOf('alm_line_any_02', 'Other.')], ledgerFile).length, 1, 'an id that left the doc is flagged');
assert.deepEqual(ledgerProblems([entryOf('alm_line_any_01', 'One line.', 'r')], ledgerFile), [], 'a retired row keeps its id in the doc');
ok('pairs: ledger (an id never leaves the doc; retired rows stay)');

// only ticked rows ship; draft mode is marked
{
  const rows: DocRow[] = [
    { line: 1, mark: 'x', id: 'alm_line_any_01', kind: 'line', targetRaw: 'any', body: 'Ticked line.' },
    { line: 2, mark: ' ', id: 'alm_line_any_02', kind: 'line', targetRaw: 'any', body: 'Unticked line.' },
    { line: 3, mark: 'r', id: 'alm_line_any_03', kind: 'line', targetRaw: 'any', body: 'Retired line.' },
  ];
  const ticked = planLoad(rows, { all: false });
  assert.deepEqual(ticked.picked.map((e) => e.row.id), ['alm_line_any_01'], 'only ticked ships');
  const all = planLoad(rows, { all: true });
  assert.deepEqual(all.picked.map((e) => e.row.id), ['alm_line_any_01', 'alm_line_any_02'], 'draft mode takes unticked but never retired');
  assert.ok(renderTs(all.entries, all.picked, true).includes(DRAFT_MARK), 'a draft file is marked');
  assert.ok(!renderTs(ticked.entries, ticked.picked, false).includes(DRAFT_MARK), 'a real file is not');
  assert.ok(renderTs(ticked.entries, ticked.picked, false).includes('"alm_line_any_03"'), 'the retired id stays in the ledger');
  assert.equal(planLoad([{ ...rows[0]!, id: null }], { all: false }).problems.length, 1, 'a row without an id blocks the load');
  assert.ok(planLoad([rows[0]!, { ...rows[1]!, id: 'alm_line_any_01' }], { all: true }).problems.some((p) => /used twice/.test(p)), 'an id used twice blocks the load');
  assert.ok(planLoad([{ ...rows[0]!, id: 'alm_try_any_01' }], { all: false }).problems.some((p) => /does not match its heading/.test(p)), 'an id must match its heading');
}
ok('pairs: only ticked rows ship, retired never, draft mode marked, missing/duplicate/mismatched ids refused');

// coverage
assert.ok(coverageProblems([]).length > 30, 'an empty draft fails coverage in many places');
{
  const noPicks = draft.entries.filter((e) => !(e.row.kind === 'pick' && e.target.event === 'halloween'));
  assert.ok(coverageProblems(noPicks).some((p) => /halloween has 0 peak Picks/.test(p)), 'a global event needs 3 peak Picks');
  const noFade = draft.entries.filter((e) => !(e.target.event === 'diwali' && e.target.phase === 'fade'));
  assert.ok(coverageProblems(noFade).some((p) => /diwali has no fade/.test(p)), 'every event needs a fade card');
  const noTry = draft.entries.filter((e) => !(e.row.kind === 'try' && e.target.axes?.[0] === 'openness:high'));
  assert.ok(coverageProblems(noTry).some((p) => /openness:high has no try card of its own/.test(p)));
  const noName = draft.entries.filter((e) => !(e.row.kind === 'archetype' && e.target.axes?.[0] === 'autonomy:low'));
  assert.ok(coverageProblems(noName).some((p) => /autonomy:low: 0 archetype/.test(p)));
  const noMoon = draft.entries.filter((e) => e.target.event !== 'full_moon');
  assert.ok(coverageProblems(noMoon).some((p) => /full_moon has no card/.test(p)));
}
{
  const without = (f: (e: Entry) => boolean) => coverageProblems(draft.entries.filter((e) => !f(e)));
  assert.ok(without((e) => e.row.kind === 'basepick' && e.target.axis === 'autonomy' && e.row.id!.endsWith('_01')).some((p) => /autonomy: 18 base Picks/.test(p)), '19 base Picks per trait');
  const bandTries = draft.entries.filter((e) => e.row.kind === 'try' && e.target.axes?.[0] === 'playfulness:low');
  assert.ok(without((e) => e.row.kind === 'try' && (!e.target.axes || e.target.axes[0] === 'playfulness:low')).some((p) => /playfulness:low: \d+ try cards visible/.test(p)), '15 tries visible per band');
  assert.equal(bandTries.length, 4);
  const aPick: Entry = { ...entryOf('alm_pick_diwali_peak_01', 'x'), target: { slug: 'diwali_peak', event: 'diwali', phase: 'peak' }, row: { ...entryOf('a', 'x').row, kind: 'pick' } };
  assert.ok(coverageProblems([...draft.entries, aPick]).some((p) => /diwali is regional or opt-in/.test(p)), 'a regional event gets no Pick');
  const weekCard: Entry = { ...entryOf('alm_line_week_openness_01', 'x'), target: { slug: 'week_openness', arc: 'week_openness' } };
  assert.ok(coverageProblems([...draft.entries, weekCard]).some((p) => /week_openness: week arcs get no cards/.test(p)), 'week arcs get no cards');
  assert.ok(without((e) => e.row.kind === 'month' && e.target.arc === 'month_masks').some((p) => /month_masks has no month recap/.test(p)), 'every month has a recap');
  assert.ok(without((e) => e.row.kind === 'line' && e.target.arc === 'season_embers').some((p) => /season_embers has no line card/.test(p)), 'every season has a card');
}
ok('pairs: coverage fails when a Pick, a phase, a band try, a name, a micro-event, a season or a month recap goes missing, or a regional Pick / week card appears');

console.log(`\ncheck:almanac-bank — ${passed} checks passed`);
