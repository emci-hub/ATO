/**
 * Circle chat (master plan Step 14, Circle option C, wave108): end-to-end encrypted 1:1 chat.
 *
 * Pins:
 *   - the phone never sends message text to the server, except the reporter's own copy in a report;
 *   - wave108: friends-only + block check on every read/send, 18+, rate limits, no client insert path,
 *     30-day retention cron, report = reported message + up to 5 before (ids checked on the server),
 *     the warn -> chat off -> ban ladder is root only, every chat table is in the delete proof;
 *   - the chat filter (pass/fail pairs: slurs and explicit sexual words only; swearing passes);
 *   - reportContext (the message + 5 before, only lines this phone could open, never my own);
 *   - the 1.1 store build: libsodium pinned + its unpack script allowed, runtime 1.1.0,
 *     ITSAppUsesNonExemptEncryption true, and the store pack + privacy labels describe chat.
 * Run: npm run check:circle-chat
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { chatFlag } from '../src/lib/chat/chat-filter';
import { CHAT_REPORT_CONTEXT_BEFORE, CHAT_RETENTION_DAYS, CHAT_UI, reportContext, type ChatLine } from '../src/lib/chat/chat-rules';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');
const stripSql = (s: string) => s.replace(/--[^\n]*/g, '');

const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  allowScripts?: Record<string, boolean>;
};
assert.equal(pkg.scripts['check:circle-chat'], 'tsx ./scripts/circle-chat-check.ts');
ok('wired as check:circle-chat');

// --- the store build ------------------------------------------------------------------------------
{
  assert.equal(pkg.dependencies['react-native-libsodium'], '1.7.0', 'libsodium pinned exactly');
  assert.equal(pkg.allowScripts?.['react-native-libsodium@1.7.0'], true, 'its unpack script is allowed (the native build needs it)');
  const app = JSON.parse(read('app.json')) as { expo: { version: string; runtimeVersion: string; plugins: unknown[]; ios: { infoPlist?: Record<string, unknown> } } };
  assert.equal(app.expo.runtimeVersion, '1.1.0', 'new native module = new runtime: 1.0 phones never get chat code over OTA');
  assert.equal(app.expo.version, '1.1.0');
  assert.ok(app.expo.plugins.includes('react-native-libsodium'), 'config plugin listed');
  // 2026-10-21: `true` with no compliance code was rejected by Apple (90592). The key is left OUT on purpose, so App Store
  // Connect asks the export questions for each build (see app-store-pack §9 update); never set it to a claim we cannot back.
  assert.equal(app.expo.ios.infoPlist?.ITSAppUsesNonExemptEncryption, undefined, 'encryption key omitted: ASC asks per build');
  ok('1.1 build: libsodium 1.7.0 + allowed script, runtime 1.1.0, plugin, ITSAppUsesNonExemptEncryption omitted');
}

// --- no plain text leaves the phone ----------------------------------------------------------------
{
  const store = read('src/lib/chat/chat-store.ts');
  const sendCall = store.slice(store.indexOf("'chat_send'"), store.indexOf("'chat_send'") + 200);
  assert.doesNotMatch(sendCall, /\bp_text\b|[\s{,]text:/, 'chat_send carries ciphertext only');
  assert.match('{ p_text: x }', /\bp_text\b|[\s{,]text:/, 'pair: a plain-text arg is caught');
  assert.match(sendCall, /p_ciphertext: row\.ciphertext, p_nonce: row\.nonce, p_sender_key: row\.senderKey, p_recipient_key: row\.recipientKey/);
  const screen = read('src/app/chat.tsx');
  assert.doesNotMatch(screen, /\.from\('chat_messages'\)|\.insert\(/, 'the screen never writes a table directly');
  assert.match(screen, /sealFor\(text, key, keys\)/, 'the screen seals before sending');
  const crypto = read('src/lib/chat/chat-crypto.ts');
  assert.match(crypto, /AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/, 'the secret key stays in this device’s Keychain');
  assert.doesNotMatch(store, /secretKey/, 'the secret key never reaches the I/O module');
  ok('only ciphertext + public keys are sent; the secret key stays in the Keychain');
}

// --- wave108 ----------------------------------------------------------------------------------------
{
  const sql = stripSql(read('supabase/migrations/wave108_circle_chat.sql'));
  const fn = (name: string) => {
    const s = sql.indexOf(`create or replace function public.${name}(`);
    assert.ok(s >= 0, `${name} defined`);
    return sql.slice(s, sql.indexOf('$$;', sql.indexOf('as $$', s)));
  };
  for (const name of ['chat_set_key', 'chat_peer_key', 'chat_send', 'chat_thread', 'chat_report']) {
    assert.match(fn(name), /perform public\.require_adult\(\);/, `${name}: 18+`);
    assert.match(fn(name), /security definer\s*set search_path = public/, `${name}: definer with a fixed path`);
  }
  for (const name of ['chat_peer_key', 'chat_send', 'chat_thread']) {
    assert.match(fn(name), /if not public\._chat_allowed\(uid, p_peer\) then/, `${name}: accepted friends, not blocked`);
  }
  assert.match(fn('_chat_allowed'), /from public\.connections[\s\S]*not public\._circle_blocked\(p_a, p_b\)/);
  assert.match(sql, /revoke all on function public\._chat_allowed\(uuid, uuid\) from public, anon, authenticated;/);
  assert.match(fn('chat_send'), /_chat_level\(uid\) in \('chat_off', 'banned'\)/, 'chat off and ban stop sending');
  assert.match(fn('chat_send'), /_rate_limit_caller\('chat_send', 200, 3600\)/);
  assert.match(fn('chat_send'), /'key_changed'/, 'stale keys are refused, not stored');
  assert.match(fn('chat_report'), /_rate_limit_caller\('chat_report', 10, 86400\)/);
  assert.match(fn('chat_report'), /jsonb_array_length\(p_messages\) not between 1 and 6/, 'reported + up to 5 before');
  assert.match(fn('chat_report'), /m\.sender_id = p_peer and m\.recipient_id = uid/, 'only a message the friend sent can be reported');
  assert.match(fn('chat_report'), /<> cardinality\(v_ids\)/, 'every context id is a real message between the two');
  assert.match(fn('admin_chat_restrict'), /root_id := public\.require_root\(\);/, 'the ladder is root only');
  assert.match(sql, /level text not null check \(level in \('warned', 'chat_off', 'banned'\)\)/);
  // No client write path to the message table; reads are the two people only.
  assert.doesNotMatch(sql, /create policy \w+ on public\.chat_messages\s+for (insert|update|delete|all)/);
  assert.match(sql, /create policy chat_messages_select_parties on public\.chat_messages\s+for select using \(auth\.uid\(\) = sender_id or auth\.uid\(\) = recipient_id\);/);
  assert.match(sql, /alter table public\.chat_keys enable row level security;/);
  assert.match(sql, /alter table public\.chat_restrictions enable row level security;/);
  assert.match(sql, /if not exists \([\s\S]*?pg_publication_tables[\s\S]*?alter publication supabase_realtime add table public\.chat_messages;/, 'realtime add is re-runnable');
  assert.match(sql, /create policy reports_insert_no_context on public\.reports\s+as restrictive for insert to authenticated\s+with check \(context is null\);/, 'only chat_report writes report context (no forged chat reports)');
  assert.match(fn('chat_report'), /jsonb_typeof\(v_item -> 'text'\) is distinct from 'string'/, 'a missing text key is refused, not NULL-passed');
  // 30 days, daily.
  assert.match(fn('purge_old_chat_messages'), new RegExp(`created_at < now\\(\\) - interval '${CHAT_RETENTION_DAYS} days'`));
  assert.match(sql, /'chat-retention-30d',\s*'23 4 \* \* \*'/);
  assert.match(sql, /revoke all on function public\.purge_old_chat_messages\(\) from public, anon, authenticated;/);
  assert.match(sql, /alter table public\.reports add column if not exists context jsonb;/);
  assert.match(sql, /nonce text not null check \(nonce ~ '\^\[A-Za-z0-9_\+\/=-\]\{32\}\$'\)/, 'nonce = 24 bytes base64');
  ok('wave108: 18+, friends + block on every read/send, root-only ladder, rate limits, read-only table, 30-day cron');
}

// --- filter: pass/fail pairs -------------------------------------------------------------------------
{
  const flagged: [string, 'slur' | 'sexual'][] = [
    ['you absolute f4ggot', 'slur'],
    ['shut up retard', 'slur'],
    ['send nudes', 'sexual'],
    ['want a dick pic', 'sexual'],
    ['NUDES now', 'sexual'],
  ];
  const clean = [
    'what the fuck, that was hilarious',
    'I snigger every time',
    'we watched a Hitler documentary',
    'graduated summa cum laude',
    'this shit is so good',
    'the nazi party rose in 1933',
    'my cat is a menace',
    '',
  ];
  for (const [text, why] of flagged) assert.equal(chatFlag(text), why, `flags: ${text}`);
  for (const text of clean) assert.equal(chatFlag(text), null, `passes: ${text}`);
  ok(`chat filter: ${flagged.length} flagged, ${clean.length} pass (swearing, history and "cum laude" pass)`);
}

// --- reportContext -----------------------------------------------------------------------------------
{
  const line = (i: number, mine: boolean, text: string | null = `m${i}`): ChatLine => ({ id: `id${i}`, mine, text, at: `2026-10-21T00:00:${String(i).padStart(2, '0')}Z` });
  const lines = [line(0, false), line(1, true), line(2, false, null), line(3, true), line(4, false), line(5, true), line(6, false), line(7, false)];
  const ctx = reportContext(lines, 'id7')!;
  assert.equal(CHAT_REPORT_CONTEXT_BEFORE, 5);
  assert.deepEqual(ctx.map((l) => l.id), ['id3', 'id4', 'id5', 'id6', 'id7'], 'the 5 before (one unreadable dropped) + the reported one');
  assert.equal(ctx[ctx.length - 1]!.id, 'id7');
  assert.equal(reportContext(lines, 'id5'), null, 'my own message is not reportable');
  assert.equal(reportContext(lines, 'id2'), null, 'an unreadable message is not reportable');
  assert.equal(reportContext(lines, 'nope'), null);
  assert.ok(reportContext([line(0, false, 'x'.repeat(3000))], 'id0')![0]!.text.length <= 2000, 'capped at the server limit');
  ok('reportContext: reported + up to 5 before, readable only, never my own');
}

// --- disclosure --------------------------------------------------------------------------------------
{
  assert.match(CHAT_UI.privacyLine, /30 days/);
  assert.match(CHAT_UI.privacyLine, /5 before/);
  const pack = read('docs/app-store-pack.md');
  assert.match(pack, /\| Export compliance \| `ITSAppUsesNonExemptEncryption = false` \| key left out of `app.json`/);
  assert.match(pack, /\| Messaging \/ chat between users \| No \| Yes \|/);
  assert.match(pack, /add \*\*Emails or Text Messages\*\*/);
  const labels = read('src/app/legal/app-privacy-labels.md');
  assert.match(labels, /reported (chat )?messages?/i, 'labels name reported chat messages');
  ok('chat screen, store pack and privacy labels describe chat, retention and reports');
}

console.log(`\n${passed} circle-chat checks passed`);
