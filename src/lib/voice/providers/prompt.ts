import { traitPromptLines } from '@/lib/traits';

import { libraryGroundingBlock, selectLibraryEntries } from '../library';
import { VOICE_REFERENCE } from '../voice-reference';
import type { Tone, VoiceCard, VoiceMe } from '../types';
import { TALK_STYLE_GUIDE, type GenerateInput, type TalkGenerateInput } from './types';

/** Keep in sync with `TALK_RECENT_CHECKS` in checks.ts (Sage's talk fetch). */
export const TALK_PROMPT_HISTORY = 5;

function streakSummary(history: GenerateInput['history']): string {
  if (history.length === 0) return 'No checks logged yet.';
  const recent = history
    .slice(-TALK_PROMPT_HISTORY)
    .map((h) => `- Day ${h.day}: ${h.status}${h.source ? ` (${h.source})` : ''}`)
    .join('\n');
  return recent;
}

function alreadyShown(history: GenerateInput['history']): string {
  const cards = history.filter((h) => h.read && h.do).slice(-7);
  if (cards.length === 0) return 'None yet.';
  return cards
    .map((h) => `- Day ${h.day} Read: ${h.read}\n  Do: ${h.do}`)
    .join('\n');
}

function signalPool(me: VoiceMe): string {
  const knocks = me.knocks_you_off
    .split(/,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  const facts = (me.facts ?? []).filter((fact) => fact.trim().length > 0).slice(0, 8);
  const lines: string[] = [];
  if (knocks.length > 0) {
    lines.push(`- Knocks they named (rotate; do not default to the first one every day): ${knocks.join('; ')}`);
  }
  if (facts.length > 0) {
    lines.push(`- Remembered facts (optional; pick a different one than recent Reads used): ${facts.join('; ')}`);
  }
  if (me.current_focus) lines.push(`- Current focus chip: ${me.current_focus}`);
  if (me.show_up) lines.push(`- How this week feels: ${me.show_up}`);
  if (me.recovery_style) lines.push(`- What they say pulls them back: ${me.recovery_style}`);
  return lines.length === 0 ? '- (no extra signals)' : lines.join('\n');
}

function threadTurns(turns: TalkGenerateInput['recentTurns']): string {
  if (!turns || turns.length === 0) return '';
  const lines = turns
    .filter((turn) => turn.text.trim().length > 0)
    .slice(-6)
    .map((turn) => `${turn.role}: ${turn.text.trim().slice(0, 400)}`);
  if (lines.length === 0) return '';
  return `\nRECENT TURNS IN THIS THREAD (oldest first; the new line is below, not listed here):\n${lines.join('\n')}\n`;
}

/** Self-report intake lines. Not a diagnosis — they tapped these. */
function intakeContext(me: VoiceMe): string {
  const lines: string[] = [];
  if (me.evening_wind_down) lines.push(`- Evening wind-down they named: ${me.evening_wind_down}`);
  if (me.energy_pattern) lines.push(`- When they say they have the most in the tank: ${me.energy_pattern}`);
  if (me.recovery_style) lines.push(`- What they say pulls them back: ${me.recovery_style}`);
  if (me.support_style) lines.push(`- What they say helps: ${me.support_style}`);
  if (me.current_focus) lines.push(`- What they're mostly trying to do right now: ${me.current_focus}`);
  const traits = traitPromptLines(me);
  const intake = lines.length === 0 ? '' : `${lines.join('\n')}\n- Treat the lines above as self-report, never as a diagnosis.\n`;
  return `${intake}${traits}`;
}

/** Builds the single-turn prompt that asks Gemini for today's card. */
export function buildPrompt(input: GenerateInput): string {
  const { me, day, tone, crisisToday, previousHadCut } = input;

  const styleGuide = TALK_STYLE_GUIDE;

  const toneNote: Record<Tone, string> = {
    lift: 'today is a lift — they showed up, name the streak without inflating it.',
    even: 'today is even — a normal day, no drama, nothing to fix.',
    cut: 'today is a cut — a habit was skipped; call out the HABIT, never the person.',
  };

  return `You are Sage, the coach inside the ATO app. You reflect more than you ask. Coach, not doctor. ~4 sentences max.

VOICE REFERENCE (write in this register — do NOT reuse these lines verbatim):
${VOICE_REFERENCE}

TODAY
- User: ${me.name}
- Day: ${day}
- Talk style: ${styleGuide[me.talk_style]}
- Tone: ${toneNote[tone]}
${crisisToday ? '- CRISIS DAY: do NOT include any cut, no matter what.' : ''}
${previousHadCut ? '- Yesterday was already a cut. Do NOT cut again.' : ''}
${input.retryHint ? `- Previous draft was dropped (${input.retryHint}). Write a different angle, not a rephrase.` : ''}

CONTEXT
- Morning cue (anchor the Do to this): ${me.morning_cue}
${intakeContext(me)}- Recent checks:
${streakSummary(input.history)}

AVAILABLE SIGNALS — pick ONE primary angle today. Do not default to the same knock or the same streak/baseline story two days in a row.
${signalPool(me)}
${libraryGroundingBlock(selectLibraryEntries(me, { day, surface: 'card' }))}

ALREADY SHOWN (do not reuse wording OR the same topic angle):
${alreadyShown(input.history)}

RULES
1. Read: 1–4 sentences. General reflection on today/the pattern, from a signal that recent Reads did not already use.
2. Do: exactly ONE if-then action, anchored to the morning cue, e.g. "After you ${me.morning_cue}, <specific concrete action>." Specific enough that they could start it in under 10 minutes. The action should fit today's angle, not copy yesterday's Do with new adjectives.
3. No repetition of content shown before — paraphrases of the same sleep/streak/baseline story still count as repetition.
4. Describe how they tend to move, never label them. No type codes, no scores-as-identity, no diagnosis.

Respond with JSON only, no prose, in this shape:
{"read": "<the read text>", "do": "<the do text>"}`;
}

export interface ParsedCard {
  read: string;
  do: string;
}

/** Extracts {read, do} from Gemini's JSON (tolerating fences and stray text). */
export function parseGeminiCard(raw: string): ParsedCard | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    if (typeof obj.read === 'string' && typeof obj.do === 'string') {
      return { read: obj.read.trim(), do: obj.do.trim() };
    }
  } catch {
    // fall through to line-based parse
  }

  const read = cleaned.match(/^"?read"?\s*:\s*"(.+?)"\s*,?$/mi)?.[1];
  const doText = cleaned.match(/^"?do"?\s*:\s*"(.+?)"\s*,?$/mi)?.[1];
  if (read && doText) return { read: read.trim(), do: doText.trim() };
  return null;
}

/** Normalises a card so the gemini card and local card share shape checks. */
export function isUsableCard(card: ParsedCard | null): card is VoiceCard {
  return card !== null && card.read.length > 0 && card.do.length > 0;
}

// --- Talk reply -----------------------------------------------------------

/** Builds the Talk prompt. Card is background only; the typed line is the job. */
export function buildTalkPrompt(input: TalkGenerateInput): string {
  const { me, message, day, history, todayCard } = input;
  const styleGuide = TALK_STYLE_GUIDE;
  const cardBlock = todayCard
    ? `OPTIONAL BACKGROUND — today's Home card. Do not restate, paraphrase, or answer as if they asked about this unless they did.
- Home Read: ${todayCard.read}
- Home Do: ${todayCard.do}`
    : 'OPTIONAL BACKGROUND: no Home card today.';

  return `You are Sage, the coach inside the ATO app. Coach, not doctor. This is a conversation, not a daily card.

VOICE NOTE: write in Sage's register (reflect more than ask) but do NOT recycle the Home-card voice-reference lines as the reply.

WHO THEY ARE (tone only — not the topic unless they bring it up)
- Name: ${me.name}
- Talk style: ${styleGuide[me.talk_style]}
- How this week feels (self-report): ${me.show_up}
- What knocks them off: ${me.knocks_you_off}
- Morning cue: ${me.morning_cue}
${intakeContext(me)}- Today is day ${day}.
- Recent checks:
${streakSummary(history)}

${cardBlock}
${libraryGroundingBlock(selectLibraryEntries(me, { day, surface: 'talk', message }))}
${threadTurns(input.recentTurns)}${
    input.retryHint
      ? `PREVIOUS DRAFT was dropped because it named a type or label. Write a different angle. Describe how they tend to move — never a type, score, or diagnosis.\n`
      : ''
  }
THEY JUST SAID:
"${message}"

Answer that first and directly. If they asked a question, give a straight answer to that question. Do not pivot to streaks, sleep, or the Home Read unless they brought those up. Use any framing notes above only when they match what they just said. A short helpful nudge is fine after the answer. Never a diagnosis, never judgment of the person, never a type label. No more than 4 sentences. Plain text only, no quotes, no prefix.`;
}

export interface ParsedTalkReply {
  reply: string;
}

/** Extracts the reply from Gemini's raw text. */
export function parseTalkReply(raw: string): ParsedTalkReply | null {
  const trimmed = raw.trim().replace(/^```(?:text)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (trimmed.length === 0) return null;
  return { reply: trimmed };
}
