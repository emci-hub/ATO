/**
 * AI views paid in ATO tokens + the daily check-in (wave92, emci 2026-10-09).
 * Run: npm run check:ai-tokens
 *
 * Pins: the server charges inside each AI claim (after the safety cap, before
 * the call) and says 'tokens' when the balance is short; a failed call is
 * refunded once a day per feature; the check-in pays once a day (+5, every 7th
 * +10, a missed day never resets); the earn amounts; the safety caps; the
 * root-only dev reset; and in the app: every AI surface shows its price, says
 * how to earn more, refunds on failure, and the check-in sits on Home.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AI_TOKEN_PRICE, ATO_TOKEN_EARN, ATO_TOKEN_HOW_LINES, atoTokenCopyClean } from '../src/lib/ato-tokens';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const sql = read('supabase/migrations/wave92_ai_tokens.sql');
const fnBody = (name: string) => {
  const start = sql.indexOf(`create or replace function public.${name}`);
  assert.ok(start >= 0, `${name} is defined`);
  return sql.slice(start, sql.indexOf('\n$$;', start));
};

// Server: charge inside each claim.
for (const [name, kind, key] of [
  ['claim_story_generate', 'story', 'story'],
  ['claim_legend_figure_story', 'legend', 'legend_figure'],
  ['claim_category_deep_dive', 'deep_dive', 'category_deep_dive'],
] as const) {
  const body = fnBody(name);
  const capAt = body.indexOf('if used >= cap then');
  const chargeAt = body.indexOf(`public._charge_ai_tokens(uid, '${kind}')`);
  const countAt = body.indexOf(`'{${key}}'`);
  assert.ok(capAt > 0 && chargeAt > capAt && countAt > chargeAt, `${name}: safety cap, then charge, then count`);
  assert.match(body, /if balance is null then\s+return jsonb_build_object\('ok', false, 'reason', 'tokens'/, `${name}: too few tokens → no AI call`);
  assert.match(body, /pg_advisory_xact_lock\(hashtext\('ato_tokens:' \|\| uid::text\)\)/, `${name}: holds the token lock`);
  assert.ok(sql.includes(`revoke all on function public.${name}() from public, anon;`), `${name}: not for anon`);
}
const charge = fnBody('_charge_ai_tokens');
assert.match(charge, /where id = p_uid and ato_tokens >= price/, 'a charge never goes below zero');
assert.match(sql, /revoke all on function public\._charge_ai_tokens\(uuid, text\) from public, anon, authenticated;/, 'the charge is internal only');
ok('every AI claim: safety cap, then a 5-token charge under the token lock, else "tokens" and no call');

const refund = fnBody('refund_ai_tokens');
assert.match(refund, /created_at > now\(\) - interval '15 minutes'/, 'refund only right after a charge');
assert.match(refund, /on conflict \(user_id, ai_kind, local_day\) where reason = 'ai_refund' do nothing/, 'one refund a day per feature');
assert.match(sql, /create unique index if not exists ato_token_events_ai_refund_daily/);
ok('a failed AI call is refunded, at most once a day per feature, within 15 minutes');

const checkin = fnBody('claim_daily_checkin');
assert.match(checkin, /on conflict \(user_id, local_day\) where reason = 'daily_checkin' do nothing/, 'once per local day');
assert.match(checkin, /\(before_count \+ 1\) % 7 = 0 then bonus else base/, 'every 7th check-in pays the bonus; a missed day never resets');
assert.match(sql, /checkin_tokens int not null default 5/);
assert.match(sql, /checkin_week_bonus int not null default 10/);
assert.match(sql, /ai_token_price int not null default 5/);
ok('daily check-in: +5 once a day, every 7th +10, never reset by a missed day');

assert.match(sql, /set story_daily_cap = 5, legend_figure_daily_cap = 5, category_deep_dive_daily_cap = 5/, 'tokens decide; caps are a safety ceiling');
assert.match(fnBody('claim_full_profile_complete'), /amount int := 15;/, 'first 48: +15');
assert.match(fnBody('claim_ongoing_round_complete'), /amount int := 5;/, 'a set of 16: +5');
const reset = fnBody('dev_reset_ai_limits');
assert.match(reset, /root_id := public\.require_root\(\);/, 'dev reset: root only, checked on the server');
assert.match(reset, /set calls = 0, by_type = '\{\}'::jsonb/, 'clears only the AI counters');
assert.doesNotMatch(reset, /ato_tokens|delete from/, 'never touches tokens or deletes rows');
ok('earn 15 once / 5 per set; safety caps of 5; the dev reset is root-only and clears only AI counters');

// App.
assert.equal(AI_TOKEN_PRICE, 5);
assert.ok(ATO_TOKEN_HOW_LINES.some((line) => line.includes('Check in on Home')), 'You says where tokens come from');
assert.ok(ATO_TOKEN_HOW_LINES.some((line) => line.includes(`Spend: ${AI_TOKEN_PRICE}`)), 'and what they buy');
assert.equal(atoTokenCopyClean(), true);
const story = read('src/components/sage-story-fold.tsx');
assert.match(story, /await refundAiTokens\('story'\);/, 'Story: refunded when no card comes back');
assert.match(story, /claim\.reason === 'tokens'/, 'Story: too few tokens says so');
assert.match(story, /needNew && tokens < AI_TOKEN_PRICE \? \(/, 'Story: no brand-new button without the tokens');
// wave93: library stories are free; the brand-new one shows its price.
assert.match(story, /STORY_NEW_LABEL\} · \$\{AI_PRICE_LABEL\}/, 'Story: the brand-new button shows its price');
const home = read('src/app/(tabs)/index.tsx');
const state2 = home.indexOf('STATE 2');
assert.ok(home.indexOf('<DailyCheckinCard') > state2, 'the check-in is on Home after Questions are finished');
const card = read('src/components/daily-checkin-card.tsx');
assert.doesNotMatch(card, /generateText|writeLegendStory|writeCategoryDeepDive/, 'the check-in never calls a model');
assert.equal(ATO_TOKEN_EARN.daily_checkin, AI_TOKEN_PRICE);
const devLab = read('src/app/dev-lab.tsx');
const toolsStart = devLab.indexOf('{tools ? (');
const devAt = devLab.indexOf('<AiLimitsDev');
assert.ok(devAt > toolsStart && devAt < devLab.indexOf(') : null}', toolsStart), 'the dev reset sits inside the tools branch');
assert.match(read('src/components/ai-limits-dev.tsx'), /if \(!armed\) \{/, 'two taps');
ok('app: prices shown, how to earn said, refunds wired, check-in on Home, dev reset pre-launch only with two taps');

console.log(`\ncheck:ai-tokens — ${passed} groups passed.`);
