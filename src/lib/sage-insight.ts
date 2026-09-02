/**
 * Token-spent extra Sage observation. Conversational. No trait write.
 * Distinct from the daily Explore regen and from Talk quota handling:
 * spend happens only after a body lands.
 */
import { traitPromptLines, type TraitAxis, TRAIT_AXES } from '@/lib/traits';
import { isThinProfile } from '@/lib/trait-stability';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import type { VoiceMe } from '@/lib/voice/types';
import { VOICE_REFERENCE } from '@/lib/voice/voice-reference';
import { voicePresetOf, VOICE_PRESET_GUIDE } from '@/lib/voice/preset';
import { TALK_STYLE_GUIDE } from '@/lib/voice/providers/types';
import { generateExploreBody } from '@/lib/explore/generate';
import { SAGE_INSIGHT_META } from '@/lib/ai/call-sites';
import { shouldUseLocalAi } from '@/lib/ai/override';

export const SAGE_INSIGHT_THIN =
  "I don't have much to go on yet about how you tend to move, so this stays general.";

export function buildSageInsightPrompt(me: VoiceMe, settled = 0): string {
  const traits = traitPromptLines(me);
  const thin = isThinProfile(settled)
    ? `Their profile is still thin (${settled} of ${TRAIT_AXES.length} settled). Say so plainly. Coach more generally. Do not invent specifics.`
    : `They have ${settled} of ${TRAIT_AXES.length} settled. Draw on that depth when it matches.`;

  return `Write as Sage in the ATO app. Follow the voice reference. Not a doctor. This is one extra observation they asked for — not a daily card, not a trait write.

VOICE REFERENCE (write in this register — do NOT reuse these lines verbatim):
${VOICE_REFERENCE}

TODAY
- User: ${me.name}
- Talk style: ${TALK_STYLE_GUIDE[me.talk_style]}
- Voice: ${VOICE_PRESET_GUIDE[voicePresetOf(me.voice_preset)]}

${thin}
${traits || '- No self-report lines yet.'}

RULES
1. 2–4 sentences. Conversational. Notice, don't correct.
2. No framework names. Never "you are." Never a type or a diagnosis.
3. Do not write or suggest a trait score. Observation only.
4. If the profile is thin, say so plainly and stay general.

Respond with JSON only, no prose, in this shape:
{"body": "<the observation>"}`;
}

export async function generateSageInsight(me: VoiceMe, settled = 0): Promise<string | null> {
  if (await shouldUseLocalAi()) {
    const body = isThinProfile(settled)
      ? SAGE_INSIGHT_THIN
      : 'Noticing how you have been moving lately — nothing to fix, just the pattern as it is.';
    return containsFrameworkTerm(body) ? null : body;
  }
  const body = await generateExploreBody(buildSageInsightPrompt(me, settled), SAGE_INSIGHT_META);
  if (!body || containsFrameworkTerm(body)) return null;
  return body;
}

export function insightCopyClean(): boolean {
  return !containsFrameworkTerm(SAGE_INSIGHT_THIN);
}

export type { TraitAxis };
