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
];

export const QUESTIONS_FEW_SHOTS = `1. Openness, grounded in today's Do: "Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?" Options: "The different one, easily" / "Somewhere in between" / "The safe, familiar one"

2. Relatedness, fact woven in quietly: "A friend cancels same-day, no real reason given." Options: "I'd want to talk it through" / "I'd let it go, check in eventually"

3. Growth mindset, plain baseline: "You try something new and it goes badly the first time. What actually happens next?" Options: "I look at what I'd do differently" / "I probably don't try that again"

4. Attachment_avoidance, balanced options: "Someone close to you wants to talk something out in person instead of over text." Options: "Sure, that's fine when it matters" / "I'd rather keep it lighter, over text"

5. Self-efficacy, low-stakes fun variant, no skip-grounding: "Everyone at the table already knows their order. You don't." Options: "I panic-order whatever's closest" / "Takes me a sec but I land on something" / "I ask what everyone else got"

6. Conflict_cooperativeness, plain, no scenario framing: "When you and someone else both want different things with no obvious middle ground, who usually gives first?" Options: "Probably me" / "Depends who cares more" / "Rarely me"`;
