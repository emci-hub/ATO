import { lineRuleViolation } from '@/lib/daily-line/bank';

import { questionTextGuardHit } from './guards';
import type { QuestionDraft } from './types';

/**
 * Scores one multiple-choice question against the moment voice
 * (src/lib/voice/moment-voice.ts) and the option-balance rules. Pure: no
 * network, no storage. Used by the offline report (scripts/question-voice-report.ts)
 * and meant to be the gate every generated question passes before it is shown.
 *
 * HARD issues mean the question must not ship as is. SOFT issues are taste:
 * one is a light touch, two or more is a rewrite.
 */

export type IssueKind = 'hard' | 'soft';
export interface VoiceIssue {
  kind: IssueKind;
  rule: string;
  detail: string;
}
export type VoiceVerdict = 'keep' | 'light touch' | 'rewrite';

export const QUESTION_PROMPT_MAX = 120;
export const QUESTION_OPTION_MAX = 40;

/** Things the moment voice reaches for: phones, chats, apps, calendars, plans. */
const MODERN_MOMENT =
  /\b(text(s|ed|ing)?|group chat|chat|reply|replies|replied|read receipt|says read|typing|voice note|dm|message[sd]?|notification|unread|tab|tabs|phone|app|apps|calendar|invite|plans?|playlist|queue|show|episode|feed|post(ed)?|story|stories|selfie|photo|emoji|link|meme|online|delivery|order(ed)?|cart|alarm|wifi|laptop|screen|email|inbox|call(s|ed)?|ride|uber|map|gps|ticket|booking|reservation|subscription|password|update|charger|battery|airpods|headphones|podcast)\b/i;

/** A scene: someone, somewhere, something just happened. */
const CONCRETE_SCENE =
  /\b(friend|coworker|boss|partner|roommate|sister|brother|mom|dad|neighbou?r|someone|stranger|waiter|barista|date|party|dinner|lunch|brunch|restaurant|menu|bar|gym|office|meeting|work|saturday|sunday|friday|weekend|tonight|morning|trip|flight|train|bus|line|queue|store|shop|kitchen|desk|room|couch|bed|car|deadline|project|bill|rent|birthday|gift|game|class|hobby)\b/i;

/** Survey-speak: asks about the person in general instead of a moment. */
const ABSTRACT_STEM =
  /\b(in general|generally|how (do|would) you (feel|describe|rate)|do you tend to|how often do you|to what extent|how much do you|would you say|on a scale|describe yourself|as a person|in life)\b/i;

/** Option words that make one answer the obviously right one. */
export const LOADED_OPTION_WORDS = ['obviously', 'of course', 'easily', 'definitely', 'totally', 'absolutely', 'clearly'] as const;
const LOADED_OPTION = new RegExp(`\\b(${LOADED_OPTION_WORDS.join('|')})\\b`, 'i');
/** The longest option may be at most this many times the shortest. */
export const OPTION_LENGTH_RATIO = 3;

/** References that date the question: retired app features, old tech. */
const DATED =
  /\b(your do|today'?s read|the card|read card|do card|voicemail|fax|landline|myspace|facebook wall|dvd|blockbuster|pager|tweet|bbm)\b/i;

function normalizeForDup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(a|an|the|you|your|and|to|of|is|it|that|for|in|on|with)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Recent-prompt lists run to ~1,000 texts and are compared once per draft:
// normalize each text once.
const wordSets = new Map<string, Set<string>>();
function wordsOf(text: string): Set<string> {
  let words = wordSets.get(text);
  if (!words) {
    if (wordSets.size > 5000) wordSets.clear();
    words = new Set(normalizeForDup(text).split(' ').filter(Boolean));
    wordSets.set(text, words);
  }
  return words;
}

/** Word-set overlap (Jaccard) after dropping filler words. 1 = same words. */
export function promptSimilarity(a: string, b: string): number {
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let both = 0;
  for (const w of wa) if (wb.has(w)) both += 1;
  return both / (wa.size + wb.size - both);
}

export const NEAR_DUPLICATE_AT = 0.7;

export interface AssessOptions {
  /** Prompts this question must not repeat (other bank rows, recent rounds). */
  others?: readonly string[];
}

export function assessQuestion(q: QuestionDraft, opts: AssessOptions = {}): VoiceIssue[] {
  const issues: VoiceIssue[] = [];
  const hard = (rule: string, detail: string) => issues.push({ kind: 'hard', rule, detail });
  const soft = (rule: string, detail: string) => issues.push({ kind: 'soft', rule, detail });
  const prompt = q.prompt.trim();

  // Voice rules (mechanical half of moment-voice.ts). A question may end in
  // "?" — the "no question to reflect on" rule is about statements.
  const line = lineRuleViolation(prompt.length > QUESTION_PROMPT_MAX ? prompt.slice(0, QUESTION_PROMPT_MAX) : prompt);
  if (line) hard('voice', `stem ${line}`);
  if (prompt.length > QUESTION_PROMPT_MAX) soft('length', `stem ${prompt.length} chars (max ${QUESTION_PROMPT_MAX})`);
  const guard = questionTextGuardHit(prompt);
  if (guard) hard('jargon', `stem: ${guard}`);
  if (DATED.test(prompt)) hard('dated', `stem mentions "${prompt.match(DATED)?.[0]}"`);
  if (ABSTRACT_STEM.test(prompt)) soft('abstract', `survey wording "${prompt.match(ABSTRACT_STEM)?.[0]}"`);
  if (!MODERN_MOMENT.test(prompt) && !CONCRETE_SCENE.test(prompt)) soft('abstract', 'no concrete moment or setting');
  else if (!MODERN_MOMENT.test(prompt)) soft('not modern', 'a scene, but nothing from how people live now');

  // Options.
  const n = q.options.length;
  if (n < 2 || n > 3) hard('options', `${n} options (2-3 allowed)`);
  const lengths: number[] = [];
  for (const o of q.options) {
    const t = o.text.trim();
    lengths.push(t.length);
    if (!t) hard('options', 'empty option');
    if (t.length > QUESTION_OPTION_MAX) soft('length', `option "${t}" ${t.length} chars`);
    const ov = lineRuleViolation(t);
    if (ov && ov !== 'gives advice') hard('voice', `option "${t}" ${ov}`);
    const og = questionTextGuardHit(t);
    if (og) hard('jargon', `option "${t}": ${og}`);
    if (LOADED_OPTION.test(t)) soft('balance', `option "${t}" sounds like the right answer`);
  }
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  if (shortest > 0 && longest / shortest > OPTION_LENGTH_RATIO) soft('balance', `options very uneven (${shortest} vs ${longest} chars)`);

  // Values must reach both ends of the trait.
  const values = q.options.map((o) => o.value);
  if (new Set(values).size !== values.length) hard('values', 'two options share a value');
  if (!values.includes(0.2) || !values.includes(0.8)) hard('values', `values ${values.join('/')} miss an end (need 0.2 and 0.8)`);

  // Repeats.
  for (const other of opts.others ?? []) {
    if (other === q.prompt) continue;
    const sim = promptSimilarity(prompt, other);
    if (sim >= NEAR_DUPLICATE_AT) {
      hard('repeat', `near-duplicate of "${other.slice(0, 60)}" (${sim.toFixed(2)})`);
      break;
    }
  }
  return issues;
}

/**
 * The gate every AI-written question passes before it is saved or shown
 * (forever loop, 2026-10-05): any hard issue, or an option that sounds like
 * the right answer. Returns the reason it fails, or null. A failing question
 * is dropped and its slot goes back to the shortfall retry — never shown.
 * `recent` is the person's already-asked prompts (repeat check).
 */
export function generatedQuestionFailure(q: QuestionDraft, recent: readonly string[] = []): string | null {
  const issues = assessQuestion(q, { others: recent });
  const blocking = issues.find((i) => i.kind === 'hard' || i.rule === 'balance');
  return blocking ? `${blocking.rule}: ${blocking.detail}` : null;
}

export function verdictFor(issues: readonly VoiceIssue[]): VoiceVerdict {
  if (issues.some((i) => i.kind === 'hard')) return 'rewrite';
  const soft = issues.filter((i) => i.kind === 'soft').length;
  if (soft >= 2) return 'rewrite';
  if (soft === 1) return 'light touch';
  return 'keep';
}
