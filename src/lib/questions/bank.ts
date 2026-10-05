import { QUESTIONS_BANK_V1, ROUND_ONLY_BANK_V1 } from './bank-v1';
import type { QuestionDraft } from './types';

/**
 * The intake: 48 questions, exactly 3 per trait (staged intake, emci
 * 2026-10-02). Asked as 3 sets of 16 — set N is draft N-1 of every trait —
 * so every trait moves one step per set and a trait can settle at the end of
 * set 3 (STABILITY_FLOOR_N = 3). Stage is computed from real per-trait answer
 * counts (`intake-stage.ts`), never from a running total.
 *
 * History: the 2026-09 redesign made this a tiered 50 (6/6/6, 4/4/4, 2x10)
 * ranked by how often each trait appears in the archetype catalog. Every
 * answer touches one trait and every trait needs the same 3 answers to settle,
 * so the tiers only slowed ten traits down. The extras moved to
 * `ROUND_ONLY_BANK` (never deleted); the ten third drafts came back from
 * 79ef77a^, rewritten in the moment voice with a middle option (the original
 * wordings are kept in `ROUND_ONLY_BANK`). `LEGACY_INTAKE_AXIS_COUNTS` keeps
 * the old shape so anyone who finished the old 50 keeps every unlock.
 *
 * Hand-authored, not live-generated — see docs/archive/TRAIT_SYSTEM_REDESIGN_PLAN.md §3.
 *
 * Grouped in TRAIT_AXES order. Reworded in the moment voice on 2026-10-05:
 * the old wording is frozen in bank-v1.ts, index for index, and the server
 * accepts both (wave84). A rewording keeps the trait, the set, the option
 * order and every option value — scoring never moves (`check:question-voice`).
 * Several rows are quoted verbatim in QUESTIONS_FEW_SHOTS below; keep them in
 * step (`check:questions` asserts them).
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
  // --- openness -----------------------------------------------------------------
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'A new place opened next to your usual spot, and your usual order is already in the app.',
    options: [
      { text: 'I try the new place', value: 0.8 },
      { text: 'I save it for next week', value: 0.5 },
      { text: "Usual order. It's right there", value: 0.2 },
    ],
  },
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'Same restaurant, same order, and a dish you have never tried is on the menu.',
    options: [
      { text: 'I order the new one', value: 0.8 },
      { text: 'Depends on the day', value: 0.5 },
      { text: 'I know what I like', value: 0.2 },
    ],
  },
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'A friend sends an invite to something you would never pick yourself.',
    options: [
      { text: "I'm in, that's the fun part", value: 0.8 },
      { text: "I'd probably pass", value: 0.2 },
    ],
  },
  // --- conscientiousness --------------------------------------------------------
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: 'The plan you put in your calendar last week hits its boring part today.',
    options: [
      { text: 'I still see it through', value: 0.8 },
      { text: 'I keep it if it stays easy', value: 0.5 },
      { text: 'I switch to whatever feels better', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: 'Monday. Your calendar says it is due Friday.',
    options: [
      { text: 'I start chipping at it now', value: 0.8 },
      { text: 'I start once it feels close', value: 0.5 },
      { text: 'Thursday night, like last time', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: "You said you'd send someone a link. Nobody followed up.",
    options: [
      { text: 'I still send it', value: 0.8 },
      { text: 'It quietly disappears', value: 0.2 },
    ],
  },
  // --- extraversion -------------------------------------------------------------
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'Saturday afternoon and the group chat is quiet.',
    options: [
      { text: 'I text a few people and make plans', value: 0.8 },
      { text: "Either way, I'm fine", value: 0.5 },
      { text: 'I keep the afternoon quiet', value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'You walk into a party and know two people. Both are on their phones.',
    options: [
      { text: 'I start talking to someone new', value: 0.8 },
      { text: 'I go stand with the two I know', value: 0.5 },
      { text: "I'm counting the minutes", value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'Friday, 6pm. Three invites in the group chat.',
    options: [
      { text: "I'm going to at least one", value: 0.8 },
      { text: 'Couch. Phone on silent', value: 0.2 },
    ],
  },
  // --- agreeableness ------------------------------------------------------------
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
    prompt: 'On the team call, someone shares your idea as their own.',
    options: [
      { text: 'I let it slide', value: 0.8 },
      { text: 'I mention it lightly, later', value: 0.5 },
      { text: 'I correct it on the spot', value: 0.2 },
    ],
  },
  {
    axis: 'agreeableness',
    category: 'cat_steadiness',
    prompt: 'The delivery driver gets your order wrong and looks like their day has been rough.',
    options: [
      { text: 'I give them the benefit of the doubt', value: 0.8 },
      { text: 'Bad day or not, wrong is wrong', value: 0.2 },
    ],
  },
  // --- steadiness ---------------------------------------------------------------
  {
    axis: 'steadiness',
    category: 'cat_steadiness',
    prompt: 'Your phone hits 3% before you have left the house.',
    options: [
      { text: "I'm mostly over it by lunch", value: 0.8 },
      { text: 'It sits with me a bit, then fades', value: 0.5 },
      { text: 'It colors the rest of the day', value: 0.2 },
    ],
  },
  {
    axis: 'steadiness',
    category: 'cat_steadiness',
    prompt: 'An hour before, the group chat moves the plan somewhere else.',
    options: [
      { text: 'Fine, I roll with it', value: 0.8 },
      { text: 'Mild whiplash, then fine', value: 0.5 },
      { text: 'It throws off the whole evening', value: 0.2 },
    ],
  },
  {
    axis: 'steadiness',
    category: 'cat_steadiness',
    prompt: 'A one-word reply lands and it could be read two ways.',
    options: [
      { text: 'I read it plain and move on', value: 0.8 },
      { text: 'I reread it once, then let it go', value: 0.5 },
      { text: 'I reread it a few times', value: 0.2 },
    ],
  },
  // --- attachment_anxiety -------------------------------------------------------
  {
    axis: 'attachment_anxiety',
    category: 'cat_love',
    prompt: 'Someone you like has had your message for three hours.',
    options: [
      { text: "I wonder if they're pulling away", value: 0.8 },
      { text: 'I notice, then get on with my day', value: 0.5 },
      { text: "I don't think much of it", value: 0.2 },
    ],
  },
  {
    axis: 'attachment_anxiety',
    category: 'cat_love',
    prompt: 'Your closest friend has gone quiet in the chat this week.',
    options: [
      { text: 'I assume I did something', value: 0.8 },
      { text: 'I wonder for a second, then drop it', value: 0.5 },
      { text: 'People get busy', value: 0.2 },
    ],
  },
  {
    axis: 'attachment_anxiety',
    category: 'cat_love',
    prompt: 'You sent a long message an hour ago. It says Read.',
    options: [
      { text: "I check back more than I'd admit", value: 0.8 },
      { text: 'I notice, then put the phone down', value: 0.5 },
      { text: 'I forget I sent it', value: 0.2 },
    ],
  },
  // --- attachment_avoidance -----------------------------------------------------
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
    prompt: "A rough week, and someone texts 'how are you, really?'",
    options: [
      { text: 'I tell them the real version', value: 0.2 },
      { text: 'I give them the short version', value: 0.5 },
      { text: "I say I'm fine and change the subject", value: 0.8 },
    ],
  },
  {
    axis: 'attachment_avoidance',
    category: 'cat_love',
    prompt: 'Someone starts texting you good morning every day.',
    options: [
      { text: 'I like it', value: 0.2 },
      { text: 'Nice, in small doses', value: 0.5 },
      { text: 'My replies get slower', value: 0.8 },
    ],
  },
  // --- conflict_assertiveness ---------------------------------------------------
  {
    axis: 'conflict_assertiveness',
    category: 'cat_communication',
    prompt: 'On a work call, someone says something you think is wrong.',
    options: [
      { text: 'I say so, even if it gets a bit sharp', value: 0.8 },
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
    prompt: "Your roommate's music is loud and asking might annoy them.",
    options: [
      { text: 'I ask anyway', value: 0.8 },
      { text: 'I let it go', value: 0.2 },
    ],
  },
  // --- conflict_cooperativeness -------------------------------------------------
  {
    axis: 'conflict_cooperativeness',
    category: 'cat_communication',
    prompt: 'You and a friend each sent a different dinner spot. Who gives first?',
    options: [
      { text: 'Probably me', value: 0.8 },
      { text: 'Depends who cares more', value: 0.5 },
      { text: 'Rarely me', value: 0.2 },
    ],
  },
  {
    axis: 'conflict_cooperativeness',
    category: 'cat_communication',
    prompt: 'A text argument is ten messages deep and it is getting late.',
    options: [
      { text: 'I find something we can both live with', value: 0.8 },
      { text: 'I park it for tomorrow', value: 0.5 },
      { text: 'I hold my line', value: 0.2 },
    ],
  },
  {
    axis: 'conflict_cooperativeness',
    category: 'cat_communication',
    prompt: 'The group chat is arguing and you know the right answer.',
    options: [
      { text: 'I let it go to keep the chat calm', value: 0.8 },
      { text: 'I say it once, then drop it', value: 0.5 },
      { text: 'I send the link that proves it', value: 0.2 },
    ],
  },
  // --- autonomy -----------------------------------------------------------------
  {
    axis: 'autonomy',
    category: 'cat_drive',
    prompt: 'A friend sends the whole trip plan in the chat, and it would work fine.',
    options: [
      { text: "I'd still rather do it my way", value: 0.8 },
      { text: "I'll use theirs if it saves time", value: 0.5 },
      { text: "I'm glad I don't have to figure it out", value: 0.2 },
    ],
  },
  {
    axis: 'autonomy',
    category: 'cat_drive',
    prompt: 'Someone messages you step-by-step instructions for a thing you already know how to do.',
    options: [
      { text: 'It gets under my skin', value: 0.8 },
      { text: 'I notice it, then let it go', value: 0.5 },
      { text: 'Fine by me, less to think about', value: 0.2 },
    ],
  },
  {
    axis: 'autonomy',
    category: 'cat_drive',
    prompt: "Saturday's calendar is empty and nobody has texted.",
    options: [
      { text: 'Perfect, the day is mine', value: 0.8 },
      { text: 'Nice for a morning, then I make plans', value: 0.5 },
      { text: 'I start texting people for plans', value: 0.2 },
    ],
  },
  // --- competence ---------------------------------------------------------------
  {
    axis: 'competence',
    category: 'cat_drive',
    prompt: 'A hard task lands in your inbox with your name on it.',
    options: [
      { text: 'I feel like I can handle it', value: 0.8 },
      { text: 'Depends how hard, honestly', value: 0.5 },
      { text: 'I doubt I can pull it off', value: 0.2 },
    ],
  },
  {
    axis: 'competence',
    category: 'cat_drive',
    prompt: 'Three weeks into a language app, and it still marks you wrong.',
    options: [
      { text: 'I can feel myself getting better', value: 0.8 },
      { text: 'Some days it clicks', value: 0.5 },
      { text: 'I mostly feel behind', value: 0.2 },
    ],
  },
  {
    axis: 'competence',
    category: 'cat_drive',
    prompt: "Someone at work messages: 'this is your area, right?'",
    options: [
      { text: 'Fair, it is', value: 0.8 },
      { text: "Probably, I'd double-check", value: 0.5 },
      { text: "I'm sure they mean someone else", value: 0.2 },
    ],
  },
  // --- relatedness --------------------------------------------------------------
  {
    axis: 'relatedness',
    category: 'cat_drive',
    prompt: 'A friend cancels by text an hour before, no real reason given.',
    options: [
      { text: "I'd want to talk it through", value: 0.8 },
      { text: "I'd let it go, check in eventually", value: 0.2 },
    ],
  },
  {
    axis: 'relatedness',
    category: 'cat_drive',
    prompt: 'Good news pops up on your phone on an ordinary Tuesday.',
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
  // --- growth_mindset -----------------------------------------------------------
  {
    axis: 'growth_mindset',
    category: 'cat_agency',
    prompt: 'Your first try at a recipe from a video goes badly. What actually happens next?',
    options: [
      { text: "I look at what I'd do differently", value: 0.8 },
      { text: "I probably don't try that again", value: 0.2 },
    ],
  },
  {
    axis: 'growth_mindset',
    category: 'cat_agency',
    prompt: 'Someone online is much better than you at a thing you care about.',
    options: [
      { text: 'I want to know how they got there', value: 0.8 },
      { text: 'Good for them, different lane', value: 0.5 },
      { text: 'Some people just have it', value: 0.2 },
    ],
  },
  {
    axis: 'growth_mindset',
    category: 'cat_agency',
    prompt: 'A friend posts day 60 of learning something new.',
    options: [
      { text: 'Give me 60 days and I could too', value: 0.8 },
      { text: 'Depends on the thing', value: 0.5 },
      { text: 'Some people are just built for it', value: 0.2 },
    ],
  },
  // --- locus_of_control ---------------------------------------------------------
  {
    axis: 'locus_of_control',
    category: 'cat_agency',
    prompt: 'The group trip you helped plan falls apart in the chat.',
    options: [
      { text: 'I look at what I could have done', value: 0.8 },
      { text: "Some of it was me, some wasn't", value: 0.5 },
      { text: 'It was bound to happen', value: 0.2 },
    ],
  },
  {
    axis: 'locus_of_control',
    category: 'cat_agency',
    prompt: "A good week, and someone texts 'how did you pull that off?'",
    options: [
      { text: 'Honestly, I worked for it', value: 0.8 },
      { text: 'A bit of both', value: 0.5 },
      { text: 'Good timing, mostly', value: 0.2 },
    ],
  },
  {
    axis: 'locus_of_control',
    category: 'cat_agency',
    prompt: 'New year, blank calendar. How it goes is mostly…',
    options: [
      { text: 'Up to what I do', value: 0.8 },
      { text: 'Half me, half luck', value: 0.5 },
      { text: 'Up to what happens', value: 0.2 },
    ],
  },
  // --- self_efficacy ------------------------------------------------------------
  {
    axis: 'self_efficacy',
    category: 'cat_agency',
    prompt: "Everyone at the table already knows their order. You don't.",
    options: [
      { text: "I panic-order whatever's closest", value: 0.2 },
      { text: 'Takes a sec, but I land on something', value: 0.5 },
      { text: 'I pick something and own it', value: 0.8 },
    ],
  },
  {
    axis: 'self_efficacy',
    category: 'cat_agency',
    prompt: 'The wifi drops and you have never fixed it yourself before.',
    options: [
      { text: "I'll figure it out", value: 0.8 },
      { text: 'I look it up first', value: 0.5 },
      { text: 'I find someone who knows', value: 0.2 },
    ],
  },
  {
    axis: 'self_efficacy',
    category: 'cat_agency',
    prompt: 'A big task has sat in your to-do app for two weeks.',
    options: [
      { text: 'I pick any piece and start', value: 0.8 },
      { text: 'I break it down, then wait a bit', value: 0.5 },
      { text: 'I keep moving it to tomorrow', value: 0.2 },
    ],
  },
  // --- playfulness --------------------------------------------------------------
  {
    axis: 'playfulness',
    category: 'cat_social',
    prompt: 'A 40-minute delay at the gate, and your phone is at 20%.',
    options: [
      { text: "I'd mess around and see what happens", value: 0.8 },
      { text: 'Either way, I am fine', value: 0.5 },
      { text: "I'd rather just get through it", value: 0.2 },
    ],
  },
  {
    axis: 'playfulness',
    category: 'cat_social',
    prompt: "A serious work call, and someone's cat walks across their keyboard.",
    options: [
      { text: 'I take the joke', value: 0.8 },
      { text: 'Depends who is on the call', value: 0.5 },
      { text: 'I keep it serious', value: 0.2 },
    ],
  },
  {
    axis: 'playfulness',
    category: 'cat_social',
    prompt: 'The group chat has a running joke.',
    options: [
      { text: 'I started it', value: 0.8 },
      { text: 'I keep it going', value: 0.5 },
      { text: 'I just react with a laugh', value: 0.2 },
    ],
  },
];

/**
 * Authored questions that left the intake but stay in use: the twelve extras
 * the tiered 50 gave openness/conscientiousness/extraversion (3 each) and
 * agreeableness/conflict_assertiveness/relatedness (1 each), then the ten
 * original wordings of the restored third drafts. Served in rounds from the
 * shared pool (wave49 / wave78 rows). Never delete one: an account that
 * answered it in the old intake is kept away from it by
 * `legacyIntakeExclusions` (intake-stage.ts).
 */
export const ROUND_ONLY_BANK: readonly QuestionDraft[] = [
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'Something new is sitting in your watch queue, right next to an old favorite.',
    options: [
      { text: 'New one', value: 0.8 },
      { text: 'Depends on my mood', value: 0.5 },
      { text: 'Something familiar', value: 0.2 },
    ],
  },
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'A coworker drops a totally different plan into the project chat.',
    options: [
      { text: "I'm curious, let's see", value: 0.8 },
      { text: "I'll hear them out", value: 0.5 },
      { text: "I'd rather stick to the plan", value: 0.2 },
    ],
  },
  {
    axis: 'openness',
    category: 'cat_openness',
    prompt: 'A friend sends a link to a class for a hobby you have never tried.',
    options: [
      { text: "I'd sign up", value: 0.8 },
      { text: 'Maybe another time', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: "Your alarm goes off and you already know today's to-do list is long.",
    options: [
      { text: 'I get moving right away', value: 0.8 },
      { text: 'I ease into it', value: 0.5 },
      { text: 'I hit snooze', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: "Midnight, dishes in the sink, and you promised yourself you'd do them tonight.",
    options: [
      { text: 'I still do them', value: 0.8 },
      { text: 'I do the bare minimum', value: 0.5 },
      { text: 'They wait until tomorrow', value: 0.2 },
    ],
  },
  {
    axis: 'conscientiousness',
    category: 'cat_steadiness',
    prompt: 'An online form wants three things and you only have two handy.',
    options: [
      { text: 'I track down the third one now', value: 0.8 },
      { text: 'I fill in what I can, come back later', value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'Hours alone with your laptop, and you just hit a wall.',
    options: [
      { text: 'I go find someone to talk to', value: 0.8 },
      { text: 'Either way', value: 0.5 },
      { text: 'I push through alone', value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: "The team chat asks who's in for lunch.",
    options: [
      { text: 'Count me in', value: 0.8 },
      { text: 'Depends on the day', value: 0.5 },
      { text: "I'd rather eat at my desk", value: 0.2 },
    ],
  },
  {
    axis: 'extraversion',
    category: 'cat_openness',
    prompt: 'At an event, you end up next to someone new and nobody is talking.',
    options: [
      { text: "I don't mind starting it", value: 0.8 },
      { text: "I'll follow their lead", value: 0.2 },
    ],
  },
  {
    axis: 'agreeableness',
    category: 'cat_steadiness',
    prompt: 'A friend texts asking for a favor that would eat your whole evening.',
    options: [
      { text: 'I usually say yes anyway', value: 0.8 },
      { text: 'Depends how big a favor', value: 0.5 },
      { text: "I say no if it's a real hassle", value: 0.2 },
    ],
  },
  {
    axis: 'conflict_assertiveness',
    category: 'cat_communication',
    prompt: "A friend still hasn't paid you back for the last three dinners.",
    options: [
      { text: 'I bring it up directly', value: 0.8 },
      { text: 'I hint at it', value: 0.5 },
      { text: 'I let it slide', value: 0.2 },
    ],
  },
  {
    axis: 'relatedness',
    category: 'cat_drive',
    prompt: 'You just finished something and it came out better than you hoped.',
    options: [
      { text: 'I want to tell someone right away', value: 0.8 },
      { text: 'It can wait until it comes up', value: 0.5 },
      { text: 'I keep it to myself', value: 0.2 },
    ],
  },
  {
    axis: 'steadiness',
    category: 'cat_steadiness',
    prompt: "Your manager messages 'can we talk tomorrow?' and nothing else.",
    options: [
      { text: 'I read it plain and move on', value: 0.8 },
      { text: 'I reread it a few times', value: 0.2 },
    ],
  },
  {
    axis: 'attachment_anxiety',
    category: 'cat_love',
    prompt: 'After a good night out, you scroll back through the chat to check it really went well.',
    options: [
      { text: 'Yeah, that lands', value: 0.8 },
      { text: 'Not really me', value: 0.2 },
    ],
  },
  {
    axis: 'attachment_avoidance',
    category: 'cat_love',
    prompt: "The person you've been seeing starts saying 'we' in texts.",
    options: [
      { text: 'I lean in', value: 0.2 },
      { text: 'I want a bit of room', value: 0.8 },
    ],
  },
  {
    axis: 'conflict_cooperativeness',
    category: 'cat_communication',
    prompt: 'Mid-argument, you find the screenshot that proves your point.',
    options: [
      { text: 'I keep it to myself', value: 0.8 },
      { text: 'I send it', value: 0.2 },
    ],
  },
  {
    axis: 'autonomy',
    category: 'cat_drive',
    prompt: 'A day off, notifications muted, and nobody needs anything from you.',
    options: [
      { text: 'That is the best kind of day', value: 0.8 },
      { text: "I'd rather have a plan", value: 0.2 },
    ],
  },
  {
    axis: 'competence',
    category: 'cat_drive',
    prompt: "A coworker messages 'how are you so good at this?'",
    options: [
      { text: 'Yeah, I think so too', value: 0.8 },
      { text: 'I brush it off', value: 0.2 },
    ],
  },
  {
    axis: 'growth_mindset',
    category: 'cat_agency',
    prompt: 'Day 1 of a 30-day challenge in an app, and it shows.',
    options: [
      { text: "I'll be better by day 30", value: 0.8 },
      { text: 'Some things just are not for me', value: 0.2 },
    ],
  },
  {
    axis: 'locus_of_control',
    category: 'cat_agency',
    prompt: 'The email lands: the job you wanted went to someone else.',
    options: [
      { text: "Next time I'll do it differently", value: 0.8 },
      { text: 'Timing decides more than I do', value: 0.2 },
    ],
  },
  {
    axis: 'self_efficacy',
    category: 'cat_agency',
    prompt: 'You move apartments next month and the to-do list is just a title.',
    options: [
      { text: 'I start somewhere and adjust', value: 0.8 },
      { text: 'I stall until it gets urgent', value: 0.2 },
    ],
  },
  {
    axis: 'playfulness',
    category: 'cat_social',
    prompt: 'Someone asks who sends the most memes in the group chat.',
    options: [
      { text: "Guilty, that's me", value: 0.8 },
      { text: 'Not me, I just react', value: 0.2 },
    ],
  },
];

/**
 * Per-trait question counts of the old tiered 50 (bank.ts before 2026-10-02).
 * Only read by the old-50 rule: an account whose answers fill this shape keeps
 * every unlock it had, whatever the new stage says.
 */
export const LEGACY_INTAKE_AXIS_COUNTS = {
  openness: 6,
  conscientiousness: 6,
  extraversion: 6,
  agreeableness: 4,
  steadiness: 2,
  attachment_anxiety: 2,
  attachment_avoidance: 2,
  conflict_assertiveness: 4,
  conflict_cooperativeness: 2,
  autonomy: 2,
  competence: 2,
  relatedness: 4,
  growth_mindset: 2,
  locus_of_control: 2,
  self_efficacy: 2,
  playfulness: 2,
} as const;

/**
 * The old intake's prompts in old per-trait order: answering N on a trait in
 * the old intake meant seeing that trait's first N entries here.
 */
export const LEGACY_INTAKE_PROMPTS: readonly { axis: QuestionDraft['axis']; prompt: string }[] = [
  { axis: 'openness', prompt: "Your Do today was writing down one thing you're walking into. Was today's version the safe pick or the different one?" },
  { axis: 'openness', prompt: 'Same restaurant, and there is a menu item you have never tried.' },
  { axis: 'openness', prompt: 'A friend wants to drag you to something you would never pick yourself.' },
  { axis: 'openness', prompt: "You're picking a show to watch and there's something new in your queue you haven't tried." },
  { axis: 'openness', prompt: 'A coworker suggests doing the project a totally different way than you planned.' },
  { axis: 'openness', prompt: "You have a free Saturday and someone mentions a class or hobby you've never tried." },
  { axis: 'conscientiousness', prompt: 'A plan you made last week hits a boring stretch today.' },
  { axis: 'conscientiousness', prompt: 'Something is due Friday. It is Monday.' },
  { axis: 'conscientiousness', prompt: 'You said you would do a small thing for someone and nobody followed up.' },
  { axis: 'conscientiousness', prompt: "Your alarm goes off and you already know today's to-do list is long." },
  { axis: 'conscientiousness', prompt: "You told yourself you'd clean up before bed, and you're tired." },
  { axis: 'conscientiousness', prompt: 'A form needs three pieces of information and you only have two handy.' },
  { axis: 'extraversion', prompt: 'Saturday afternoon, nobody has plans yet.' },
  { axis: 'extraversion', prompt: 'You walk into a party and know maybe two people.' },
  { axis: 'extraversion', prompt: 'A long week just ended.' },
  { axis: 'extraversion', prompt: "You've been working alone for hours and hit a wall." },
  { axis: 'extraversion', prompt: 'A coworker asks if you want to grab lunch with the group instead of eating at your desk.' },
  { axis: 'extraversion', prompt: "You're the one who has to make small talk with someone new at an event." },
  { axis: 'agreeableness', prompt: "A group chat is picking a place you don't really like." },
  { axis: 'agreeableness', prompt: 'Someone takes credit for something that was mostly yours.' },
  { axis: 'agreeableness', prompt: 'A stranger is clearly in the wrong and clearly having a bad day.' },
  { axis: 'agreeableness', prompt: "Someone asks for a favor that's a genuine inconvenience for you." },
  { axis: 'steadiness', prompt: 'A small thing goes wrong first thing in the morning.' },
  { axis: 'steadiness', prompt: 'Plans change on you an hour before.' },
  { axis: 'attachment_anxiety', prompt: 'Someone you like takes a while to reply.' },
  { axis: 'attachment_anxiety', prompt: 'A close friend has been quieter than usual this week.' },
  { axis: 'attachment_avoidance', prompt: 'Someone close to you wants to talk something out in person instead of over text.' },
  { axis: 'attachment_avoidance', prompt: 'A rough week. Someone asks how you actually are.' },
  { axis: 'conflict_assertiveness', prompt: 'You disagree with someone in the room.' },
  { axis: 'conflict_assertiveness', prompt: 'The order is wrong and the place is busy.' },
  { axis: 'conflict_assertiveness', prompt: 'You want something and asking might annoy someone.' },
  { axis: 'conflict_assertiveness', prompt: "A friend keeps borrowing money and hasn't paid you back." },
  { axis: 'conflict_cooperativeness', prompt: 'When you and someone else both want different things with no obvious middle ground, who usually gives first?' },
  { axis: 'conflict_cooperativeness', prompt: 'An argument is going nowhere and it is getting late.' },
  { axis: 'autonomy', prompt: 'Someone hands you a plan that would work fine.' },
  { axis: 'autonomy', prompt: 'You get told exactly how to do something you already know how to do.' },
  { axis: 'competence', prompt: 'A hard task lands on your plate.' },
  { axis: 'competence', prompt: 'You are learning something new and you are still bad at it.' },
  { axis: 'relatedness', prompt: 'A friend cancels same-day, no real reason given.' },
  { axis: 'relatedness', prompt: 'Something good happens to you on an ordinary Tuesday.' },
  { axis: 'relatedness', prompt: 'A whole day with no messages from anyone.' },
  { axis: 'relatedness', prompt: "You just finished something you're proud of." },
  { axis: 'growth_mindset', prompt: 'You try something new and it goes badly the first time. What actually happens next?' },
  { axis: 'growth_mindset', prompt: 'Someone is much better than you at a thing you care about.' },
  { axis: 'locus_of_control', prompt: 'A plan you were in on falls apart.' },
  { axis: 'locus_of_control', prompt: 'A good week. Where does the credit actually go?' },
  { axis: 'self_efficacy', prompt: "Everyone at the table already knows their order. You don't." },
  { axis: 'self_efficacy', prompt: 'Something breaks and you have never fixed one before.' },
  { axis: 'playfulness', prompt: 'A dull stretch with nothing required of you.' },
  { axis: 'playfulness', prompt: 'A serious conversation hits a genuinely funny moment.' },
];

/**
 * The AI round prompt's register: revised bank questions in the moment voice
 * (emci 2026-10-05). The model matches these and must never reuse one —
 * every bank prompt is also in the prompt's ALREADY ASKED list.
 */
export const QUESTIONS_FEW_SHOTS = `1. Openness: "A new place opened next to your usual spot, and your usual order is already in the app." Options: "I try the new place" / "I save it for next week" / "Usual order. It's right there"

2. Relatedness: "A friend cancels by text an hour before, no real reason given." Options: "I'd want to talk it through" / "I'd let it go, check in eventually"

3. Attachment_anxiety: "You sent a long message an hour ago. It says Read." Options: "I check back more than I'd admit" / "I notice, then put the phone down" / "I forget I sent it"

4. Attachment_avoidance, balanced options: "Someone close to you wants to talk something out in person instead of over text." Options: "Sure, that's fine when it matters" / "I'd rather keep it lighter, over text"

5. Self-efficacy, low-stakes and fun: "Everyone at the table already knows their order. You don't." Options: "I panic-order whatever's closest" / "Takes a sec, but I land on something" / "I pick something and own it"

6. Conflict_cooperativeness: "The group chat is arguing and you know the right answer." Options: "I let it go to keep the chat calm" / "I say it once, then drop it" / "I send the link that proves it"

7. Playfulness: "A serious work call, and someone's cat walks across their keyboard." Options: "I take the joke" / "Depends who is on the call" / "I keep it serious"

8. Steadiness: "An hour before, the group chat moves the plan somewhere else." Options: "Fine, I roll with it" / "Mild whiplash, then fine" / "It throws off the whole evening"`;

/**
 * The moment-voice rewrite (2026-10-05) is draft copy until emci reads it.
 * The before/after table is docs/proposals/question-rewrite.md.
 */
export const QUESTION_VOICE_COPY_REVIEWED = false;

/**
 * Old wording -> new wording for every bank row the rewrite changed (intake
 * and round-only). Index for index with bank-v1.ts, so trait, set and option
 * values are identical; only the words moved. Used wherever the app matches
 * question TEXT: the round's "already asked" list and the old-intake
 * exclusions, so a person who answered the old wording never gets the new
 * wording of the same question in a round (and the other way round).
 */
export const PROMPT_REWORDS: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  const pairs: [readonly QuestionDraft[], readonly QuestionDraft[]][] = [
    [QUESTIONS_BANK_V1, QUESTIONS_BANK],
    [ROUND_ONLY_BANK_V1, ROUND_ONLY_BANK],
  ];
  for (const [before, after] of pairs) {
    before.forEach((row, i) => {
      if (row.prompt !== after[i].prompt) out[row.prompt] = after[i].prompt;
    });
  }
  return out;
})();

const REWORDED_FROM: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PROMPT_REWORDS).map(([before, after]) => [after, before]),
);

/** Each text plus its other wording, if the rewrite gave it one. */
export function withRewordAliases(texts: readonly string[]): string[] {
  const out: string[] = [];
  for (const text of texts) {
    out.push(text);
    const other = PROMPT_REWORDS[text] ?? REWORDED_FROM[text];
    if (other) out.push(other);
  }
  return out;
}
