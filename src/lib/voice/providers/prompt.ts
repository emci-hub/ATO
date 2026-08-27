import { VOICE_REFERENCE } from '../voice-reference';
import type { Tone, VoiceCard, VoiceMe } from '../types';
import { TALK_STYLE_GUIDE, type GenerateInput, type TalkGenerateInput } from './types';

function streakSummary(history: GenerateInput['history']): string {
  if (history.length === 0) return 'No checks logged yet.';
  const recent = history
    .slice(-5)
    .map((h) => `- Day ${h.day}: ${h.status}${h.source ? ` (${h.source})` : ''}`)
    .join('\n');
  return recent;
}

/** Self-report intake lines. Not a diagnosis — they tapped these. */
function intakeContext(me: VoiceMe): string {
  const lines: string[] = [];
  if (me.evening_wind_down) lines.push(`- Evening wind-down they named: ${me.evening_wind_down}`);
  if (me.energy_pattern) lines.push(`- When they say they have the most in the tank: ${me.energy_pattern}`);
  if (me.recovery_style) lines.push(`- What they say pulls them back: ${me.recovery_style}`);
  if (me.support_style) lines.push(`- What they say helps: ${me.support_style}`);
  if (me.current_focus) lines.push(`- What they're mostly trying to do right now: ${me.current_focus}`);
  if (lines.length === 0) return '';
  return `${lines.join('\n')}\n- Treat the lines above as self-report, never as a diagnosis.\n`;
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

CONTEXT
- How this week feels (self-report): ${me.show_up}
- What knocks them off: ${me.knocks_you_off}
- Their morning cue (anchor the Do to this): ${me.morning_cue}
${intakeContext(me)}- Recent checks:
${streakSummary(input.history)}

RULES
1. Read: 1–4 sentences in the voice above. If a cut, name the habit/skip plainly — never the person's worth.
2. Do: exactly ONE if-then action, anchored to the morning cue, e.g. "After you ${me.morning_cue}, <specific concrete action>." Specific enough that they could start it in under 10 minutes.
3. No repetition of content shown before.

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

/** Builds the single-turn prompt that asks Gemini for a Talk reply. */
export function buildTalkPrompt(input: TalkGenerateInput): string {
  const { me, message, day, history, todayCard } = input;
  const styleGuide = TALK_STYLE_GUIDE;

  return `You are Sage, the coach inside the ATO app. You reflect more than you ask. Coach, not doctor. Reply in ~4 sentences max, in the user's talk style.

VOICE REFERENCE (write in this register — do NOT reuse these lines verbatim):
${VOICE_REFERENCE}

USER
- Name: ${me.name}
- Talk style: ${styleGuide[me.talk_style]}
- How this week feels (self-report): ${me.show_up}
- What knocks them off: ${me.knocks_you_off}
- Their morning cue: ${me.morning_cue}
${intakeContext(me)}- Today is day ${day}${todayCard ? `.\n- Today's card:\n  read: ${todayCard.read}\n  do: ${todayCard.do}` : '.'}
- Recent checks:
${streakSummary(history)}

THE USER WROTE:
"${message}"

Reply as Sage, in the voice above and the talk style above. Reflect what they said, then a short helpful nudge. Never a diagnosis, never judgment of the person. No more than 4 sentences. Respond with plain text only, no quotes, no prefix.`;
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
