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

import { GENERATED_BASE_PICKS, GENERATED_CARDS, GENERATED_EVENT_PICK_OPTIONS } from '../src/lib/almanac/bank.generated';
import { EVENTS } from '../src/lib/almanac/events';
import { lineRuleViolation } from '../src/lib/daily-line/bank';
import {
  ALMANAC_PICK_CUTOVER,
  DAILY_PICK_COPY_REVIEWED,
  DAILY_PICKS,
  EVENT_DAILY_PICKS,
  EVENT_PICK_POSITION_BASE,
  GLOBAL_PICK_EVENTS,
  LEGACY_PICK_COUNT,
  PICK_OVERLAP_DAYS,
  eventPickForYmd,
  eventPickOverrides,
  legacyPickIndexForYmd,
  pickForYmd,
  pickIndexAt,
  positionForSlot,
  dailyPickById,
  RETIRED_DAILY_PICKS,
  RETIRED_PICK_POSITION_BASE,
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
// 64 shipped (wave82, 4 per trait), then 304 appended by PHASE-11d (19 per trait, TRAIT_AXES
// order, p66…p369): 368 = 16 × 23. Append only: the first 64 never move.
const PER_TRAIT = 23;
const APPENDED = PER_TRAIT - 4;
assert.equal(DAILY_PICKS.length, 16 * PER_TRAIT);
assert.equal(LEGACY_PICK_COUNT, 64);
assert.equal(new Set(DAILY_PICKS.map((p) => p.id)).size, DAILY_PICKS.length, 'ids are unique');
TRAIT_AXES.forEach((axis, t) => {
  const four = DAILY_PICKS.slice(t * 4, t * 4 + 4);
  assert.ok(four.every((p) => p.axis === axis), `picks ${t * 4}..${t * 4 + 3} are all ${axis} (TRAIT_AXES order)`);
  const start = LEGACY_PICK_COUNT + t * APPENDED;
  const more = DAILY_PICKS.slice(start, start + APPENDED);
  assert.ok(more.every((p) => p.axis === axis), `appended picks ${start}..${start + APPENDED - 1} are all ${axis}`);
});
DAILY_PICKS.slice(LEGACY_PICK_COUNT).forEach((p, i) => {
  assert.equal(p.id, `p${66 + i}`, `appended ids run p66…p369 in order (${p.id})`);
});
const almanacIds = new Map(GENERATED_BASE_PICKS.map((g) => [`${g.axis}|${g.prompt}`, g]));
for (const p of DAILY_PICKS.slice(LEGACY_PICK_COUNT)) {
  const g = almanacIds.get(`${p.axis}|${p.prompt}`);
  assert.ok(g, `${p.id}: comes from a ticked base Pick in docs/almanac-review.md`);
  assert.deepEqual(
    p.options.map((o) => [o.text, o.value]),
    g.options.map((o) => [o.text, o.value]),
    `${p.id}: answers exactly as approved (${g.id})`,
  );
}
assert.equal(GENERATED_BASE_PICKS.length, DAILY_PICKS.length - LEGACY_PICK_COUNT, 'every ticked base Pick is appended once');
DAILY_PICKS.forEach((p, i) => {
  const values = p.options.map((o) => o.value).sort();
  assert.deepEqual(values, [0.2, 0.8], `${p.id}: one high and one low answer`);
  const voice = lineRuleViolation(p.prompt, { allowAdvice: true });
  // The appended Picks may set a scene with "You're …" ("You're stuck in a traffic jam."): a situation,
  // not a label pinned on the reader. The core content policy (docs/copy-review-rules.md) judges
  // meaning, not the keyword, and emci approved these rows (check:almanac-bank ran its own rules).
  const sceneYouAre = i >= LEGACY_PICK_COUNT && voice === 'says "you are"';
  assert.ok(voice === null || sceneYouAre, `${p.id} voice rule (${voice}): ${p.prompt}`);
  for (const text of [p.prompt, ...p.options.map((o) => o.text)]) {
    assert.ok(!containsFrameworkTerm(text), `${p.id}: framework term in "${text}"`);
  }
  // The shipped 64 keep the old 28; the appended ones use the Almanac's approved limit (40,
  // check:almanac-bank). The answer rows are full width and the text wraps.
  const max = i < LEGACY_PICK_COUNT ? 28 : 40;
  for (const o of p.options) assert.ok(o.text.length <= max, `${p.id}: "${o.text}" is too long for a button`);
});
const highFirst = DAILY_PICKS.filter((p) => p.options[0].value === 0.8).length / DAILY_PICKS.length;
assert.ok(highFirst >= 0.25 && highFirst <= 0.75, `the high side is not always first (${Math.round(highFirst * 100)}%)`);
assert.equal(DAILY_PICK_COPY_REVIEWED, true, 'accepted by emci 2026-10-23 (roadmap A4; the table is pinned by check:copy-flags)');
ok('368 picks: the shipped 64 (4 per trait) + 304 approved base Picks (19 per trait, p66…p369), one high and one low answer each, voice rules');

// ── Rotation (both formulas, both sides of the cutover) ─────────────────────────
function walk(count: number, from: string, index: (ymd: string) => number) {
  const seen = new Set<number>();
  let prevAxis: string | null = null;
  for (let d = 0; d < count; d += 1) {
    const ymd = addDaysYmd(from, d);
    const i = index(ymd);
    assert.notEqual(DAILY_PICKS[i]!.axis, prevAxis, `${ymd}: same trait two days running`);
    prevAxis = DAILY_PICKS[i]!.axis;
    seen.add(i);
  }
  return seen;
}
const legacy = walk(64, '2026-01-01', legacyPickIndexForYmd);
assert.deepEqual([...legacy].sort((a, b) => a - b), [...Array(64).keys()], '64 rotation: every shipped pick once in 64 days');
const full = walk(368, '2027-03-01', (ymd) => pickIndexAt(ymd, 368));
assert.equal(full.size, 368, '368 rotation: every pick once in 368 days');
for (let s = 0; s < 368; s += 1) {
  assert.equal(DAILY_PICKS[positionForSlot(s, PER_TRAIT)]!.axis, TRAIT_AXES[Math.floor(s / PER_TRAIT)], `slot ${s} is its trait's`);
}
for (let s = 0; s < 64; s += 1) assert.equal(positionForSlot(s, 4), s, 'with K = 4 the slot is the position (wave82)');
assert.equal(legacyPickIndexForYmd('2025-12-31'), legacyPickIndexForYmd(addDaysYmd('2025-12-31', 64)), 'days before the epoch wrap too (64)');
assert.equal(pickIndexAt('2025-12-31', 368), pickIndexAt(addDaysYmd('2025-12-31', 368), 368), 'days before the epoch wrap too (368)');
// The switch: the 64 rotation up to the day before, the 368 rotation from it, no trait twice across it.
assert.ok(ALMANAC_PICK_CUTOVER >= '2026-11-01', 'the cutover is on or after the planned OTA (emci set 2026-11-01 at PHASE-27: no other users, no overlap needed)');
const beforeCut = addDaysYmd(ALMANAC_PICK_CUTOVER, -1);
assert.equal(pickIndexForYmd(beforeCut), legacyPickIndexForYmd(beforeCut), 'the day before the cutover: the 64 rotation');
assert.equal(pickIndexForYmd(ALMANAC_PICK_CUTOVER), pickIndexAt(ALMANAC_PICK_CUTOVER, 368), 'the cutover day: the 368 rotation');
walk(800, addDaysYmd(ALMANAC_PICK_CUTOVER, -400), pickIndexForYmd);
for (let d = -400; d < 400; d += 1) {
  const ymd = addDaysYmd(ALMANAC_PICK_CUTOVER, d);
  assert.equal(pickIndexForYmd(ymd), d < 0 ? legacyPickIndexForYmd(ymd) : pickIndexAt(ymd, 368), `${ymd}: the right rotation`);
  assert.equal(pickForYmd(ymd).id, DAILY_PICKS[pickIndexForYmd(ymd)]!.id);
}
assert.equal(PICK_OVERLAP_DAYS, 14);
ok('64 rotation before the cutover, 368 from it; never the same trait two days running (across the switch too); every pick once per cycle');

// ── Seasonal peak Picks (global events only) ───────────────────────────────────
const cardById = new Map(GENERATED_CARDS.map((c) => [c.id, c]));
assert.equal(EVENT_DAILY_PICKS.length, GLOBAL_PICK_EVENTS.length * 3, 'three yearly variants per global event');
for (const p of EVENT_DAILY_PICKS) {
  assert.match(p.id, /^ev-[a-z_]+-[0-9]+$/);
  assert.equal(p.id, `ev-${p.event}-${p.variant}`);
  const card = cardById.get(p.cardId);
  assert.ok(card && card.kind === 'pick' && card.event === p.event && card.phase === 'peak', `${p.id}: a reviewed peak Pick card`);
  assert.equal(p.prompt, card.text, `${p.id}: prompt exactly as approved`);
  assert.deepEqual(
    p.options.map((o) => ({ text: o.text, out: !!o.out })),
    GENERATED_EVENT_PICK_OPTIONS[p.cardId]!.map((o) => ({ text: o.text, out: !!o.out })),
    `${p.id}: answers exactly as approved`,
  );
  assert.ok(!('axis' in p), `${p.id}: an event Pick moves no trait`);
}
for (const e of GLOBAL_PICK_EVENTS) {
  const def = EVENTS.find((d) => d.id === e.event);
  assert.ok(def, `${e.event} is an Almanac event`);
  assert.ok(!def.regional && !def.cultural && !def.ambient && !def.onlyRegions, `${e.event}: global (the shared Pick is the same for everyone)`);
  assert.deepEqual(def.rule, { kind: 'fixed', month: e.month, day: e.day }, `${e.event}: same date as the Almanac calendar`);
  assert.equal(def.ramp.peak, e.peakDays, `${e.event}: same peak days as the Almanac`);
}
const overrides = eventPickOverrides();
assert.equal(new Set(overrides.map((r) => r.ymd)).size, overrides.length, 'one override per day');
for (const r of overrides) {
  assert.ok(EVENT_DAILY_PICKS.some((p) => p.id === r.pickId && p.event === r.event), `${r.ymd}: a known event Pick`);
  assert.equal(eventPickForYmd(r.ymd)?.id, r.pickId);
}
assert.equal(eventPickForYmd('2026-11-03'), null, 'an ordinary day has no event Pick');
assert.equal(eventPickForYmd('2026-12-25')?.id, 'ev-christmas-1');
assert.equal(eventPickForYmd('2026-12-26')?.id, 'ev-christmas-2', 'a second peak day takes the next variant');
assert.equal(eventPickForYmd('2027-10-31')?.id, 'ev-halloween-2', 'variants take turns by year');
ok('12 seasonal peak Picks as approved, global events only, one override per peak day 2026–2035, no trait');

// ── Server ───────────────────────────────────────────────────────────────────
const sql = read('supabase/migrations/wave82_daily_pick.sql');
const rows = execFileSync('npx', ['tsx', 'scripts/gen-wave82-picks.ts'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
}).trim();
assert.ok(sql.replace(/\r\n/g, '\n').includes(rows.replace(/\r\n/g, '\n')), 'the migration pool rows match the app list as wave82 created it (regenerate with scripts/gen-wave82-picks.ts)');
// A pick whose scene changed is retired, never reworded in place (emci 2026-10-19): old answers keep
// pointing at the original text, and a new id takes its place in the rotation (wave99c).
const retireSql = execFileSync('npx', ['tsx', 'scripts/gen-wave82-picks.ts', '--retire'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
}).trim();
assert.ok(
  read('supabase/migrations/wave99c_daily_pick_p65.sql').replace(/\r\n/g, '\n').includes(retireSql.replace(/\r\n/g, '\n')),
  'wave99c parks every retired pick and inserts its replacement (regenerate with gen-wave82-picks.ts --retire)',
);
for (const r of RETIRED_DAILY_PICKS) {
  assert.equal(DAILY_PICKS[r.position]!.id, r.replacedBy, `${r.pick.id}: its replacement holds its old position`);
  assert.ok(!DAILY_PICKS.some((p) => p.id === r.pick.id), `${r.pick.id}: a retired id is never served again`);
  assert.equal(dailyPickById(r.pick.id)?.prompt, r.pick.prompt, `${r.pick.id}: old answers still find the original question`);
  assert.ok(RETIRED_PICK_POSITION_BASE + r.position >= DAILY_PICKS.length, 'a parked position is outside every rotation');
  assert.ok(RETIRED_PICK_POSITION_BASE + r.position < EVENT_PICK_POSITION_BASE, 'and below the event Picks');
}
assert.ok(
  !DAILY_PICKS.some((p) => /\blocations?\b/i.test(p.prompt) && p.axis.startsWith('attachment_')),
  'declining to share a location is a boundary, never scored as closeness or distance',
);
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

// wave117 (PHASE-11d, NOT applied): the 368 pool, the cutover, the overlap, the overrides, the counter.
const w117 = read('supabase/migrations/wave117_almanac.sql').replace(/\r\n/g, '\n');
// wave119 restates daily_pick_position + answer_daily_pick with the final cutover date; wave117 keeps the rest.
const w119 = read('supabase/migrations/wave119_pick_cutover.sql').replace(/\r\n/g, '\n');
const w117Rows = execFileSync('npx', ['tsx', 'scripts/gen-wave82-picks.ts', '--wave117'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
}).trim();
assert.ok(w117.includes(w117Rows.replace(/\r\n/g, '\n')), 'wave117 rows match the app (regenerate with gen-wave82-picks.ts --wave117)');
// The SQL rotation, read back from its text and run with Postgres integer rules (% keeps the
// dividend's sign, / truncates), must give the app's index on every day around the cutover.
const legacyFn = /create function public\.daily_pick_legacy_position\(p_ymd date\)[\s\S]*?as \$\$\s*select \(\(\(\(p_ymd - date '2026-01-01'\) % 64\) \+ 64\) % 64 % 16\) \* 4\s*\+ \(\(\(\(p_ymd - date '2026-01-01'\) % 64\) \+ 64\) % 64 \/ 16\);\s*\$\$;/;
assert.match(w117, legacyFn, 'the 64 rotation is wave82\'s, word for word');
const posFn = w119.match(
  /create or replace function public\.daily_pick_position\(p_ymd date\)[\s\S]*?when p_ymd < date '(\d{4}-\d{2}-\d{2})' then public\.daily_pick_legacy_position\(p_ymd\)\s*when s\.n \/ 16 < 4 then \(s\.n % 16\) \* 4 \+ s\.n \/ 16\s*else 64 \+ \(s\.n % 16\) \* (\d+) \+ \(s\.n \/ 16 - 4\)\s*end\s*from \(select \(\(\(p_ymd - date '2026-01-01'\) % (\d+)\) \+ \d+\) % \d+ as n\) s;/,
);
assert.ok(posFn, 'daily_pick_position has the cutover branch');
const [, sqlCutover, sqlAppended, sqlCount] = posFn;
assert.equal(sqlCutover, ALMANAC_PICK_CUTOVER, 'the SQL cutover date is the app\'s');
assert.equal(Number(sqlCount), DAILY_PICKS.length);
assert.equal(Number(sqlAppended), APPENDED);
const pgMod = (a: number, b: number) => a % b; // JS % also keeps the dividend's sign, like Postgres
const pgDiv = (a: number, b: number) => Math.trunc(a / b);
const dayOf = (ymd: string) => Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86_400_000);
function sqlLegacy(ymd: string) {
  const n = pgMod(pgMod(dayOf(ymd), 64) + 64, 64);
  return pgMod(n, 16) * 4 + pgDiv(n, 16);
}
function sqlPosition(ymd: string) {
  if (ymd < sqlCutover!) return sqlLegacy(ymd);
  const c = Number(sqlCount);
  const n = pgMod(pgMod(dayOf(ymd), c) + c, c);
  return pgDiv(n, 16) < 4 ? pgMod(n, 16) * 4 + pgDiv(n, 16) : 64 + pgMod(n, 16) * Number(sqlAppended) + (pgDiv(n, 16) - 4);
}
// The SQL position is the pool row's position; the pool row at position i is DAILY_PICKS[i].
for (let d = -800; d < 800; d += 1) {
  const ymd = addDaysYmd(ALMANAC_PICK_CUTOVER, d);
  assert.equal(sqlPosition(ymd), pickIndexForYmd(ymd), `${ymd}: SQL and app agree`);
  assert.equal(sqlLegacy(ymd), legacyPickIndexForYmd(ymd), `${ymd}: SQL and app agree on the 64 rotation`);
}
// Overlap: for 14 days from the cutover an old bundle's 64-rotation pick is still accepted; the override too.
const answer117 = w119.slice(w119.indexOf('create or replace function public.answer_daily_pick'));
assert.ok(
  answer117.includes(
    `if not found or not (
       p.position = public.daily_pick_position(p_ymd)
       or (p_ymd < date '${ALMANAC_PICK_CUTOVER}' + ${PICK_OVERLAP_DAYS} and p.position = public.daily_pick_legacy_position(p_ymd))
       or exists (select 1 from public.daily_pick_event_override o where o.ymd = p_ymd and o.pick_id = p.id)
     ) then`,
  ),
  'answer_daily_pick accepts the rotation pick, the old pick for 14 days from the cutover, or the override',
);
// The rest of answer_daily_pick is wave101's (18+ gate, today only, one a day, counts after intake).
const answer101 = read('supabase/migrations/wave101_under18_server_gate.sql').replace(/\r\n/g, '\n');
const body101 = answer101.slice(answer101.indexOf('create or replace function public.answer_daily_pick'));
const strip = (s: string) =>
  s
    .slice(0, s.indexOf('grant execute on function public.answer_daily_pick'))
    .replace(/  select \* into p from public\.daily_pick_pool where id = p_pick_id;[\s\S]*?raise exception 'not the pick for that day' using errcode = '22023';\n  end if;\n/, '<CHECK>')
    .replace(/  -- An event Pick has no trait: save the answer, move nothing\.\n[\s\S]*?\n  end if;\n\n/, '');
assert.equal(strip(answer117), strip(body101), 'answer_daily_pick is wave101\'s word for word apart from the position check and the event-Pick branch');
assert.match(answer117, /if p\.axis is null then\s+insert into public\.daily_pick_answers \(user_id, ymd, pick_id, option_index, counted\)\s+values \(uid, p_ymd, p_pick_id, p_option_index, false\);\s+return/, 'an event Pick is saved, counted false, no trait write');
assert.ok(answer117.indexOf('if p.axis is null') < answer117.indexOf('perform public._trait_write'), 'the event branch returns before any trait write');
// Overrides: global events only, the same list as the app.
const eventCheck = w117.match(/event_id text not null check \(event_id in \(([^)]*)\)\)/);
assert.ok(eventCheck, 'the override table limits event_id');
assert.deepEqual(
  eventCheck[1]!.split(',').map((s) => s.trim().replace(/'/g, '')).sort(),
  GLOBAL_PICK_EVENTS.map((e) => e.event).sort(),
  'the override table allows exactly the global events',
);
assert.match(w117, /check \(pick_id like 'ev-' \|\| event_id \|\| '-%'\)/, 'an override names its own event\'s Pick');
assert.match(w117, /alter table public\.daily_pick_event_override enable row level security;/);
assert.match(w117, /revoke insert, update, delete on public\.daily_pick_event_override from public, anon, authenticated;/, 'nobody writes overrides from the app');
// The counter: totals only, definer, safe search_path, signed in and 18+, nothing under 20.
const total = w117.slice(w117.indexOf('create function public.daily_pick_event_total'));
assert.match(total, /^create function public\.daily_pick_event_total\(p_event_id text, p_year int\)\nreturns jsonb\nlanguage plpgsql\nstable\nsecurity definer\nset search_path = public, pg_temp\n/, 'security definer, search_path = public, pg_temp');
assert.match(total, /perform public\.require_adult\(\);[^\n]*\n  if uid is null then\n    raise exception 'not authenticated' using errcode = '28000';/, '18+ and rejects a null auth.uid()');
assert.match(total, /if v_total < 20 then\s+return null;/, 'nothing under 20 answers');
assert.match(total, /return jsonb_build_object\('total', v_total\);\nend;/, 'returns one total');
assert.doesNotMatch(total.slice(0, total.indexOf('end;\n$$;')), /user_id|option_index|jsonb_agg|array_agg|'counts'|'shares'/, 'no per-user rows, no answer split');
assert.match(total, /revoke all on function public\.daily_pick_event_total\(text, int\) from public, anon;\ngrant execute on function public\.daily_pick_event_total\(text, int\) to authenticated;/, 'authenticated only');
assert.doesNotMatch(w117, /delete from|drop table|truncate|update public\.|alter table public\.(?!daily_pick_pool |daily_pick_event_override )/i, 'no data change; only the pool and the new table');
assert.match(w117, /^-- wave117_almanac\.sql \(PHASE-11d, 2026-10-28\)\. NOT APPLIED/, 'marked not applied');
ok('wave117: pool rows = app, SQL rotation = app on both sides of the cutover, 14-day overlap, global overrides, counter totals only from 20');
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
// emci 2026-10-14: the Story and the focus moved to Insights. Home is the
// check-in, the Insights link, Today's Pick, then the round ring.
const state2 = home.indexOf('STATE 2');
assert.ok(state2 > 0);
assert.ok(home.indexOf('<DailyCheckinCard', state2) < home.indexOf('testID="home-see-insights"', state2), 'Home: check-in above the Insights link');
assert.ok(home.indexOf('testID="home-see-insights"', state2) < home.indexOf('{pickBlock}', state2), 'Home: the Insights link above Today\'s Pick');
assert.ok(home.indexOf('{pickBlock}', state2) < home.indexOf('<ProgressRing value=', state2), 'Home: Today\'s Pick above the round ring');
assert.doesNotMatch(home, /SageStoryFold|styles\.sealedCard/, 'no Story or focus card on Home');
ok('no model call; share carries the question only; answers go through the checkpoint; Home order check-in → Insights → pick → round');

console.log(`\ndaily-pick-check: ${passed} passed`);
