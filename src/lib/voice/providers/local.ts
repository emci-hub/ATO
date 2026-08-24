import { hasCut } from '../filters';
import type { TalkStyle, Tone, VoiceCard } from '../types';
import type { GenerateInput, TalkGenerateInput, VoiceProvider } from './types';

/**
 * Deterministic local generator used in dev / tests (MODEL_PROVIDER=local) and
 * as the fallback when gemini is configured but no key is present. Writes in
 * the sage.txt register — style × tone, day-parameterised so Day 4 can never
 * be string-identical to Day 3.
 */

const READ_TEMPLATES: Record<TalkStyle, Record<Tone, (day: number) => string>> = {
  quiet: {
    lift: (d) =>
      `Day ${d} in a row now. You did the thing and didn't make noise about it — that's the pattern that actually holds.`,
    even: (d) =>
      `Day ${d}. Nothing broke, nothing surged. Just another one logged — those add up quieter than the big ones.`,
    cut: (d) =>
      `Day ${d}, with a couple of skips in it. Not a verdict — just worth noticing before it becomes the default.`,
  },
  even: {
    lift: (d) => `Day ${d} in a row is worth naming plainly: that's a real streak, not luck.`,
    even: (d) =>
      `Day ${d}. Mixed run — some did, some skip. That's most weeks, honestly. Nothing to fix here.`,
    cut: (d) =>
      `Day ${d}, and the skips are landing on the same kind of day each time. That's the actual pattern, not bad luck.`,
  },
  loud: {
    lift: (d) =>
      `Day ${d} — back to back to back. This is the version of you that shows up. Keep pointing at it.`,
    even: (d) =>
      `Day ${d}, steady, no drama either direction. Sometimes steady IS the win. Don't undersell it.`,
    cut: (d) =>
      `Day ${d}, and those skips are a real signal, not a bad stretch. Something's getting in the way. Let's name it.`,
  },
};

/** Rotates by day so consecutive generated Dos are never the same string. */
const CONCRETE_ACTIONS = [
  "one small piece of today's one big thing",
  "the task you've been dodging all week",
  "one real chunk of the week's main goal",
  'the thing that would make today count',
];

function actionFor(day: number): string {
  return CONCRETE_ACTIONS[(day - 1) % CONCRETE_ACTIONS.length];
}

const DO_TEMPLATES: Record<TalkStyle, Record<Tone, (day: number, cue: string) => string>> = {
  quiet: {
    lift: (d, cue) => `After you ${cue}, do ${actionFor(d)}, then let the streak speak for itself.`,
    even: (d, cue) => `After you ${cue}, write down ${actionFor(d)}, and do just that.`,
    cut: (d, cue) => `After you ${cue}, do the smallest version of ${actionFor(d)} — one minute is enough.`,
  },
  even: {
    lift: (d, cue) => `Right after you ${cue}, start ${actionFor(d)} before you open your phone.`,
    even: (d, cue) => `After you ${cue}, pick ${actionFor(d)} and do it first.`,
    cut: (d, cue) => `Right after you ${cue}, close out yesterday's skip: do ${actionFor(d)}, no speeches.`,
  },
  loud: {
    lift: (d, cue) => `Right after you ${cue}, knock out ${actionFor(d)}. First thing. Now.`,
    even: (d, cue) => `Right after you ${cue}, go do ${actionFor(d)} — no negotiating with yourself.`,
    cut: (d, cue) => `Right after you ${cue}, break the pattern: do ${actionFor(d)} and call it a win.`,
  },
};

function localCard(input: GenerateInput): VoiceCard {
  const { me, day, tone, history, crisisToday, previousHadCut } = input;
  const style = me.talk_style;

  // Sage's voice rules: never cut after a crisis, never cut twice in a row.
  const effectiveTone: Tone =
    tone === 'cut' && (crisisToday || previousHadCut) ? 'even' : tone;

  return {
    read: READ_TEMPLATES[style][effectiveTone](day),
    do: DO_TEMPLATES[style][effectiveTone](day, me.morning_cue),
  };
}

export const localProvider: VoiceProvider = {
  id: 'local',
  label: 'local (deterministic)',
  generate: async (input) => localCard(input),
  generateTalk: async (input) => localTalk(input),
};

/** Kept for tests / debugging: how the local provider reads a card's cut-ness. */
export const localCardHasCut = (input: GenerateInput): boolean =>
  hasCut(localCard(input).read);

// --- Talk replies (deterministic, style-differentiated) ---------------------

/**
 * Rotates so the same style gets a stable but non-repeating reply per message.
 * Style is visibly different: quiet = short + no exclamation, even = measured,
 * loud = punchy + exclamation.
 */
function localTalk(input: TalkGenerateInput): { reply: string } {
  const { me, message } = input;
  const style = me.talk_style;
  const asked = message.trim().length > 0;

  switch (style) {
    case 'quiet':
      return {
        reply: asked
          ? `You said: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}". Noted, quietly. A small step today still counts as a step.`
          : 'A quiet day is still a day logged. No need to make noise about it.',
      };
    case 'loud':
      return {
        reply: asked
          ? `You said: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}" — and that's the energy! Say it out loud, then go do one real thing. Today is yours!`
          : 'Steady week, no drama either direction. Sometimes steady IS the win — don\u2019t undersell it!',
      };
    case 'even':
    default:
      return {
        reply: asked
          ? `You said: "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}". That's worth a straight answer: pick the one thing you'd regret skipping and do it first.`
          : 'Mixed week, some did, some skip. That\u2019s most weeks, honestly. Nothing to fix here.',
      };
  }
}
