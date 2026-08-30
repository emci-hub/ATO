/**
 * Self-reported age / date-of-birth checks (Stage 2 ME box).
 * Run: npx tsx scripts/age-check.ts
 *
 * Client-visible path: the same helpers onboarding.tsx uses to show an inline
 * error before createMe. Live 16+ / 16–17 storage is verified in SQL against
 * the project after this file's helpers pass.
 */
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

import {
  AGE_INVALID_MESSAGE,
  AGE_REQUIRED_MESSAGE,
  MIN_APP_AGE_YEARS,
  NIGHT_GOING_AGE_YEARS,
  UNDER_16_MESSAGE,
  ageYearsOn,
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
  assert.equal(MIN_APP_AGE_YEARS, 16);
  assert.equal(NIGHT_GOING_AGE_YEARS, 18);
  ok('thresholds are 16 (app) and 18 (going)');

  assert.deepEqual(bornOnFromParts('', '', ''), { ok: false, message: AGE_REQUIRED_MESSAGE });
  assert.deepEqual(bornOnFromParts('2010', '13', '01'), { ok: false, message: AGE_INVALID_MESSAGE });
  assert.deepEqual(bornOnFromParts('2010', '02', '30'), { ok: false, message: AGE_INVALID_MESSAGE });
  ok('empty / impossible dates fail with an inline message, not a throw');

  const under = shiftYears(15);
  const parsedUnder = bornOnFromParts(under.y, under.m, under.d);
  assert.equal(parsedUnder.ok, true);
  if (!parsedUnder.ok) throw new Error('expected parse');
  assert.equal(signupAgeMessage(parsedUnder.bornOn), UNDER_16_MESSAGE);
  assert.equal(isAtLeastAge(parsedUnder.bornOn, MIN_APP_AGE_YEARS), false);
  ok('under-16 parse succeeds and signup is blocked with the inline 16+ message', {
    bornOn: parsedUnder.bornOn,
    message: UNDER_16_MESSAGE,
  });

  const sixteen = shiftYears(16);
  const parsed16 = bornOnFromParts(sixteen.y, sixteen.m, sixteen.d);
  assert.equal(parsed16.ok, true);
  if (!parsed16.ok) throw new Error('expected parse');
  assert.equal(signupAgeMessage(parsed16.bornOn), null);
  assert.equal(isAtLeastAge(parsed16.bornOn, MIN_APP_AGE_YEARS), true);
  assert.equal(isAtLeastAge(parsed16.bornOn, NIGHT_GOING_AGE_YEARS), false);
  ok('exactly-16 signup is allowed; 18+ going gate still false', {
    bornOn: parsed16.bornOn,
    age: ageYearsOn(parsed16.bornOn),
  });

  const seventeen = shiftYears(17);
  const parsed17 = bornOnFromParts(seventeen.y, seventeen.m, seventeen.d);
  assert.equal(parsed17.ok, true);
  if (!parsed17.ok) throw new Error('expected parse');
  assert.equal(signupAgeMessage(parsed17.bornOn), null);
  assert.equal(isAtLeastAge(parsed17.bornOn, MIN_APP_AGE_YEARS), true);
  assert.equal(isAtLeastAge(parsed17.bornOn, NIGHT_GOING_AGE_YEARS), false);
  ok('16/17 signup is allowed and going-gate helper stays false', {
    bornOn: parsed17.bornOn,
    age: ageYearsOn(parsed17.bornOn),
  });

  const adult = shiftYears(18);
  assert.equal(isAtLeastAge(adult.iso, NIGHT_GOING_AGE_YEARS), true);
  ok('18+ recomputes true from the same date field (no boolean baked at signup)');

  const onboarding = readFileSync(resolve(__dirname, '../src/app/onboarding.tsx'), 'utf8');
  assert.match(onboarding, /bornOnFromParts/);
  assert.match(onboarding, /signupAgeMessage/);
  assert.match(onboarding, /setAgeError/);
  assert.match(onboarding, /UNDER_16_MESSAGE/);
  assert.match(onboarding, /When were you born/);
  ok('onboarding shows the age error on the field, not only a generic form error');

  const me = readFileSync(resolve(__dirname, '../src/lib/me.ts'), 'utf8');
  assert.match(me, /p_born_on: profile\.born_on/);
  assert.match(me, /born_on: string \| null/);
  ok('createMe sends born_on through complete_signup; ME stores the date');

  const you = readFileSync(resolve(__dirname, '../src/app/(tabs)/you.tsx'), 'utf8');
  const accountStart = you.indexOf('<SettingsFold title="Account">');
  const accountEnd = you.indexOf('</SettingsFold>', accountStart);
  assert.ok(accountStart >= 0 && accountEnd > accountStart, 'Account fold is on You');
  const account = you.slice(accountStart, accountEnd);
  const tzIdx = account.indexOf('label="Timezone"');
  const birthdayIdx = account.indexOf('<BirthdayRow');
  assert.ok(tzIdx >= 0, 'Timezone row is in Account');
  assert.ok(birthdayIdx > tzIdx, 'Birthday row sits directly below Timezone in Account');
  ok('You Account fold has Birthday directly below Timezone');

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
  assert.equal(signupAgeMessage(parsedUnder.bornOn), UNDER_16_MESSAGE);
  ok('setBornOn re-runs the same onboarding 16+ check; underage dates stay blocked');

  const around = readFileSync(resolve(__dirname, '../src/app/(tabs)/around.tsx'), 'utf8');
  assert.match(
    around,
    /const oldEnough = me\?\.born_on \? isAtLeastAge\(me\.born_on, NIGHT_GOING_AGE_YEARS\) : false/,
  );
  ok('Around 18+ gate is unchanged — missing born_on still fails closed');

  console.log(`\nAll ${passed} age client checks passed.`);
}

main();
