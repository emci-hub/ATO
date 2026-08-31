/**
 * Full-sweep mode: one item per axis, all TRAIT_AXES, one batch.
 * Distinct from the 5-item soft-rotation used by Tell Sage more.
 */
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import { QUESTIONS_FEW_SHOTS } from './bank';
import { keepGuardedDrafts } from './guards';
import { bankByAxis, composeLocalSweep, QUESTIONS_SWEEP_SIZE } from './local';
import { parseQuestionSweep } from './parse';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';
import { voicePresetOf, VOICE_PRESET_GUIDE } from '@/lib/voice/preset';
import { TALK_STYLE_GUIDE } from '@/lib/voice/providers/types';
import type { TalkStyle } from '@/lib/voice/types';
import { VOICE_CONFIG } from '@/lib/voice/config';

import type { QuestionDraft } from './types';

export {
  INTAKE_SWEEP_COPY_REVIEWED,
  QUESTIONS_SWEEP_SIZE,
  bankByAxis,
  composeLocalSweep,
  unansweredSweep,
} from './local';

export function buildQuestionsSweepPrompt(input: {
  me: { name: string; talk_style: TalkStyle; voice_preset: string };
  retryHint?: boolean;
}): string {
  const retry = input.retryHint
    ? 'Previous draft had a blocked term or pattern. Write a different full set.\n'
    : '';

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is a full-sweep of Infinite Questions — one multiple-choice item per axis, all ${TRAIT_AXES.length}, in a single batch.

VOICE REFERENCE (write in this register — do NOT reuse these lines verbatim):
${VOICE_REFERENCE}

LOCKED EXAMPLES (shape to match — not templates to paste):
${QUESTIONS_FEW_SHOTS}

TODAY
- User: ${input.me.name}
- Talk style: ${TALK_STYLE_GUIDE[input.me.talk_style]}
- Voice: ${VOICE_PRESET_GUIDE[voicePresetOf(input.me.voice_preset)]}

${retry}AXES (exactly one question per axis, every axis, no extras, no repeats):
${TRAIT_AXES.join(', ')}

RULES
1. Return exactly 15 questions — one for each axis above, in that order.
2. Multiple-choice only. 2 or 3 options each. Never ask for free text.
3. Each question maps to exactly one axis. Include the axis id in JSON.
4. Options need a 0–1 value for that axis (high pole closer to 1).
5. No framework names. Plain voice. A few seconds to read.
6. One idea per question. Never double-barrel.
7. Options must be genuinely balanced — no leading or socially-desirable "better" answer.
8. Mix stakes. Include genuinely low-stakes / light scenarios.
9. This is a full sweep, not a rotating batch of 5. Do not skip an axis.

Respond with JSON only, no prose, in this shape:
{"questions":[{"axis":"openness","prompt":"...","options":[{"text":"...","value":0.8},{"text":"...","value":0.2}]}]}`;
}

export async function generateQuestionSweep(prompt: string): Promise<QuestionDraft[] | null> {
  const key = VOICE_CONFIG.geminiApiKey;
  if (!key || VOICE_CONFIG.provider === 'local') return null;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(VOICE_CONFIG.geminiModel)}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: 'low' },
      },
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
  const drafts = parseQuestionSweep(text);
  return drafts.length > 0 ? drafts : null;
}

/**
 * One item per axis. Gemini if reachable; otherwise the locked bank.
 * Does not touch the 5-item rotation used by Tell Sage more.
 */
export async function routeQuestionSweep(input: {
  me: { name: string; talk_style: TalkStyle; voice_preset: string };
  useLocal?: boolean;
}): Promise<QuestionDraft[]> {
  const local = composeLocalSweep();
  if (input.useLocal === true || !VOICE_CONFIG.geminiApiKey || VOICE_CONFIG.provider === 'local') {
    return local;
  }

  const first = await generateQuestionSweep(buildQuestionsSweepPrompt(input));
  let { kept } = keepGuardedDrafts(first ?? []);
  if (kept.length < QUESTIONS_SWEEP_SIZE) {
    const retry = await generateQuestionSweep(
      buildQuestionsSweepPrompt({ ...input, retryHint: true }),
    );
    const again = keepGuardedDrafts(retry ?? []).kept;
    const seen = new Set(kept.map((draft) => draft.axis));
    for (const draft of again) {
      if (seen.has(draft.axis)) continue;
      seen.add(draft.axis);
      kept.push(draft);
    }
  }

  const byAxis = new Map<TraitAxis, QuestionDraft>();
  for (const draft of kept) {
    if (!byAxis.has(draft.axis)) byAxis.set(draft.axis, draft);
  }
  const localByAxis = bankByAxis();
  const out: QuestionDraft[] = [];
  for (const axis of TRAIT_AXES) {
    const draft = byAxis.get(axis) ?? localByAxis.get(axis);
    if (!draft) continue;
    out.push({
      axis: draft.axis,
      prompt: draft.prompt,
      options: draft.options.map((opt) => ({ ...opt })),
    });
  }
  return keepGuardedDrafts(out).kept;
}
