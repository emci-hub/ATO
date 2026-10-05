/**
 * Today's Pick (emci, 2026-10-05): one either/or question a day, the same for
 * everyone, one tap. Replaces the daily line card on Home.
 * Run: npm run check:daily-pick
 *
 * Pins: the 64 picks (4 per trait, one high and one low answer, moment-voice
 * rules); the date rotation (no trait two days running, every pick in 64 days)
 * matching the server's; the migration's pool rows matching the app's list;
 * the server rules (counts as an answer only after a trait's intake, one
 * answer a day, split only as totals from 20 and only to someone who answered);
 * no model call; the share image carries the question only.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { lineRuleViolation } from '../src/lib/daily-line/bank';
import {
  DAILY_PICK_COPY_REVIEWED,
  DAILY_PICKS,
  pickForYmd,
  pickIndexForYmd,
} from '../src/lib/daily-pick/bank';
import { reactionLine } from '../src/lib/daily-pick/reaction';
import { addDaysYmd } from '../src/lib/local-date';
import { TRAIT_AXES } from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

// ── The picks ────────────────────────────────────────────────────────────────
assert.equal(DAILY_PICKS.length, 64);
assert.equal(new Set(DAILY_PICKS.map((p) => p.id)).size, 64, 'ids are unique');
TRAIT_AXES.forEach((axis, t) => {
  const four = DAILY_PICKS.slice(t * 4, t * 4 + 4);
  assert.ok(four.every((p) => p.axis === axis), `picks ${t * 4}..${t * 4 + 3} are all ${axis} (TRAIT_AXES order)`);
});
for (const p of DAILY_PICKS) {
  const values = p.options.map((o) => o.value).sort();
  assert.deepEqual(values, [0.2, 0.8], `${p.id}: one high and one low answer`);
  assert.equal(lineRuleViolation(p.prompt, { allowAdvice: true }), null, `${p.id} voice rule: ${p.prompt}`);
  for (const text of [p.prompt, ...p.options.map((o) => o.text)]) {
    assert.ok(!containsFrameworkTerm(text), `${p.id}: framework term in "${text}"`);
  }
  for (const o of p.options) assert.ok(o.text.length <= 28, `${p.id}: "${o.text}" is too long for a button`);
}
assert.ok(DAILY_PICKS.filter((p) => p.options[0].value === 0.8).length >= 24, 'the high side is not always first');
assert.equal(DAILY_PICK_COPY_REVIEWED, false, 'draft until emci reads them');
ok('64 picks, 4 per trait in order, one high and one low answer each, moment-voice rules, draft');

// ── Rotation ─────────────────────────────────────────────────────────────────
const seen = new Set<number>();
let prevAxis: string | null = null;
for (let d = 0; d < 64; d += 1) {
  const ymd = addDaysYmd('2026-01-01', d);
  const pick = pickForYmd(ymd);
  assert.notEqual(pick.axis, prevAxis, `${ymd}: same trait two days running`);
  prevAxis = pick.axis;
  seen.add(pickIndexForYmd(ymd));
}
assert.equal(seen.size, 64, 'every pick comes up once in 64 days');
assert.equal(pickIndexForYmd('2025-12-31'), pickIndexForYmd(addDaysYmd('2025-12-31', 64)), 'days before the epoch wrap too');
ok('one pick a day for everyone; never the same trait two days running; all 64 in 64 days');

// ── Server ───────────────────────────────────────────────────────────────────
const sql = read('supabase/migrations/wave82_daily_pick.sql');
const rows = execFileSync('npx', ['tsx', 'scripts/gen-wave82-picks.ts'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
}).trim();
assert.ok(sql.replace(/\r\n/g, '\n').includes(rows.replace(/\r\n/g, '\n')), 'the migration pool rows match the app list (regenerate with scripts/gen-wave82-picks.ts)');
// The server's date rule is the app's: (n % 16) * 4 + n / 16 over n = day % 64.
assert.match(sql, /select \(\(\(\(p_ymd - date '2026-01-01'\) % 64\) \+ 64\) % 64 % 16\) \* 4\s*\+ \(\(\(\(p_ymd - date '2026-01-01'\) % 64\) \+ 64\) % 64 \/ 16\);/);
assert.match(sql, /v_mode := case when v_count >= 3 then 'answer' else 'direct' end;/, 'counts only after the trait\'s intake');
assert.match(sql, /perform public\._trait_write\(uid, p\.axis, 'self_situation', v_value, v_mode\);/, 'the one trait write goes through the checkpoint');
assert.match(sql, /if p_ymd is null\s+or p_ymd < \(timezone\('utc', now\(\)\)\)::date - 1/, 'only today');
assert.match(sql, /p\.position <> public\.daily_pick_position\(p_ymd\)/, 'only that day\'s pick');
assert.match(sql, /primary key \(user_id, ymd\)/, 'one answer a day');
// The split was replaced by wave83: one day only, rounded to 5%, never counts.
const split = read('supabase/migrations/wave83_daily_pick_split_by_day.sql');
assert.match(split, /where user_id = uid and pick_id = p_pick_id and ymd = p_ymd\s*\) then\s*return null;/, 'split only after answering that day');
assert.match(split, /from public\.daily_pick_answers where pick_id = p_pick_id and ymd = p_ymd;/, 'one day only');
assert.match(split, /if v_a \+ v_b < 20 then\s*return null;/, 'no split under 20 answers');
assert.match(split, /round\(v_a \* 20\.0 \/ \(v_a \+ v_b\)\) \* 5/, 'shares rounded to 5%');
assert.doesNotMatch(split.slice(split.indexOf('create function')), /'counts'|'total'/, 'no raw counts');
assert.match(split, /drop function public\.daily_pick_split\(text\);/);
assert.doesNotMatch(sql, /alter table public\.(?!daily_pick)|drop |delete from|update public\.(?!me\b)/i, 'additive only');
ok('server: the same rotation, counts only after a trait\'s intake, one a day, split as totals from 20 to answerers only, additive');

// ── App side ─────────────────────────────────────────────────────────────────
const card = read('src/components/today-pick-card.tsx');
const store = read('src/lib/daily-pick/store.ts');
for (const src of [card, store, read('src/lib/daily-pick/bank.ts')]) {
  assert.doesNotMatch(src, /generateText|claimAiCall|ai-generate/);
}
assert.match(card, /content=\{\{ kind: 'line', text: pick\.prompt \}\}/, 'share = the question only');
assert.match(store, /await answerDailyPick\(ymd, pick\.id, optionIndex\);/, 'answers go through the trait checkpoint');
assert.match(read('src/lib/trait-checkpoint.ts'), /supabase\.rpc\('answer_daily_pick'/);
const pick = DAILY_PICKS[20]!; // Reassurance: "They left you on read…"
const line = reactionLine(pick, 0, '2026-10-05');
assert.ok(line && line.source === 'authored', 'a reaction is an approved line');
assert.equal(reactionLine(pick, 0, '2026-10-05')?.id, line?.id, 'same day, same answer, same reaction');
const home = read('src/app/(tabs)/index.tsx').replace(/\r\n/g, '\n');
assert.ok(home.indexOf('<SageStoryFold') < home.indexOf('styles.sealedCard'), 'Home: Story above the insight');
assert.ok(home.indexOf('styles.sealedCard') < home.indexOf('{pickBlock}\n'), 'Home: the insight above Today\'s Pick');
assert.ok(home.lastIndexOf('{pickBlock}') < home.indexOf('<ProgressRing value='), 'Home: Today\'s Pick above the round ring');
ok('no model call; share carries the question only; answers go through the checkpoint; Home order Story → insight → pick → round');

console.log(`\ndaily-pick-check: ${passed} passed`);
