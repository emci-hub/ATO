/**
 * Trait score, legend hysteresis, and the borderline legend.
 * Run: npm run check:trait-accuracy
 *
 * The stored track value stays the recency (EWMA) reading. The score is the
 * equal-weight average, shrunk toward 50% by a prior worth two answers.
 */
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { archetypeName } from '../src/lib/legends64/archetypes';
import { closestArchetypes, midpointHighLow } from '../src/lib/legends64/classify';
import { legendHeadline, topTraitPhrases, type LockedPoles } from '../src/lib/legends64/identity';
import {
  collectedLegendIds,
  LEGEND_GROWN_OUT_LINE,
  LEGEND_RESTORED_LINE,
  LEGEND_SHARPER_NOTE,
  reconcileLegendForms,
  type LegendHistory,
} from '../src/lib/legends64/legend-forms';
import {
  applyEwmaAnswer,
  confidenceLabel,
  confidenceRead,
  CONFIDENCE_LEARNING_COPY,
  CONFIDENCE_SOLID_COPY,
  equalWeightScore,
  LABEL_MIN_ANSWERS,
  recencyReading,
  SCORE_PRIOR_ANSWERS,
  ATTACHMENT_MIN_ANSWERS,
  isAttachmentAxis,
  isPublicCardAxis,
  traitConfidence,
  traitScore,
  type TraitTrack,
} from '../src/lib/trait-stability';
import { shapedByRow } from '../src/lib/shaped-by';
import {
  CORRECTION_SAVED,
  SELF_CORRECTION_WEIGHT,
  legendCorrectionSamples,
  traitNudgeValue,
} from '../src/lib/self-correction';
import { publicCardPoints, traitShapePoints } from '../src/lib/trait-shape';
import { WAVE116_OPTION_IDS } from './gen-wave85-bank';
import { cronbachAlpha, itemTotalCorrelations, retestStability } from '../src/lib/trait-item-stats';
import { isDirectTraitSource, writeForOptionalScreen } from '../src/lib/traits';
import { SCENARIO_QUESTIONS } from '../src/lib/vibe-check';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const NOW = '2026-10-23T12:00:00.000Z';

function replay(samples: readonly number[]): TraitTrack {
  let row: TraitTrack | null = null;
  for (const sample of samples) row = applyEwmaAnswer(row, 'openness', 'report', sample, NOW);
  if (!row) throw new Error('no answers');
  return { ...row, answerSamples: [...samples] };
}

// --- score: every answer counts the same, few answers shrink toward 50% ---
const threeHigh = equalWeightScore([0.8, 0.8, 0.8]);
const threeExpected = (SCORE_PRIOR_ANSWERS * 0.5 + 0.8 + 0.8 + 0.8) / (SCORE_PRIOR_ANSWERS + 3);
assert.ok(threeHigh != null && Math.abs(threeHigh - threeExpected) < 1e-12);
assert.ok(threeHigh != null && threeHigh < 0.8 && threeHigh > 0.5);
ok('three 0.8 answers score below 0.8, pulled toward 50% by a prior of two');

const many = Array.from({ length: 25 }, () => 0.8);
const full = equalWeightScore(many);
assert.ok(full != null && full > 0.75 && full < 0.8);
ok('twenty-five agreeing answers sit close to the answers, not the prior');

const weighted = equalWeightScore([
  { value: 0.8, weight: 1 },
  { value: 0.8, weight: 0.5 },
]);
const flat = equalWeightScore([0.8, 0.8]);
assert.ok(weighted != null && flat != null && weighted < flat);
ok('a half-weight second answer moves the score less than a full one');

const outlier = replay([...Array.from({ length: 20 }, () => 0.8), 0.2]);
const score = traitScore(outlier);
const recency = recencyReading(outlier);
assert.ok(score != null && recency != null);
assert.notEqual(Number(score.toFixed(4)), Number(recency.toFixed(4)));
// A recent-heavy blend (fixed 0.35 EWMA on a settled 0.8) would drop to 0.59.
const recentHeavy = 0.35 * 0.2 + 0.65 * 0.8;
assert.ok(Math.abs(score - 0.8) < Math.abs(recentHeavy - 0.8));
assert.ok(score > 0.7);
ok('one off-day answer stays in the equal-weight score; recency is a separate reading');

const edited: TraitTrack = { ...outlier, value: 0.15 };
assert.equal(traitScore(edited, 'self_settings'), 0.15);
assert.notEqual(traitScore(edited, 'self_situation'), 0.15);
ok('a settings edit stays; an ordinary answer uses the average');

assert.equal(traitConfidence(0), 0);
assert.equal(traitConfidence(LABEL_MIN_ANSWERS), LABEL_MIN_ANSWERS / (LABEL_MIN_ANSWERS + SCORE_PRIOR_ANSWERS));
assert.equal(confidenceRead(2), 'hidden');
assert.equal(confidenceRead(3), 'learning');
assert.equal(confidenceLabel(4), CONFIDENCE_LEARNING_COPY);
assert.equal(confidenceRead(8), 'solid');
assert.equal(confidenceLabel(12), CONFIDENCE_SOLID_COPY);
ok('confidence is hidden under 3 answers, still learning from 3, solid from 8');

// --- vibe-check: not a lock, and not two equal traits ---
assert.equal(isDirectTraitSource('self_scenario'), false);
for (let screen = 0; screen < SCENARIO_QUESTIONS.length; screen += 1) {
  const question = SCENARIO_QUESTIONS[screen]!;
  for (const option of question.options) {
    const write = writeForOptionalScreen({ screen: screen as 0, optionId: option.value });
    assert.ok(write);
    assert.equal(write.source, 'self_situation');
    const numbers = Object.values(write.incoming).filter((value): value is number => typeof value === 'number');
    assert.ok(numbers.length >= 1 && numbers.length <= 2);
    if (numbers.length === 2) assert.notEqual(numbers[0], numbers[1], `${option.value} set two traits to ${numbers[0]}`);
    const weights = Object.values(write.weights);
    if (weights.length === 2) assert.ok(weights.includes(1) && weights.includes(0.5));
  }
}
const detour = writeForOptionalScreen({ screen: 1, optionId: 'push_it' });
assert.equal(detour?.incoming.extraversion, 0.8);
assert.notEqual(detour?.incoming.playfulness, 0.8);
const letGo = writeForOptionalScreen({ screen: 3, optionId: 'let_it_go' });
assert.notEqual(letGo?.incoming.conflict_assertiveness, letGo?.incoming.autonomy);
ok('no vibe-check option sets two traits to the same number, and none of them lock');

const scenarioThenBank = equalWeightScore([
  { value: 0.8, weight: 1 },
  0.2,
  0.2,
  0.2,
  0.2,
]);
assert.ok(scenarioThenBank != null && scenarioThenBank < 0.45);
ok('four later low answers outvote one high scenario answer');

// --- legends: middle zone, hysteresis, unknown is not low ---
assert.equal(midpointHighLow(null), 'U');
assert.equal(midpointHighLow(0.51), 'M');
assert.equal(midpointHighLow(0.51, 'H'), 'H');
assert.equal(midpointHighLow(0.44, 'H'), 'L');
assert.equal(midpointHighLow(0.49, 'L'), 'L');
assert.equal(midpointHighLow(0.56, 'L'), 'H');
assert.equal(midpointHighLow(0.5), 'M');
ok('a letter flips only on a clear crossing; 51% with no history is middle; unanswered is unknown');

function track(axis: TraitTrack['axis'], value: number, answerCount = 8): TraitTrack {
  return {
    axis,
    track: 'report',
    value,
    stability: 0.8,
    answerCount,
    lastTouched: NOW,
    lastDepthAt: null,
  };
}

const borderlineTracks: TraitTrack[] = [
  track('conscientiousness', 0.72),
  track('extraversion', 0.7),
  track('openness', 0.8),
  track('agreeableness', 0.5),
  track('conflict_assertiveness', 0.8),
  track('relatedness', 0.76),
];
const borderlinePoles: LockedPoles = {
  conscientiousness: 'H',
  extraversion: 'H',
  openness: 'H',
  agreeableness: 'M',
  conflict_assertiveness: 'H',
  relatedness: 'H',
};
const before = midpointHighLow(0.5);
assert.equal(before, 'M');
const oldPole = 0.5 >= 0.5 ? 'H' : 'L';
assert.equal(oldPole, 'H', 'the old cut would have called 50% high');
const headline = legendHeadline(borderlineTracks, borderlinePoles, 'primal');
assert.equal(headline.kind, 'balanced');
assert.equal(headline.title, 'Balanced Pathfinder');
assert.equal(headline.choices.length, 2);
const choiceCodes = headline.choices.map((choice) => choice.code).sort();
assert.deepEqual(choiceCodes, ['HHH-HHH', 'HHH-LHH']);
const byCode = Object.fromEntries(headline.choices.map((choice) => [choice.code, choice.title]));
assert.equal(byCode['HHH-HHH'], archetypeName('HHH-HHH', 'primal'));
assert.equal(byCode['HHH-LHH'], archetypeName('HHH-LHH', 'primal'));
assert.equal(byCode['HHH-HHH'], 'Grinning Pathfinder');
assert.equal(byCode['HHH-LHH'], 'Fierce Pathfinder');
assert.ok(headline.flavour?.includes('Grinning Pathfinder') && headline.flavour.includes('Fierce Pathfinder'));
ok('a middle modifier becomes Balanced Pathfinder and names the two existing legends beside it');

const picked = legendHeadline(borderlineTracks, borderlinePoles, 'primal', 'HHH-LHH');
assert.equal(picked.kind, 'balanced');
assert.equal(picked.title, archetypeName('HHH-LHH', 'primal'));
ok('picking one of the two nearest legends uses that existing name');

const choicePoles: LockedPoles = {
  conscientiousness: 'H',
  extraversion: 'H',
  openness: 'M',
  agreeableness: 'L',
  conflict_assertiveness: 'H',
  relatedness: 'H',
};
const choiceTracks = borderlineTracks.map((row) => (row.axis === 'openness' ? { ...row, value: 0.51 } : row));
const choice = legendHeadline(choiceTracks, choicePoles, 'primal');
assert.equal(choice.kind, 'choice');
assert.match(choice.title, /^Between /);
assert.equal(choice.choices.length, 2);
assert.ok(choice.choices.every((row) => archetypeName(row.code, 'primal') === row.title));
ok('a middle core trait asks for a pick between the two nearest existing names');

const unknownPoles: LockedPoles = { ...borderlinePoles, openness: 'U' };
const unknown = legendHeadline(borderlineTracks, unknownPoles, 'primal');
assert.equal(unknown.kind, 'forming');
assert.equal(closestArchetypes({ openness: null }, { openness: 'U' }).length, 0);
ok('an unanswered trait stays unknown and does not pick a legend as if it were low');

// --- legend history: one migration, then restore, and a pick is not a legend ---
const NOW_ISO = '2026-10-23T12:00:00.000Z';
const LATER = '2026-11-01T12:00:00.000Z';
const oldHigh: LockedPoles = {
  conscientiousness: 'H',
  extraversion: 'H',
  openness: 'H',
  agreeableness: 'H',
  conflict_assertiveness: 'H',
  relatedness: 'H',
};
const nowMiddle: LockedPoles = { ...oldHigh, agreeableness: 'M' };
const fierce: LockedPoles = { ...oldHigh, agreeableness: 'L' };
const emptyHistory: LegendHistory = { forms: [], migrated: false };
const migrated = reconcileLegendForms({
  history: emptyHistory,
  previousPoles: oldHigh,
  nextPoles: nowMiddle,
  nowIso: NOW_ISO,
});
assert.equal(migrated.event?.kind, 'sharper');
assert.equal(migrated.history.migrated, true);
assert.equal(migrated.history.forms.length, 1);
assert.equal(migrated.history.forms[0]?.legendId, 'HHH-HHH');
assert.equal(migrated.history.forms[0]?.archivedAt, NOW_ISO);
assert.equal(migrated.history.forms[0]?.restoredAt, null);
assert.deepEqual(collectedLegendIds(migrated.history), ['HHH-HHH']);
const again = reconcileLegendForms({
  history: migrated.history,
  previousPoles: nowMiddle,
  nextPoles: nowMiddle,
  nowIso: LATER,
});
assert.equal(again.event, null);
assert.equal(again.history, migrated.history);
ok('a scoring change archives the old legend once and does not flip it again');

const moved = reconcileLegendForms({
  history: migrated.history,
  previousPoles: nowMiddle,
  nextPoles: fierce,
  nowIso: LATER,
});
assert.equal(moved.event?.kind, 'earned');
assert.equal(moved.history.forms.find((row) => row.legendId === 'HHH-LHH')?.archivedAt, null);
assert.ok(moved.history.forms.find((row) => row.legendId === 'HHH-HHH')?.archivedAt);
const restored = reconcileLegendForms({
  history: moved.history,
  previousPoles: fierce,
  nextPoles: oldHigh,
  nowIso: '2026-12-01T12:00:00.000Z',
});
assert.equal(restored.event?.kind, 'restored');
const back = restored.history.forms.find((row) => row.legendId === 'HHH-HHH');
assert.equal(back?.archivedAt, null);
assert.equal(back?.restoredAt, '2026-12-01T12:00:00.000Z');
assert.equal(back?.firstEarnedAt, NOW_ISO);
assert.ok(restored.history.forms.find((row) => row.legendId === 'HHH-LHH')?.archivedAt);
ok('a matching score restores the archived legend and keeps the first-earned time');

const farmed = reconcileLegendForms({
  history: emptyHistory,
  previousPoles: {},
  nextPoles: nowMiddle,
  nowIso: NOW_ISO,
});
assert.deepEqual(collectedLegendIds(farmed.history), []);
assert.equal(headline.kind, 'balanced');
assert.ok(headline.choices.length === 2);
assert.ok(!collectedLegendIds(farmed.history).includes(headline.choices[0]!.code));
assert.ok(!collectedLegendIds(farmed.history).includes(headline.choices[1]!.code));
ok('a middle reading collects nothing, so picking either nearest name cannot farm a legend');

assert.equal(LEGEND_SHARPER_NOTE, 'Your read got sharper.');
assert.equal(LEGEND_GROWN_OUT_LINE, "You've grown out of this.");
assert.equal(LEGEND_RESTORED_LINE, 'This name fits again.');
const card = readFileSync(resolve(__dirname, '../src/components/identity-card.tsx'), 'utf8');
const pick = card.slice(card.indexOf('headline.choices.map'), card.indexOf('{progress ?'));
assert.doesNotMatch(pick, /recordLegendForm|reconcileLegendForms/);
assert.match(pick, /Not a collected legend/);
assert.match(pick, /pickCloser/);
assert.match(card, /publicCardPoints/);
const sql = readFileSync(resolve(__dirname, '../supabase/migrations/wave115_legend_forms.sql'), 'utf8');
assert.match(sql, /p_archive is honoured only on the one-time migration/);
assert.match(sql, /delete from public\.legend_forms where user_id = uid/);
assert.match(sql, /delete from public\.legend_form_state where user_id = uid/);
ok('the card pick does not record a legend, and the server keeps the archive to one migration');

assert.equal(SELF_CORRECTION_WEIGHT, 1);
assert.equal(traitNudgeValue(0.8, 'other'), 0.2);
assert.equal(traitNudgeValue(0.2, 'other'), 0.8);
assert.equal(traitNudgeValue(0.8, 'softer'), 0.65);
const beforeNudge = equalWeightScore([0.8, 0.8, 0.8, 0.8]);
const afterNudge = equalWeightScore([0.8, 0.8, 0.8, 0.8, { value: 0.2, weight: SELF_CORRECTION_WEIGHT }]);
assert.ok(beforeNudge != null && afterNudge != null && afterNudge < beforeNudge && afterNudge > 0.6 && afterNudge !== 0.2);
ok('Not me is one weighted answer; it nudges the score and does not lock the other end');

function answered(axis: TraitTrack['axis'], n: number, value: number): TraitTrack {
  let row: TraitTrack | null = null;
  for (let i = 0; i < n; i += 1) row = applyEwmaAnswer(row, axis, 'report', value, NOW);
  return { ...row!, answerSamples: Array.from({ length: n }, () => value) };
}
const closer = legendCorrectionSamples(
  [answered('conscientiousness', 4, 0.8), answered('agreeableness', 4, 0.5)],
  {},
  'HHH-LHH',
);
assert.ok(!closer.some((row) => row.axis === 'conscientiousness'));
assert.deepEqual(
  closer.find((row) => row.axis === 'agreeableness'),
  { axis: 'agreeableness', value: 0.2, weight: 1 },
);
assert.ok(closer.every((row) => row.weight === SELF_CORRECTION_WEIGHT));
const correctionSql = readFileSync(resolve(__dirname, '../supabase/migrations/wave117_self_correction.sql'), 'utf8');
assert.match(correctionSql, /does not set a direct source/);
assert.match(correctionSql, /trait_sources ->> p_axis = 'self_confirm'/);
assert.match(correctionSql, /'correction'/);
const correctionBody = correctionSql.slice(correctionSql.indexOf('as $$'));
assert.doesNotMatch(correctionBody, /self_slider|self_settings|self_tap/);
assert.match(readFileSync(resolve(__dirname, '../src/components/full-profile-fold.tsx'), 'utf8'), /TraitResultCorrection/);
assert.equal(CORRECTION_SAVED, 'Saved as one answer. Later answers can still move this.');
ok('a closer legend writes weighted answers on the axes that differ, and never a direct lock');

assert.equal(ATTACHMENT_MIN_ANSWERS, 5);
assert.equal(isAttachmentAxis('attachment_anxiety'), true);
assert.equal(isPublicCardAxis('attachment_anxiety'), false);
const learning = shapedByRow('attachment_anxiety', [answered('attachment_anxiety', 4, 0.8)]);
assert.equal(learning.lean, null);
assert.equal(learning.line, CONFIDENCE_LEARNING_COPY);
const shown = shapedByRow('attachment_anxiety', [answered('attachment_anxiety', 5, 0.8)]);
assert.equal(shown.lean, 'high');
const phrases = topTraitPhrases([answered('attachment_anxiety', 8, 0.9), answered('openness', 8, 0.8)]);
assert.deepEqual(phrases, ['Goes for the untried option']);
const shape = publicCardPoints(traitShapePoints(null, [answered('attachment_anxiety', 8, 0.9), answered('openness', 8, 0.8)]));
assert.equal(shape.find((point) => point.axis === 'attachment_anxiety')?.lean, null);
assert.equal(shape.find((point) => point.axis === 'openness')?.lean != null, true);
ok('attachment traits stay unnamed until 5 answers and off the public card');

assert.equal(WAVE116_OPTION_IDS.length, 17);
assert.ok(WAVE116_OPTION_IDS.includes('openness_03'));
assert.ok(WAVE116_OPTION_IDS.includes('growth_mindset_01'));
const alpha = cronbachAlpha([
  [1, 1, 1],
  [2, 2, 2],
  [3, 3, 3],
  [4, 4, 4],
]);
assert.ok(alpha != null && Math.abs(alpha - 1) < 1e-9);
assert.ok(itemTotalCorrelations([[1, 1], [2, 2], [3, 3], [4, 4]]).every((value) => value != null && value > 0.99));
assert.ok(Math.abs((retestStability([0.2, 0.5, 0.8], [0.2, 0.5, 0.8]) ?? 0) - 1) < 1e-9);
ok('item stats: alpha, item-total and retest are ready for a later run of about 300 people');

console.log(`\n${passed} trait-accuracy checks passed`);
