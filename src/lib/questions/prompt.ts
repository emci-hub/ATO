import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';
import { voicePresetOf, VOICE_PRESET_GUIDE } from '@/lib/voice/preset';
import { TALK_STYLE_GUIDE } from '@/lib/voice/providers/types';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import type { TalkStyle } from '@/lib/voice/types';

import { QUESTIONS_FEW_SHOTS } from './bank';
import type { QuestionGrounding } from './types';

export function buildQuestionsPrompt(input: {
  me: {
    name: string;
    talk_style: TalkStyle;
    voice_preset: string;
  };
  grounding: QuestionGrounding;
  recentAxes?: string[];
  retryHint?: boolean;
  priorityAxes?: readonly TraitAxis[];
}): string {
  const ground =
    input.grounding.kind === 'none' || !input.grounding.detail
      ? 'No specific recent moment. Write plain, grounded questions anyway — never invent a skip or a lapse.'
      : input.grounding.kind === 'fact'
        ? `A stored fact may quietly shape at most one scenario (do not quote it, never "you mentioned to Sage"): ${input.grounding.detail}`
        : `Ground at least one question in this recent moment (${input.grounding.kind}): ${input.grounding.detail}`;

  const recent =
    input.recentAxes && input.recentAxes.length > 0
      ? `Do not repeat these recently asked axes (soft rotation, last 2–3): ${input.recentAxes.join(', ')}.`
      : 'No recent axes to avoid.';

  const priority =
    input.priorityAxes && input.priorityAxes.length > 0
      ? `PRIORITY AXES (cover as many of these as you can, in the order listed — the user skipped them elsewhere and they are still unanswered): ${input.priorityAxes.join(', ')}.\n`
      : '';

  const retry = input.retryHint
    ? 'Previous draft had a blocked term or pattern in a question or an option. Write a different batch.\n'
    : '';

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is Infinite Questions — multiple-choice only, mapping to existing trait axes.

VOICE REFERENCE (write in this register — do NOT reuse these lines verbatim):
${VOICE_REFERENCE}

LOCKED EXAMPLES (use as the few-shot set, exactly this wording as the shape to match — not templates to paste):
${QUESTIONS_FEW_SHOTS}

TODAY
- User: ${input.me.name}
- Talk style: ${TALK_STYLE_GUIDE[input.me.talk_style]}
- Voice: ${VOICE_PRESET_GUIDE[voicePresetOf(input.me.voice_preset)]}

CONTEXT
${retry}${ground}

AXES (each question maps to exactly one):
${TRAIT_AXES.join(', ')}

${priority}RULES
1. Return exactly 5 questions.
2. Multiple-choice only. 2 or 3 options each. Never ask for free text.
3. Each question maps to one axis from the list. Include the axis id in JSON.
4. Options need a 0–1 value for that axis (high pole closer to 1).
5. No framework names. Plain voice.
6. Ground in something that already happened. Never a hypothetical, "what if," or imagined variant of a real moment.
7. One idea, one moment per question. Never double-barrel a real event and a hypothetical variant of it in the same stem.
8. Options must be genuinely balanced — no leading or socially-desirable "better" answer, and not near-duplicates.
9. Do not use a skipped Check, a cut, or a lapse as grounding. Dawn owns that signal.
10. Personal facts (something they told Sage) may quietly shape at most one scenario. Never call it out ("you mentioned to Sage that…"). Use sparingly — not every question.
11. Mix stakes. Include genuinely low-stakes / light scenarios. Not every question should be emotionally weighty.
12. ${recent}
13. Never repeat the same sentence shape/structure two questions in a row.

Respond with JSON only, no prose, in this shape:
{"questions":[{"axis":"openness","prompt":"...","options":[{"text":"...","value":0.8},{"text":"...","value":0.2}]}]}`;
}
