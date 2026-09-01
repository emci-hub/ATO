/**
 * Optional vibe-check copy (Pass 1). Chip ids stay internal; only labels
 * and prompts are user-facing. Scores still write the existing 0–1 axes.
 */
import type { IntakeChip } from '@/lib/intake';
import type { ClosePatternId, DisagreeId } from '@/lib/traits';
import { SLIDER_AXES } from '@/lib/traits';

export const EVEN_KEEL_COPY = {
  label: 'How rattled a bad day gets you',
  description: 'Some people shake it off fast, some carry it longer — no wrong answer here.',
} as const;

export const CLOSENESS_COPY = {
  label: 'How you handle getting close to people',
  description: "Everyone's a little different here — this just helps Sage read the room right.",
} as const;

type SliderAxis = (typeof SLIDER_AXES)[number];

export type VibeSliderQuestion = {
  kind: 'slider';
  prompt: string;
  axis: SliderAxis;
  fieldLabel?: string;
  fieldDescription?: string;
  chips: (IntakeChip & { score: number })[];
};

export type VibeCloseQuestion = {
  kind: 'close';
  prompt: string;
  fieldLabel?: string;
  fieldDescription?: string;
  chips: IntakeChip<ClosePatternId>[];
};

export type VibeDisagreeQuestion = {
  kind: 'disagree';
  prompt: string;
  chips: IntakeChip<DisagreeId>[];
};

export type VibeQuestion = VibeSliderQuestion | VibeCloseQuestion | VibeDisagreeQuestion;

export const VIBE_QUESTIONS: readonly VibeQuestion[] = [
  {
    kind: 'slider',
    axis: 'openness',
    prompt:
      'Someone in the group chat finds a spot that looks kinda sketchy but also kinda cool. Zero reviews.',
    chips: [
      { value: 'open_high', label: "I'm in, that's kind of the fun part", score: 1 },
      { value: 'open_mid', label: "I'll go if someone's got a backup plan", score: 0.5 },
      { value: 'open_low', label: "I'd rather just go somewhere we know is good", score: 0 },
    ],
  },
  {
    kind: 'slider',
    axis: 'conscientiousness',
    prompt: "You committed to plans two weeks ago. Day comes and you're just not feeling it.",
    chips: [
      { value: 'con_high', label: "I said I'd go, so I'm going", score: 1 },
      { value: 'con_mid', label: 'Depends how hard I actually committed', score: 0.5 },
      { value: 'con_low', label: "I'm probably canceling", score: 0 },
    ],
  },
  {
    kind: 'slider',
    axis: 'extraversion',
    prompt: 'Rough week, finally got a night to yourself.',
    chips: [
      { value: 'ex_high', label: "I'm texting people, let's do something", score: 1 },
      { value: 'ex_mid', label: 'Maybe one person, kept low-key', score: 0.5 },
      { value: 'ex_low', label: "Phone off, door closed, that's it", score: 0 },
    ],
  },
  {
    kind: 'slider',
    axis: 'agreeableness',
    prompt: "Group chat's picking dinner and it's not going your way.",
    chips: [
      { value: 'ag_low', label: "I'll say something, that's a fair ask", score: 0 },
      { value: 'ag_mid', label: "I'll mention it once, then just go with it", score: 0.5 },
      { value: 'ag_high', label: "Honestly, whatever's fine", score: 1 },
    ],
  },
  {
    kind: 'slider',
    axis: 'steadiness',
    fieldLabel: EVEN_KEEL_COPY.label,
    fieldDescription: EVEN_KEEL_COPY.description,
    prompt: 'Plan falls through last minute. In the grand scheme, not a big deal.',
    chips: [
      { value: 'st_high', label: "Genuinely doesn't touch me, I move on", score: 1 },
      { value: 'st_mid', label: "Annoying for a bit, then it's gone", score: 0.5 },
      { value: 'st_low', label: 'Somehow ruins my whole day', score: 0 },
    ],
  },
  {
    kind: 'close',
    fieldLabel: CLOSENESS_COPY.label,
    fieldDescription: CLOSENESS_COPY.description,
    prompt:
      "Someone goes quiet on you for a few days, no explanation. What's the actual gut reaction, not what you'd say out loud.",
    chips: [
      {
        value: 'close_steady',
        label: "They're probably just busy, I don't think much of it",
      },
      { value: 'worry_pull_away', label: "I start replaying what I might've done" },
      {
        value: 'keep_distance',
        label: "Kind of nice not being checked on, if I'm honest",
      },
      {
        value: 'want_and_pull',
        label: "I notice, I miss it, but I'm still not the one texting first",
      },
    ],
  },
  {
    kind: 'close',
    prompt: 'A new group actually feels like your people. They start inviting you to a regular thing.',
    chips: [
      { value: 'close_steady', label: "I'm in, right away" },
      {
        value: 'worry_pull_away',
        label: "I'll show up a few times before I let myself get attached",
      },
      { value: 'keep_distance', label: "I keep it light, I don't want to need this" },
      { value: 'want_and_pull', label: "I want in more than I'm letting on" },
    ],
  },
  {
    kind: 'disagree',
    prompt:
      "You and someone close to you just aren't seeing eye to eye on something. First move?",
    chips: [
      { value: 'push_my_way', label: 'I say my piece, straight up' },
      {
        value: 'win_we_both',
        label: "We talk it out until it's actually settled for both of us",
      },
      { value: 'split_difference', label: 'We meet in the middle' },
      { value: 'step_back', label: 'I need to step away and come back to it' },
      { value: 'give_ground', label: "I drop it, it's not worth the friction" },
    ],
  },
];
