/**
 * Daily insight (T-H1) — the stored shape, the store, and wave69's schema.
 * The AI writer was removed in roadmap A5 (2026-10-23); the shape and caps live in
 * src/lib/insight/draft.ts.
 *
 * Source-text assertions, same convention as the wave checks.
 *
 * The load-bearing assertion in this file is the caps drift guard: the
 * per-field character caps exist twice, once in TypeScript and once as CHECK
 * constraints in the migration. If they ever disagree, the client truncates to
 * one length and the database rejects at another, which surfaces as a silent
 * failed insert rather than a visible error.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function read(rel: string): string {
  return readFileSync(rel, 'utf8');
}

const gen = read('src/lib/insight/draft.ts');
const store = read('src/lib/insight/store.ts');
const migration = read('supabase/migrations/wave69_daily_insights.sql');
// wave87 (emci 2026-10-07) raised the title cap to 120 for the stored focus
// sentences and restated insert_daily_insight. For each cap, the latest
// migration that sets it is the one the database runs.
const wave87 = read('supabase/migrations/wave87_insight_title_120.sql');
const CAP_SOURCES: readonly (readonly [string, string])[] = [
  ['wave87', wave87],
  ['wave69', migration],
];

// --- the AI writer is gone (roadmap A5) -----------------------------------
// The framework fence, the all-or-nothing parser and the prompt belonged to the AI writer, which no
// longer exists: the daily insight is a hand-written bank pick (src/lib/insight-bank/, pinned by
// check:insight-bank, which also keeps the stored copy through the clear-voice rules).
assert.ok(!existsSync('src/lib/insight/generate-insight.ts'), 'the AI daily-insight writer stays deleted');
assert.doesNotMatch(
  gen.replace(/\/\*[\s\S]*?\*\//g, ''),
  /generateText|buildDailyInsightPrompt|parseDailyInsight|DAILY_INSIGHT_COPY_REVIEWED/,
  'draft.ts code is only the shape and the caps (its header comment names what was removed)',
);
ok('the AI daily-insight writer and its stale review flag are gone');

// --- caps drift guard ------------------------------------------------------
const capsBlock: string | undefined = /INSIGHT_FIELD_CAPS = \{([\s\S]*?)\} as const;/.exec(gen)?.[1];
assert.ok(capsBlock, 'INSIGHT_FIELD_CAPS block must be parseable');

const SQL_COLUMN: Record<string, string> = {
  theme: 'theme',
  title: 'title',
  reflection: 'reflection',
  tryToday: 'try_today',
  watchFor: 'watch_for',
};

for (const [tsField, sqlColumn] of Object.entries(SQL_COLUMN)) {
  const tsCap: string | undefined = new RegExp(`${tsField}:\\s*(\\d+)`).exec(capsBlock)?.[1];
  assert.ok(tsCap, `${tsField} must have a cap in INSIGHT_FIELD_CAPS`);

  const capRe = new RegExp(
    `char_length\\(${sqlColumn}\\) > 0 and char_length\\(${sqlColumn}\\) <= (\\d+)`,
  );
  const capHit = CAP_SOURCES.map(([name, sql]) => [name, capRe.exec(sql)?.[1]] as const).find(([, cap]) => cap);
  const sqlCap: string | undefined = capHit?.[1];
  assert.ok(sqlCap, `${sqlColumn} must have a CHECK constraint in wave69 or wave87`);

  assert.equal(
    tsCap,
    sqlCap,
    `${tsField}: TypeScript caps at ${tsCap} but ${capHit?.[0]} caps at ${sqlCap} — the client would truncate to one length and the database reject at another`,
  );

  // The RPC re-truncates server-side, so a direct call cannot get past the cap.
  // wave87 restates the whole function, so every field's truncation is read there.
  assert.match(
    wave87,
    new RegExp(`left\\(btrim\\(p_${sqlColumn}\\), ${sqlCap}\\)`),
    `insert_daily_insight must truncate ${sqlColumn} to its own cap`,
  );
}
ok('per-field caps agree across draft.ts, the CHECK constraints, and the RPC');

// wave87 changes only the title cap, restates the RPC with the same guards,
// and adds no policy (emci approved the cap, not a data change).
assert.match(wave87, /drop constraint if exists daily_insights_title_check;/);
assert.match(
  wave87,
  /add constraint daily_insights_title_check\s*\n\s*check \(char_length\(title\) > 0 and char_length\(title\) <= 120\);/,
);
assert.match(wave87, /create or replace function public\.insert_daily_insight\(/);
assert.match(wave87, /security definer/);
assert.match(wave87, /uid uuid := auth\.uid\(\);/);
assert.match(wave87, /raise exception 'not authenticated'/);
assert.match(wave87, /revoke all on function public\.insert_daily_insight[^;]*from public, anon;/);
assert.doesNotMatch(wave87, /create policy|for (insert|update|delete)/);
ok('wave87 raises only the title cap to 120 and restates the guarded RPC, with no new policy');

// --- schema ----------------------------------------------------------------
// INVARIANT. Owner-only read, and deliberately no peer-visible view — unlike
// checks.read_text, an insight is never shown to the Circle.
assert.match(migration, /alter table public\.daily_insights enable row level security;/);
assert.match(
  migration,
  /create policy daily_insights_select_own on public\.daily_insights\s*\n\s*for select using \(auth\.uid\(\) = user_id\);/,
);
// No view over this table, and exactly one policy — a peer surface would have
// to arrive as one or the other, so both are pinned rather than the wording.
assert.doesNotMatch(migration, /create (or replace )?view/i);
assert.equal(
  (migration.match(/create policy/g) ?? []).length,
  1,
  'daily_insights must carry exactly one policy — the owner-only select',
);
ok('daily_insights is RLS-enabled, owner-only select, with no view or second policy');

// "One live insight per user per day" is a database fact, not a client
// convention. Superseded rows are exempt so history accumulates underneath it.
assert.match(
  migration,
  /create unique index daily_insights_user_ymd_current_idx\s*\n\s*on public\.daily_insights \(user_id, ymd\)\s*\n\s*where superseded_at is null;/,
);
ok('a partial unique index enforces one live insight per (user, ymd)');

// There is no insert/update/delete policy: every write goes through the RPC,
// so the supersede step and the insert can never come apart.
assert.doesNotMatch(migration, /for (insert|update|delete)/);
assert.match(migration, /create or replace function public\.insert_daily_insight\(/);
assert.match(migration, /security definer/);
assert.match(migration, /uid uuid := auth\.uid\(\);/);
assert.match(migration, /raise exception 'not authenticated'/);
assert.match(
  migration,
  /update public\.daily_insights\s*\n\s*set superseded_at = timezone\('utc', now\(\)\)\s*\n\s*where user_id = uid and ymd = p_ymd and superseded_at is null;/,
);
ok('insert_daily_insight supersedes then inserts, scoped to auth.uid(), with no write policy beside it');

assert.match(migration, /revoke all on function public\.insert_daily_insight/);
assert.match(migration, /grant execute on function public\.insert_daily_insight/);
ok('insert_daily_insight is revoked from public/anon and granted only to authenticated');

// --- store -----------------------------------------------------------------
// The store must not reach the table directly for writes, or it would bypass
// the supersede step and trip the partial unique index instead.
assert.match(store, /supabase\.rpc\('insert_daily_insight'/);
assert.doesNotMatch(store, /\.from\('daily_insights'\)[\s\S]{0,120}?\.(insert|update|upsert|delete)\(/);
ok('store writes only through insert_daily_insight, never a direct table write');

assert.match(store, /export async function fetchTodayInsight/);
assert.match(store, /export async function saveInsight/);
assert.match(store, /export async function fetchInsightHistory/);
assert.match(store, /\.is\('superseded_at', null\)/);
ok('store exposes fetchTodayInsight / saveInsight / fetchInsightHistory, reading the live row only');

// --- no AI writer any more ------------------------------------------------
// The AI daily-insight writer was removed on 2026-10-14 (Insights is template-only) and its file in A5.
assert.ok(!existsSync('src/lib/ai/call-sites.ts'), 'there is no call-site registry any more');
assert.doesNotMatch(store, /generateText|generateDailyInsight/);
ok('the AI daily-insight writer is gone: no call-site registry, no model call in the store');

console.log(`\n${passed} insight checks passed`);
