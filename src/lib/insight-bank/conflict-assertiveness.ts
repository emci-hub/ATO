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
      'Practice saying what bothers you in one sentence, out loud and alone, so it feels familiar when you need it.',
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
    why: 'Giving in keeps things kind, but doing it often can leave your own wishes out of the decision.',
    try: [
      'Next time you both want different things, say what you want first, so the other person knows.',
      'Pick one plan this week to choose yourself, so the choices get shared.',
    ],
    watch: [
      'Notice how often you end up doing what the other person wanted.',
      'Notice when giving in leaves you a little resentful.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_07', ['conflict_assertiveness:high'], {
    focus: [
      'When a meal or a service isn’t right, you tend to say so politely and ask for a fix.',
      'You usually return something or ask for a refund when it’s not what you paid for.',
      'When a bill has a mistake on it, you tend to bring it up right away.',
    ],
    why: 'Speaking up gets you what you paid for, but a tense tone can make the other person less willing to help.',
    try: [
      'Start your next complaint with one friendly sentence, so the person on the other end wants to help.',
      'Ask “what can we do about this?” in your next dispute, so the talk turns to a solution.',
    ],
    watch: [
      'Notice how the other person’s tone changes with yours.',
      'Notice whether you got what you wanted by being direct or by being friendly.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_08', ['conflict_assertiveness:high'], {
    focus: [
      'When you ask for a raise or a better deal, you tend to name your number clearly.',
      'You usually ask for what you want in a negotiation instead of waiting for it to be offered.',
      'When you think you deserve more, you tend to say so.',
    ],
    why: 'Asking clearly often gets you results others miss, but pushing too hard can leave the other side feeling cornered.',
    try: [
      'Write two reasons for your next ask, so you show why and not just what you want.',
      'Ask the other person what matters most to them, so you find a deal that works for both sides.',
    ],
    watch: [
      'Notice when the other person goes quiet during a negotiation.',
      'Notice whether the result felt fair to you both.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_09', ['conflict_assertiveness:high'], {
    focus: [
      'When a friend makes a mistake, you tend to tell them plainly what went wrong.',
      'You usually give honest feedback to a friend or coworker instead of hinting.',
      'When someone is about to make a choice you disagree with, you tend to say so.',
    ],
    why: 'Plain feedback saves people time, but the same words can sting more than you intend when the person is already hard on themselves.',
    try: [
      'Ask “do you want my honest view?” before you give feedback, so the other person is ready to hear it.',
      'Add one thing the person did well, so your feedback comes with a fair picture.',
    ],
    watch: [
      'Notice how the person looks right after you give your view.',
      'Notice who asks for your honest opinion and who just wants support.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_10', ['conflict_assertiveness:high'], {
    focus: [
      'When a decision is being made in a group, you tend to say what you want early.',
      'You usually share your preference first, so others know where you stand.',
      'When the group seems stuck, you tend to push for a choice.',
    ],
    why: 'Naming what you want moves things along, but others might go quiet and not say what they prefer.',
    try: [
      'Ask the quietest person in the group what they’d choose before you push for a decision, so their view counts.',
      'Say your preference second instead of first once this week, so you see what others bring up.',
    ],
    watch: [
      'Notice who hasn’t spoken before the group decides.',
      'Notice whether the decision changes when you wait to speak.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_11', ['conflict_assertiveness:high'], {
    focus: [
      'When someone interrupts you, you tend to say so and finish your point.',
      'You usually don’t let a conversation run past something you wanted to say.',
      'When another person talks over you, you tend to bring the conversation back to your point.',
    ],
    why: 'Finishing your point makes sure you’re heard, but the other person may feel cut off in return.',
    try: [
      'Say “I’d like to finish, then I want to hear you” the next time you’re interrupted, so both of you get a turn.',
      'Let someone finish a point fully once today, even if you disagree, so you hear all of it.',
    ],
    watch: [
      'Notice how often you start talking before someone has finished.',
      'Notice how the other person acts when you wait.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_12', ['conflict_assertiveness:high'], {
    focus: [
      'When something at work isn’t working, you tend to bring it to your boss directly.',
      'You usually raise a problem with your team instead of hoping it goes away.',
      'When a rule seems unfair, you tend to ask the person in charge about it.',
    ],
    why: 'Raising a problem early can save everyone time, but a boss may need to hear the solution you have in mind too.',
    try: [
      'Offer one possible fix with the next problem you raise, so your boss can say yes to something.',
      'Pick a quiet time to bring up a problem, so the talk isn’t rushed.',
    ],
    watch: [
      'Notice how your boss responds when you bring a fix.',
      'Notice which problems you raise that others stay quiet about.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_07', ['conflict_assertiveness:low'], {
    focus: [
      'When a neighbor or roommate is too loud, you tend to put up with it instead of asking them to stop.',
      'You usually wait a long time before you tell someone their behavior bothers you.',
      'When someone does something annoying, you tend to let it build before you say anything.',
    ],
    why: 'Avoiding a fight keeps things calm for now, but a small problem can grow into one that feels harder for you to raise.',
    try: [
      'Tell the person about a small thing that bothers you in one calm sentence, so it stays small.',
      'Write out what you’d say first, so the words are ready when the moment comes.',
    ],
    watch: [
      'Notice how long you wait before you say something.',
      'Notice how you feel once you’ve said it.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_08', ['conflict_assertiveness:low'], {
    focus: [
      'When you want a raise or a change at work, you tend to hope someone notices instead of asking.',
      'You usually wait for your boss to bring up your good work.',
      'When you think you deserve more, you tend to keep it to yourself.',
    ],
    why: 'Doing good work quietly is admirable, but your boss may not know what you want unless you tell them.',
    try: [
      'Write down three things you’ve done well this month, so you’re ready to share them if asked.',
      'Ask your boss for ten minutes to talk about your role, so you can say what you’d like to grow into.',
    ],
    watch: [
      'Notice what you want that you haven’t said out loud.',
      'Notice how your boss reacts when you share a result.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_09', ['conflict_assertiveness:low'], {
    focus: [
      'When a friend asks what you want to do, you tend to say you don’t mind even if you do.',
      'You usually hold back your preference to avoid starting a debate.',
      'When a plan doesn’t suit you, you tend to go along and quietly wish it were different.',
    ],
    why: 'Going along keeps the mood easy, but over time your friends may not know what you actually enjoy.',
    try: [
      'Name one small preference this week, like the place for lunch, so it becomes a habit.',
      'Tell a friend one thing you’d like to do next time, so your wishes become part of the plan.',
    ],
    watch: [
      'Notice how often you say “I don’t mind.”',
      'Notice how a friend reacts when you do share a choice.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_10', ['conflict_assertiveness:low'], {
    focus: [
      'When you get something you didn’t order or a gift you don’t like, you tend to say it’s fine.',
      'You usually accept something that isn’t right rather than ask for a change.',
      'When a service falls short, you tend to say nothing and don’t go back.',
    ],
    why: 'Not making a fuss feels polite, but the other side often wants to fix a mistake and can’t if you don’t say.',
    try: [
      'Say “could I get this fixed?” once this week, so you see how easy it can be.',
      'Let a small mistake go and ask about the next one, so you pick your moments.',
    ],
    watch: [
      'Notice how people react when you ask politely for a change.',
      'Notice how it feels to accept something that isn’t right.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_11', ['conflict_assertiveness:low'], {
    focus: [
      'When someone cancels on you again, you tend to say it’s okay and feel upset later.',
      'You usually keep your feelings to yourself after a friend lets you down.',
      'When a partner does something that hurts, you tend to wait for it to pass.',
    ],
    why: 'Keeping the peace protects the moment, but feelings you don’t share can sit with you and shape how you see the person.',
    try: [
      'Tell the person one sentence about how it felt, with no demand attached, so it’s out.',
      'Write the feeling in your notes first, so you know what you want to say.',
    ],
    watch: [
      'Notice what you feel later that you didn’t say at the time.',
      'Notice how the person reacts when you’re honest in a gentle way.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_12', ['conflict_assertiveness:low'], {
    focus: [
      'When a group makes a choice you disagree with, you tend to go along and say nothing.',
      'You usually wait until the meeting is over to share your concerns, if at all.',
      'When others sound sure, you tend to doubt your own view and stay quiet.',
    ],
    why: 'Your view might be the one the group is missing, and it only helps if someone hears it.',
    try: [
      'Share one question in the next meeting, so you speak up without needing to disagree.',
      'Send a short message to the group after a meeting with your point, so it still gets heard.',
    ],
    watch: [
      'Notice how often your quiet concern turns out to matter later.',
      'Notice how it feels to speak first and not last.',
    ],
  }),
];
