/** Directness (conflict_assertiveness): Direct (high) and Quiet (low). */
import { idea, type InsightIdea } from './define';

export const CONFLICT_ASSERTIVENESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_conflict_assertiveness_h_01', ['conflict_assertiveness:high'], {
    focus: [
      'When you disagree in a meeting, you tend to say so right away.',
      'You usually speak up when you think a plan at work won’t work.',
      'When something seems wrong, you tend to say it out loud instead of waiting.',
    ],
    why: 'Speaking up helps catch problems early, but quieter coworkers might not get a chance to share their view with you.',
    try: [
      'Ask a quieter coworker for their opinion before you share yours, so more ideas get heard.',
      'Wait for two other people to speak in your next meeting before you do, so you hear the room first.',
    ],
    watch: [
      'Notice who talks after you speak up.',
      'Notice when your first point makes others hold back theirs.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_02', ['conflict_assertiveness:high'], {
    focus: [
      'When you want something from a friend or partner, you tend to ask for it plainly.',
      'You usually tell people what you need instead of hinting.',
      'When a plan doesn’t work for you, you tend to say so and suggest another.',
    ],
    why: 'Asking plainly makes things clear, but others might hint instead, so you might miss what they need.',
    try: [
      'Ask a friend or partner what they’d like this week, so their needs are clear too.',
      'Pay attention to one hint someone drops today and act on it, so they feel heard.',
    ],
    watch: [
      'Notice when someone hints at what they want.',
      'Notice how often your plan becomes the group’s plan.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_03', ['conflict_assertiveness:high'], {
    focus: [
      'When there’s tension with someone, you tend to want to talk it out right away.',
      'You usually prefer to settle a problem the same day instead of letting it sit.',
      'When a disagreement starts, you tend to push for an answer quickly.',
    ],
    why: 'Dealing with things fast stops them from growing, but the other person might need time to think before talking with you.',
    try: [
      'Next time there’s tension, ask the other person when they’d like to talk, so they’re ready too.',
      'Give a disagreement a night before you bring it up, so you both come in calmer.',
    ],
    watch: [
      'Notice when the other person seems rushed to answer.',
      'Notice whether a short pause changes how the talk goes.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_04', ['conflict_assertiveness:high'], {
    focus: [
      'When someone pushes back on your idea, you tend to argue your point harder.',
      'You usually defend your view strongly when others disagree.',
      'When a coworker challenges your plan, you tend to explain it again more firmly.',
    ],
    why: 'Standing by your ideas shows confidence, but listening first might show you something you missed.',
    try: [
      'Next time someone pushes back, ask what worries them before you reply, so you understand their side.',
      'Repeat back the other person’s point in your own words, so they know you heard it.',
    ],
    watch: [
      'Notice when you start your reply before the other person finishes.',
      'Notice whether their concern had a point.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_05', ['conflict_assertiveness:high'], {
    focus: [
      'When someone is treated unfairly, you tend to speak up for them.',
      'You usually step in when you see a friend or coworker being talked over.',
      'When a decision seems unfair, you tend to say something even if it’s not about you.',
    ],
    why: 'Speaking up for others is a real strength, but the person you’re defending might want to speak for themselves.',
    try: [
      'Ask the person afterward if they wanted you to step in, so you know for next time.',
      'Next time, look at the person first before you speak, so they get the chance to answer.',
    ],
    watch: [
      'Notice how the person you defend reacts.',
      'Notice when someone was about to speak up for themselves.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_06', ['conflict_assertiveness:high', 'conflict_cooperativeness:high'], {
    focus: [
      'In a disagreement, you tend to say what you think and then look for a fix that suits everyone.',
      'You usually speak up in a conflict, but you also want both sides to leave happy.',
      'When friends argue, you tend to share your view and then help find a middle ground.',
    ],
    why: 'Mixing honesty with care makes you good at solving problems, but it can take a lot of your energy.',
    try: [
      'Next time you help settle something, take a short break after, so you have energy left for yourself.',
      'Let one small disagreement go today, so you save your energy for the ones that matter.',
    ],
    watch: [
      'Notice how tired you feel after helping settle a disagreement.',
      'Notice which conflicts actually need you.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_01', ['conflict_assertiveness:low'], {
    focus: [
      'When a roommate leaves a mess, you tend to clean it up instead of saying something.',
      'You usually choose to keep quiet about small things that bother you.',
      'When a friend keeps showing up late, you usually don’t mention it.',
    ],
    why: 'Keeping quiet avoids small fights, but the same thing can keep happening because the other person doesn’t know it bothers you.',
    try: [
      'Tell one person about one small thing that bugs you, so they get the chance to change it.',
      'Write down what you’d say in one sentence, so it’s easier to say it out loud.',
    ],
    watch: [
      'Notice when the same small thing happens again.',
      'Notice how you feel after you don’t say something.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_02', ['conflict_assertiveness:low'], {
    focus: [
      'When you disagree in a meeting, you tend to keep it to yourself.',
      'You usually wait to share a concern until after the meeting, if at all.',
      'When your boss suggests something you doubt, you tend to go along with it.',
    ],
    why: 'Holding back avoids friction, but your view might be the one that saves the team time.',
    try: [
      'Send your concern to your boss in a short message after the meeting, so it still gets heard.',
      'Ask one question about the plan in your next meeting, so your doubt gets voiced gently.',
    ],
    watch: [
      'Notice when a concern you didn’t share turns out to be right.',
      'Notice how people react when you do speak up.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_03', ['conflict_assertiveness:low'], {
    focus: [
      'When you want something, you tend to hint at it instead of asking directly.',
      'You usually hope people will notice what you need without you saying it.',
      'When a plan doesn’t suit you, you tend to go along and hope it works out.',
    ],
    why: 'Hinting feels gentler to you, but people often miss hints and then can’t give you what you want.',
    try: [
      'Ask for one thing you want this week in a plain sentence, so the other person knows.',
      'Text your partner or a friend one clear request, so it’s easier than saying it in person.',
    ],
    watch: [
      'Notice when you drop a hint and nobody picks it up.',
      'Notice how people respond when you ask plainly.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_04', ['conflict_assertiveness:low'], {
    focus: [
      'When an argument starts, you tend to stay quiet and wait for it to calm down.',
      'You usually listen more than you talk when people disagree.',
      'When voices get raised, you tend to step back instead of joining in.',
    ],
    why: 'Staying calm helps cool things down, but your view still matters even if you share it later.',
    try: [
      'When things calm down, share one thought you held back, so your side gets heard.',
      'Write down your view during a tense talk, so you can share it later when it’s calmer.',
    ],
    watch: [
      'Notice what you wanted to say but didn’t.',
      'Notice whether people ask for your view after things calm down.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_05', ['conflict_assertiveness:low'], {
    focus: [
      'After a disagreement, you tend to apologize first, even when it wasn’t your fault.',
      'You usually say sorry to end a tense moment, even if you weren’t wrong.',
      'When there’s tension with a friend, you tend to apologize just to end it.',
    ],
    why: 'Apologizing keeps the peace, but saying sorry for things you didn’t do can leave your own hurt unspoken.',
    try: [
      'Next time you go to apologize, ask yourself what you’re sorry for, so you only say it when you mean it.',
      'Swap one “sorry” for “thanks for waiting” today, so you still sound kind.',
    ],
    watch: [
      'Notice when you say sorry out of habit.',
      'Notice whether the other person also apologizes.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_06', ['conflict_assertiveness:low', 'conflict_cooperativeness:high'], {
    focus: [
      'In disagreements, you tend to give in so the other person is happy.',
      'When a friend wants something different, you usually go with their choice.',
      'You tend to put the other person’s wishes first when you both want different things.',
    ],
    why: 'Giving in keeps things kind, but doing it every time can leave your own wishes out of the decision.',
    try: [
      'Next time you both want different things, say what you want first, so the other person knows.',
      'Pick one plan this week to choose yourself, so the choices get shared.',
    ],
    watch: [
      'Notice how often you end up doing what the other person wanted.',
      'Notice when giving in leaves you a little resentful.',
    ],
  }),
];
