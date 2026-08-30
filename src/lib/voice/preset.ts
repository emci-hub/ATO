/**
 * Sage voice preset. One parameter on ME, same job as talk_style: fed into
 * the single generate call. All presets inherit sage.txt. A livelier preset
 * adds energy/warmth; it does not drop fact-vs-inference or the hedge rules.
 * motivational_coach is the only preset allowed a closing encouragement line.
 */

export const VOICE_PRESETS = [
  'neutral',
  'close_friend',
  'hyperactive_friend',
  'parent',
  'motivational_coach',
] as const;

export type VoicePreset = (typeof VOICE_PRESETS)[number];

export const DEFAULT_VOICE_PRESET: VoicePreset = 'close_friend';

export const VOICE_PRESET_LABELS: Record<VoicePreset, string> = {
  neutral: 'Neutral',
  close_friend: 'Close friend',
  hyperactive_friend: 'Hyperactive friend',
  parent: 'Parent',
  motivational_coach: 'Motivational coach',
};

/** Cosmetic sample under the selected You-tab preset. Static local strings — never a model call. */
export const VOICE_PRESET_PREVIEWS: Record<VoicePreset, string> = {
  neutral: 'Three days logged. Steady pattern so far.',
  close_friend: "Three days in — that's actually something.",
  hyperactive_friend: "THREE DAYS?! Okay you're actually doing this.",
  parent: 'Three days. Good. Keep going.',
  motivational_coach: "Three days down. You're building something real here.",
};

/** Prompt-facing notes. Ids stay internal; the model sees this sentence. */
export const VOICE_PRESET_GUIDE: Record<VoicePreset, string> = {
  neutral:
    'neutral: spare and even. Warmth is optional. Still state facts directly and hedge only the interpretation.',
  close_friend:
    'close friend: like someone who already knows them. Warm, specific, still in the room. No pep-talk closer.',
  hyperactive_friend:
    'hyperactive friend: more energy and warmth, shorter bursts. Still hedges inference. No closing encouragement unless the fact earned it.',
  parent:
    'parent: steadier, a bit more caretaking, not a lecture. Facts stay facts. Inference stays a hypothesis.',
  motivational_coach:
    'motivational coach: this is the one voice allowed a short closing encouragement line. Still never "you are X". Still hedge inference inside the sentence.',
};

export function isVoicePreset(value: string | null | undefined): value is VoicePreset {
  return !!value && (VOICE_PRESETS as readonly string[]).includes(value);
}

export function voicePresetOf(value: string | null | undefined): VoicePreset {
  return isVoicePreset(value) ? value : DEFAULT_VOICE_PRESET;
}
