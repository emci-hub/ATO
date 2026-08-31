import type { QuestionDraft } from './types';

/**
 * Locked few-shot set. Use exactly as written in the generate prompt.
 * Also the local fallback bank when Gemini is off.
 */
export const QUESTIONS_BANK: readonly QuestionDraft[] = [
  {
    axis: 'openness',
    prompt:
      "Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?",
    options: [
      { text: 'The different one, easily', value: 0.8 },
      { text: 'Somewhere in between', value: 0.5 },
      { text: 'The safe, familiar one', value: 0.2 },
    ],
  },
  {
    axis: 'relatedness',
    prompt: 'A friend cancels same-day, no real reason given.',
    options: [
      { text: "I'd want to talk it through", value: 0.8 },
      { text: "I'd let it go, check in eventually", value: 0.2 },
    ],
  },
  {
    axis: 'growth_mindset',
    prompt: 'You try something new and it goes badly the first time. What actually happens next?',
    options: [
      { text: "I look at what I'd do differently", value: 0.8 },
      { text: "I probably don't try that again", value: 0.2 },
    ],
  },
  {
    axis: 'attachment_avoidance',
    prompt: 'Someone close to you wants to talk something out in person instead of over text.',
    options: [
      { text: "Sure, that's fine when it matters", value: 0.2 },
      { text: "I'd rather keep it lighter, over text", value: 0.8 },
    ],
  },
  {
    axis: 'self_efficacy',
    prompt: "Everyone at the table already knows their order. You don't.",
    options: [
      { text: "I panic-order whatever's closest", value: 0.2 },
      { text: 'Takes me a sec but I land on something', value: 0.5 },
      { text: 'I ask what everyone else got', value: 0.75 },
    ],
  },
  {
    axis: 'conflict_cooperativeness',
    prompt:
      'When you and someone else both want different things with no obvious middle ground, who usually gives first?',
    options: [
      { text: 'Probably me', value: 0.8 },
      { text: 'Depends who cares more', value: 0.5 },
      { text: 'Rarely me', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    prompt: 'A plan you made last week hits a boring stretch today.',
    options: [
      { text: 'I still see it through', value: 0.8 },
      { text: 'I keep it if it stays easy', value: 0.5 },
      { text: 'I switch to whatever feels better', value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    prompt: 'Saturday afternoon, nobody has plans yet.',
    options: [
      { text: "I'd rather text a few people and make something happen", value: 0.8 },
      { text: "Either way, I'm fine", value: 0.5 },
      { text: "I'd rather keep the time quiet", value: 0.2 },
    ],
  },
  {
    axis: 'agreeableness',
    prompt: "A group chat is picking a place you don't really like.",
    options: [
      { text: "I go along, it's not worth a fuss", value: 0.8 },
      { text: 'I mention it once, then let it go', value: 0.5 },
      { text: "I say I'd rather go somewhere else", value: 0.2 },
    ],
  },
  {
    axis: 'steadiness',
    prompt: 'A small thing goes wrong first thing in the morning.',
    options: [
      { text: "I'm mostly over it by lunch", value: 0.8 },
      { text: 'It sits with me a bit, then fades', value: 0.5 },
      { text: 'It colors the rest of the day', value: 0.2 },
    ],
  },
  {
    axis: 'attachment_anxiety',
    prompt: 'Someone you like takes a while to reply.',
    options: [
      { text: "I start wondering if they're pulling away", value: 0.8 },
      { text: 'I notice, then I get on with my day', value: 0.5 },
      { text: "I don't think much of it", value: 0.2 },
    ],
  },
  {
    axis: 'conflict_assertiveness',
    prompt: 'You disagree with someone in the room.',
    options: [
      { text: 'I say so, even if it gets a little sharp', value: 0.8 },
      { text: 'I wait to see if it blows over', value: 0.5 },
      { text: 'I let it go rather than push', value: 0.2 },
    ],
  },
  {
    axis: 'autonomy',
    prompt: 'Someone hands you a plan that would work fine.',
    options: [
      { text: "I'd still rather do it my way", value: 0.8 },
      { text: "I'll use theirs if it saves time", value: 0.5 },
      { text: "I'm glad I don't have to figure it out", value: 0.2 },
    ],
  },
  {
    axis: 'competence',
    prompt: 'A hard task lands on your plate.',
    options: [
      { text: 'I feel like I can handle it', value: 0.8 },
      { text: 'Depends how hard, honestly', value: 0.5 },
      { text: 'I doubt I can pull it off', value: 0.2 },
    ],
  },
  {
    axis: 'locus_of_control',
    prompt: 'A plan you were in on falls apart.',
    options: [
      { text: 'I look first at what I might have done differently', value: 0.8 },
      { text: "Some of it was me, some of it wasn't", value: 0.5 },
      { text: 'It was bound to happen', value: 0.2 },
    ],
  },
  {
    axis: 'playfulness',
    prompt: 'A dull stretch with nothing required of you.',
    options: [
      { text: "I'd mess around and see what happens", value: 0.8 },
      { text: 'Either way, I am fine', value: 0.5 },
      { text: "I'd rather just get through it", value: 0.2 },
    ],
  },
];

export const QUESTIONS_FEW_SHOTS = `1. Openness, grounded in today's Do: "Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?" Options: "The different one, easily" / "Somewhere in between" / "The safe, familiar one"

2. Relatedness, fact woven in quietly: "A friend cancels same-day, no real reason given." Options: "I'd want to talk it through" / "I'd let it go, check in eventually"

3. Growth mindset, plain baseline: "You try something new and it goes badly the first time. What actually happens next?" Options: "I look at what I'd do differently" / "I probably don't try that again"

4. Attachment_avoidance, balanced options: "Someone close to you wants to talk something out in person instead of over text." Options: "Sure, that's fine when it matters" / "I'd rather keep it lighter, over text"

5. Self-efficacy, low-stakes fun variant, no skip-grounding: "Everyone at the table already knows their order. You don't." Options: "I panic-order whatever's closest" / "Takes me a sec but I land on something" / "I ask what everyone else got"

6. Conflict_cooperativeness, plain, no scenario framing: "When you and someone else both want different things with no obvious middle ground, who usually gives first?" Options: "Probably me" / "Depends who cares more" / "Rarely me"`;
