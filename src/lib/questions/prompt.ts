import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';
import { voicePresetOf, VOICE_PRESET_GUIDE } from '@/lib/voice/preset';
import { TALK_STYLE_GUIDE } from '@/lib/voice/providers/types';
import { TRAIT_AXES } from '@/lib/traits';
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
}): string {
  const ground =
    input.grounding.kind === 'none' || !input.grounding.detail
      ? 'No specific recent moment. Write plain, grounded questions anyway — never invent a skip or a lapse.'
      : input.grounding.kind === 'fact'
        ? `A stored fact may quietly shape at most one scenario (do not quote it, never "you mentioned to Sage"): ${input.grounding.detail}`
        : `Ground at least one question in this recent moment (${input.grounding.kind}): ${input.grounding.detail}`;

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
${ground}

AXES (each question maps to exactly one):
${TRAIT_AXES.join(', ')}

RULES
1. Return exactly 5 questions.
2. Multiple-choice only. 2 or 3 options each. Never ask for free text.
3. Each question maps to one axis from the list. Include the axis id in JSON.
4. Options need a 0–1 value for that axis (high pole closer to 1).
5. No framework names. Plain voice.
6. Do not use a skipped Check or a lapse as grounding.

Respond with JSON only, no prose, in this shape:
{"questions":[{"axis":"openness","prompt":"...","options":[{"text":"...","value":0.8},{"text":"...","value":0.2}]}]}`;
}
