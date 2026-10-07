/**
 * "Preview as new user" (Dev Tools Hub, Testing; emci 2026-10-07).
 * Run: npm run check:preview-mode
 *
 * Runs the REAL request rules and the REAL fetch wrapper against a fake
 * network, then source checks for the wiring. The load-bearing assertions
 * (red team, 2026-10-07):
 * - nothing can write while previewing: every table write, every RPC not on
 *   the read list and every edge function is refused before it leaves the
 *   phone, and an unknown request is refused (fail closed);
 * - reads look like a new account (per-account tables come back empty, `me`
 *   without answers, tokens or milestones);
 * - preview can never be on in a public build, is never saved, and ends on an
 *   account change without writing one account's phone data onto another;
 * - when preview is off, the client's fetch is untouched.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PREVIEW_BLOCKED_CODE,
  PREVIEW_EMPTY_TABLES,
  PREVIEW_ME_OVERLAY,
  PREVIEW_READ_RPCS,
  isPreviewing,
  previewFetch,
  previewMe,
  previewRpc,
  previewRule,
  setPreviewState,
} from '../src/lib/preview-mode';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
}

const BASE = 'https://x.supabase.co';

// --- rules --------------------------------------------------------------------------
assert.deepEqual(previewRule(`${BASE}/auth/v1/token?grant_type=refresh_token`, 'POST'), { kind: 'pass' }, 'token refresh keeps working');
assert.deepEqual(previewRule(`${BASE}/auth/v1/logout`, 'POST'), { kind: 'pass' }, 'sign-out keeps working');
assert.deepEqual(previewRule(`${BASE}/auth/v1/user`, 'GET'), { kind: 'pass' });
assert.deepEqual(previewRule(`${BASE}/auth/v1/user`, 'PUT'), { kind: 'block' }, 'no password or email change on the real account');
assert.deepEqual(previewRule(`${BASE}/auth/v1/user/identities/x`, 'DELETE'), { kind: 'block' });
assert.deepEqual(previewRule(`${BASE}/functions/v1/ai-generate`, 'POST'), { kind: 'block' }, 'no AI call');
assert.deepEqual(previewRule(`${BASE}/functions/v1/delete-account`, 'POST'), { kind: 'block' });
for (const write of ['answer_intake_question', 'insert_daily_insight', 'claim_full_profile_complete', 'record_daily_line', 'answer_daily_pick', 'reset_my_account', 'serve_bank_set', 'spend_tokens', 'some_future_rpc']) {
  assert.deepEqual(previewRule(`${BASE}/rest/v1/rpc/${write}`, 'POST'), { kind: 'block' }, `${write} is refused`);
}
for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
  assert.deepEqual(previewRule(`${BASE}/rest/v1/me?id=eq.1`, method), { kind: 'block' }, `${method} on a table is refused`);
  assert.deepEqual(previewRule(`${BASE}/rest/v1/daily_line_pool`, method), { kind: 'block' });
}
assert.deepEqual(previewRule(`${BASE}/storage/v1/object/x`, 'POST'), { kind: 'block' });
assert.deepEqual(previewRule('not a url', 'GET'), { kind: 'block' }, 'unparseable means refused');
assert.deepEqual(previewRule(`${BASE}/rest/v1/rpc/my_dev_access`, 'POST'), { kind: 'pass' });
assert.deepEqual(previewRule(`${BASE}/rest/v1/rpc/home_bootstrap`, 'POST'), { kind: 'patch-rpc', name: 'home_bootstrap' });
assert.deepEqual(previewRule(`${BASE}/rest/v1/me?select=*&id=eq.1`, 'GET'), { kind: 'patch-me' });
assert.deepEqual(previewRule(`${BASE}/rest/v1/question_bank?select=*`, 'GET'), { kind: 'pass' }, 'shared content reads normally');
const narrowed = previewRule(`${BASE}/rest/v1/trait_tracks?select=axis&user_id=eq.1`, 'GET');
assert.equal(narrowed.kind, 'narrow');
assert.match((narrowed as { url: string }).url, /user_id=is\.null/, 'per-account reads match no row');
ok('rules: auth passes; table writes, non-read RPCs, edge functions and unknowns are refused; per-account reads narrowed');

const WRITE_SHAPE = /^(insert|claim|record|spend|set|reset|start|stop|answer|apply|change|undo|serve|earn|react|reveal|store|clear|stamp|complete|delete|pause|unpause|log|dev_fill|root_delete|root_pause|root_unpause|approve|deny|confirm)_?/;
for (const name of PREVIEW_READ_RPCS) {
  assert.doesNotMatch(name, WRITE_SHAPE, `${name} is on the read list but is named like a write`);
}
ok(`the read list holds ${PREVIEW_READ_RPCS.size} read-only RPCs; nothing named like a write is on it`);

for (const t of ['trait_tracks', 'trait_answers', 'ato_token_events', 'daily_insights', 'daily_pick_answers', 'daily_line_days', 'trait_profile_snapshots']) {
  assert.ok(PREVIEW_EMPTY_TABLES.has(t), `${t} reads empty while previewing`);
}
const me = previewMe([{ id: 'u', handle: 'h', ai_consent: true, openness: 0.7, ato_tokens: 42, celebrated_milestone_ids: ['x'] }]) as Record<string, unknown>[];
assert.equal(me[0]!.openness, null);
assert.equal(me[0]!.ato_tokens, 0);
assert.deepEqual(me[0]!.celebrated_milestone_ids, []);
assert.equal(me[0]!.handle, 'h', 'the account itself is unchanged');
assert.equal(me[0]!.ai_consent, true, 'consent is unchanged');
for (const key of ['ato_tokens', 'tokens', 'milestones_celebrated', 'sage_story', 'openness', 'playfulness']) {
  assert.ok(key in PREVIEW_ME_OVERLAY, `${key} reads as new`);
}
assert.deepEqual(previewRpc('bank_answered', { ids: ['q1'], fresh_starts: 2 }), { ids: [], fresh_starts: 0 });
const boot = previewRpc('home_bootstrap', { trait_tracks: [{}], checks: [{}], crisis_since: ['x'], other: 1 }) as Record<string, unknown>;
assert.deepEqual([boot.trait_tracks, boot.checks, boot.crisis_since, boot.other], [[], [], [], 1]);
ok('reads look new: me without answers, tokens or milestones (handle and consent kept); bootstrap and bank progress empty');

// --- the fetch wrapper -------------------------------------------------------------------
async function runFetch(): Promise<void> {
  const calls: string[] = [];
  const base = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
    return new Response(JSON.stringify([{ openness: 0.9, ato_tokens: 5 }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const wrapped = previewFetch(base);

  setPreviewState(false, null);
  assert.equal(isPreviewing(), false);
  await wrapped(`${BASE}/rest/v1/rpc/insert_daily_insight`, { method: 'POST' });
  assert.equal(calls.length, 1, 'preview off: the request goes out untouched');

  setPreviewState(true, 'u1');
  assert.equal(isPreviewing(), true, 'pre-launch build: preview can be on');
  const blocked = await wrapped(`${BASE}/rest/v1/rpc/insert_daily_insight`, { method: 'POST' });
  assert.equal(calls.length, 1, 'preview on: the write never leaves the phone');
  assert.equal(blocked.status, 403);
  assert.equal(((await blocked.json()) as { code: string }).code, PREVIEW_BLOCKED_CODE);
  const meRes = await wrapped(`${BASE}/rest/v1/me?select=*`, { method: 'GET' });
  const meBody = (await meRes.json()) as Record<string, unknown>[];
  assert.deepEqual([meBody[0]!.openness, meBody[0]!.ato_tokens], [null, 0], 'me reads as new');
  await wrapped(`${BASE}/rest/v1/trait_tracks?select=*`, { method: 'GET' });
  assert.match(calls[calls.length - 1]!, /user_id=is\.null/, 'per-account read narrowed');
  setPreviewState(false, null);
}

void runFetch()
  .then(() => {
    ok('fetch wrapper: off = untouched; on = writes refused locally, me rewritten, per-account reads narrowed');
    sourceChecks();
    console.log(`\n${passed} preview-mode checks passed`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

function sourceChecks(): void {
  const mode = read('src/lib/preview-mode.ts');
  assert.match(mode, /return PRE_LAUNCH_DEV && DEV_TOOLS_AVAILABLE && previewing;/, 'never on in a public build');
  assert.match(mode, /previewing = on && PRE_LAUNCH_DEV && DEV_TOOLS_AVAILABLE;/);
  assert.doesNotMatch(mode, /AsyncStorage|SecureStore|setItem/, 'the flag is never saved');
  assert.doesNotMatch(mode, /from '@\/lib\/supabase'/, 'no import loop with the client');
  assert.match(read('src/lib/supabase.ts'), /fetch: previewFetch\(\(input, init\) => fetch\(input, init\)\),/, 'every Supabase request goes through the rules');

  const session = read('src/lib/preview-session.ts');
  const start = session.slice(session.indexOf('export async function startPreview'), session.indexOf('export async function stopPreview'));
  assert.match(start, /if \(!PRE_LAUNCH_DEV \|\| !DEV_TOOLS_AVAILABLE\) throw new Error/);
  assert.match(start, /if \(!input\.isRoot\) throw new Error/, 'root only');
  assert.ok(
    start.indexOf('AsyncStorage.setItem(PREVIEW_SNAPSHOT_KEY') > 0 && start.indexOf('AsyncStorage.setItem(PREVIEW_SNAPSHOT_KEY') < start.indexOf('AsyncStorage.multiRemove(keys)'),
    'the copy is saved on the phone before anything is removed, so an app kill cannot lose it',
  );
  assert.ok(start.indexOf('if (await readSaved()) throw new Error') > 0 && start.indexOf('if (await readSaved()) throw new Error') < start.indexOf('AsyncStorage.setItem(PREVIEW_SNAPSHOT_KEY'), 'an older saved copy is never overwritten');
  assert.match(read('src/lib/local-account-data.ts'), /if \(keep\.length === 0\) await AsyncStorage\.removeItem\('ato\.preview\.snapshot\.v1'\);/, 'sign-out and deletion also drop a saved preview copy');
  assert.match(session, /PREVIEW_UNTOUCHED_PREFIXES: readonly string\[\] = \['ato\.play\.'\]/, 'the Divecore save is never touched');
  assert.match(read('src/lib/local-account-data.ts'), /'ato\.preview\.snapshot\.v1',/, 'the copy is a device-level key: no wipe or preview removes it');
  assert.doesNotMatch(session, /cancelAllScheduledPush|clearLocalAccountData/, 'preview never cancels pushes or wipes for real');
  const stop = session.slice(session.indexOf('export async function stopPreview'), session.indexOf('export function endPreviewIfAccountChanged'));
  assert.ok(stop.indexOf('await restore(') < stop.indexOf('setPreviewState(false, null)'), 'real data is back before preview turns off');
  const change = session.slice(session.indexOf('export function endPreviewIfAccountChanged'), session.indexOf('export async function recoverPreviewSnapshot'));
  assert.match(change, /if \(owner !== userId\) \{[\s\S]*?AsyncStorage\.removeItem\(PREVIEW_SNAPSHOT_KEY\)[\s\S]*?return;/, 'another account never gets the old account’s phone data');
  const recover = session.slice(session.indexOf('export async function recoverPreviewSnapshot'));
  assert.match(recover, /if \(saved\.owner !== userId\) \{\s*await AsyncStorage\.removeItem\(PREVIEW_SNAPSHOT_KEY\);\s*return;/, 'a leftover copy is restored only for its own account');
  const meCtx = read('src/lib/me-context.tsx');
  assert.match(meCtx, /endPreviewIfAccountChanged\(userId, devAccess\.isRoot\);/, 'ends on account change or loss of root');
  assert.match(meCtx, /recoverPreviewSnapshot\(userId\)/, 'a preview killed mid-way is undone on the next launch');
  const fab = read('src/components/app-dev-fab.tsx');
  assert.match(fab, /PREVIEW_HIDDEN_SECTIONS: readonly AppDevSection\[\] = \['jump', 'local-data', 'ai-consent'\]/);
  assert.match(fab, /if \(previewing && PREVIEW_HIDDEN_SECTIONS\.includes\(id\)\) return null;/, 'the DEV bubble hides its writers too');

  const push = read('src/lib/push.ts');
  const sync = push.slice(push.indexOf('export async function syncPushSchedule'));
  assert.ok(sync.indexOf('if (isPreviewing()) return;') > 0 && sync.indexOf('if (isPreviewing()) return;') < sync.indexOf('cancelScheduledNotificationAsync'), 'the real push schedule is left alone');
  const widget = read('src/lib/insight/today-insight.ts');
  assert.match(widget, /function writeWidget\(insight: CachedInsight \| null\) \{[\s\S]{0,120}isPreviewing\(\)\) return;/);
  assert.match(widget, /export function writeWidgetLine\(line: string\) \{\s*if \(Platform\.OS !== 'ios' \|\| isPreviewing\(\)\) return;/);
  assert.match(read('src/app/_layout.tsx'), /<PreviewBanner \/>/, 'the red bar is mounted over every screen');
  assert.match(read('src/components/preview-banner.tsx'), /onPress=\{\(\) => void stopPreview\(\)\}/, 'one tap on the bar exits');

  const hub = read('src/app/dev-lab.tsx');
  assert.match(hub, /\{previewing \? null : <HubTool id="jump"><JumpThisAccount \/><\/HubTool>\}/, 'no jumps while previewing');
  assert.match(hub, /\{previewing \? null : <HubTool id="bank-fill"><QuestionBankPanel \/><\/HubTool>\}/);
  assert.match(hub, /\{tools && !previewing \? \(\s*<HubSection id="danger">/, 'no Danger zone while previewing');
  const panel = hub.slice(hub.indexOf('function PreviewAsNewUser() {'), hub.indexOf('function ResetAccount() {'));
  assert.match(panel, /startPreview\(\{ userId: me\.id, isRoot: devAccess\.isRoot \}\)/);
  assert.match(panel, /\{devAccess\.isRoot \? \(/, 'only root sees the switch');
  ok('wiring: public builds can’t preview, flag never saved, root only, copy saved before clearing and recovered after a kill, Divecore untouched, account change drops the copy, pushes and widget paused, red bar, writers hidden in the Hub and the bubble');
}
