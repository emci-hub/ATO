/**
 * Self-reported age / date-of-birth checks (Stage 2 ME box).
 * Run: npx tsx scripts/age-check.ts
 *
 * Client-visible path: the same helpers onboarding.tsx uses to show an inline
 * error before createMe. Live 18+ storage is verified in SQL against the
 * project after this file's helpers pass (minimum age 18 since 2026-10-19;
 * server side lives in wave99b_min_age_18.sql, checked below as text).
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import {
  AGE_INVALID_MESSAGE,
  AGE_REQUIRED_MESSAGE,
  MIN_APP_AGE_YEARS,
  NIGHT_GOING_AGE_YEARS,
  UNDER_18_MESSAGE,
  accessDateFor,
  ageGateFor,
  errorMessageForAge,
  formatDateForLocale,
  getLocalAgeEntry,
  isBlockedForAge,
  isReadableBornOn,
  localAgeEntryFor,
  resolveAgeGate,
  setLocalAgeEntry,
  subscribeLocalAgeEntry,
  bornOnFromParts,
  isAtLeastAge,
  signupAgeMessage,
} from '../src/lib/age';

let passed = 0;
function ok(label: string, detail?: unknown) {
  passed += 1;
  console.log(`  \u2713 ${label}${detail === undefined ? '' : ` \u2014 ${JSON.stringify(detail)}`}`);
}

function shiftYears(years: number, today = new Date()): { y: string; m: string; d: string; iso: string } {
  const t = new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
  const y = t.getFullYear();
  const m = t.getMonth() + 1;
  const d = t.getDate();
  return {
    y: String(y),
    m: String(m),
    d: String(d),
    iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  };
}

function main() {
  assert.equal(MIN_APP_AGE_YEARS, 18);
  assert.equal(NIGHT_GOING_AGE_YEARS, 18);
  assert.equal(UNDER_18_MESSAGE, 'ATO is for people 18 and older.');
  ok('thresholds are 18 (app) and 18 (going)');

  for (const e of [{ code: 'P0005' }, { message: 'age_under_16' }, { message: 'age_under_18' }]) {
    assert.equal(errorMessageForAge(e), UNDER_18_MESSAGE);
  }
  ok('server age errors (P0005, old age_under_16, new age_under_18) map to the 18+ message');

  assert.deepEqual(bornOnFromParts('', '', ''), { ok: false, message: AGE_REQUIRED_MESSAGE });
  assert.deepEqual(bornOnFromParts('2010', '13', '01'), { ok: false, message: AGE_INVALID_MESSAGE });
  assert.deepEqual(bornOnFromParts('2010', '02', '30'), { ok: false, message: AGE_INVALID_MESSAGE });
  ok('empty / impossible dates fail with an inline message, not a throw');

  const under = shiftYears(15);
  const parsedUnder = bornOnFromParts(under.y, under.m, under.d);
  assert.equal(parsedUnder.ok, true);
  if (!parsedUnder.ok) throw new Error('expected parse');
  assert.equal(signupAgeMessage(parsedUnder.bornOn), UNDER_18_MESSAGE);
  assert.equal(isAtLeastAge(parsedUnder.bornOn, MIN_APP_AGE_YEARS), false);
  ok('under-16 parse succeeds and signup is blocked with the inline 18+ message', {
    bornOn: parsedUnder.bornOn,
    message: UNDER_18_MESSAGE,
  });

  for (const years of [16, 17]) {
    const t = shiftYears(years);
    const parsed = bornOnFromParts(t.y, t.m, t.d);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) throw new Error('expected parse');
    assert.equal(signupAgeMessage(parsed.bornOn), UNDER_18_MESSAGE);
    assert.equal(isAtLeastAge(parsed.bornOn, MIN_APP_AGE_YEARS), false);
    assert.equal(isAtLeastAge(parsed.bornOn, NIGHT_GOING_AGE_YEARS), false);
  }
  ok('16- and 17-year-olds are blocked at signup with the 18+ message');

  const adult = shiftYears(18);
  const parsed18 = bornOnFromParts(adult.y, adult.m, adult.d);
  assert.equal(parsed18.ok, true);
  if (!parsed18.ok) throw new Error('expected parse');
  assert.equal(signupAgeMessage(parsed18.bornOn), null);
  assert.equal(isAtLeastAge(adult.iso, MIN_APP_AGE_YEARS), true);
  assert.equal(isAtLeastAge(adult.iso, NIGHT_GOING_AGE_YEARS), true);
  ok('exactly-18 signup is allowed; 18+ recomputes true from the same date field (no boolean baked at signup)');

  const mig = readFileSync(resolve(__dirname, '../supabase/migrations/wave99b_min_age_18.sql'), 'utf8');
  const signupFn = mig.slice(mig.indexOf('function public.complete_signup'), mig.indexOf('function public.me_born_on_guard'));
  const guardFn = mig.slice(mig.indexOf('function public.me_born_on_guard'));
  assert.ok(signupFn.length > 100 && guardFn.length > 100, 'both functions are in the migration');
  assert.match(signupFn, /is_at_least_age\(p_born_on, 18\)/);
  assert.match(signupFn, /'age_under_18'/);
  assert.match(guardFn, /is_at_least_age\(new\.born_on, 18\)/);
  assert.match(guardFn, /'age_under_18'/);
  for (const sql of [signupFn, guardFn]) {
    assert.doesNotMatch(sql, /is_at_least_age\([^)]*, 16\)/);
    assert.doesNotMatch(sql, /age_under_16/);
  }
  assert.equal((guardFn.match(/is_at_least_age\(new\.born_on, 18\)/g) ?? []).length, 2, 'guard checks on insert and on birthday change');
  ok('wave99b migration: complete_signup and me_born_on_guard both require 18 and raise age_under_18');

  const onboarding = readFileSync(resolve(__dirname, '../src/app/onboarding.tsx'), 'utf8');
  assert.match(onboarding, /bornOnFromParts/);
  assert.match(onboarding, /signupAgeMessage/);
  assert.match(onboarding, /setAgeError/);
  assert.match(onboarding, /UNDER_18_MESSAGE/);
  assert.match(onboarding, /When were you born/);
  ok('onboarding shows the age error on the field, not only a generic form error');

  const me = readFileSync(resolve(__dirname, '../src/lib/me.ts'), 'utf8');
  assert.match(me, /p_born_on: profile\.born_on/);
  assert.match(me, /born_on: string \| null/);
  ok('createMe sends born_on through complete_signup; ME stores the date');

  // Parked 2026-09-15 (Card F), RESTORED 2026-10-04 (emci): the birthday row is
  // back on You inside an Account fold, with its confirm-before-change flow and
  // the 18+ re-check asserted below.
  const you = readFileSync(resolve(__dirname, '../src/app/settings.tsx'), 'utf8');
  assert.ok(you.indexOf('<SettingsFold title="Account">') >= 0, 'the Account fold is on Settings');
  assert.match(you, /<BirthdayRow me=\{me\} onUpdated=\{\(\) => refresh\(\)\} \/>/, 'the birthday row is mounted with a refresh');
  ok('Settings has the Account fold with the birthday editor');

  const birthdayRow = readFileSync(resolve(__dirname, '../src/components/birthday-row.tsx'), 'utf8');
  const bornOnFields = readFileSync(resolve(__dirname, '../src/components/born-on-fields.tsx'), 'utf8');
  assert.match(birthdayRow, /Birthday/);
  assert.match(birthdayRow, /edit/);
  assert.match(birthdayRow, /Are you sure you want to change your birthday\?/);
  assert.match(birthdayRow, /NULL_CHIP = '—'/);
  assert.match(birthdayRow, /bornOnFromParts/);
  assert.match(birthdayRow, /signupAgeMessage/);
  assert.match(birthdayRow, /setBornOn/);
  assert.match(birthdayRow, /BornOnFields/);
  assert.match(onboarding, /BornOnFields/);
  assert.match(bornOnFields, /placeholder="YYYY"/);
  ok('Birthday row reuses onboarding BornOnFields; null uses the intake em dash; set dates confirm before edit');

  const setBornOnFn = me.slice(
    me.indexOf('export async function setBornOn'),
    me.indexOf('export async function setCity'),
  );
  assert.match(setBornOnFn, /bornOnFromParts/);
  assert.match(setBornOnFn, /signupAgeMessage/);
  assert.doesNotMatch(setBornOnFn, /NIGHT_GOING_AGE_YEARS/);
  assert.equal(signupAgeMessage(parsedUnder.bornOn), UNDER_18_MESSAGE);
  ok('setBornOn re-runs the same onboarding 18+ check; underage dates stay blocked');

  // Around is parked (docs/ISOLATION_PLAN.md Card 2) — the going toggle and its
  // 18+ gate no longer live in the screen. The threshold itself (isAtLeastAge /
  // NIGHT_GOING_AGE_YEARS, asserted above) is untouched and will re-gate the
  // rebuilt screen the same way; this just confirms the parked screen doesn't
  // carry a stale, unexercised copy of that logic.
  const around = readFileSync(resolve(__dirname, '../src/app/(tabs)/around.tsx'), 'utf8');
  assert.doesNotMatch(around, /isAtLeastAge\(me\.born_on, NIGHT_GOING_AGE_YEARS\)/);
  ok('Around is parked — the going 18+ gate is disconnected, not duplicated, on the placeholder');

  under18AccessBlock(parsedUnder.bornOn);

  console.log(`\nAll ${passed} age client checks passed.`);
}

/**
 * Under-18 access block (emci 2026-10-20, docs/under18-access.md): existing
 * under-18 testers are routed to a block screen, never deleted.
 */
function under18AccessBlock(under15BornOn: string) {
  const today = new Date(2026, 9, 20); // 20 Oct 2026, local time

  // 17 years 364 days blocks; exactly 18 opens; the day before the 18th birthday blocks.
  assert.equal(ageGateFor('2008-10-21', today), 'blocked', '17y364d is blocked');
  assert.equal(ageGateFor('2008-10-20', today), 'open', 'exactly 18 today opens');
  assert.equal(ageGateFor('2008-10-19', today), 'open', '18 and 1 day opens');
  assert.equal(ageGateFor('2008-10-20', new Date(2026, 9, 19)), 'blocked', 'the day before the 18th birthday is blocked');
  assert.equal(ageGateFor('2009-01-01', today), 'blocked', '17 and some months is blocked');
  assert.equal(ageGateFor('1990-01-01', today), 'open');
  assert.equal(isBlockedForAge('2008-10-21', today), true);
  assert.equal(isBlockedForAge('2008-10-20', today), false);
  assert.equal(isBlockedForAge(under15BornOn), true);
  ok('17y364d and the day before the 18th birthday are blocked; exactly 18 and older open');

  // Unknown birthday → confirm-age, never open, never blocked, never a throw.
  const unknown: unknown[] = [null, undefined, '', ' ', 'not-a-date', '2008-10', '2008-13-45', '2008-02-30', '2007-02-29', '2008-00-10', '08-10-20', 42, {}];
  for (const missing of unknown) {
    assert.doesNotThrow(() => ageGateFor(missing as string, today));
    assert.equal(ageGateFor(missing as string, today), 'confirm', `born_on ${JSON.stringify(missing)} → confirm`);
    assert.equal(isBlockedForAge(missing as string, today), false);
  }
  assert.equal(isReadableBornOn('2008-02-29'), true, '2008 is a leap year');
  assert.equal(isReadableBornOn('2007-02-29'), false, '2007 is not');
  assert.equal(isReadableBornOn('2000-02-29'), true, '2000 is a leap year (divisible by 400)');
  assert.equal(isReadableBornOn('1900-02-29'), false, '1900 is not (divisible by 100)');
  ok('null / empty / malformed / impossible born_on → confirm-age (never opens the app, never throws)');

  // A birthday after today is impossible data (sign-up and the server refuse it) → confirm-age.
  assert.equal(ageGateFor('2026-10-21', today), 'confirm', 'tomorrow');
  assert.equal(ageGateFor('2027-01-01', today), 'confirm', 'next year');
  assert.equal(ageGateFor('2026-10-20', today), 'blocked', 'born today: 0 years old, a real date → blocked');
  ok('future birthday → confirm-age (asks again); born today → blocked');

  // Phone local date vs server UTC around midnight. The app counts on the phone's
  // LOCAL date; the server guard and wave101 count on UTC current_date.
  const born = '2008-10-21';
  const utcDay = (instant: Date) => new Date(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate(), 12);
  // Local midnight on this machine: 23:59:59 the day before → blocked, 00:00:00 on the birthday → open.
  assert.equal(ageGateFor(born, new Date(2026, 9, 20, 23, 59, 59)), 'blocked');
  assert.equal(ageGateFor(born, new Date(2026, 9, 21, 0, 0, 0)), 'open');
  // Sydney (UTC+11) at 2026-10-20T22:30Z: phone says 21 Oct 09:30 → app opens;
  // server says 20 Oct → still under 18 (a birthday save would be refused until 11:00 local).
  const sydneyInstant = new Date(Date.UTC(2026, 9, 20, 22, 30));
  assert.equal(ageGateFor(born, new Date(2026, 9, 21, 9, 30)), 'open', 'phone ahead of UTC: app opens');
  assert.equal(ageGateFor(born, utcDay(sydneyInstant)), 'blocked', 'server UTC: not 18 yet');
  // Los Angeles (UTC-7) at 2026-10-21T03:00Z: phone says 20 Oct 20:00 → still blocked;
  // server says 21 Oct → 18 (the server would accept; the app opens at local midnight).
  const laInstant = new Date(Date.UTC(2026, 9, 21, 3, 0));
  assert.equal(ageGateFor(born, new Date(2026, 9, 20, 20, 0)), 'blocked', 'phone behind UTC: still blocked');
  assert.equal(ageGateFor(born, utcDay(laInstant)), 'open', 'server UTC: already 18');
  ok('timezone edge: the app uses the phone date; the server uses UTC; both sides of midnight tested');

  // Leap years and 29 Feb births: 18 on 1 Mar in a non-leap year, on 29 Feb in a leap year.
  assert.equal(ageGateFor('2008-02-29', new Date(2026, 1, 28)), 'blocked');
  assert.equal(ageGateFor('2008-02-29', new Date(2026, 2, 1)), 'open');
  assert.equal(ageGateFor('2010-02-29', today), 'confirm', '2010 has no 29 Feb');
  assert.equal(ageGateFor('2012-02-29', new Date(2030, 1, 28)), 'blocked', '2030 is not a leap year');
  assert.equal(ageGateFor('2012-02-29', new Date(2030, 2, 1)), 'open');
  assert.equal(accessDateFor('2012-02-29'), '2030-03-01');
  assert.equal(ageGateFor('2014-02-29', today), 'confirm');
  assert.equal(accessDateFor('2010-02-28'), '2028-02-28');
  assert.equal(ageGateFor('2010-02-28', new Date(2028, 1, 27)), 'blocked');
  assert.equal(ageGateFor('2010-02-28', new Date(2028, 1, 28)), 'open');
  // A 29 Feb birth year is ≡ 0 mod 4, so year + 18 is ≡ 2 mod 4 and never a leap year:
  // every real 29 Feb birth opens on 1 Mar of the 18th year.
  for (const y of [2000, 2004, 2008, 2012, 2016]) {
    assert.equal(accessDateFor(`${y}-02-29`), `${y + 18}-03-01`);
  }
  ok('29 Feb births open on 1 Mar; leap-year rules (÷4, ÷100, ÷400) decide which 29 Febs are real');

  // resolveAgeGate: a readable stored date always decides; the confirm-screen entry can only block.
  assert.deepEqual(resolveAgeGate('2008-10-20', '2010-01-01', today), { state: 'open', bornOn: '2008-10-20' });
  assert.deepEqual(resolveAgeGate('2008-10-21', null, today), { state: 'blocked', bornOn: '2008-10-21' });
  assert.deepEqual(resolveAgeGate(null, null, today), { state: 'confirm', bornOn: null });
  assert.deepEqual(resolveAgeGate(null, '2010-01-01', today), { state: 'blocked', bornOn: '2010-01-01' });
  assert.deepEqual(resolveAgeGate(null, '1990-01-01', today), { state: 'confirm', bornOn: null }, 'an adult entry never opens without the saved row');
  assert.deepEqual(resolveAgeGate('garbage', 'garbage', today), { state: 'confirm', bornOn: null });
  ok('resolveAgeGate: stored date decides; an under-18 entry blocks; an entry can never open the app');

  // The in-memory entry is per user and notifies the layout.
  let fired = 0;
  const unsubscribe = subscribeLocalAgeEntry(() => {
    fired += 1;
  });
  setLocalAgeEntry({ userId: 'u1', bornOn: '2010-01-01' });
  assert.equal(localAgeEntryFor('u1'), '2010-01-01');
  assert.equal(localAgeEntryFor('u2'), null, 'never follows another account');
  assert.equal(localAgeEntryFor(null), null);
  setLocalAgeEntry(null);
  assert.equal(getLocalAgeEntry(), null);
  unsubscribe();
  assert.equal(fired, 2);
  ok('the confirm-screen entry is in memory, keyed by user, and re-renders the layout');

  // bornOnFromParts takes the same fake today (dev preview) for its "not in the future" rule.
  assert.equal(bornOnFromParts('2026', '10', '21', today).ok, false);
  assert.equal(bornOnFromParts('2026', '10', '20', today).ok, true);
  ok('bornOnFromParts uses the given today for the future-date rule');

  // The date shown is the 18th birthday, and the gate opens exactly that day.
  assert.equal(accessDateFor('2008-10-21'), '2026-10-21');
  assert.equal(isBlockedForAge('2008-10-21', new Date(2026, 9, 20)), true);
  assert.equal(isBlockedForAge('2008-10-21', new Date(2026, 9, 21)), false);
  // 29 Feb: opens 1 Mar in a non-leap year (same day ageYearsOn and the server's is_at_least_age count 18).
  assert.equal(accessDateFor('2008-02-29'), '2026-03-01');
  assert.equal(isBlockedForAge('2008-02-29', new Date(2026, 1, 28)), true);
  assert.equal(isBlockedForAge('2008-02-29', new Date(2026, 2, 1)), false);
  assert.equal(accessDateFor('2006-02-29'), '2024-02-29');
  assert.equal(accessDateFor('2008-12-31'), '2026-12-31');
  const shown = formatDateForLocale('2026-10-21', 'en-US');
  assert.match(shown, /October/);
  assert.match(shown, /21/);
  assert.match(shown, /2026/);
  ok('the date shown is the 18th birthday, formatted for the locale', { shown });

  // The block + confirm screens: Sign out, Email support, and the EXISTING delete
  // sheet (opened, never called directly). Nothing else writes.
  const screen = read('src/app/under-18.tsx');
  const confirm = read('src/app/confirm-age.tsx');
  assert.match(screen, /clearLocalSession\(\)/, 'Sign out uses the onboarding sign-out call');
  assert.match(screen, /'Sign out'/);
  assert.match(screen, /UNDER_18_MESSAGE/);
  assert.match(screen, /accessDateFor\(bornOn\)/);
  assert.match(screen, /formatDateForLocale\(/);
  assert.match(screen, /Nothing has been deleted or changed\./);
  assert.match(screen, /cancelAllScheduledPush\(\)/, 'no push while blocked');
  assert.match(screen, /import \{ DeleteAccountSheet \} from '@\/components\/delete-account-sheet';/, 'the existing delete sheet, not a new flow');
  assert.match(screen, /<DeleteAccountSheet\s+visible=\{deleting\}\s+onClose=\{\(\) => setDeleting\(false\)\}\s+hasAppleIdentity=\{hasAppleIdentity\}\s+preview=\{preview\}\s+\/>/);
  assert.match(screen, /onPress=\{\(\) => setDeleting\(true\)\}/, 'the tap only opens the sheet');
  assert.match(screen, />\s*Delete my account\s*</);
  assert.match(screen, /Deleting your account is permanent\. If you leave it, we keep your account and everything in it just as it is\./);
  const writes =
    /deleteAccount\(|reset_my_account|resetMyAccount|functions\.invoke|\.rpc\(|\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/;
  assert.doesNotMatch(screen, writes, 'the block screen calls no write API itself');
  assert.match(confirm, /<AgeGateActions preview=\{preview\}/, 'confirm-age has Sign out, support and delete too');
  assert.doesNotMatch(confirm.replace(/setBornOn\(me\.id, bornOn\)/, ''), writes, 'confirm-age writes only through setBornOn');
  const sheet = read('src/components/delete-account-sheet.tsx');
  assert.match(sheet, /if \(preview\) \{\s*setError\([^)]*\);\s*return;\s*\}\s*setWorking\(true\);/, 'preview mode returns before deleteAccount');
  assert.match(sheet, /preview = false,/, 'preview is off unless the dev preview asks');
  assert.doesNotMatch(read('src/app/settings.tsx'), /preview=\{/, 'Settings never opens the sheet in preview mode');
  assert.doesNotMatch(read('src/app/(tabs)/you.tsx'), /preview=\{/, 'You never opens the sheet in preview mode');
  const supportEmail = /SUPPORT_EMAIL = '([^']+)'/.exec(screen)?.[1];
  const feedbackEmail = /FEEDBACK_EMAIL = '([^']+)'/.exec(read('src/app/settings.tsx'))?.[1];
  assert.ok(supportEmail && supportEmail === feedbackEmail, 'support address matches Settings / legal');
  ok('block + confirm-age: Sign out, Email support, and the existing Delete account sheet; no other write');

  // Confirm-age: the onboarding date fields and the guarded setBornOn path.
  assert.match(confirm, /<BornOnFields/);
  assert.match(confirm, /Confirm your age/);
  assert.match(confirm, /await setBornOn\(me\.id, bornOn\);\s*await refresh\(\);/);
  assert.match(confirm, /if \(ageGateFor\(parsed\.bornOn, now\) === 'blocked'\) \{\s*onUnderage\(parsed\.bornOn\);\s*return;\s*\}\s*setSaving\(true\);/, 'an under-18 date is never sent');
  assert.match(confirm, /if \(message === UNDER_18_MESSAGE\) \{\s*onUnderage\(parsed\.bornOn\);/, 'a server age refusal still lands on the block screen');
  assert.match(confirm, /setLocalAgeEntry\(\{ userId: me\.id, bornOn \}\)/);
  ok('confirm-age: same date fields as sign-up, setBornOn + refresh for 18+, under 18 → block (memory only)');

  // Guard placement in the root layout.
  const layout = read('src/app/_layout.tsx');
  assert.match(layout, /const meRow = !!me;/);
  assert.match(layout, /const ageGate = isAuthed && meRow \? resolveAgeGate\(me\?\.born_on, localAgeEntryFor\(me\?\.id\)\)\.state : 'open';/);
  assert.match(layout, /const ageGated = ageConfirm \|\| ageBlocked;/);
  assert.match(layout, /const hasMe = meRow && !ageGated;/);
  assert.doesNotMatch(layout.slice(layout.indexOf('const ageGate ='), layout.indexOf('const hasMe')), /PRE_LAUNCH_DEV|__DEV__|DEV_TOOLS/, 'no dev bypass');
  assert.match(layout, /<Stack\.Protected guard=\{!isAuthed\}>\s*<Stack\.Screen name="auth" \/>/);
  assert.match(layout, /<Stack\.Protected guard=\{isAuthed && !meRow\}>\s*<Stack\.Screen name="onboarding" \/>/);
  assert.match(layout, /<Stack\.Protected guard=\{ageConfirm\}>\s*<Stack\.Screen name="confirm-age" \/>\s*<\/Stack\.Protected>/);
  assert.match(layout, /<Stack\.Protected guard=\{ageBlocked\}>\s*<Stack\.Screen name="under-18" \/>\s*<\/Stack\.Protected>/);
  assert.match(layout, /<Stack\.Protected guard=\{isAuthed && hasMe\}>\s*<Stack\.Screen name="\(tabs\)" \/>/);
  // Launch flip (2026-10-20): Play sits under the age guard only; the labs stay under PRE_LAUNCH_DEV inside it.
  assert.match(
    layout,
    /<Stack\.Protected guard=\{!ageGated\}>\s*(?:\{\/\*[^}]*\*\/\}\s*)?<Stack\.Screen name="play" \/>\s*<Stack\.Protected guard=\{PRE_LAUNCH_DEV\}>[\s\S]*?name="age-gate-lab"/,
  );
  assert.match(layout, /\{isAuthed && hasMe \? <PushRuntime \/> : null\}/);
  assert.match(layout, /\{ageGated \? null : <AppDevFab \/>\}/);
  ok('layout: auth / onboarding unchanged, confirm-age and under-18 only when gated, tabs + labs + push + DEV closed');

  // Same expressions, run as a truth table.
  const route = (isAuthed: boolean, me: { id: string; born_on: string | null } | null) => {
    const meRow = !!me;
    const ageGate = isAuthed && meRow ? resolveAgeGate(me?.born_on, localAgeEntryFor(me?.id), today).state : 'open';
    const hasMe = meRow && ageGate === 'open';
    if (!isAuthed) return 'auth';
    if (!meRow) return 'onboarding';
    if (ageGate === 'confirm') return 'confirm-age';
    if (ageGate === 'blocked') return 'under-18';
    return hasMe ? '(tabs)' : 'none';
  };
  assert.equal(route(false, null), 'auth');
  assert.equal(route(true, null), 'onboarding');
  assert.equal(route(true, { id: 'a', born_on: '2008-10-21' }), 'under-18');
  assert.equal(route(true, { id: 'a', born_on: '2008-10-20' }), '(tabs)');
  assert.equal(route(true, { id: 'a', born_on: null }), 'confirm-age');
  assert.equal(route(true, { id: 'a', born_on: 'bad' }), 'confirm-age');
  setLocalAgeEntry({ userId: 'a', bornOn: '2010-05-05' });
  assert.equal(route(true, { id: 'a', born_on: null }), 'under-18', 'typed an under-18 date on confirm-age');
  assert.equal(route(true, { id: 'b', born_on: null }), 'confirm-age', 'another account on the phone is not affected');
  setLocalAgeEntry(null);
  ok('signed-out → auth, no me → onboarding, no birthday → confirm-age, under 18 → block, 18+ → app');

  // Dev preview: dev builds only, inside the Hub's tools branch, synthetic fixtures, no account calls.
  const lab = read('src/app/age-gate-lab.tsx');
  assert.match(lab, /if \(!DEV_TOOLS_AVAILABLE\) return <Redirect href="\/" \/>;/);
  assert.doesNotMatch(lab, /useMeContext|setBornOn|supabase|clearLocalSession|deleteAccount\(|setLocalAgeEntry/, 'the preview touches no account');
  assert.match(lab, /<Under18View bornOn=\{gate\.bornOn\} preview \/>/);
  assert.match(lab, /<ConfirmAgeView[\s\S]*?preview[\s\S]*?\/>/);
  for (const id of ['17y364d', 'exactly18', '18plus1', 'feb29-before', 'feb29-open', 'null', 'empty', 'malformed', 'future']) {
    assert.match(lab, new RegExp(`id: '${id}'`), `preset ${id}`);
  }
  const hub = read('src/app/dev-lab.tsx');
  const toolsAt = hub.indexOf('{tools ? (');
  const closeAt = hub.indexOf('          ) : null}\n\n          <HubSection\n            id="admin"'.replace(/\n/g, hub.includes('\r\n') ? '\r\n' : '\n'), toolsAt);
  const panelAt = hub.indexOf('<AgeGatePreviewPanel />');
  assert.ok(toolsAt > 0 && panelAt > toolsAt && panelAt < closeAt, 'the Hub panel sits inside the tools branch');
  ok('dev preview: real screens, synthetic presets, DEV_TOOLS_AVAILABLE only, inside the Hub tools branch');

  // The server gate is pinned in full by scripts/under18-server-check.ts (server work).
  // Here: only that it is still unapplied and its adult check is the same 18 as the app.
  const gate = read('supabase/migrations/wave101_under18_server_gate.sql');
  assert.match(gate, /NOT APPLIED/);
  assert.match(gate, /function public\.is_adult\(p_uid uuid\)/);
  assert.match(gate, /is_at_least_age\(m\.born_on, 18\)/);
  ok('wave101 server gate: still NOT APPLIED, is_adult uses the same 18 (details: under18-server-check)');

  // Step 2 (master plan, 2026-10-20): the 18+ nights gate fails closed. Paired refuse/allow cases.
  const now = new Date();
  const exact18 = shiftYears(18, now).iso;
  const t364 = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate() + 1); // 17y364d old
  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const refused: [string, string | null | undefined][] = [
    ['null', null],
    ['undefined', undefined],
    ['blank', ''],
    ['spaces', '   '],
    ['text', 'abc'],
    ['month 13', '2000-13-45'],
    ['30 Feb', '2000-02-30'],
    ['wrong shape', '2000/01/01'],
    ['future', `${now.getFullYear() + 1}-01-01`],
    ['17y364d', isoOf(t364)],
  ];
  for (const [label, value] of refused) {
    assert.equal(isAtLeastAge(value, NIGHT_GOING_AGE_YEARS), false, `isAtLeastAge refuses ${label}`);
    assert.notEqual(signupAgeMessage(value), null, `signupAgeMessage refuses ${label}`);
  }
  assert.equal(signupAgeMessage(isoOf(t364)), UNDER_18_MESSAGE);
  assert.equal(signupAgeMessage('abc'), AGE_INVALID_MESSAGE);
  assert.equal(signupAgeMessage(''), AGE_REQUIRED_MESSAGE);
  assert.equal(isAtLeastAge(exact18, NIGHT_GOING_AGE_YEARS), true, 'exactly 18 is allowed');
  assert.equal(signupAgeMessage(exact18), null);
  ok('nights gate (client): null / blank / malformed / future / 17y364d refused; exactly 18 allowed');

  const around = read('src/app/around-lab.tsx');
  assert.doesNotMatch(around, /me\?\.born_on \?\s*isAtLeastAge/, 'no truthiness shortcut around the birthday');
  assert.match(around, /isAtLeastAge\(me\?\.born_on, NIGHT_GOING_AGE_YEARS\)/);
  assert.match(around, /CONFIRM_AGE_MESSAGE/);
  ok('around-lab: a missing birthday is not old enough and gets the confirm-your-age message');

  // Server half: wave102 re-creates set_going so p_ages cannot skip the age test.
  const w102 = read('supabase/migrations/wave102_nights_18_gate.sql');
  const w102Fn = w102.slice(w102.indexOf('function public.set_going'));
  assert.match(w102, /NOT APPLIED/);
  assert.match(w102Fn, /perform public\.require_adult\(\)/);
  assert.match(w102Fn, /if not public\.is_at_least_age\(v_born, 18\) then/);
  assert.match(w102Fn, /'going_under_18'/);
  const w102Body = w102Fn.slice(w102Fn.indexOf('as $$')).replace(/--.*$/gm, '');
  assert.doesNotMatch(w102Body, /show_requires_18|p_ages/, 'the body never reads p_ages or show_requires_18');
  assert.match(w102Fn, /revoke all on function public\.set_going\(text,boolean,text\) from public, anon;/);
  assert.match(w102Fn, /grant execute on function public\.set_going\(text,boolean,text\) to authenticated;/);
  assert.doesNotMatch(w102Fn, /is_at_least_age\([^)]*, (1[0-79]|[0-9]|2\d)\)/, 'only 18');
  assert.doesNotMatch(w102Fn.replace(/--.*$/gm, ''), /\bupdate public\.|\bdelete from public\.me\b/);
  // The helper it relies on: null is never adult, exactly 18 (born_on <= today - 18y) is.
  const helper = read('supabase/migrations/stage2_me_born_on.sql');
  assert.match(helper, /select p_born_on is not null/);
  assert.match(helper, /p_born_on <= \(current_date - make_interval\(years => p_years\)\)/);
  ok('wave102: set_going needs an 18+ birthday always (null/blank/under-18 raise), p_ages not trusted, NOT APPLIED');
}

function read(rel: string): string {
  return readFileSync(resolve(__dirname, '..', rel), 'utf8');
}

main();
