/**
 * Stage 9 intake core — unit checks.
 * Run: npm run check:intake
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CORE_INTAKE_QUESTIONS,
  CORE_INTAKE_TOTAL,
  INTAKE_SETTINGS_LABELS,
  TALK_STYLE_PREVIEWS,
  bankStyleFor,
  coreIntakeAnsweredLabel,
  displayIntakeValue,
  joinKnocks,
  parseKnocks,
  phraseForStoredChip,
  selectedIntakeValues,
  voiceMeFrom,
} from '../src/lib/intake';
import { SCENARIO_QUESTIONS } from '../src/lib/vibe-check';
import { bankCard, bankCardForMe } from '../src/lib/voice/bank';
import { routeVoiceCard } from '../src/lib/voice/router';
import { buildVoiceConfig } from '../src/lib/voice/config';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const localConfig = buildVoiceConfig({ MODEL_PROVIDER: 'local' });
const dev = { isDev: true, config: localConfig };

async function main() {
  assert.equal(CORE_INTAKE_QUESTIONS.length, 8);
  assert.equal(CORE_INTAKE_TOTAL, 8);
  const fields = CORE_INTAKE_QUESTIONS.map((q) => q.field);
  assert.deepEqual(fields, [
    'talk_style',
    'show_up',
    'knocks_you_off',
    'morning_cue',
    'evening_wind_down',
    'energy_pattern',
    'support_style',
    'current_focus',
  ]);
  CORE_INTAKE_QUESTIONS.forEach((q, i) => {
    assert.equal(q.n, i + 1);
    assert.ok(q.chips.length >= 3, `${q.field} needs chips`);
    assert.ok(q.prompt.length > 0);
  });
  ok('8 core questions in spec order, one chip set each');

  assert.equal(coreIntakeAnsweredLabel(3), 'answered 3 of 8');
  ok('progress label is "answered 3 of 8"');

  const onboarding = readFileSync(resolve(__dirname, '../src/app/onboarding.tsx'), 'utf8');
  const coreSweep = readFileSync(resolve(__dirname, '../src/components/core-intake-sweep.tsx'), 'utf8');
  const meLib = readFileSync(resolve(__dirname, '../src/lib/me.ts'), 'utf8');
  assert.match(onboarding, /CoreIntakeSweep/);
  assert.match(onboarding, /phase === 'account'/);
  assert.match(onboarding, /phase === 'optional-gate'/);
  assert.doesNotMatch(onboarding, /intakeIndex/);
  assert.doesNotMatch(onboarding, /intakeProgressLabel/);
  assert.match(coreSweep, /CORE_INTAKE_QUESTIONS/);
  assert.match(coreSweep, /ChipGroup/);
  assert.match(coreSweep, /coreIntakeAnsweredLabel/);
  ok('core intake is one scrollable page reusing the sweep shape, with an answered counter');

  const energyQ = CORE_INTAKE_QUESTIONS.find((q) => q.field === 'energy_pattern');
  assert.equal(energyQ?.prompt, 'When do you have the most energy during the day?');
  assert.equal(energyQ?.helper, 'Helps us pick a good time to check in with you.');
  ok('Q6 energy-pattern question and helper match the locked copy');

  const sweepUsage = onboarding.slice(
    onboarding.indexOf('<CoreIntakeSweep'),
    onboarding.indexOf('/>', onboarding.indexOf('<CoreIntakeSweep')) + 2,
  );
  assert.match(sweepUsage, /selectedFor=\{selectedValues\}/);
  assert.match(sweepUsage, /onSubmit=\{\(\) => void submit\(\)\}/);
  assert.match(sweepUsage, /setPhase\('account'\)/);
  assert.doesNotMatch(sweepUsage, /setTalkStyle|setEnergyPattern|setCurrentFocus/);
  ok('intake Back returns to the account step without clearing answers');

  assert.match(meLib, /export const RESERVED_HANDLES/);
  assert.match(meLib, /'ato'/);
  assert.match(meLib, /'astrollogs'/);
  assert.match(meLib, /export function handleFormatError/);
  assert.match(meLib, /That handle is reserved/);
  assert.match(meLib, /export async function checkHandleAvailable/);
  assert.match(meLib, /public_profile/);
  assert.match(onboarding, /checkHandleAvailable/);
  assert.match(onboarding, /continueFromAccount/);
  assert.match(onboarding, /onHandleBlur/);
  const continueFn = onboarding.slice(
    onboarding.indexOf('async function continueFromAccount()'),
    onboarding.indexOf('async function onHandleBlur()'),
  );
  assert.match(continueFn, /checkHandleAvailable/);
  assert.match(continueFn, /setPhase\('intake'\)/);
  assert.doesNotMatch(
    onboarding.slice(onboarding.indexOf('async function submit()'), onboarding.indexOf('async function goHome()')),
    /setPhase\('intake'\)/,
  );
  ok('handle reserved + uniqueness run on the account step, before intake questions');

  const chips = readFileSync(resolve(__dirname, '../src/components/intake-chips.tsx'), 'utf8');
  const settings = readFileSync(resolve(__dirname, '../src/components/intake-settings.tsx'), 'utf8');
  const you = readFileSync(resolve(__dirname, '../src/app/(tabs)/you.tsx'), 'utf8');
  const sage = readFileSync(resolve(__dirname, '../src/app/(tabs)/sage.tsx'), 'utf8');
  const exploreTab = readFileSync(resolve(__dirname, '../src/app/(tabs)/explore.tsx'), 'utf8');
  assert.match(chips, /accessibilityRole=\{multi \? 'checkbox' : 'radio'\}/);
  assert.match(settings, /CORE_INTAKE_QUESTIONS/);
  assert.match(settings, /updateIntake/);
  assert.match(exploreTab, /IntakeSettings/);
  assert.match(meLib, /export async function updateIntake/);
  assert.match(sage, /useMeContext/);
  ok('Settings edits the same 8 chips; Sage reads the shared ME row');

  const explore = readFileSync(resolve(__dirname, '../src/app/(tabs)/explore.tsx'), 'utf8');
  assert.match(explore, /me\?\.current_focus/);
  assert.match(explore, /CURRENT_FOCUS_CHIPS/);
  assert.match(explore, /Right now:/);
  ok('current_focus surfaces as a deterministic Explore header line');

  const joined = joinKnocks(['sleep', 'workload']);
  assert.equal(joined, 'sleep, workload');
  assert.deepEqual(parseKnocks(joined), ['sleep', 'workload']);
  ok('knocks_you_off stays a string (joined chips)');

  assert.equal(phraseForStoredChip('through_it'), 'Get through something hard');
  assert.equal(phraseForStoredChip('night_owl'), 'Night owl');
  assert.equal(phraseForStoredChip('space'), 'Space to sit with it');
  assert.equal(phraseForStoredChip('people/conflict'), 'People/conflict');
  assert.equal(phraseForStoredChip('make coffee'), 'make coffee');
  ok('stored chip ids map to chip labels; cue phrases pass through');

  const sample = {
    talk_style: 'even',
    show_up: 'push through it',
    knocks_you_off: 'sleep, workload',
    morning_cue: 'make coffee',
    evening_wind_down: 'put my phone down',
    energy_pattern: 'morning',
    support_style: 'nudge',
    current_focus: 'habit',
  };
  assert.equal(CORE_INTAKE_QUESTIONS.every((q) => INTAKE_SETTINGS_LABELS[q.field]), true);
  assert.equal(displayIntakeValue('talk_style', sample), 'Even');
  assert.equal(displayIntakeValue('show_up', sample), 'Push through it');
  assert.equal(displayIntakeValue('knocks_you_off', sample), 'Sleep, Workload');
  assert.deepEqual(selectedIntakeValues('knocks_you_off', sample), ['sleep', 'workload']);
  assert.equal(INTAKE_SETTINGS_LABELS.talk_style, 'How Sage talks to you');
  assert.equal(TALK_STYLE_PREVIEWS.quiet, 'Three days now. Not loud about it, just there.');
  assert.equal(
    TALK_STYLE_PREVIEWS.even,
    "Three days in a row. That's a start worth noticing.",
  );
  assert.equal(
    TALK_STYLE_PREVIEWS.loud,
    "Three days! That's the kind of streak worth bragging about.",
  );
  assert.match(settings, /TALK_STYLE_PREVIEWS/);
  assert.match(settings, /setPreviewTalk/);
  assert.doesNotMatch(settings, /generate|claimAiCall|gemini/i);
  ok('talk_style picker preview is static local copy, no model call');
  assert.equal(INTAKE_SETTINGS_LABELS.morning_cue, 'Your morning anchor');
  assert.equal(
    CORE_INTAKE_QUESTIONS.find((q) => q.field === 'knocks_you_off')?.prompt,
    'What tends to drain your energy or throw off your schedule?',
  );
  ok('Settings labels and display values cover all 8 fields');

  assert.equal(SCENARIO_QUESTIONS.length, 8);
  assert.equal(
    SCENARIO_QUESTIONS[0]?.prompt,
    "You've had a plan locked in for weeks — everyone knows the spot. Right before, the group finds something new and everyone's suddenly into that instead.",
  );
  assert.deepEqual(SCENARIO_QUESTIONS[0]?.axes, ['openness', 'conscientiousness']);
  ok('scenario prompts and axis pairs match the locked copy');

  const copyBlob = [
    onboarding,
    coreSweep,
    chips,
    settings,
    you,
    readFileSync(resolve(__dirname, '../src/components/share-poster.tsx'), 'utf8'),
    readFileSync(resolve(__dirname, '../src/components/optional-intake.tsx'), 'utf8'),
    readFileSync(resolve(__dirname, '../src/lib/vibe-check.ts'), 'utf8'),
    readFileSync(resolve(__dirname, '../src/components/axis-taps.tsx'), 'utf8'),
  ].join('\n');
  for (const banned of ['MBTI', 'Myers-Briggs', 'Big Five', 'OCEAN', 'attachment style', 'neuroticism', 'TIPI', 'ECR']) {
    assert.equal(copyBlob.toLowerCase().includes(banned.toLowerCase()), false, `public/intake copy leaked "${banned}"`);
  }
  ok('no raw framework labels in intake UI or poster');

  const poster = readFileSync(resolve(__dirname, '../src/components/share-poster.tsx'), 'utf8');
  assert.doesNotMatch(poster, /energy_pattern|support_style|current_focus/);
  ok('poster does not render psych-adjacent fields');

  const fallback = bankStyleFor({ talk_style: 'even' });
  assert.equal(fallback, 'even');
  ok('pre-intake rows keep talk_style bank slots');

  const quietPick = bankStyleFor({
    talk_style: 'loud',
    energy_pattern: 'night_owl',
    support_style: 'space',
  });
  const loudPick = bankStyleFor({
    talk_style: 'quiet',
    energy_pattern: 'morning',
    support_style: 'nudge',
  });
  assert.equal(quietPick, 'quiet');
  assert.equal(loudPick, 'loud');
  ok('energy_pattern + support_style pick different bank style slots');

  const cue = 'make coffee';
  const quietMe = voiceMeFrom({
    name: 'A',
    show_up: 'building something',
    talk_style: 'loud',
    knocks_you_off: 'sleep',
    morning_cue: cue,
    evening_wind_down: 'put my phone down',
    energy_pattern: 'night_owl',
    support_style: 'space',
    current_focus: 'habit',
  });
  const loudMe = voiceMeFrom({
    name: 'B',
    show_up: 'running hot',
    talk_style: 'quiet',
    knocks_you_off: 'workload',
    morning_cue: 'put on music',
    evening_wind_down: 'get in bed',
    energy_pattern: 'morning',
    support_style: 'nudge',
    current_focus: 'show_up',
  });

  const quietCard = bankCardForMe(1, quietMe)!;
  const loudCard = bankCardForMe(1, loudMe)!;
  assert.equal(quietCard.do, bankCard(1, 'quiet', cue)!.do);
  assert.equal(loudCard.do, bankCard(1, 'loud', 'put on music')!.do);
  assert.ok(quietCard.do.includes(cue), 'Do must contain the person\'s morning_cue phrase');
  assert.ok(!quietCard.do.includes('{morning_cue}'));
  assert.notEqual(quietCard.read, loudCard.read);
  assert.notEqual(quietCard.do, loudCard.do);
  ok('Day 1 Do inserts the user cue; two answer sets pick different bank cards');

  const routed = await routeVoiceCard(
    { me: quietMe, checkCount: 0, history: [] },
    dev,
  );
  assert.equal(routed.source, 'bank');
  assert.equal(routed.provider, null);
  assert.equal(routed.dev?.fromModel, false);
  assert.equal(routed.card?.do, quietCard.do);
  ok('check_count < 3 still uses first_cards.md with no model call');

  console.log(`\nAll ${passed} intake checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
