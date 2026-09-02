/**
 * Optional intake scenario copy. Chip ids stay internal; only labels and
 * prompts are user-facing. Each question maps to exactly two trait axes —
 * the option a person taps carries both axes' values inline, so this file
 * is the single source of truth for both copy and scoring.
 */
import type { TraitAxis } from '@/lib/traits';

export type ScenarioOption = {
  value: string;
  label: string;
  axisAValue: number;
  axisBValue: number;
};

export type ScenarioQuestion = {
  axes: readonly [TraitAxis, TraitAxis];
  prompt: string;
  options: readonly ScenarioOption[];
};

export const SCENARIO_QUESTIONS: readonly ScenarioQuestion[] = [
  {
    axes: ['openness', 'conscientiousness'],
    prompt:
      "You've had a plan locked in for weeks — everyone knows the spot. Right before, the group finds something new and everyone's suddenly into that instead.",
    options: [
      { value: 'new_thing', label: "New thing, I'm dropping the old plan", axisAValue: 0.8, axisBValue: 0.2 },
      { value: 'flex_both', label: "I'll go if we can still make the old plan happen after", axisAValue: 0.5, axisBValue: 0.5 },
      { value: 'stick_plan', label: "We already committed, we're doing the original plan", axisAValue: 0.2, axisBValue: 0.8 },
    ],
  },
  {
    axes: ['extraversion', 'playfulness'],
    prompt: "Group's already running late, and someone suggests a pointless, kind of silly detour on the way.",
    options: [
      { value: 'push_it', label: "I'm the one pushing for it, more people the better", axisAValue: 0.8, axisBValue: 0.8 },
      { value: 'quiet_in', label: "I'll go along, but I'm quiet about it — I don't need it to be a whole thing", axisAValue: 0.3, axisBValue: 0.6 },
      { value: 'keep_moving', label: "Not worth it, let's just get where we're going", axisAValue: 0.2, axisBValue: 0.1 },
    ],
  },
  {
    axes: ['agreeableness', 'conflict_cooperativeness'],
    prompt: "Group can't agree where to eat and it's dragging on.",
    options: [
      { value: 'wherever', label: 'Honestly, wherever — I just want it decided', axisAValue: 0.8, axisBValue: 0.4 },
      { value: 'say_and_solve', label: "I say what I actually want, then help find something everyone's okay with", axisAValue: 0.3, axisBValue: 0.8 },
      { value: 'push_my_pick', label: 'I push my pick until people come around', axisAValue: 0.1, axisBValue: 0.1 },
    ],
  },
  {
    axes: ['conflict_assertiveness', 'autonomy'],
    prompt: "Someone close to you makes a call on your behalf — signs you up, agrees to something for you — without checking first.",
    options: [
      { value: 'say_it', label: 'I tell them straight up I wanted to decide that myself', axisAValue: 0.8, axisBValue: 0.8 },
      { value: 'mention_it', label: "I mention it, but let it ride since it's already done", axisAValue: 0.4, axisBValue: 0.4 },
      { value: 'let_it_go', label: 'I let it go — honestly easier that someone else handled it', axisAValue: 0.1, axisBValue: 0.1 },
    ],
  },
  {
    axes: ['steadiness', 'locus_of_control'],
    prompt: "A plan you were counting on falls apart last minute — nobody's fault in particular.",
    options: [
      { value: 'reflect_hard', label: "Throws me for a bit, and I wonder what I should've done differently", axisAValue: 0.2, axisBValue: 0.8 },
      { value: 'shake_external', label: 'I shake it off fast, and it was bound to happen either way', axisAValue: 0.8, axisBValue: 0.2 },
      { value: 'shake_reflect', label: "I shake it off fast, but I do think about what I'd change next time", axisAValue: 0.8, axisBValue: 0.8 },
    ],
  },
  {
    axes: ['attachment_anxiety', 'attachment_avoidance'],
    prompt: "You're texting with someone you're into and they take way longer than usual to reply.",
    options: [
      { value: 'not_much', label: "I don't think much of it, they're probably just busy", axisAValue: 0.2, axisBValue: 0.2 },
      { value: 'did_i_do', label: 'I start wondering if I did something wrong', axisAValue: 0.8, axisBValue: 0.2 },
      { value: 'kind_of_relief', label: 'Honestly kind of a relief — less pressure to reply fast myself', axisAValue: 0.2, axisBValue: 0.8 },
    ],
  },
  {
    axes: ['competence', 'self_efficacy'],
    prompt: "You get handed something you've never done before, basically no instructions, due soon.",
    options: [
      { value: 'just_start', label: 'I figure I can handle it, I just start', axisAValue: 0.8, axisBValue: 0.8 },
      { value: 'check_work', label: 'I think I can get through it, but I want someone to check my work', axisAValue: 0.6, axisBValue: 0.5 },
      { value: 'not_sure', label: "I'm not sure I'm the right person for this", axisAValue: 0.2, axisBValue: 0.2 },
    ],
  },
  {
    axes: ['growth_mindset', 'relatedness'],
    prompt: 'You mess up in a way people around you actually notice.',
    options: [
      { value: 'talk_it_through', label: 'I want to talk it through with someone right after', axisAValue: 0.6, axisBValue: 0.8 },
      { value: 'own_it_alone', label: "I go over what happened on my own so I don't do it again", axisAValue: 0.8, axisBValue: 0.2 },
      { value: 'move_past', label: "I just want to move past it — replaying it doesn't help", axisAValue: 0.2, axisBValue: 0.4 },
    ],
  },
];
