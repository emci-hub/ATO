/** Directness (conflict_assertiveness): Direct (high) and Quiet (low). */
import { idea, type InsightIdea } from './define';

export const CONFLICT_ASSERTIVENESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_conflict_assertiveness_h_01', ['conflict_assertiveness:high'], {
    focus: [
      'You disagree in a meeting, and you usually say so before the next slide is up.',
      'A plan in the work chat looks like it won’t work, and you usually say that out loud.',
      'Something in the shared doc looks wrong, and you can name it in the thread instead of waiting.',
    ],
    why: 'You can catch a bad plan by saying it early, but quieter coworkers might not get a turn in the chat.',
    try: [
      'Ask a quieter coworker what they think before you share yours, so more than one idea gets heard.',
      'Wait until two other people have spoken in the next meeting, so you hear the room first.',
    ],
    watch: [
      'Notice who talks after you put your point in the meeting.',
      'Notice when your first point makes other people hold theirs back.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_02', ['conflict_assertiveness:high'], {
    focus: [
      'You want something from a friend or partner, and you usually ask for it in a plain sentence.',
      'A friend hints about Friday, and you usually skip the hint and say the time you actually need.',
      'A Friday plan doesn’t work for you, and you usually say so and offer a different time.',
    ],
    why: 'A plain ask makes the plan clear, but other people might hint, so you can miss what they need from the same chat.',
    try: [
      'Ask a friend or partner what they’d like this week, so their side of the plan is clear too.',
      'Look for one hint someone drops today and act on it, so they feel heard without a speech.',
    ],
    watch: [
      'Notice when someone hints at what they want instead of asking.',
      'Notice how often your plan becomes the one on the group calendar.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_03', ['conflict_assertiveness:high'], {
    focus: [
      'Tension with someone can have you wanting to talk it out the same afternoon, not next week.',
      'A tense text usually has you wanting it settled before bed, not left until morning.',
      'A disagreement starts, and you can push for an answer before the other person has sat with it.',
    ],
    why: 'You can stop a small thing from growing by talking the same day, but the other person might need the night first.',
    try: [
      'Next time there’s tension, ask when they’d like to talk, so they’re ready too.',
      'Give a disagreement a night before you bring it up, so the talk starts calmer.',
    ],
    watch: [
      'Notice when the other person seems rushed to answer before they’ve had a minute.',
      'Notice whether one night changes how the talk goes.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_04', ['conflict_assertiveness:high'], {
    focus: [
      'Someone pushes back on your idea, and you usually argue the point harder in the next sentence.',
      'You can defend your view strongly once other people in the meeting disagree.',
      'A coworker challenges your plan, and you usually explain it again, firmer the second time.',
    ],
    why: 'Standing by the idea shows you believe it, but listening first might show you a problem you missed in the plan.',
    try: [
      'Next time someone pushes back, ask what worries them before you reply, so you hear their side.',
      'Say their point back in your own words, so they know you heard it before you answer.',
    ],
    watch: [
      'Notice when you start your reply before the other person finishes the sentence.',
      'Notice whether their worry about the plan had a real point.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_05', ['conflict_assertiveness:high'], {
    focus: [
      'Someone gets treated unfairly in the room, and you usually speak up for them before they do.',
      'A friend or coworker gets talked over, and you can step in so their sentence gets finished.',
      'A decision looks unfair, and you usually say something even when it isn’t about your own task.',
    ],
    why: 'Speaking up for someone is a real help, but the person you defended might have wanted to answer for themselves.',
    try: [
      'Ask the person afterward if they wanted you to step in, so you know for the next meeting.',
      'Next time, look at them first before you speak, so they get a chance to answer.',
    ],
    watch: [
      'Notice how the person you spoke for reacts in the moment.',
      'Notice when they were about to speak for themselves.',
    ],
  }),
  idea('ftw_conflict_assertiveness_h_06', ['conflict_assertiveness:high', 'conflict_cooperativeness:high'], {
    focus: [
      'In a disagreement you usually say what you think, then look for a fix that works for both of you.',
      'You can say what you think at dinner and still want both people to leave feeling all right.',
      'Friends argue, and you usually share your view, then help them find a plan you can both accept.',
    ],
    why: 'Honesty plus a fix makes you useful in a fight, but sorting other people’s arguments can take a lot of your evening.',
    try: [
      'Next time you help settle something, take a short break after, so your own night still has some left.',
      'Let one small disagreement go today, so you save the sharp one for the fight that matters.',
    ],
    watch: [
      'Notice how tired you feel after helping two people settle a fight.',
      'Notice which arguments actually need you in them.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_01', ['conflict_assertiveness:low'], {
    focus: [
      'A roommate leaves dishes in the sink, and you usually wash them instead of saying anything.',
      'Small things that bother you can stay unsaid, and you keep the kitchen quiet.',
      'A friend keeps showing up late to the movie, and you usually don’t mention the start time.',
    ],
    why: 'Staying quiet avoids a small fight, but the dishes or the late arrival can keep happening because they don’t know it bothers you.',
    try: [
      'Tell one person about one small thing that bothers you, so they get a chance to change it.',
      'Say what bothers you in one sentence, out loud and alone, so it feels familiar when you need it.',
    ],
    watch: [
      'Notice when the same small thing, the sink or the late text, happens again.',
      'Notice how you feel after you don’t say the thing.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_02', ['conflict_assertiveness:low'], {
    focus: [
      'You disagree in a meeting, and you usually keep the point in your notes instead of the room.',
      'Your concern can wait until after the meeting, and sometimes it never makes it into a message.',
      'Your boss suggests something you doubt, and you usually go along with it in the thread.',
    ],
    why: 'Holding the point back avoids a clash in the room, but your view might be the one that saves the team an afternoon.',
    try: [
      'Send your boss a short note after the meeting with the concern, so it’s in writing.',
      'Ask one question about the plan in your next meeting, so the doubt gets said.',
    ],
    watch: [
      'Notice when a concern you kept in your notes turns out to be right.',
      'Notice how people react when you do say the point out loud.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_03', ['conflict_assertiveness:low'], {
    focus: [
      'You want something, and you usually hint at it instead of asking in a plain sentence.',
      'You can hope people notice what you need, a ride, a quieter night, without you saying it.',
      'A plan doesn’t suit you, and you usually go along and hope the evening works out.',
    ],
    why: 'A hint feels gentler to you, but people often miss it, and then they can’t give you what you wanted.',
    try: [
      'Ask for one thing you want this week in one plain sentence, so nobody has to guess it.',
      'Text your partner or a friend one clear request, so it’s easier than saying it in the room.',
    ],
    watch: [
      'Notice when you drop a hint and nobody in the chat picks it up.',
      'Notice how people respond once you ask in a plain sentence.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_04', ['conflict_assertiveness:low'], {
    focus: [
      'An argument starts, and you usually stay quiet and wait for the voices to come down.',
      'When people disagree, you can listen more than you talk and keep your view for later.',
      'Voices get raised in the kitchen, and you usually step back instead of joining in.',
    ],
    why: 'Staying quiet can settle the room, but your view still matters, even if you share it after the voices drop.',
    try: [
      'When the room calms down, share one thought you held back, so your side gets heard.',
      'Write your view during a tense talk, so you can share it later when the room is calmer.',
    ],
    watch: [
      'Notice what you wanted to say and didn’t, once the room is quiet.',
      'Notice whether people ask for your view after things have calmed down.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_05', ['conflict_assertiveness:low'], {
    focus: [
      'After a disagreement, you usually apologize first, even when the mistake wasn’t yours.',
      'You can say sorry to end a tense moment, even if you weren’t the one who was wrong.',
      'Tension with a friend can have you apologizing just so the chat can go back to normal.',
    ],
    why: 'A quick sorry keeps the chat calm, but saying sorry for something you didn’t do can leave your own hurt unsaid.',
    try: [
      'Next time you start to apologize, name what you’re actually sorry for, so you only say it when you mean it.',
      'Change one “sorry” to “thanks for waiting” today, so you still sound kind.',
    ],
    watch: [
      'Notice when “sorry” comes out of habit, before you’ve checked if you mean it.',
      'Notice whether the other person apologizes too, or whether it’s only you.',
    ],
  }),
  idea('ftw_conflict_assertiveness_l_06', ['conflict_assertiveness:low', 'conflict_cooperativeness:high'], {
    focus: [
      'In a disagreement you usually give in, so the other person leaves happy with the plan.',
      'A friend wants something different, and you can go with their choice for the night.',
      'You both want different things, and you usually put their wish ahead of yours.',
    ],
    why: 'Giving in keeps the evening kind, but doing it often can leave your own wish out of the plan.',
    try: [
      'Next time you both want different plans, say yours first, so the other person hears it.',
      'Pick one plan this week yourself, so the choices get shared.',
    ],
    watch: [
      'Notice how often the night ends up as what the other person wanted.',
      'Notice when giving in leaves you annoyed on the way home.',
    ],
  }),
];
