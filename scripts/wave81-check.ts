/**
 * wave81: at most 2 paid rounds per local day (emci 2026-10-03: "cap 2").
 * Run: npm run check:wave81
 *
 * A round's questions are created by the phone, so without a cap someone
 * sending their own requests could make and finish fake rounds for unlimited
 * tokens. Proves the server cap, its race-safety and idempotency, and that the
 * app says why a capped round paid nothing (never "+21").
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ATO_TOKEN_EARN, ROUND_PAYOUTS_PER_DAY } from '../src/lib/ato-tokens';
import { roundCompleteBody } from '../src/lib/questions/progressive-unlock';
import { roundCapLine } from '../src/lib/questions/staged-intake-copy';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
}

const sql = read('supabase/migrations/wave81_round_payout_cap.sql');
assert.match(sql, /^-- APPLIED 2026-10-03/m);
assert.equal(ROUND_PAYOUTS_PER_DAY, 2);
const lockAt = sql.indexOf("perform pg_advisory_xact_lock(hashtext('ato_tokens:' || uid::text));");
const capAt = sql.indexOf('if v_paid_today >= 2 and not exists (');
const insertAt = sql.indexOf('insert into public.ato_token_events');
assert.ok(lockAt > 0 && capAt > lockAt && insertAt > capAt, 'the cap is checked under the lock, before the insert');
assert.match(sql, /where user_id = uid and reason = 'ongoing_round_complete' and local_day = today;/);
assert.match(sql, /raise exception 'daily round payout cap reached' using errcode = 'P0042';/);
assert.match(sql, /and pack_id = p_pack_id\s*\) then/, 'a pack already paid still answers `already`, never the cap error');
// Everything else from wave78 is unchanged.
assert.match(sql, /if v_total_items < 16 then/);
assert.match(sql, /where pack_id = p_pack_id and answered_option is null;/);
assert.match(sql, /on conflict \(user_id, pack_id\) where reason = 'ongoing_round_complete' do nothing/);
ok('server: 2 paid rounds per local day, checked under the token lock, idempotent for a paid pack; wave78 rules unchanged');

const server = read('src/lib/ato-tokens-server.ts');
assert.match(server, /export const ROUND_PAYOUT_CAP_ERRCODE = 'P0042';/);
assert.match(server, /const capped = \(err as \{ code\?: unknown \} \| null\)\?\.code === ROUND_PAYOUT_CAP_ERRCODE;/);
assert.match(server, /onSettled\?\.\(\{ paid: false, fresh: false, capped \}\);/);
assert.match(read('src/components/questions-fold.tsx'), /body: roundCompleteBody\(tracks, paid, capped\),/);
ok('app: a capped claim is recognised and passed to the round message');

const capped = roundCompleteBody([], false, true);
assert.ok(capped.startsWith(roundCapLine(ROUND_PAYOUTS_PER_DAY)));
assert.doesNotMatch(capped, new RegExp(`\\+${ATO_TOKEN_EARN.ongoing_round_complete}`), 'a capped round never names the +21');
assert.match(roundCapLine(2), /today's two\./);
assert.ok(!containsFrameworkTerm(roundCapLine(2)));
assert.doesNotMatch(roundCompleteBody([], false, false), /No tokens/, 'an ordinary unpaid round stays silent about tokens');
ok('a capped round says "No tokens for this one — you\'ve earned today\'s two." and never "+21"');

console.log(`\n${passed} wave81 checks passed`);
