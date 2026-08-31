import { phraseForStoredChip } from '@/lib/intake';
import { libraryGroundingBlock, selectLibraryEntries } from '@/lib/voice/library';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';
import { voicePresetOf, VOICE_PRESET_GUIDE } from '@/lib/voice/preset';
import { TALK_STYLE_GUIDE } from '@/lib/voice/providers/types';
import { traitPromptLines, type TraitAxis } from '@/lib/traits';

import type { ExploreFocus, ExploreMeSlice } from './types';

/**
 * Internal prompt scaffolding only. Never render, never log as a user-facing
 * label. Exact lines — do not rephrase.
 */
export const EXPLORE_AXIS_GROUNDING_LINES = [
  'openness: curiosity about ideas, new experiences, trying something unfamiliar',
  'conscientiousness: follow-through, structure, planning ahead vs staying loose',
  'extraversion: energy from people and activity vs energy from quiet and solitude',
  'agreeableness: how they move through disagreement — softening it or naming it',
  'steadiness: emotional evenness under pressure vs feeling things sharply',
  'attachment_anxiety: needing reassurance, worrying where they stand with someone',
  'attachment_avoidance: pulling back or staying self-reliant as closeness increases',
  'conflict_assertiveness: saying the hard thing directly, or letting it sit',
  'conflict_cooperativeness: looking for a shared fix, or holding their ground',
  'autonomy: wanting to choose their own path vs wanting guidance',
  'competence: confidence in their own follow-through and capability',
  'relatedness: how connected they feel to the people around them right now',
  'growth_mindset: whether setbacks read as fixed or as something that can shift',
  'locus_of_control: outcomes feeling steered by them, or happening to them',
  "self_efficacy: belief they can actually do the thing they're setting out to do",
  'playfulness: whether a bit of lightness is how a day lands, versus treating the day as a job',
] as const;

export const EXPLORE_AXIS_GROUNDING: Record<TraitAxis, string> = Object.fromEntries(
  EXPLORE_AXIS_GROUNDING_LINES.map((line) => {
    const split = line.indexOf(': ');
    return [line.slice(0, split), line.slice(split + 2)];
  }),
) as Record<TraitAxis, string>;

function axisGroundingBlock(traits: ExploreFocus['traits']): string {
  if (traits.length === 0) return '';
  const lines = traits.map((axis) => `${axis}: ${EXPLORE_AXIS_GROUNDING[axis]}`);
  return `AXIS GROUNDING (internal only — write from this meaning. Never name the axis, never paste this line, never say "you are." Chips and signals are texture around this, not a different topic.)
${lines.join('\n')}
`;
}

/**
 * Explore few-shots — deeper than Read, may combine 2–3 traits, same root
 * voice. Examples to match, not templates to paste.
 */
export const EXPLORE_FEW_SHOTS = `## Explore
You skipped twice this week, both times when your plate was already full. Maybe that's less about not wanting people time, and more about just not having room for it.

## Explore
Sleep showed up in this week's Reads, and you also said a short reset is what pulls you back. Noticing those together — maybe the reset is doing the job sleep didn't.

## Explore
You mentioned it bothers you when a text goes unanswered for a while — but you're also someone who tends to leave people a little space. Might be both: wanting things to keep moving, but not wanting to be the one pushing.

## Explore
Your best energy shows up right after coffee, and lately you're mostly just trying to show up. That's a lot to ask of one small window in your day.`;

function chipLines(me: ExploreMeSlice, chips: ExploreFocus['chips']): string {
  const lines: string[] = [];
  for (const chip of chips) {
    const value = me[chip];
    if (typeof value === 'string' && value.trim()) {
      const display =
        chip === 'knocks_you_off'
          ? value
              .split(/,\s*/)
              .map((part) => phraseForStoredChip(part.trim()))
              .filter(Boolean)
              .join(', ')
          : phraseForStoredChip(value);
      lines.push(`- ${chip}: ${display}`);
    }
  }
  return lines.length === 0 ? '- (none named)' : lines.join('\n');
}

function traitLines(me: ExploreMeSlice, traits: ExploreFocus['traits']): string {
  if (traits.length === 0) return '- (no extra-axis scores — write from the chips only)';
  const slice = Object.fromEntries(traits.map((axis) => [axis, me[axis]]));
  const lines = traitPromptLines(slice);
  return lines.trim() ? lines.trim() : traits.map((axis) => `- ${axis} is filled`).join('\n');
}

export function buildExplorePrompt(input: {
  me: ExploreMeSlice;
  focus: ExploreFocus;
  reactionNotes: string[];
  retryHint?: boolean;
}): string {
  const { me, focus } = input;
  const signalLine = focus.signal
    ? `- Recent signal (${focus.signal.kind}): ${focus.signal.detail}`
    : '- No recent signal. Stay at one trait, or write from the chips. Do not invent a 2–3 combo.';

  const combineRule =
    focus.traits.length >= 2
      ? `Combine these ${focus.traits.length} traits in one observation. At least one is tied to the recent signal.`
      : 'One trait or chips only. Do not manufacture a 2–3 combo.';

  const missed = input.reactionNotes.length
    ? `ANGLES THAT DID NOT LAND for this person (do not reuse; never treat as a trait score):\n${input.reactionNotes.map((note) => `- ${note}`).join('\n')}`
    : 'No prior Explore reactions.';

  const groundingPresent = focus.traits.length > 0;
  const lengthRule = groundingPresent
    ? `7. AXIS GROUNDING is internal. Write the observation from that meaning. Do not quote it. Do not let a chip or signal (sleep, coffee, recovery) replace the tagged axis.
8. 2–4 sentences. Deeper than a daily Read. Plain text.`
    : '7. 2–4 sentences. Deeper than a daily Read. Plain text.';

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is Explore — a deeper observation, not a daily Read/Do.

VOICE REFERENCE (write in this register — do NOT reuse these lines verbatim):
${VOICE_REFERENCE}

EXPLORE SHAPE (examples to match, not templates to paste):
${EXPLORE_FEW_SHOTS}

TODAY
- User: ${me.name}
- Talk style: ${TALK_STYLE_GUIDE[me.talk_style]}
- Voice: ${VOICE_PRESET_GUIDE[voicePresetOf(me.voice_preset)]}
${input.retryHint ? '- Previous draft was dropped because it named a type or label. Write a different angle.\n' : ''}
CONTEXT
${traitLines(me, focus.traits)}
${axisGroundingBlock(focus.traits)}CHIPS they already named:
${chipLines(me, focus.chips.length > 0 ? focus.chips : ['morning_cue', 'show_up', 'current_focus', 'recovery_style'])}
${signalLine}
${libraryGroundingBlock(selectLibraryEntries(me, { day: 1, surface: 'card' }))}

${missed}

RULES
1. ${combineRule}
2. Never combine growth_mindset, locus_of_control, and self_efficacy in one entry.
3. Reflect patterns as maybes, not facts. No "you are." No framework names (MBTI, Big Five, attachment, and the rest). Never name the axis. Notice, don't correct.
4. Hedge lives inside the sentence. No bolted-on closing after a dash or period.
5. Completeness is not an input. Do not mention leftover axes, a fuller profile, or that more answers would help.
6. FRAMING NOTES are concepts, not copy. Restate in Sage's own words. Never paste a note.
${lengthRule}

Respond with JSON only, no prose, in this shape:
{"body": "<the observation>"}`;
}

export function parseExploreBody(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    if (typeof obj.body === 'string' && obj.body.trim().length > 0) {
      return obj.body.trim();
    }
  } catch {
    // fall through
  }

  const quoted = cleaned.match(/"body"\s*:\s*"((?:\\.|[^"\\])*)"/i)?.[1];
  if (quoted) return quoted.replace(/\\n/g, ' ').trim();
  if (cleaned.length > 20 && !cleaned.startsWith('{')) return cleaned.slice(0, 1200);
  return null;
}
