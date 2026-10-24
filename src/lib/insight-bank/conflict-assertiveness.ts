/** Directness (conflict_assertiveness): Direct (high) and Quiet (low). */
import { idea, type InsightIdea } from './define';

export const CONFLICT_ASSERTIVENESS_IDEAS: readonly InsightIdea[] = [
  idea("ftw_conflict_assertiveness_h_01", ["conflict_assertiveness:high"], {
    focus: [
      "Your answers suggest you put a clear point on the table in a disagreement.",
      "From your answers, you put a clear point on the table in a disagreement.",
      "The pattern in your answers is that you put a clear point on the table in a disagreement.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_02", ["conflict_assertiveness:high"], {
    focus: [
      "The catch in your answers is a point that takes over the talk.",
      "What this can cost you is a point that takes over the talk.",
      "A cost worth naming for you is a point that takes over the talk.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_03", ["conflict_assertiveness:high"], {
    focus: [
      "Someone else might notice that you say the point when staying quiet would be easier.",
      "From the outside, you say the point when staying quiet would be easier.",
      "Other people can see that you say the point when staying quiet would be easier.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_04", ["conflict_assertiveness:high"], {
    focus: [
      "What you might miss is the other person's point.",
      "Your answers leave room to miss the other person's point.",
      "A thing you might skip is the other person's point.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_05", ["conflict_assertiveness:high"], {
    focus: [
      "The helpful side for you shows up when the point needs to be in the talk.",
      "Your answers also show a use when the point needs to be in the talk.",
      "There is a use for you when the point needs to be in the talk.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_h_06", ["conflict_assertiveness:high", "conflict_cooperativeness:high"], {
    focus: [
      "Your answers suggest two things at once: you say your point, and you widen the plan.",
      "Both can be true for you in the same week: you say your point, and you widen the plan.",
      "In the same week, you say your point, and you widen the plan.",
    ],
    why: "The upside for you is a point that gets said. The catch is a point that takes over the talk.",
    try: [
      "Next time you choose, name whether the point is taking over first.",
      "Before you decide, check what the other person still needs to say.",
    ],
    watch: [
      "Notice when your point takes over the whole talk.",
      "Notice if you missed the other person's point.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_01", ["conflict_assertiveness:low"], {
    focus: [
      "Your answers suggest you step back in a disagreement even when the point is ready.",
      "From your answers, you step back in a disagreement even when the point is ready.",
      "The pattern in your answers is that you step back in a disagreement even when the point is ready.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_02", ["conflict_assertiveness:low"], {
    focus: [
      "The catch in your answers is a point that never gets said.",
      "What this can cost you is a point that never gets said.",
      "A cost worth naming for you is a point that never gets said.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_03", ["conflict_assertiveness:low"], {
    focus: [
      "Someone else might notice that you step back even when the point is ready to say.",
      "From the outside, you step back even when the point is ready to say.",
      "Other people can see that you step back even when the point is ready to say.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_04", ["conflict_assertiveness:low"], {
    focus: [
      "What you might miss is the point you meant to say.",
      "Your answers leave room to miss the point you meant to say.",
      "A thing you might skip is the point you meant to say.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_05", ["conflict_assertiveness:low"], {
    focus: [
      "The helpful side for you shows up when a softer step can keep the talk alive.",
      "Your answers also show a use when a softer step can keep the talk alive.",
      "There is a use for you when a softer step can keep the talk alive.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea("ftw_conflict_assertiveness_l_06", ["conflict_assertiveness:low", "conflict_cooperativeness:high"], {
    focus: [
      "Your answers suggest two things at once: you step back, and you widen the plan.",
      "Both can be true for you in the same week: you step back, and you widen the plan.",
      "In the same week, you step back, and you widen the plan.",
    ],
    why: "The upside for you is a softer disagreement. The catch is a point that never gets said.",
    try: [
      "Next time you choose, name whether the point still needs saying first.",
      "Before you decide, check what you are not saying.",
    ],
    watch: [
      "Notice when the point never gets said.",
      "Notice if you wanted to say it and stepped back.",
    ],
  }),
  idea('ftw_conflict_assertiveness_h_07', ['conflict_assertiveness:high'], {
    focus: [
      'When a meal or a service isn’t right, you tend to say so politely and ask for a fix.',
      'You usually return something or ask for a refund when it’s not what you paid for.',
      'You tend to bring a bill up right away when it has a mistake on it.',
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
      'You tend to say so when you think you deserve more.',
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
      'You tend to keep it to yourself when you think you deserve more.',
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
      'You tend to go along quietly when a plan doesn’t suit you.',
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
