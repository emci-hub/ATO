import { hasCut } from '../filters';
import { selectLibraryEntries, signalPoolFor, type LibraryEntryId } from '../library';
import type { TalkStyle, Tone, VoiceCard, VoiceMe } from '../types';
import type { GenerateInput, TalkGenerateInput, VoiceProvider } from './types';

/**
 * Deterministic local generator used in dev / tests (MODEL_PROVIDER=local) and
 * as the fallback when gemini is configured but no key is present. Consecutive
 * days rotate the signal so topical anti-repeat does not collapse to one story.
 */

function angleFor(me: VoiceMe, day: number): string {
  const pool = signalPoolFor(me);
  if (pool.length === 0) return 'today';
  return pool[(day - 1) % pool.length];
}

type ReadWriter = (day: number, angle: string) => string;

const READ_FRAMES: Record<TalkStyle, Record<Tone, ReadWriter[]>> = {
  quiet: {
    lift: [
      (d, a) => `Day ${d}. You showed up. ${a} didn't get the last word.`,
      (d, a) => `Day ${d} logged. Quiet hold, and ${a} stayed in its lane.`,
      (d, a) => `Day ${d}. No speech — just the check, with ${a} named and left.`,
    ],
    even: [
      (d, a) => `Day ${d}. Even day. ${a} is in the picture; nothing to dramatize.`,
      (d, a) => `Day ${d} is ordinary. ${a} can wait in the background.`,
      (d, a) => `Day ${d}. Mixed and quiet. ${a} isn't the whole story today.`,
    ],
    cut: [
      (d, a) => `Day ${d} skipped. Name ${a} as the habit — not you.`,
      (d, a) => `Day ${d} missed. ${a} got in the way. That's the note, not a verdict.`,
      (d, a) => `Day ${d}. The skip tracks to ${a}. Worth seeing once.`,
    ],
  },
  even: {
    lift: [
      (d, a) => `Day ${d} shown up. ${a} was around and you still logged it — that's the hold.`,
      (d, a) => `Day ${d} in: a real check, with ${a} not erased, just not in charge.`,
      (d, a) => `Day ${d}. You did the thing. ${a} didn't cancel it.`,
    ],
    even: [
      (d, a) => `Day ${d} is even. ${a} is one thread, not the plot.`,
      (d, a) => `Day ${d}. Ordinary mix. Glance at ${a}, then leave it.`,
      (d, a) => `Day ${d} logged without a surge. ${a} can sit to the side.`,
    ],
    cut: [
      (d, a) => `Day ${d} skipped. The habit to name is ${a}, not your worth.`,
      (d, a) => `Day ${d} missed. ${a} showed up as the blocker. That's the pattern to notice.`,
      (d, a) => `Day ${d}. Skip landed on ${a}. Call the habit, then move.`,
    ],
  },
  loud: {
    lift: [
      (d, a) => `Day ${d} — you showed. ${a} didn't get to write the ending.`,
      (d, a) => `Day ${d} in the books. Point at it. ${a} can wait.`,
      (d, a) => `Day ${d} done. That's the version that shows up, ${a} included.`,
    ],
    even: [
      (d, a) => `Day ${d}, steady. ${a} is noise, not the headline.`,
      (d, a) => `Day ${d} even. Don't undersell a normal log because ${a} exists.`,
      (d, a) => `Day ${d}: no drama. ${a} stays a side note.`,
    ],
    cut: [
      (d, a) => `Day ${d} skipped. ${a} is the signal. Name it.`,
      (d, a) => `Day ${d} missed — ${a} got in the way. That's real, not a smear.`,
      (d, a) => `Day ${d}. Break the loop: ${a} is the habit, not you.`,
    ],
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
    lift: (d, cue) => `After you ${cue}, do ${actionFor(d)}, then let the check stand.`,
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

function libraryIds(input: { me: VoiceMe; day: number; message?: string; surface: 'card' | 'talk' }): Set<LibraryEntryId> {
  return new Set(selectLibraryEntries(input.me, input).map((entry) => entry.id));
}

function libraryShapedCard(input: GenerateInput, effectiveTone: Tone): VoiceCard | null {
  const ids = libraryIds({ me: input.me, day: input.day, surface: 'card' });
  const cue = input.me.morning_cue;
  const d = input.day;
  const slot = (d - 1) % 3;
  if (ids.has('workload')) {
    const reads: Record<Tone, string[]> = {
      lift: [
        `Day ${d} shown up. One next piece, not the whole list — that's the hold.`,
        `Day ${d} in. The pile was around; one next piece, not the whole list.`,
        `Day ${d}. You did the thing. One next piece, not the whole list.`,
      ],
      even: [
        `Day ${d} is even. The pile is heavy — one next piece, not the whole list.`,
        `Day ${d}. Ordinary mix. One next piece, not the whole list.`,
        `Day ${d} logged without a surge. One next piece of the pile, not the whole list.`,
      ],
      cut: [
        `Day ${d} skipped. The pile got in the way. Next time: one next piece, not the whole list.`,
        `Day ${d} missed. Name the pile as the habit — one next piece, not the whole list.`,
        `Day ${d}. Skip landed on the pile. One next piece, not the whole list.`,
      ],
    };
    const dos: Record<Tone, string[]> = {
      lift: [
        `Right after you ${cue}, do one next piece, not the whole list.`,
        `After you ${cue}, start one next piece — not the whole list — before you open your phone.`,
        `Right after you ${cue}, knock out one next piece, not the whole list.`,
      ],
      even: [
        `After you ${cue}, do one next piece, not the whole list.`,
        `After you ${cue}, pick one next piece — not the whole list — and do it first.`,
        `After you ${cue}, write down one next piece, not the whole list, and do just that.`,
      ],
      cut: [
        `After you ${cue}, do one next piece, not the whole list — one minute is enough.`,
        `Right after you ${cue}, one next piece of the pile, not the whole list.`,
        `Right after you ${cue}, break the pattern: one next piece, not the whole list.`,
      ],
    };
    return { read: reads[effectiveTone][slot]!, do: dos[effectiveTone][slot]! };
  }
  if (ids.has('sleep')) {
    const reads: Record<Tone, string[]> = {
      lift: [
        `Day ${d}. You showed up. Today's step stays small so bedtime is still reachable.`,
        `Day ${d} logged. Quiet hold — bedtime is still reachable.`,
        `Day ${d}. No speech. Today's step stays small so bedtime is still reachable.`,
      ],
      even: [
        `Day ${d}. Even day. Today's step stays small so bedtime is still reachable.`,
        `Day ${d} is ordinary. Bedtime is still reachable if today's step stays small.`,
        `Day ${d}. Mixed and quiet. Today's step stays small so bedtime is still reachable.`,
      ],
      cut: [
        `Day ${d} skipped. Last night ran short. Today's step stays small so bedtime is still reachable.`,
        `Day ${d} missed. Name last night as the habit — bedtime is still reachable.`,
        `Day ${d}. The skip tracks to a short night. Today's step stays small so bedtime is still reachable.`,
      ],
    };
    const dos: Record<Tone, string[]> = {
      lift: [
        `After you ${cue}, do one small piece, then stop so bedtime is still reachable.`,
        `Right after you ${cue}, start one small piece — bedtime is still reachable.`,
        `After you ${cue}, knock out one small piece so bedtime is still reachable.`,
      ],
      even: [
        `After you ${cue}, do one small piece so bedtime is still reachable.`,
        `After you ${cue}, pick one small piece and stop — bedtime is still reachable.`,
        `After you ${cue}, write down one small piece so bedtime is still reachable.`,
      ],
      cut: [
        `After you ${cue}, do the smallest version — bedtime is still reachable.`,
        `Right after you ${cue}, one small piece so bedtime is still reachable.`,
        `Right after you ${cue}, one minute is enough so bedtime is still reachable.`,
      ],
    };
    return { read: reads[effectiveTone][slot]!, do: dos[effectiveTone][slot]! };
  }
  return null;
}

function localCard(input: GenerateInput): VoiceCard {
  const { me, day, tone, crisisToday, previousHadCut } = input;
  const style = me.talk_style;

  const effectiveTone: Tone =
    tone === 'cut' && (crisisToday || previousHadCut) ? 'even' : tone;

  const angle = angleFor(me, day);
  const grounded = libraryShapedCard(input, effectiveTone);
  if (grounded) return grounded;

  const frames = READ_FRAMES[style][effectiveTone];
  return {
    read: frames[(day - 1) % frames.length](day, angle),
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

function localTalk(input: TalkGenerateInput): { reply: string } {
  const { me, message, day } = input;
  const style = me.talk_style;
  const asked = message.trim().length > 0;
  const isQuestion = message.includes('?');
  const clip = `${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`;
  const ids = libraryIds({ me, day, message, surface: 'talk' });

  if (ids.has('workload')) {
    const frame = 'The pile is heavy — one next piece, not the whole list.';
    if (asked && isQuestion) {
      return { reply: `You asked: "${clip}". ${frame}` };
    }
    if (asked) {
      return { reply: `You said: "${clip}". ${frame}` };
    }
    return { reply: frame };
  }

  if (asked && isQuestion) {
    switch (style) {
      case 'quiet':
        return {
          reply: `You asked: "${clip}". Short take: it depends on today, not on a rule from Sage.`,
        };
      case 'loud':
        return {
          reply: `You asked: "${clip}" — answer it straight: if it helps today, do it today, and say it out loud so it sticks!`,
        };
      case 'even':
      default:
        return {
          reply: `You asked: "${clip}". Direct take: if waiting costs nothing, wait; if it helps today, do it today.`,
        };
    }
  }

  switch (style) {
    case 'quiet':
      return {
        reply: asked
          ? `You said: "${clip}". Noted, quietly. A small step today still counts as a step.`
          : 'A quiet day is still a day logged. No need to make noise about it.',
      };
    case 'loud':
      return {
        reply: asked
          ? `You said: "${clip}" — and that's the energy! Say it out loud, then go do one real thing. Today is yours!`
          : 'Steady week, no drama either direction. Sometimes steady IS the win — don\u2019t undersell it!',
      };
    case 'even':
    default:
      return {
        reply: asked
          ? `You said: "${clip}". That's worth a straight answer: pick the one thing you'd regret skipping and do it first.`
          : 'Mixed week, some did, some skip. That\u2019s most weeks, honestly. Nothing to fix here.',
      };
  }
}
