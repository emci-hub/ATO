/**
 * Whole-line gate. Every line needs a flip, the bank stays inside the budgets,
 * and a rendered card keeps one shape per spoken line.
 */
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import {
  DIVE_MEANS_MAX_WORDS,
  DIVE_MEANS_MIN_WORDS,
  MIX_MAX_WORDS,
  MIX_MIN_WORDS,
  NOTICE_MAX_WORDS,
  NOTICE_MIN_WORDS,
  SHOWS_MAX_WORDS,
  SHOWS_MIN_WORDS,
  diveLineViolation,
} from '@/lib/category-deep-dive/dive';
import {
  DIFFER_MAX_WORDS,
  DIFFER_MIN_WORDS,
  MEANS_MAX_WORDS,
  MEANS_MIN_WORDS,
  SCENE_MAX_WORDS,
  SCENE_MIN_WORDS,
  WON_MAX_WORDS,
  legendLineViolation,
  titleViolation,
} from '@/lib/legend-figures/story';
import { PRONOUNS } from '@/lib/story-v3/tracery';
import { cardJokeViolation } from '@/lib/voice/card-joke';
import { metaphorSymbolIssues, PROP_CAP_PER_TRAIT, TAG_QUESTION_CAP, phraseCount, tagQuestionShare, textIssues, TRAIT_SCENES } from '@/lib/voice/player-copy';

import { speak } from './pick';
import type { StoryLibrary, StoryLine } from './types';
import { BANNED_PATTERNS } from './types';

const QUOTE_ANSWER = 'I plan a whole new day';
/** Same clause legendDeed returns for Marie Curie. Word counts stay stable. */
const LEGEND_DEED = 'coined the word radioactivity';
const ALLOWED_TOKEN = /\{(?:Subj|subj|Name|legend|answer|deed)\}/g;

const DIVE_BANDS: Record<string, readonly [number, number]> = {
  shows: [SHOWS_MIN_WORDS, SHOWS_MAX_WORDS],
  mix: [MIX_MIN_WORDS, MIX_MAX_WORDS],
  notice: [NOTICE_MIN_WORDS, NOTICE_MAX_WORDS],
  means: [DIVE_MEANS_MIN_WORDS, DIVE_MEANS_MAX_WORDS],
};

const LEGEND_BANDS: Record<string, readonly [number, number]> = {
  'legend-won': [8, WON_MAX_WORDS],
  'legend-scene': [SCENE_MIN_WORDS, SCENE_MAX_WORDS],
  'legend-differ': [DIFFER_MIN_WORDS, DIFFER_MAX_WORDS],
  'legend-means': [MEANS_MIN_WORDS, MEANS_MAX_WORDS],
};

export interface MatrixFailure {
  templateId: string;
  trait: string;
  tier: string;
  pronoun: string;
  detail: string;
}

export interface MatrixReport {
  renders: number;
  failures: MatrixFailure[];
}

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function push(failures: MatrixFailure[], trait: string, tier: string, detail: string): void {
  failures.push({ templateId: 'line', trait, tier, pronoun: '-', detail });
}

function spoken(line: StoryLine, legend = false): string {
  return speak(line.text, PRONOUNS.you, 'You', {
    legend: legend ? 'Marie Curie' : undefined,
    answer: line.text.includes('{answer}') ? QUOTE_ANSWER : undefined,
    deed: legend ? LEGEND_DEED : undefined,
  });
}

function lineIssues(line: StoryLine): string[] {
  const issues: string[] = [];
  if (!line.flip.trim()) issues.push('flip is empty');
  if (line.flip.trim() === line.text.trim()) issues.push('flip repeats the line');
  const bare = line.text.replace(ALLOWED_TOKEN, '');
  if (/[{}]/.test(bare)) issues.push('unknown slot');
  for (const ban of BANNED_PATTERNS) {
    if (ban.test(line.text) || ban.test(line.flip)) issues.push(`banned ${ban}`);
  }
  for (const issue of textIssues(`${line.text}\n${line.flip}`)) issues.push(issue.detail);
  for (const issue of metaphorSymbolIssues(`${line.text}\n${line.flip}`)) issues.push(issue.detail);
  const legend = line.slot.startsWith('legend');
  const text = spoken(line, legend);
  const allowed = [legend ? 'Marie Curie' : '', line.text.includes('{answer}') ? QUOTE_ANSWER : ''].filter(Boolean).join(' ');
  if (line.slot === 'title' || line.slot === 'legend-title') {
    const title = titleViolation(text, allowed);
    if (title) issues.push(title);
  } else if (line.slot === 'joke' || line.slot === 'legend-joke') {
    const joke = cardJokeViolation(text);
    if (joke) issues.push(joke);
    const voice = legend ? legendLineViolation(text, allowed, false) : diveLineViolation(text, allowed);
    if (voice) issues.push(voice);
  } else {
    const voice = legend ? legendLineViolation(text, allowed, false) : diveLineViolation(text, allowed);
    if (voice) issues.push(voice);
    const band = legend ? LEGEND_BANDS[line.slot] : DIVE_BANDS[line.slot];
    if (band) {
      const n = words(text);
      if (n < band[0] || n > band[1]) issues.push(`length ${n}, want ${band[0]}–${band[1]}`);
    }
  }
  return issues;
}

function budgetIssues(lines: readonly StoryLine[]): string[] {
  const issues: string[] = [];
  if (tagQuestionShare(lines.map((line) => line.text)) > TAG_QUESTION_CAP) {
    issues.push(`tag questions are over ${TAG_QUESTION_CAP}`);
  }
  const byTrait: Record<string, string> = {};
  for (const line of lines) byTrait[line.trait] = `${byTrait[line.trait] ?? ''} ${line.text}`;
  for (const trait of TRAIT_AXES) {
    const blob = byTrait[trait] ?? '';
    for (const phrase of TRAIT_SCENES[trait]) {
      const count = phraseCount(blob, phrase);
      if (count === 0) issues.push(`${trait} is missing "${phrase}"`);
      if (count > PROP_CAP_PER_TRAIT) issues.push(`${trait} "${phrase}" appears ${count} times`);
    }
  }
  for (const [owner, phrases] of Object.entries(TRAIT_SCENES)) {
    for (const phrase of phrases) {
      for (const [trait, blob] of Object.entries(byTrait)) {
        if (trait !== owner && blob.toLowerCase().includes(phrase.toLowerCase())) {
          issues.push(`"${phrase}" belongs to ${owner} and also appears in ${trait}`);
        }
      }
    }
  }
  return issues;
}

export function validateLibrary(library: StoryLibrary, options: { requireApproved?: boolean } = {}): MatrixReport {
  const failures: MatrixFailure[] = [];
  const requireApproved = options.requireApproved ?? false;
  let renders = 0;
  const seen = new Set<string>();
  for (const line of library.lines) {
    renders += 1;
    if (seen.has(line.id)) push(failures, line.trait, String(line.tier), `duplicate id ${line.id}`);
    seen.add(line.id);
    if (requireApproved && line.status !== 'approved') {
      push(failures, line.trait, String(line.tier), `${line.id} is ${line.status}`);
    }
    for (const issue of lineIssues(line)) push(failures, line.trait, String(line.tier), `${line.id}: ${issue}`);
  }
  for (const issue of budgetIssues(library.lines)) push(failures, '-', '-', issue);
  return { renders, failures };
}

export type { TraitAxis };
