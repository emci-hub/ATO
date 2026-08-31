/**
 * You-tab Full Profile. Run: npm run check:full-profile
 *
 * Private 15-axis inventory. Completeness is "N of 15 answered" — never a
 * percent, never on Home / Explore / Talk / widget / push. Writes reuse
 * updateTraits. Poster and public handle stay closed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  FULL_PROFILE_LABEL,
  FULL_PROFILE_LEDE,
  NOT_ANSWERED_YET,
  TRAIT_AXIS_TOTAL,
  answeredAxisCount,
  answeredAxisLabel,
  formatTraitTouchedAt,
  profileCopyClean,
  sourceProvenance,
} from '../src/lib/full-profile';
import { AXIS_EDITOR_COPY } from '../src/lib/sage-knows';
import {
  TRAIT_AXES,
  emptyTraitState,
  emptyTraitValues,
  mergeTraitWrite,
} from '../src/lib/traits';
import { containsFrameworkTerm } from '../src/lib/voice/framework-fence';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const root = resolve(__dirname, '..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

assert.equal(TRAIT_AXIS_TOTAL, 15);
assert.equal(answeredAxisCount(emptyTraitValues()), 0);
assert.equal(answeredAxisLabel(emptyTraitValues()), '0 of 15 answered');
const some = mergeTraitWrite(
  emptyTraitState(),
  { extraversion: 0.2, growth_mindset: 0.8 },
  'self_tap',
  ['extraversion', 'growth_mindset'],
);
assert.equal(answeredAxisCount(some.values), 2);
assert.equal(answeredAxisLabel(some.values), '2 of 15 answered');
const gamed = mergeTraitWrite(emptyTraitState(), { autonomy: 0.9 }, 'self_game', ['autonomy']);
assert.equal(answeredAxisCount(gamed.values), 1);
ok('inferred-from-game still counts as answered; empty is 0 of 15');

assert.equal(sourceProvenance(undefined), null);
assert.equal(sourceProvenance('nope'), null);
assert.deepEqual(sourceProvenance('self_slider'), {
  kind: 'told',
  line: 'You told us directly — a vibe-check you tapped.',
});
assert.deepEqual(sourceProvenance('self_grid'), {
  kind: 'told',
  line: 'You told us directly — a type you already knew.',
});
assert.deepEqual(sourceProvenance('self_situation'), {
  kind: 'told',
  line: 'You told us directly — a situation you picked.',
});
assert.deepEqual(sourceProvenance('self_tap'), {
  kind: 'told',
  line: 'You told us directly — a ranking you sorted.',
});
assert.deepEqual(sourceProvenance('self_game'), {
  kind: 'inferred',
  line: 'Inferred from a gut-call you played.',
});
assert.deepEqual(sourceProvenance('self_settings'), {
  kind: 'corrected',
  line: 'You corrected this after Sage checked in.',
});
assert.deepEqual(sourceProvenance('self_confirm'), {
  kind: 'confirmed',
  line: 'You said this still fits.',
});
ok('provenance is plain language; grid/situation count as told; game is inferred; settings is a correction');

assert.equal(formatTraitTouchedAt(undefined), null);
assert.equal(formatTraitTouchedAt(''), null);
assert.equal(formatTraitTouchedAt('nope'), null);
assert.equal(
  formatTraitTouchedAt('2026-08-31T13:03:52.487Z', 'UTC'),
  'Last updated Aug 31, 2026',
);
ok('last updated reads trait_touched_at; null axes have no line');

assert.equal(profileCopyClean(), true);
assert.equal(containsFrameworkTerm(FULL_PROFILE_LABEL), false);
assert.equal(containsFrameworkTerm(FULL_PROFILE_LEDE), false);
assert.equal(containsFrameworkTerm(NOT_ANSWERED_YET), false);
for (const axis of TRAIT_AXES) {
  const copy = AXIS_EDITOR_COPY[axis];
  assert.equal(containsFrameworkTerm(copy.label), false, copy.label);
  assert.equal(containsFrameworkTerm(copy.hint), false, copy.hint);
}
const ui = [read('src/lib/full-profile.ts'), read('src/components/full-profile-fold.tsx')].join('\n');
for (const banned of ['MBTI', 'Myers-Briggs', 'Big Five', 'OCEAN', 'attachment style', 'neuroticism', 'INFJ', 'INFP']) {
  assert.equal(ui.toLowerCase().includes(banned.toLowerCase()), false, `leaked "${banned}"`);
}
ok('Full Profile copy names no framework, type code, or diagnosis');

const fold = read('src/components/full-profile-fold.tsx');
assert.match(fold, /updateTraits/);
assert.match(fold, /self_tap/);
assert.match(fold, /self_settings/);
assert.match(fold, /AxisTaps/);
assert.match(fold, /TraitBandVisual/);
assert.match(fold, /AXIS_EDITOR_COPY/);
assert.doesNotMatch(fold, /recordRanking|recordScenario|optionalFillWrite/);
assert.doesNotMatch(fold, /applyRankingWeek|applyScenarioWeek|applyCompletenessWeek|you_slot|week_slot/);
assert.doesNotMatch(fold, /toFixed|percent|%/);
ok('edits reuse updateTraits + AxisTaps; no new writer; no score or percent');

const you = read('src/app/(tabs)/you.tsx');
const bandsIdx = you.indexOf('<TraitBandsFold');
const profileIdx = you.indexOf('<FullProfileFold');
const fillIdx = you.indexOf('<OptionalIntakeFill');
assert.ok(bandsIdx >= 0 && profileIdx > bandsIdx && fillIdx > profileIdx);
assert.match(you, /from '@\/components\/full-profile-fold'/);
assert.match(fold, /SettingsFold title=\{`\$\{FULL_PROFILE_LABEL\}/);
ok('Full Profile sits on You after trait bands, before fill-later');

const poster = read('src/components/share-poster.tsx');
const handlePage = read('src/app/[handle].tsx');
const home = read('src/app/(tabs)/index.tsx');
const sage = read('src/app/(tabs)/sage.tsx');
const dawn = read('src/app/dawn.tsx');
const widget = read('targets/widget/widgets.swift');
const push = read('src/lib/push-copy.ts');
const explore = read('src/components/explore-panel.tsx');
for (const [name, source] of [
  ['poster', poster],
  ['handle', handlePage],
  ['home', home],
  ['sage', sage],
  ['dawn', dawn],
  ['widget', widget],
  ['push', push],
  ['explore', explore],
] as const) {
  assert.doesNotMatch(source, /FullProfileFold|of 15 answered|How you're currently leaning/);
  assert.doesNotMatch(source, /full-profile/, `${name} must not import Full Profile`);
}
ok('completeness and Full Profile stay off Home, Sage, Talk, Explore, widget, push, poster, public handle');

const meSrc = read('src/lib/me.ts');
assert.match(meSrc, /export async function fetchMe/);
assert.match(meSrc, /export async function updateTraits/);
assert.match(meSrc.slice(meSrc.indexOf('export async function fetchMe')), /\.eq\('id', userId\)/);
assert.match(meSrc.slice(meSrc.indexOf('export async function updateTraits')), /\.eq\('id', userId\)/);
ok('fetchMe / updateTraits still scope writes to the signed-in id; no new table');

console.log(`\n${passed} full-profile checks passed`);
