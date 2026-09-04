import type { QuestionDraft } from './types';

/**
 * Fallback bank when Gemini is off, and the source of the locked few-shot set.
 *
 * THREE drafts per axis, grouped in TRAIT_AXES order, and the first draft of
 * each axis is the original locked one quoted verbatim in QUESTIONS_FEW_SHOTS
 * below — do not reorder an axis group or reword a first entry without
 * updating that string too (`check:questions` asserts three of them verbatim).
 *
 * Multiple choice only, 2 or 3 options, never free text: `parseQuestionDraft`
 * and the `insert_question_pack` RPC both reject anything outside 2-3.
 * Higher `value` = higher on the axis, consistently within an axis group.
 *
 * Every stem and every option must clear `questionDraftGuardHit` (framework
 * fence -> jargon -> phrase pattern). Words the fence rejects outright and
 * that are easy to reach for here: secure, anxious, avoidant, collaborative,
 * compromising, competitive, accommodating, neurotic — plus "your type",
 * "you're the kind of", "growth mindset", "locus of control", "self-efficacy".
 */
export const QUESTIONS_BANK: readonly QuestionDraft[] = [
  // --- openness ------------------------------------------------------------
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt:
      "Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?",
    options: [
      { text: 'The different one, easily', value: 0.8 },
      { text: 'Somewhere in between', value: 0.5 },
      { text: 'The safe, familiar one', value: 0.2 },
    ],
  },
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'Same restaurant, and there is a menu item you have never tried.',
    options: [
      { text: 'New one. Obviously', value: 0.8 },
      { text: 'Depends on the day', value: 0.5 },
      { text: 'I know what I like', value: 0.2 },
    ],
  },
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'A friend wants to drag you to something you would never pick yourself.',
    options: [
      { text: "I'm in, that's the fun part", value: 0.8 },
      { text: "I'd probably pass", value: 0.2 },
    ],
  },

  // --- conscientiousness ---------------------------------------------------
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: 'A plan you made last week hits a boring stretch today.',
    options: [
      { text: 'I still see it through', value: 0.8 },
      { text: 'I keep it if it stays easy', value: 0.5 },
      { text: 'I switch to whatever feels better', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: 'Something is due Friday. It is Monday.',
    options: [
      { text: 'I start chipping at it now', value: 0.8 },
      { text: 'I start once it feels close', value: 0.5 },
      { text: 'Thursday night, same as always', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: 'You said you would do a small thing for someone and nobody followed up.',
    options: [
      { text: 'I still do it', value: 0.8 },
      { text: 'It quietly disappears', value: 0.2 },
    ],
  },

  // --- extraversion --------------------------------------------------------
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'Saturday afternoon, nobody has plans yet.',
    options: [
      { text: "I'd rather text a few people and make something happen", value: 0.8 },
      { text: "Either way, I'm fine", value: 0.5 },
      { text: "I'd rather keep the time quiet", value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'You walk into a party and know maybe two people.',
    options: [
      { text: 'I start talking to someone new', value: 0.8 },
      { text: 'I find the two I know', value: 0.5 },
      { text: "I'm counting the minutes", value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'A long week just ended.',
    options: [
      { text: 'Going out would recharge me', value: 0.8 },
      { text: 'Being alone would recharge me', value: 0.2 },
    ],
  },

  // --- agreeableness -------------------------------------------------------
  {
    axis: 'agreeableness',
    category: 'cat_steadiness',
    prompt: "A group chat is picking a place you don't really like.",
    options: [
      { text: "I go along, it's not worth a fuss", value: 0.8 },
      { text: 'I mention it once, then let it go', value: 0.5 },
      { text: "I say I'd rather go somewhere else", value: 0.2 },
    ],
  },
  {
    axis: 'agreeableness',
    category: 'cat_steadiness',
    prompt: 'Someone takes credit for something that was mostly yours.',
    options: [
      { text: 'I let it slide', value: 0.8 },
      { text: 'I mention it lightly, later', value: 0.5 },
      { text: 'I correct it on the spot', value: 0.2 },
    ],
  },
  {
    axis: 'agreeableness',
    category: 'cat_steadiness',
    prompt: 'A stranger is clearly in the wrong and clearly having a bad day.',
    options: [
      { text: 'I give them the benefit of the doubt', value: 0.8 },
      { text: 'Bad day or not, wrong is wrong', value: 0.2 },
    ],
  },

  // --- steadiness ----------------------------------------------------------
  {
    axis: 'steadiness',
    category: 'cat_steadiness',
    prompt: 'A small thing goes wrong first thing in the morning.',
    options: [
      { text: "I'm mostly over it by lunch", value: 0.8 },
      { text: 'It sits with me a bit, then fades', value: 0.5 },
      { text: 'It colors the rest of the day', value: 0.2 },
    ],
  },
  {
    axis: 'steadiness',
    category: 'cat_steadiness',
    prompt: 'Plans change on you an hour before.',
    options: [
      { text: 'Fine, I roll with it', value: 0.8 },
      { text: 'Mild whiplash, then fine', value: 0.5 },
      { text: 'It throws off the whole evening', value: 0.2 },
    ],
  },
  {
    axis: 'steadiness',
    category: 'cat_steadiness',
    prompt: 'Someone sends a short reply that could be read two ways.',
    options: [
      { text: 'I read it the plain way and move on', value: 0.8 },
      { text: 'I reread it a few times', value: 0.2 },
    ],
  },

  // --- attachment_anxiety --------------------------------------------------
  {
    axis: 'attachment_anxiety',
    category: 'cat_love',
    prompt: 'Someone you like takes a while to reply.',
    options: [
      { text: "I start wondering if they're pulling away", value: 0.8 },
      { text: 'I notice, then I get on with my day', value: 0.5 },
      { text: "I don't think much of it", value: 0.2 },
    ],
  },
  {
    axis: 'attachment_anxiety',
    category: 'cat_love',
    prompt: 'A close friend has been quieter than usual this week.',
    options: [
      { text: 'I assume I did something', value: 0.8 },
      { text: 'I wonder for a second, then drop it', value: 0.5 },
      { text: 'People get busy', value: 0.2 },
    ],
  },
  {
    axis: 'attachment_anxiety',
    category: 'cat_love',
    prompt: 'You need reassurance more often than you would like to admit.',
    options: [
      { text: 'Yeah, that lands', value: 0.8 },
      { text: 'Not really me', value: 0.2 },
    ],
  },

  // --- attachment_avoidance ------------------------------------------------
  {
    axis: 'attachment_avoidance',
    category: 'cat_love',
    prompt: 'Someone close to you wants to talk something out in person instead of over text.',
    options: [
      { text: "Sure, that's fine when it matters", value: 0.2 },
      { text: "I'd rather keep it lighter, over text", value: 0.8 },
    ],
  },
  {
    axis: 'attachment_avoidance',
    category: 'cat_love',
    prompt: 'A rough week. Someone asks how you actually are.',
    options: [
      { text: 'I tell them the real version', value: 0.2 },
      { text: 'I give them the short version', value: 0.5 },
      { text: 'I say I am fine and change the subject', value: 0.8 },
    ],
  },
  {
    axis: 'attachment_avoidance',
    category: 'cat_love',
    prompt: 'Things are getting closer with someone.',
    options: [
      { text: 'I lean in', value: 0.2 },
      { text: 'I want a bit of room', value: 0.8 },
    ],
  },

  // --- conflict_assertiveness ----------------------------------------------
  {
    axis: 'conflict_assertiveness',
    category: 'cat_communication',
    prompt: 'You disagree with someone in the room.',
    options: [
      { text: 'I say so, even if it gets a little sharp', value: 0.8 },
      { text: 'I wait to see if it blows over', value: 0.5 },
      { text: 'I let it go rather than push', value: 0.2 },
    ],
  },
  {
    axis: 'conflict_assertiveness',
    category: 'cat_communication',
    prompt: 'The order is wrong and the place is busy.',
    options: [
      { text: 'I send it back', value: 0.8 },
      { text: 'Depends how wrong', value: 0.5 },
      { text: 'I eat it', value: 0.2 },
    ],
  },
  {
    axis: 'conflict_assertiveness',
    category: 'cat_communication',
    prompt: 'You want something and asking might annoy someone.',
    options: [
      { text: 'I ask anyway', value: 0.8 },
      { text: 'I let it go', value: 0.2 },
    ],
  },

  // --- conflict_cooperativeness --------------------------------------------
  {
    axis: 'conflict_cooperativeness',
    category: 'cat_communication',
    prompt:
      'When you and someone else both want different things with no obvious middle ground, who usually gives first?',
    options: [
      { text: 'Probably me', value: 0.8 },
      { text: 'Depends who cares more', value: 0.5 },
      { text: 'Rarely me', value: 0.2 },
    ],
  },
  {
    axis: 'conflict_cooperativeness',
    category: 'cat_communication',
    prompt: 'An argument is going nowhere and it is getting late.',
    options: [
      { text: 'I look for something we both can live with', value: 0.8 },
      { text: 'I park it for tomorrow', value: 0.5 },
      { text: 'I hold my line', value: 0.2 },
    ],
  },
  {
    axis: 'conflict_cooperativeness',
    category: 'cat_communication',
    prompt: 'Winning the point matters more than keeping the peace.',
    options: [
      { text: 'Not for me, usually', value: 0.8 },
      { text: 'Honestly, sometimes yes', value: 0.2 },
    ],
  },

  // --- autonomy ------------------------------------------------------------
  {
    axis: 'autonomy',
    category: 'cat_drive',
    prompt: 'Someone hands you a plan that would work fine.',
    options: [
      { text: "I'd still rather do it my way", value: 0.8 },
      { text: "I'll use theirs if it saves time", value: 0.5 },
      { text: "I'm glad I don't have to figure it out", value: 0.2 },
    ],
  },
  {
    axis: 'autonomy',
    category: 'cat_drive',
    prompt: 'You get told exactly how to do something you already know how to do.',
    options: [
      { text: 'It gets under my skin', value: 0.8 },
      { text: 'I notice it, then let it go', value: 0.5 },
      { text: "Fine by me, less to think about", value: 0.2 },
    ],
  },
  {
    axis: 'autonomy',
    category: 'cat_drive',
    prompt: 'A free day with nothing scheduled and nobody asking anything of you.',
    options: [
      { text: 'That is the best kind of day', value: 0.8 },
      { text: "I'd rather have a plan", value: 0.2 },
    ],
  },

  // --- competence ----------------------------------------------------------
  {
    axis: 'competence',
    category: 'cat_drive',
    prompt: 'A hard task lands on your plate.',
    options: [
      { text: 'I feel like I can handle it', value: 0.8 },
      { text: 'Depends how hard, honestly', value: 0.5 },
      { text: 'I doubt I can pull it off', value: 0.2 },
    ],
  },
  {
    axis: 'competence',
    category: 'cat_drive',
    prompt: 'You are learning something new and you are still bad at it.',
    options: [
      { text: 'I can feel myself getting better', value: 0.8 },
      { text: 'Some days it clicks', value: 0.5 },
      { text: 'I mostly feel behind', value: 0.2 },
    ],
  },
  {
    axis: 'competence',
    category: 'cat_drive',
    prompt: 'Someone says you are good at something you do a lot.',
    options: [
      { text: 'Yeah, I think so too', value: 0.8 },
      { text: 'I brush it off', value: 0.2 },
    ],
  },

  // --- relatedness ---------------------------------------------------------
  {
    axis: 'relatedness',
    category: 'cat_drive',
    prompt: 'A friend cancels same-day, no real reason given.',
    options: [
      { text: "I'd want to talk it through", value: 0.8 },
      { text: "I'd let it go, check in eventually", value: 0.2 },
    ],
  },
  {
    axis: 'relatedness',
    category: 'cat_drive',
    prompt: 'Something good happens to you on an ordinary Tuesday.',
    options: [
      { text: "I'm texting someone before I sit down", value: 0.8 },
      { text: 'It comes up next time we talk', value: 0.5 },
      { text: 'I just enjoy it', value: 0.2 },
    ],
  },
  {
    axis: 'relatedness',
    category: 'cat_drive',
    prompt: 'A whole day with no messages from anyone.',
    options: [
      { text: 'I feel the gap', value: 0.8 },
      { text: 'Bliss', value: 0.2 },
    ],
  },

  // --- growth_mindset ------------------------------------------------------
  {
    axis: 'growth_mindset',
    category: 'cat_agency',
    prompt: 'You try something new and it goes badly the first time. What actually happens next?',
    options: [
      { text: "I look at what I'd do differently", value: 0.8 },
      { text: "I probably don't try that again", value: 0.2 },
    ],
  },
  {
    axis: 'growth_mindset',
    category: 'cat_agency',
    prompt: 'Someone is much better than you at a thing you care about.',
    options: [
      { text: 'I want to know how they got there', value: 0.8 },
      { text: 'Good for them, different lane', value: 0.5 },
      { text: 'Some people just have it', value: 0.2 },
    ],
  },
  {
    axis: 'growth_mindset',
    category: 'cat_agency',
    prompt: 'You can get noticeably better at almost anything with enough reps.',
    options: [
      { text: 'I believe that', value: 0.8 },
      { text: 'Only up to a point', value: 0.2 },
    ],
  },

  // --- locus_of_control ----------------------------------------------------
  {
    axis: 'locus_of_control',
    category: 'cat_agency',
    prompt: 'A plan you were in on falls apart.',
    options: [
      { text: 'I look first at what I might have done differently', value: 0.8 },
      { text: "Some of it was me, some of it wasn't", value: 0.5 },
      { text: 'It was bound to happen', value: 0.2 },
    ],
  },
  {
    axis: 'locus_of_control',
    category: 'cat_agency',
    prompt: 'A good week. Where does the credit actually go?',
    options: [
      { text: 'Mostly to what I did', value: 0.8 },
      { text: 'A bit of both', value: 0.5 },
      { text: 'Mostly to how things fell', value: 0.2 },
    ],
  },
  {
    axis: 'locus_of_control',
    category: 'cat_agency',
    prompt: 'How next year goes is mostly up to you.',
    options: [
      { text: 'Mostly, yes', value: 0.8 },
      { text: 'Timing decides more than I do', value: 0.2 },
    ],
  },

  // --- self_efficacy -------------------------------------------------------
  {
    axis: 'self_efficacy',
    category: 'cat_agency',
    prompt: "Everyone at the table already knows their order. You don't.",
    options: [
      { text: "I panic-order whatever's closest", value: 0.2 },
      { text: 'Takes me a sec but I land on something', value: 0.5 },
      { text: 'I ask what everyone else got', value: 0.75 },
    ],
  },
  {
    axis: 'self_efficacy',
    category: 'cat_agency',
    prompt: 'Something breaks and you have never fixed one before.',
    options: [
      { text: "I'll figure it out", value: 0.8 },
      { text: 'I look it up first', value: 0.5 },
      { text: 'I find someone who knows', value: 0.2 },
    ],
  },
  {
    axis: 'self_efficacy',
    category: 'cat_agency',
    prompt: 'A big thing you have to do, and no obvious first step.',
    options: [
      { text: 'I start somewhere and adjust', value: 0.8 },
      { text: 'I stall until it gets urgent', value: 0.2 },
    ],
  },

  // --- playfulness ---------------------------------------------------------
  {
    axis: 'playfulness',
    category: 'cat_social',
    prompt: 'A dull stretch with nothing required of you.',
    options: [
      { text: "I'd mess around and see what happens", value: 0.8 },
      { text: 'Either way, I am fine', value: 0.5 },
      { text: "I'd rather just get through it", value: 0.2 },
    ],
  },
  {
    axis: 'playfulness',
    category: 'cat_social',
    prompt: 'A serious conversation hits a genuinely funny moment.',
    options: [
      { text: 'I take the joke', value: 0.8 },
      { text: 'Depends who is in the room', value: 0.5 },
      { text: 'I keep it serious', value: 0.2 },
    ],
  },
  {
    axis: 'playfulness',
    category: 'cat_social',
    prompt: 'People would say you are one of the sillier people they know.',
    options: [
      { text: 'That tracks', value: 0.8 },
      { text: 'Not the word they would use', value: 0.2 },
    ],
  },
];

export const QUESTIONS_FEW_SHOTS = `1. Openness, grounded in today's Do: "Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?" Options: "The different one, easily" / "Somewhere in between" / "The safe, familiar one"

2. Relatedness, fact woven in quietly: "A friend cancels same-day, no real reason given." Options: "I'd want to talk it through" / "I'd let it go, check in eventually"

3. Growth mindset, plain baseline: "You try something new and it goes badly the first time. What actually happens next?" Options: "I look at what I'd do differently" / "I probably don't try that again"

4. Attachment_avoidance, balanced options: "Someone close to you wants to talk something out in person instead of over text." Options: "Sure, that's fine when it matters" / "I'd rather keep it lighter, over text"

5. Self-efficacy, low-stakes fun variant, no skip-grounding: "Everyone at the table already knows their order. You don't." Options: "I panic-order whatever's closest" / "Takes me a sec but I land on something" / "I ask what everyone else got"

6. Conflict_cooperativeness, plain, no scenario framing: "When you and someone else both want different things with no obvious middle ground, who usually gives first?" Options: "Probably me" / "Depends who cares more" / "Rarely me"`;
