/**
 * Pet talk checks (overhaul, 2026-09-29). Run: npm run check:pet-talk
 *
 *   - Every form × situation has lines: 6+ for idle chatter, happy and hungry,
 *     3+ for everything else; no duplicates inside a pool.
 *   - Every line fits the bubble and never uses GAME_SPEC §7's banned words
 *     (gamble / casino / jackpot / bet).
 *   - The picker never plays the same line twice in a row.
 *   - Every status and every time of day maps to a situation that has lines.
 */
import assert from 'node:assert/strict';

import { PET_BRANCHES } from '../src/play/pet';
import { PET_STATUSES } from '../src/play/pet-status';
import {
  PET_BANNED_WORDS,
  PET_EGG_LINES,
  PET_EGG_TALK,
  PET_EGG_TALK_LINES,
  PET_TALK_BIG,
  PET_TALK_LINES,
  PET_TALK_MAX_CHARS,
  PET_TALK_MIN,
  PET_TALK_MIN_BIG,
  PET_TALK_SITUATIONS,
  pickEggLine,
  pickEggTalk,
  pickPetLine,
  talkSituationForStatus,
  timeOfDaySituation,
} from '../src/play/pet-talk';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const banned = new RegExp(`\\b(${PET_BANNED_WORDS.join('|')})\\b`, 'i');
let total = 0;
for (const branch of PET_BRANCHES) {
  for (const situation of PET_TALK_SITUATIONS) {
    const pool = PET_TALK_LINES[branch][situation];
    const min = PET_TALK_BIG.includes(situation) ? PET_TALK_MIN_BIG : PET_TALK_MIN;
    assert.ok(pool.length >= min, `${branch}/${situation}: ${pool.length} lines, needs ${min}`);
    assert.equal(new Set(pool).size, pool.length, `${branch}/${situation}: no duplicate lines`);
    for (const line of pool) {
      total += 1;
      assert.ok(line.trim().length > 0, `${branch}/${situation}: empty line`);
      assert.ok(line.length <= PET_TALK_MAX_CHARS, `${branch}/${situation}: "${line}" is over ${PET_TALK_MAX_CHARS} chars`);
      assert.ok(!banned.test(line), `${branch}/${situation}: "${line}" uses a banned word`);
    }
  }
}
assert.deepEqual([...PET_BANNED_WORDS].sort(), ['bet', 'casino', 'gamble', 'jackpot'], 'banned list is GAME_SPEC §7’s');
ok(`${total} lines: every form × situation covered (6+ chatter/happy/hungry, 3+ others), short, no banned words`);

// Five forms have five different voices — no pool is copied between forms.
for (const situation of PET_TALK_SITUATIONS) {
  const seen = new Set<string>();
  for (const branch of PET_BRANCHES) {
    const key = PET_TALK_LINES[branch][situation].join('|');
    assert.ok(!seen.has(key), `${situation}: ${branch} copies another form's lines`);
    seen.add(key);
  }
}
ok('each form has its own lines');

// Never the same line twice in a row.
let s = 12345;
const rng = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
};
for (const branch of PET_BRANCHES) {
  for (const situation of PET_TALK_SITUATIONS) {
    let last: string | null = null;
    for (let i = 0; i < 1000; i += 1) {
      const line = pickPetLine(branch, situation, last, rng);
      assert.notEqual(line, last, `${branch}/${situation}: repeated "${line}"`);
      assert.ok(PET_TALK_LINES[branch][situation].includes(line));
      last = line;
    }
  }
}
// Worst-case source (always 0 / always just under 1) still never repeats.
for (const edge of [() => 0, () => 0.999999]) {
  let last: string | null = null;
  for (let i = 0; i < 20; i += 1) {
    const line = pickPetLine('scruffy', 'sad', last, edge);
    assert.notEqual(line, last);
    last = line;
  }
}
let egg: string | null = null;
for (let i = 0; i < 200; i += 1) {
  const line = pickEggLine(egg, rng);
  assert.notEqual(line, egg);
  egg = line;
}
assert.ok(PET_EGG_LINES.length >= 2);
ok('picker: 1000 picks per form × situation, never the same line twice in a row');

for (const status of PET_STATUSES) {
  const situation = talkSituationForStatus(status);
  assert.ok(PET_TALK_SITUATIONS.includes(situation), `${status} → ${situation}`);
}
assert.equal(talkSituationForStatus('hungry'), 'hungry');
assert.equal(talkSituationForStatus('starving'), 'hungry');
assert.equal(talkSituationForStatus('very_sad'), 'sad');
assert.equal(talkSituationForStatus('okay'), 'chatter');
assert.equal(timeOfDaySituation(8), 'morning');
assert.equal(timeOfDaySituation(13), 'afternoon');
assert.equal(timeOfDaySituation(19), 'evening');
assert.equal(timeOfDaySituation(23), null);
assert.equal(timeOfDaySituation(3), null);
ok('every status and time of day maps to a situation with lines');

for (const moment of PET_EGG_TALK) {
  const pool = PET_EGG_TALK_LINES[moment];
  assert.ok(pool.length >= PET_TALK_MIN, `egg/${moment}: ${pool.length} lines, needs ${PET_TALK_MIN}`);
  for (const line of pool) {
    assert.ok(line.length <= PET_TALK_MAX_CHARS, `egg/${moment}: "${line}" too long`);
    assert.ok(!banned.test(line), `egg/${moment}: "${line}" uses a banned word`);
  }
  let last: string | null = null;
  for (let i = 0; i < 300; i += 1) {
    const line = pickEggTalk(moment, last, rng);
    assert.notEqual(line, last, `egg/${moment}: repeated`);
    last = line;
  }
}
for (const g of ['common', 'rare', 'epic', 'legendary']) assert.ok(PET_EGG_TALK.includes(`reveal_${g}` as never), `a reveal line for ${g}`);
ok('egg-stage lines: keep warm, hatching, hatched, a reveal per grade, shiny, trade-up — 3+ each, no repeats, no banned words');

console.log(`\ncheck:pet-talk — ${passed} groups passed.`);
