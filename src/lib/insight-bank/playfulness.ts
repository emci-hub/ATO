/** Playfulness (playfulness): Playful (high) and Serious (low). */
import { idea, type InsightIdea } from './define';

export const PLAYFULNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_playfulness_h_01', ['playfulness:high'], {
    focus: [
      'When a meeting gets tense, you usually reach for a joke before the silence has settled.',
      'An awkward pause at dinner can get a light line from you before anyone names the tension.',
      'You sometimes look for something funny to say once the work chat turns sharp.',
    ],
    why: 'A joke can help people relax, but sometimes the people around you need the serious moment to stay serious.',
    try: [
      'Next time things get tense, wait a moment before the joke, so people can say what they need.',
      'Ask a friend if they want to laugh or talk, so you know which one they want.',
    ],
    watch: [
      'Notice when a joke changes the subject someone wanted to keep.',
      'Notice when the humor actually helps the room.',
    ],
  }),
  idea('ftw_playfulness_h_02', ['playfulness:high'], {
    focus: [
      'A boring task can sit until you turn it into a game or put music on.',
      'You usually put on a playlist or make a tiny game so the dull work is easier to start.',
      'When the spreadsheet is dull, you sometimes wait until you have a fun way in.',
    ],
    why: 'Making a task fun can help you finish it, but some chores just need doing even when they stay dull.',
    try: [
      'Put on a favorite playlist and do one boring task now, so it gets done.',
      'Set a small reward for finishing a dull task, so you have something after it.',
    ],
    watch: [
      'Notice which tasks you put off because they are not fun.',
      'Notice how fast a boring task goes once you actually start it.',
    ],
  }),
  idea('ftw_playfulness_h_03', ['playfulness:high'], {
    focus: [
      'With your partner or a close friend, you usually tease and joke more than you say the plain thing.',
      'Affection from you can show up as a joke in the chat before it shows up as a straight compliment.',
      'Once you are close to someone, you sometimes keep the tone light even on a heavy day.',
    ],
    why: 'Your teasing keeps the relationship fun, but it can sting on a day when that person already feels low.',
    try: [
      'Ask your partner or a friend how their day was before the jokes, so you read the mood.',
      'Tell someone one sincere thing you like about them today, so it is not all jokes.',
    ],
    watch: [
      'Notice when someone does not laugh at the tease.',
      'Notice how people react when you say something sincere.',
    ],
  }),
  idea('ftw_playfulness_h_04', ['playfulness:high'], {
    focus: [
      'Free time on your calendar usually turns into a search for something fun to do.',
      'When friends say they are bored, you can be the one who puts a plan in the chat.',
      'A weekend sometimes looks better to you as a fun plan than as a night on the couch.',
    ],
    why: 'Your sense of fun brings people together, but rest matters for you too, or the fun night costs the next day.',
    try: [
      'Leave one evening this week for rest, so the fun plan still has you.',
      'Text a friend one fun idea for the weekend, so the plan has a start.',
    ],
    watch: [
      'Notice when you are tired and still hunting for a fun plan.',
      'Notice which fun plans leave you happiest the next morning.',
    ],
  }),
  idea('ftw_playfulness_h_05', ['playfulness:high'], {
    focus: [
      'When you make a mistake, you usually laugh at yourself and move on to the next thing.',
      'An embarrassing moment in the group chat can become a joke from you before it becomes a worry.',
      'You sometimes do not sit with a typo you sent; the joke arrives and you move on.',
    ],
    why: 'Laughing at yourself makes you easy to be around, but some of your mistakes might still need a closer look.',
    try: [
      'Laugh at your next small mistake, then write one thing to try next time, so you still learn from it.',
      'Ask a friend if they ever wish you were more serious about a miss, so you know how the humor lands.',
    ],
    watch: [
      'Notice when a joke covers a mistake that actually bothered you.',
      'Notice how the laugh helps you move on, and when it skips the fix.',
    ],
  }),
  idea('ftw_playfulness_h_06', ['playfulness:high', 'steadiness:high'], {
    focus: [
      'When things go wrong, you usually stay calm and find something in it to laugh about.',
      'A stressful thread in the work chat can get a steady joke from you while other people panic.',
      'You sometimes stay relaxed and lighten the mood once the people around you speed up.',
    ],
    why: 'Your calm and your humor can help people feel safer, but someone stressed might need you to take it seriously first.',
    try: [
      'Ask a stressed friend what they need before the joke, so they feel heard.',
      'Share one thing that does worry you with someone close, so they see your serious side.',
    ],
    watch: [
      'Notice when your calm in a tense chat makes someone feel unheard.',
      'Notice when your humor helps someone in the room relax.',
    ],
  }),
  idea('ftw_playfulness_l_01', ['playfulness:low'], {
    focus: [
      'When there is work on the list, you usually want it done before anyone starts the fun.',
      'A silly stretch in a meeting can have you wanting the group back on the agenda.',
      'You sometimes prefer to finish the task in front of you rather than join the joke in the chat.',
    ],
    why: 'Your focus gets the work done, but a little fun can help the team work better together.',
    try: [
      'Join in on one joke at work this week, so coworkers see a lighter side.',
      'Take a ten-minute fun break after a big task, so you get a real pause.',
    ],
    watch: [
      'Notice how a little fun changes the feel of the team.',
      'Notice when you feel left out of the jokes in the chat.',
    ],
  }),
  idea('ftw_playfulness_l_02', ['playfulness:low'], {
    focus: [
      'When friends are joking, you usually steer the talk toward something real.',
      'A long banter thread can interest you less than one serious conversation.',
      'In a chat, you sometimes want to get to the point before the jokes have finished.',
    ],
    why: 'A real conversation matters to you, but a little light chat can help someone feel at ease before they open up.',
    try: [
      'Ask a friend about one fun thing in their week, so the talk starts lighter than usual.',
      'Laugh at one small joke today, so people see you can enjoy it.',
    ],
    watch: [
      'Notice when a little joking helps a friend open up.',
      'Notice how you feel after a silly moment you joined.',
    ],
  }),
  idea('ftw_playfulness_l_03', ['playfulness:low'], {
    focus: [
      'Free time on your calendar usually goes to something useful, not to play.',
      'You can feel better crossing a task off than spending the hour on something silly.',
      'When someone suggests a silly plan, you sometimes say you have things to do.',
    ],
    why: 'Being useful feels good to you, but play is a kind of rest, and skipping it can leave you flat.',
    try: [
      'Do one thing just for fun today, a game or a show, so you get a real break.',
      'Say yes to one silly plan this month, so play gets a turn.',
    ],
    watch: [
      'Notice how you feel after an hour you spent on fun and not on the list.',
      'Notice when being useful turns into skipping a rest.',
    ],
  }),
  idea('ftw_playfulness_l_04', ['playfulness:low'], {
    focus: [
      'When something goes wrong, you usually take it seriously instead of joking about it.',
      'A problem in the chat can get a direct reply from you, with the jokes left out.',
      'If your partner jokes about a problem, you sometimes want to talk about it properly first.',
    ],
    why: 'Taking the problem seriously shows you care, but a little humor can help you and other people cope.',
    try: [
      'Look for one funny detail in a small problem today, so it feels a bit lighter.',
      'Ask your partner why a joke shows up when a problem does, so you understand what the joke is doing.',
    ],
    watch: [
      'Notice when a joke helps someone else feel better about a small problem.',
      'Notice how heavy a small problem feels when you treat each one as serious.',
    ],
  }),
  idea('ftw_playfulness_l_05', ['playfulness:low'], {
    focus: [
      'When you are focused, people can think you are upset or unfriendly.',
      'Your face usually looks serious while you concentrate, and others might misread it.',
      'When coworkers are joking, you sometimes stay quiet, and some of them read that as disapproval.',
    ],
    why: 'The serious look can just be focus, but people who do not know you yet might read it as something else.',
    try: [
      'Smile or say hi to a coworker today, so they see a friendly side.',
      'Tell a teammate that quiet means you are focused, so they do not misread it.',
    ],
    watch: [
      'Notice when a coworker seems unsure how to start a chat with you.',
      'Notice how coworkers react when you show a lighter side in the chat.',
    ],
  }),
  idea('ftw_playfulness_l_06', ['playfulness:low', 'conscientiousness:high'], {
    focus: [
      'With a goal in front of you, you usually stay on it and leave the fun for later.',
      'You can finish the work on the list before you let yourself relax on the couch.',
      'Fun sometimes waits, in your week, until the work is done and the list is clear.',
    ],
    why: 'Your focus makes you reliable, but waiting until you have earned the fun can mean you rarely get any.',
    try: [
      'Put one fun thing on your calendar this week, so it happens no matter what else is on the list.',
      'Take a short fun break in the middle of the work, so you do not wait until the end.',
    ],
    watch: [
      'Notice how often you actually get to the fun part of the day.',
      'Notice how you feel after a break you did not earn first.',
    ],
  }),
];
