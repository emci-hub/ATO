/** Playfulness (playfulness): Playful (high) and Serious (low). */
import { idea, type InsightIdea } from './define';

export const PLAYFULNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_playfulness_h_01', ['playfulness:high'], {
    focus: [
      'When things get tense, you tend to make a joke to lighten the mood.',
      'You usually use humor to ease awkward moments.',
      'When a meeting gets serious, you tend to look for something funny to say.',
    ],
    why: 'Humor helps people relax, but sometimes the people around you need the serious moment to stay serious.',
    try: [
      'Next time things get tense, wait a moment before joking, so people can say what they need.',
      'Ask a friend if they want to laugh or talk, so you match their mood.',
    ],
    watch: [
      'Notice when a joke changes the subject someone wanted to talk about.',
      'Notice when humor really helps.',
    ],
  }),
  idea('ftw_playfulness_h_02', ['playfulness:high'], {
    focus: [
      'When you have boring tasks, you tend to turn them into a game or add music.',
      'You usually find ways to make dull work more fun.',
      'When a task is boring, you tend to put it off until you find a way to make it fun.',
    ],
    why: 'Making things fun helps you get them done, but some tasks just need doing even when they’re dull.',
    try: [
      'Put on your favorite playlist and do one boring task now, so it gets done.',
      'Set a small reward for finishing a dull task, so you have something to look forward to.',
    ],
    watch: [
      'Notice which tasks you put off because they’re not fun.',
      'Notice how quickly boring tasks go once you start.',
    ],
  }),
  idea('ftw_playfulness_h_03', ['playfulness:high'], {
    focus: [
      'With your partner or close friends, you tend to tease and joke around a lot.',
      'You usually show affection through jokes and playful teasing.',
      'When you’re close to someone, you tend to keep things light and fun.',
    ],
    why: 'Playfulness keeps relationships fun, but your teasing can sting on a day when someone feels low.',
    try: [
      'Ask your partner or a friend how their day was before joking around, so you read their mood.',
      'Tell someone one sincere thing you like about them today, so it isn’t all jokes.',
    ],
    watch: [
      'Notice when someone doesn’t laugh at your teasing.',
      'Notice how people react to a sincere comment from you.',
    ],
  }),
  idea('ftw_playfulness_h_04', ['playfulness:high'], {
    focus: [
      'When you have free time, you tend to look for something fun to do.',
      'You usually suggest fun plans when friends are bored.',
      'When the weekend comes, you tend to want a fun plan more than rest.',
    ],
    why: 'Your sense of fun brings people together, but rest matters for you too.',
    try: [
      'Leave one evening this week for rest, so you have energy for the fun.',
      'Text a friend a fun idea for the weekend, so the plan has a start.',
    ],
    watch: [
      'Notice when you’re tired but still looking for fun.',
      'Notice which fun plans leave you happiest.',
    ],
  }),
  idea('ftw_playfulness_h_05', ['playfulness:high'], {
    focus: [
      'When you make a mistake, you tend to laugh at yourself and move on.',
      'You usually don’t take yourself too seriously.',
      'When something embarrassing happens, you tend to joke about it.',
    ],
    why: 'Laughing at yourself makes you easy to be around, but some mistakes might still need a closer look.',
    try: [
      'Laugh at your next mistake, then write down one thing to try next time, so you learn from it.',
      'Ask a friend if they ever wish you were more serious, so you know how your humor lands.',
    ],
    watch: [
      'Notice when a joke covers up something that bothered you.',
      'Notice how laughing helps you move on.',
    ],
  }),
  idea('ftw_playfulness_h_06', ['playfulness:high', 'steadiness:high'], {
    focus: [
      'When things go wrong, you tend to stay calm and find something to laugh about.',
      'You usually handle stress with humor and a steady attitude.',
      'When others panic, you tend to stay relaxed and lighten the mood.',
    ],
    why: 'Your calm and humor help people feel safe, but someone stressed might need you to take it seriously first.',
    try: [
      'Ask a stressed friend what they need before joking, so they feel heard.',
      'Share one thing that does worry you with someone close, so they know your serious side.',
    ],
    watch: [
      'Notice when your calm makes someone feel unheard.',
      'Notice when your humor helps someone relax.',
    ],
  }),
  idea('ftw_playfulness_l_01', ['playfulness:low'], {
    focus: [
      'When there’s work to do, you tend to want to get it done before having fun.',
      'You usually prefer to focus and finish rather than joke around.',
      'When a group gets silly during work, you tend to want to get back on track.',
    ],
    why: 'Your focus gets things done, but a little fun can help your team work better together.',
    try: [
      'Join in on one joke at work this week, so coworkers see your lighter side.',
      'Take a ten-minute fun break after a big task, so you recharge.',
    ],
    watch: [
      'Notice how a little fun affects your team.',
      'Notice when you feel left out of the jokes.',
    ],
  }),
  idea('ftw_playfulness_l_02', ['playfulness:low'], {
    focus: [
      'When friends joke around, you tend to prefer steering the talk to something real.',
      'You usually enjoy serious conversations more than banter.',
      'When you talk with someone, you tend to want to get to the point.',
    ],
    why: 'Real conversations matter to you, but light chat can help others feel at ease before they open up.',
    try: [
      'Ask a friend about something fun in their week, so the talk starts light.',
      'Laugh at one joke today even if it’s small, so people see you enjoy them.',
    ],
    watch: [
      'Notice when light chat helps someone open up.',
      'Notice how you feel after a silly moment.',
    ],
  }),
  idea('ftw_playfulness_l_03', ['playfulness:low'], {
    focus: [
      'When you have free time, you tend to spend it on something useful.',
      'You usually feel better doing something productive than playing.',
      'When others suggest something silly, you tend to say you have things to do.',
    ],
    why: 'Being productive feels good to you, but play is a kind of rest that can recharge you too.',
    try: [
      'Do one thing just for fun today, so you get a real break.',
      'Say yes to one silly plan this month, so you give play a chance.',
    ],
    watch: [
      'Notice how you feel after doing something just for fun.',
      'Notice when being useful turns into never resting.',
    ],
  }),
  idea('ftw_playfulness_l_04', ['playfulness:low'], {
    focus: [
      'When something goes wrong, you tend to take it seriously instead of joking about it.',
      'You usually deal with problems directly, without jokes.',
      'When a partner jokes about a problem, you tend to want to talk about it properly.',
    ],
    why: 'Taking things seriously shows you care, but sometimes a little humor helps you and others cope.',
    try: [
      'Look for one funny thing about a small problem today, so it feels lighter.',
      'Ask your partner why they joke about problems, so you understand their way of coping.',
    ],
    watch: [
      'Notice when humor helps someone else feel better.',
      'Notice how big small problems feel when you take every one seriously.',
    ],
  }),
  idea('ftw_playfulness_l_05', ['playfulness:low'], {
    focus: [
      'When you’re focused, people sometimes think you’re upset or unfriendly.',
      'You usually look serious when you’re concentrating, and others might misread it.',
      'When coworkers are joking, you tend to stay quiet, and some read it as disapproval.',
    ],
    why: 'Your serious side is just focus, but people who don’t know you might read it differently.',
    try: [
      'Smile or say hi to a coworker today, so they see your friendly side.',
      'Tell a teammate that quiet means you’re focused, so they don’t misread it.',
    ],
    watch: [
      'Notice when someone seems unsure how to approach you.',
      'Notice how people react when you show a lighter side.',
    ],
  }),
  idea('ftw_playfulness_l_06', ['playfulness:low', 'conscientiousness:high'], {
    focus: [
      'When you have a goal, you tend to stay focused and leave fun for later.',
      'You usually finish your work before you allow yourself to relax.',
      'You tend to treat fun as something you earn after the work is done.',
    ],
    why: 'Your focus makes you reliable, but waiting to earn fun can mean you rarely get any.',
    try: [
      'Put one fun thing on your calendar this week, so it happens no matter what.',
      'Take a short fun break in the middle of your work, so you don’t wait until the end.',
    ],
    watch: [
      'Notice how often you actually get to the fun part.',
      'Notice how you feel after a break you didn’t earn.',
    ],
  }),
];
