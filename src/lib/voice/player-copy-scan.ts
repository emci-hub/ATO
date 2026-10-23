/**
 * Player-facing strings the voice check reads. Comments, scripts, the guide,
 * and the draft prompt's bad example are not in here.
 */
import { CATEGORY_BANK } from '@/lib/category-bank';
import { AXIS_CONCEPTS, CATEGORY_CONCEPTS } from '@/lib/concept-explainers';
import { DAILY_LINES } from '@/lib/daily-line/bank';
import { ALL_IDEAS } from '@/lib/insight-bank';
import { CORE_INTAKE_QUESTIONS, INTAKE_SETTINGS_LABELS } from '@/lib/intake';
import { LEGEND_ROSTER } from '@/lib/legend-figures/roster';
import { WEAKNESS_LEAD } from '@/lib/profile-history';
import {
  NOTIFICATION_ASK_BODY,
  NOTIFICATION_ASK_NO,
  NOTIFICATION_ASK_TITLE,
  NOTIFICATION_ASK_YES,
} from '@/lib/push-policy';
import { STORY_LIBRARY } from '@/lib/story-library/library';
import { reviewLibraryVoice } from '@/lib/story-library/voice-review';
import { STORY_LEAN_PHRASES } from '@/lib/story-v3/lean-phrases';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { TRAIT_POLE_LINES } from '@/lib/traits';
import { textIssues } from '@/lib/voice/player-copy';

export interface PlayerCopyIssue {
  where: string;
  detail: string;
}

interface Line {
  where: string;
  text: string;
  allowJourney?: boolean;
}

function pushStrings(lines: Line[], value: unknown, where: string, allowJourney = false): void {
  if (typeof value === 'string') {
    if (value.trim()) lines.push({ where, text: value, allowJourney });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => pushStrings(lines, item, `${where}[${index}]`, allowJourney));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' || key === 'url' || key === 'source') continue;
      pushStrings(lines, child, `${where}.${key}`, allowJourney);
    }
  }
}

export function insightCopyLines(): Line[] {
  const lines: Line[] = [];
  pushStrings(lines, ALL_IDEAS, 'insight');
  return lines;
}

export function categoryCopyLines(): Line[] {
  const lines: Line[] = [];
  pushStrings(lines, CATEGORY_BANK, 'category');
  return lines;
}

function legendLines(): Line[] {
  const lines: Line[] = [];
  for (const legend of LEGEND_ROSTER) {
    const where = `legend ${legend.id}`;
    for (const field of ['essence', 'whoTheyWere', 'famousFor', 'place', 'field', 'role'] as const) {
      const text = legend[field];
      if (text) lines.push({ where: `${where} ${field}`, text, allowJourney: true });
    }
    for (const fact of legend.facts) lines.push({ where: `${where} ${fact.id}`, text: fact.text, allowJourney: true });
    for (const moment of legend.moments) lines.push({ where: `${where} ${moment.id}`, text: moment.text, allowJourney: true });
    for (const angle of legend.angles) {
      lines.push({ where: `${where} ${angle.id} teaser`, text: angle.teaser });
      lines.push({ where: `${where} ${angle.id} meaning`, text: angle.meaning });
    }
    for (const tag of legend.tags) {
      lines.push({ where: `${where} ${tag.axis} ${tag.lean} them`, text: tag.them });
      lines.push({ where: `${where} ${tag.axis} ${tag.lean} why`, text: tag.why, allowJourney: true });
    }
  }
  return lines;
}

function bankLines(): Line[] {
  const lines: Line[] = [
    ...insightCopyLines(),
    ...categoryCopyLines(),
    ...legendLines(),
  ];
  for (const row of DAILY_LINES) lines.push({ where: `daily ${row.keys.join('+')}`, text: row.text });
  pushStrings(lines, STORY_LEAN_PHRASES, 'lean');
  pushStrings(lines, TRAIT_BAND_PHRASES, 'band');
  pushStrings(lines, TRAIT_POLE_LINES, 'pole');
  pushStrings(lines, AXIS_CONCEPTS, 'concept');
  pushStrings(lines, CATEGORY_CONCEPTS, 'category-concept');
  lines.push({ where: 'weakness lead', text: WEAKNESS_LEAD });
  for (const question of CORE_INTAKE_QUESTIONS) {
    lines.push({ where: `intake ${question.field}`, text: question.prompt });
    if (question.helper) lines.push({ where: `intake ${question.field} helper`, text: question.helper });
    for (const chip of question.chips) lines.push({ where: `intake ${question.field} ${chip.value}`, text: chip.label });
  }
  pushStrings(lines, INTAKE_SETTINGS_LABELS, 'intake-label');
  lines.push(
    { where: 'notification title', text: NOTIFICATION_ASK_TITLE },
    { where: 'notification body', text: NOTIFICATION_ASK_BODY },
    { where: 'notification yes', text: NOTIFICATION_ASK_YES },
    { where: 'notification no', text: NOTIFICATION_ASK_NO },
  );
  return lines;
}

export function issuesForLines(lines: readonly Line[]): PlayerCopyIssue[] {
  const issues: PlayerCopyIssue[] = [];
  for (const line of lines) {
    for (const issue of textIssues(line.text, { allowJourney: line.allowJourney })) {
      issues.push({ where: line.where, detail: `${issue.detail}: ${line.text}` });
    }
  }
  return issues;
}

export function insightCopyIssues(): PlayerCopyIssue[] {
  return issuesForLines(insightCopyLines());
}

export function categoryCopyIssues(): PlayerCopyIssue[] {
  return issuesForLines(categoryCopyLines());
}

export function playerCopyIssues(): PlayerCopyIssue[] {
  const issues = issuesForLines(bankLines());
  for (const failure of reviewLibraryVoice(STORY_LIBRARY)) {
    issues.push({ where: `story ${failure.trait} ${failure.tier}`, detail: failure.detail });
  }
  return issues;
}
