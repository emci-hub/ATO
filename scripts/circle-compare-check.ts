/**
 * check:circle-compare — master plan Step 7b (Circle option B: per-friend opt-in compare, shareable strengths only).
 * Offline: reads wave105_circle_compare.sql and the pure rules in src/play/circle-compare.ts. The live two-account
 * test is a manual SQL routine in docs/circle-safety.md (never real accounts).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  COMPARE_PHRASES,
  COMPARE_PRIVATE_AXES,
  COMPARE_PRIVATE_LOW_AXES,
  COMPARE_UI,
  compareKeyIsShareable,
  comparePhrases,
  parseCompareCard,
  parseCompareList,
} from '../src/play/circle-compare';
import { isShareableLean } from '../src/lib/legends64/identity';
import { TRAIT_AXES } from '../src/lib/traits';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
let groups = 0;
const ok = (msg: string) => {
  groups += 1;
  console.log(`  ✓ ${msg}`);
};

const sql = read('supabase/migrations/wave105_circle_compare.sql');
const fn = (name: string): string => {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `wave105 defines ${name}`);
  return sql.slice(start, sql.indexOf('\n$$;', start));
};

/* 1 · the switch: off by default, written only by the function ------------------------------------ */
assert.match(sql, /create table if not exists public\.circle_compare_share/);
assert.match(sql, /enabled boolean not null default false/);
assert.match(sql, /alter table public\.circle_compare_share enable row level security;/);
assert.ok(!/create policy [a-z_]+ on public\.circle_compare_share\s+for (insert|update|delete)/i.test(sql), 'switch: functions only');
assert.match(sql, /revoke all on public\.circle_compare_share from public, anon, authenticated;\s*grant select on public\.circle_compare_share to authenticated;/);
ok('switch table: off by default, RLS on, select-own only, written only by set_circle_compare_share');

/* 2 · every app function 18+ gated, signed-in only; helper internal ----------------------------------- */
for (const name of ['circle_compare_allowed', 'set_circle_compare_share', 'circle_compare_friends', 'circle_compare']) {
  assert.match(fn(name), /public\.require_adult\(\);/, `${name}: require_adult`);
  assert.match(sql, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`), `${name}: not anon`);
  assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`), `${name}: granted`);
}
assert.match(sql, /revoke all on function public\._compare_strengths\(uuid\) from public, anon, authenticated;/);
ok('4 app functions: require_adult, signed-in only; _compare_strengths internal');

/* 3 · allowed = accepted + not blocked + BOTH switches, set since the friendship began --------------- */
const allowed = fn('circle_compare_allowed');
assert.match(allowed, /from public\.connections c\s+where c\.user_id = auth\.uid\(\) and c\.peer_id = p_peer/);
assert.match(allowed, /not public\._circle_blocked\(auth\.uid\(\), p_peer\)/);
assert.equal((allowed.match(/s\.enabled/g) ?? []).length, 2, 'both switches');
assert.equal((allowed.match(/s\.updated_at >= c\.created_at/g) ?? []).length, 2, 'both switches count only since the friendship began');
assert.match(fn('set_circle_compare_share'), /_circle_blocked\(uid, p_peer\)/);
assert.match(fn('circle_compare'), /if not public\.circle_compare_allowed\(p_peer\) then\s+return jsonb_build_object\('ok', false, 'reason', 'not_allowed'\);/);
ok('compare needs an accepted friend, no block, and both switches (re-adding resets them)');

/* 4 · output = keys only, no values --------------------------------------------------------------------- */
const out = fn('circle_compare');
assert.match(out, /'shared', to_jsonb\(/);
assert.match(out, /'theirs', to_jsonb\(v_theirs\[1:3\]\)/);
assert.ok(!/\bt\.value\b|trait_tracks|\bme\b|recipe|show_up|talk_style|read_text|do_text/.test(out), 'circle_compare reads no raw trait, me or checks data');
const strengths = fn('_compare_strengths');
assert.match(strengths, /t\.track = 'report'/);
assert.match(strengths, /t\.answer_count >= 3/);
assert.match(strengths, /abs\(t\.value - 0\.5\) >= 0\.15/);
assert.match(strengths, /array_agg\(s\.key /);
assert.ok(!/array_agg\([^)]*value/.test(strengths), 'the aggregate holds keys, not values');
ok('answer carries keys only; strengths need 3+ answers and a 0.15 lean on the report track');

/* 5 · private leans: SQL list == TS list, and the TS list is at least as strict as isShareableLean ------- */
const sqlAxes = (re: RegExp): string[] => {
  const m = strengths.match(re);
  assert.ok(m, `SQL has ${re}`);
  return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
};
assert.deepEqual(sqlAxes(/t\.axis not in \(([^)]*)\)/).sort(), [...COMPARE_PRIVATE_AXES].sort(), 'SQL private axes = TS');
assert.deepEqual(sqlAxes(/t\.value < 0\.5\s+and t\.axis in \(([^)]*)\)/).sort(), [...COMPARE_PRIVATE_LOW_AXES].sort(), 'SQL private lows = TS');
for (const axis of TRAIT_AXES) {
  for (const lean of ['high', 'low'] as const) {
    const key = `${axis}:${lean}`;
    const byRule = !COMPARE_PRIVATE_AXES.includes(axis) && !(lean === 'low' && COMPARE_PRIVATE_LOW_AXES.includes(axis));
    if (byRule) assert.ok(key in COMPARE_PHRASES, `${key} is shareable but has no phrase`);
    assert.equal(compareKeyIsShareable(key), byRule, `${key}`);
    if (compareKeyIsShareable(key)) assert.ok(isShareableLean(axis, lean), `${key}: compare is never looser than isShareableLean`);
  }
}
for (const key of Object.keys(COMPARE_PHRASES)) assert.ok(compareKeyIsShareable(key), `${key} phrase is for a shareable key`);
ok('private leans pinned both ways: attachment, struggle-side lows and conflict lows never shared');

/* 6 · phone-side pass / fail pairs ------------------------------------------------------------------------ */
assert.deepEqual(comparePhrases(['openness:high', 'attachment_anxiety:high', 'competence:low', 'conflict_assertiveness:low', 'nope:high', 5, null]), ['likes trying the untried option']);
assert.deepEqual(comparePhrases(['openness:high', 'openness:high']), ['likes trying the untried option'], 'no repeats');
assert.equal(comparePhrases(['openness:high', 'conscientiousness:high', 'extraversion:high', 'autonomy:high']).length, 3, 'cap 3');
assert.deepEqual(comparePhrases('openness:high'), []);
assert.deepEqual(parseCompareCard({ ok: true, shared: ['openness:high', 'attachment_avoidance:low'], theirs: ['steadiness:low', 'playfulness:high'], value: 0.9 }), {
  shared: ['likes trying the untried option'],
  theirs: ['keeps things playful'],
});
assert.equal(parseCompareCard({ ok: false, reason: 'not_allowed' }), null);
assert.equal(parseCompareCard(null), null);
const list = parseCompareList({ preview: ['openness:high', 'attachment_anxiety:high'], friends: [{ peer: '0a1b2c3d-0000-4000-8000-000000000001', mine: true, allowed: false, extra: 'x' }, { peer: 'bad' }] });
assert.deepEqual(list, { preview: ['likes trying the untried option'], friends: [{ peer: '0a1b2c3d-0000-4000-8000-000000000001', mine: true, allowed: false }] });
assert.equal(parseCompareList({ friends: 'x' }), null);
ok('phone drops private / unknown keys, repeats and extra fields; a refusal is not a card');

/* 7 · copy: names exactly what a friend sees, no numbers, no verdicts ----------------------------------------- */
for (const phrase of Object.values(COMPARE_PHRASES)) {
  assert.ok(!/\d|%|\bmore than\b|\bless than\b|\bbetter\b|\bworse\b|\bscore\b/i.test(phrase), `phrase has no number or ranking: ${phrase}`);
}
assert.match(COMPARE_UI.consent, /up to 3/);
assert.match(COMPARE_UI.consent, /strengths/);
assert.match(COMPARE_UI.consent, /both switch/);
assert.match(COMPARE_UI.consent, /No scores, no numbers/);
assert.match(COMPARE_UI.consent, /Off any time/);
ok('consent copy names what a friend sees (3 strengths + shared), says no numbers, off any time');

/* 8 · peer_profile / peer_checks stay closed; screens use the rules file ------------------------------------- */
assert.ok(!/function public\.peer_(profile|checks)\(/.test(sql), 'wave105 does not reopen peer_profile / peer_checks');
const ui = read('src/play/circle-visits-ui.tsx');
assert.match(ui, /from '@\/play\/circle-compare'/);
assert.match(ui, /COMPARE_UI\.consent/);
assert.ok(!/\bpeer_profile\b|\bpeer_checks\b/.test(read('src/play/circle-compare-store.ts')), 'no peer_* call');
ok('peer_profile / peer_checks stay closed; the sheet shows the consent text');

console.log(`\ncheck:circle-compare ok — ${groups} groups`);
