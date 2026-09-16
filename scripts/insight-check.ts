/**
 * Daily insight (T-H1) — the generator, the store, and wave69's schema.
 *
 * Source-text assertions, same convention as the wave checks: the generator's
 * import chain reaches the edge client, so importing it here would drag a
 * network-shaped module into an offline gate check.
 *
 * The load-bearing assertion in this file is the caps drift guard: the
 * per-field character caps exist twice, once in TypeScript and once as CHECK
 * constraints in the migration. If they ever disagree, the client truncates to
 * one length and the database rejects at another, which surfaces as a silent
 * failed insert rather than a visible error.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function read(rel: string): string {
  return readFileSync(rel, 'utf8');
}

const gen = read('src/lib/insight/generate-insight.ts');
const store = read('src/lib/insight/store.ts');
const migration = read('supabase/migrations/wave69_daily_insights.sql');
const callSites = read('src/lib/ai/call-sites.ts');

// --- copy discipline -------------------------------------------------------
// INVARIANT. The insight describes the user to themselves — `reflection` and
// `watchFor` are diagnosis-adjacent. It is not shippable as reviewed without
// emci's direct read, same lane as Story and Levity.
assert.match(gen, /export const DAILY_INSIGHT_COPY_REVIEWED = false;/);
ok('DAILY_INSIGHT_COPY_REVIEWED is false — insight copy is unreviewed');

// INVARIANT. The framework fence runs on every one of the five fields, not
// just the prose ones: a framework term in `theme` reaches Home exactly like
// one in `reflection`.
assert.match(gen, /import \{ containsFrameworkTerm \}/);
assert.match(gen, /if \(containsFrameworkTerm\(trimmed\)\) return null;/);
for (const field of ['theme', 'title', 'reflection', 'tryToday', 'watchFor']) {
  assert.match(
    gen,
    new RegExp(`const ${field} = cleanField\\(parsed\\.${field}, INSIGHT_FIELD_CAPS\\.${field}\\)`),
    `${field} must go through cleanField, which is where the fence and the cap are applied`,
  );
}
ok('all five fields run through the framework fence and a length cap');

// A partial insight would render as a broken card and there is no sensible
// per-field fallback, so the parser is all-or-nothing.
assert.match(gen, /if \(!theme \|\| !title \|\| !reflection \|\| !tryToday \|\| !watchFor\) return null;/);
ok('parseDailyInsight returns null unless all five fields survive validation');

assert.match(gen, /\$\{VOICE_REFERENCE\}/);
assert.match(gen, /\$\{STYLE_BLOCK\}/);
ok('prompt carries the voice reference and the style block');

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

  const sqlCap: string | undefined = new RegExp(
    `char_length\\(${sqlColumn}\\) > 0 and char_length\\(${sqlColumn}\\) <= (\\d+)`,
  ).exec(migration)?.[1];
  assert.ok(sqlCap, `${sqlColumn} must have a CHECK constraint in wave69`);

  assert.equal(
    tsCap,
    sqlCap,
    `${tsField}: TypeScript caps at ${tsCap} but wave69 caps at ${sqlCap} — the client would truncate to one length and the database reject at another`,
  );

  // The RPC re-truncates server-side, so a direct call cannot get past the cap.
  assert.match(
    migration,
    new RegExp(`left\\(btrim\\(p_${sqlColumn}\\), ${sqlCap}\\)`),
    `insert_daily_insight must truncate ${sqlColumn} to its own cap`,
  );
}
ok('per-field caps agree across generate-insight.ts, the CHECK constraints, and the RPC');

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

// --- call-site metadata ----------------------------------------------------
// INVARIANT. check:ai fails when a generateText call site has no declared
// metadata; this pins the declaration to the registry as well as the const.
assert.match(callSites, /export const DAILY_INSIGHT_META: AiCallMetadata = \{/);
assert.match(callSites, /feature: 'Daily insight',/);
assert.match(callSites, /meta: DAILY_INSIGHT_META,/);
assert.match(gen, /import \{ DAILY_INSIGHT_META \} from '@\/lib\/ai\/call-sites';/);
assert.match(gen, /\}, DAILY_INSIGHT_META\);/);
ok('DAILY_INSIGHT_META is declared, registered in AI_CALL_SITES, and passed to generateText');

console.log(`\n${passed} insight checks passed`);
