import { AXIS_POLE_NAME, AXIS_POLES } from '@/lib/axis-poles';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import { effectiveStability, trackFor, type TraitTrack } from '@/lib/trait-stability';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';
import { voicePresetOf, VOICE_PRESET_GUIDE } from '@/lib/voice/preset';
import { TALK_STYLE_GUIDE } from '@/lib/voice/talk-style';
import { leanHighLow, TRAIT_AXES, type TraitAxis } from '@/lib/traits';
import type { TalkStyle } from '@/lib/voice/types';

import { QUESTIONS_FEW_SHOTS } from './bank';
import type { QuestionGrounding } from './types';

/**
 * Settled axes only (`effectiveStability > 0`), as qualitative pole phrases —
 * never a raw trait value — same convention as `sage-title.ts`'s settled
 * notes. Flavor for grounding, not something the model should ask about
 * directly; the RULES section below says so explicitly.
 */
function traitContextLines(tracks: readonly TraitTrack[]): string[] {
  const lines: string[] = [];
  for (const axis of TRAIT_AXES) {
    const row = trackFor(tracks, axis, 'report');
    if (!row) continue;
    const stability = effectiveStability(row);
    if (stability <= 0) continue;
    const pole = TRAIT_BAND_PHRASES[axis][leanHighLow(row.value)];
    lines.push(
      `- ${AXIS_EDITOR_COPY[axis].label}: leans toward "${pole}" (settled ${stability.toFixed(2)})`,
    );
  }
  return lines;
}

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
  tracks?: readonly TraitTrack[];
  /** Defaults to 5 (Infinite Questions' existing size). Category batches pass up to 10. */
  count?: number;
  /**
   * Category-batch mode only (additive — every pre-existing caller omits
   * this and gets identical output to before). Restricts the AXES list to
   * exactly these axes (instead of all 16) and tells the model how many
   * questions to write for each, so a category's own axes plus any
   * lagging-axis filler questions can be requested in one call.
   */
  axisCounts?: Partial<Record<TraitAxis, number>>;
  /**
   * Category-batch mode only. Literal question text already served to this
   * user (Infinite Questions history + this batch's already-saved
   * questions) — the model must not repeat or closely restate any of these.
   * New phrasing on the same axis is fine; this only blocks near-duplicates.
   */
  excludeText?: readonly string[];
}): string {
  // SHARED-POOL RULE (2026-10-01): every question this prompt produces is saved
  // to question_bank_pool, which OTHER users are served from. So nothing the
  // user typed may enter it — not their name, not a stored fact. A 'fact'
  // grounding is treated as no grounding here; scripts/ongoing-round-check.ts
  // and questions-check.ts pin both.
  const ground =
    input.grounding.kind === 'none' || input.grounding.kind === 'fact' || !input.grounding.detail
      ? 'No specific recent moment. Write plain, grounded questions anyway — never invent a skip or a lapse.'
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

  const traitLines = traitContextLines(input.tracks ?? []);
  const traitContext =
    traitLines.length > 0
      ? `TRAIT CONTEXT (settled axes only, for flavor/grounding — never ask about a trait directly, never name it, never reference the score):\n${traitLines.join('\n')}\n\n`
      : '';

  const count = input.count && input.count > 0 ? Math.floor(input.count) : 5;
  const axesLines = input.axisCounts
    ? Object.entries(input.axisCounts)
        .filter(([, n]) => (n ?? 0) > 0)
        .map(([axis, n]) => `${axis} x${n}`)
        .join(', ')
    : TRAIT_AXES.join(', ');
  // What 0 and 1 mean on each requested axis, so a question cannot drift to
  // a neighbouring trait (staged intake red-team, 2026-10-02). Static app
  // text only — never anything the user typed.
  const endAxes = (
    input.axisCounts
      ? (Object.entries(input.axisCounts) as [TraitAxis, number | undefined][])
          .filter(([, n]) => (n ?? 0) > 0)
          .map(([axis]) => axis)
      : []
  ).filter((axis) => AXIS_POLE_NAME[axis] && AXIS_POLES[axis]);
  const axisEnds =
    endAxes.length > 0
      ? `AXIS ENDS (what 0.2 and 0.8 mean on each axis above — the question must measure THIS, not a neighbouring trait):\n${endAxes
          .map(
            (axis) =>
              `- ${axis}: 0.2 = ${AXIS_POLE_NAME[axis].low} ("${AXIS_POLES[axis].low}"), 0.8 = ${AXIS_POLE_NAME[axis].high} ("${AXIS_POLES[axis].high}")`,
          )
          .join('\n')}\n\n`
      : '';
  const axesLabel = input.axisCounts
    ? `AXES (write exactly this many questions for each — total must equal ${count})`
    : 'AXES (each question maps to exactly one)';
  const exclude =
    input.excludeText && input.excludeText.length > 0
      ? `ALREADY ASKED (never repeat or closely restate any of these — new phrasing on the same axis is fine, the same question is not):\n${input.excludeText.map((t) => `- ${t}`).join('\n')}\n\n`
      : '';

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is Infinite Questions — multiple-choice only, mapping to existing trait axes.

VOICE REFERENCE (write in this register — do NOT reuse these lines verbatim):
${VOICE_REFERENCE}

LOCKED EXAMPLES (use as the few-shot set, exactly this wording as the shape to match — not templates to paste):
${QUESTIONS_FEW_SHOTS}

TODAY
- Talk style: ${TALK_STYLE_GUIDE[input.me.talk_style]}
- Voice: ${VOICE_PRESET_GUIDE[voicePresetOf(input.me.voice_preset)]}

CONTEXT
${retry}${ground}

${traitContext}${exclude}${axesLabel}:
${axesLines}

${axisEnds}${priority}RULES
1. Return exactly ${count} question${count === 1 ? '' : 's'}.
2. Multiple-choice only. 2 or 3 options each. Never ask for free text.
3. Each question maps to one axis from the list. Include the axis id in JSON.
4. Options need a 0–1 value for that axis (high pole closer to 1): use 0.8 for the high end, 0.2 for the low end and 0.5 for a middle option. Prefer 3 options, one at each.
5. No framework names. Plain voice.
6. Ground in something that already happened. Never a hypothetical, "what if," or imagined variant of a real moment.
7. One idea, one moment per question. Never double-barrel a real event and a hypothetical variant of it in the same stem.
8. Options must be genuinely balanced — no leading or socially-desirable "better" answer, and not near-duplicates.
9. Do not use a skipped Check, a cut, or a lapse as grounding. The daily insight owns that signal.
10. Personal facts (something they told Sage) may quietly shape at most one scenario. Never call it out ("you mentioned to Sage that…"). Use sparingly — not every question.
11. Mix stakes. Include genuinely low-stakes / light scenarios. Not every question should be emotionally weighty.
12. ${recent}
13. Never repeat the same sentence shape/structure two questions in a row.
14. Optional, only when genuinely justified: a question may include primaryAxes (1-2 axes it specifically measures, each {axis, weight 0-1, reason}), secondaryAxes (0-3 weaker supporting axes, same shape, lower weight), excludedAxes (axes this question deliberately does NOT measure), and redundancyTags (short lowercase real-world-theme tags). Every one of these is optional — omit all of them for a clean single-axis question rather than inventing a weak secondary axis to fill the field.
15. Where it comes naturally, set the moment in how people live now: a group chat, a shared calendar, forty open tabs, a voice note. Plain words, no slang. This changes the SETTING only — options stay balanced (rule 8), rule 6 still holds, and it never changes which axis a question measures or how its options are valued. Use a late reply or a read receipt ONLY for a question whose axis is about closeness; anywhere else it would measure the wrong thing.

Respond with JSON only, no prose. Minimum shape (single-axis, always valid):
{"questions":[{"axis":"openness","prompt":"...","options":[{"text":"...","value":0.8},{"text":"...","value":0.2}]}]}

Optional richer shape, only when a question genuinely spans axes (see rule 14):
{"questions":[{"axis":"conflict_assertiveness","prompt":"...","options":[{"text":"...","value":0.8},{"text":"...","value":0.2}],"primaryAxes":[{"axis":"conflict_assertiveness","weight":1.0,"reason":"..."},{"axis":"conflict_cooperativeness","weight":0.85,"reason":"..."}],"secondaryAxes":[{"axis":"steadiness","weight":0.35,"reason":"..."}],"excludedAxes":["openness"],"redundancyTags":["interpersonal_conflict"]}]}`;
}
