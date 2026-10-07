/** Growth (growth_mindset): Learning (high) and Settled (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const GROWTH_MINDSET_IDEAS: readonly InsightIdea[] = [
  idea('ftw_growth_mindset_h_01', ['growth_mindset:high'], {
    focus: [
      'When you make a mistake, you tend to think about what you’d do differently next time.',
      'You usually see a failure as a chance to learn something.',
      'When something goes wrong, you tend to look for the lesson in it.',
    ],
    why: 'Learning from mistakes helps you improve, but sometimes a mistake of yours just needs to be let go.',
    try: [
      'Write down one lesson from a recent mistake, then close the note, so you move on.',
      'Let one small mistake go today without picking it apart, so you get a break.',
    ],
    watch: [
      'Notice when learning from a mistake turns into dwelling on it.',
      'Notice which lessons you actually use.',
    ],
  }),
  idea('ftw_growth_mindset_h_02', ['growth_mindset:high'], {
    focus: [
      'When you finish a project, you tend to ask how you could have done better.',
      'You usually want feedback, even when it’s hard to hear.',
      'When your boss gives notes, you tend to see them as useful rather than personal.',
    ],
    why: 'Seeking feedback helps you grow fast, but asking too often can make others feel they have to critique you.',
    try: [
      'Ask for feedback on one specific thing, so the answer is easy to give.',
      'Celebrate one thing that went well before asking what to improve, so you see the good too.',
    ],
    watch: [
      'Notice when you focus on the feedback and skip the praise.',
      'Notice which feedback actually helped you.',
    ],
  }),
  idea('ftw_growth_mindset_h_03', ['growth_mindset:high'], {
    focus: [
      'When something is hard, you tend to see it as a chance to get better.',
      'You usually enjoy a challenge more than an easy task.',
      'When you’re learning something new, you tend to keep going even when it’s frustrating.',
    ],
    why: 'Your love of challenge helps you grow, but rest and easy wins matter for you too.',
    try: [
      'Do one easy thing you enjoy today, so you get a break from pushing.',
      'Pick one goal to focus on this month, so your energy doesn’t spread too thin.',
    ],
    watch: [
      'Notice when you pick the hard option just because it’s hard.',
      'Notice how you feel after an easy, fun day.',
    ],
  }),
  idea('ftw_growth_mindset_h_04', ['growth_mindset:high'], {
    focus: [
      'When a friend says they’re bad at something, you tend to tell them they can learn it.',
      'You usually believe people can improve with practice.',
      'When someone gives up, you tend to encourage them to try again.',
    ],
    why: 'Your belief in growth can lift people up, but sometimes a friend just needs you to listen.',
    try: [
      'Ask a friend if they want encouragement or just to vent, so you give them what they need.',
      'Share a time you struggled and improved, so your encouragement feels real.',
    ],
    watch: [
      'Notice when a friend wants to be heard, not coached.',
      'Notice how people respond to your encouragement.',
    ],
  }),
  idea('ftw_growth_mindset_h_05', ['growth_mindset:high'], {
    focus: [
      'When you look at your life, you tend to see things you want to improve.',
      'You usually have a few self-improvement goals going at once.',
      'When you have free time, you tend to spend it learning something.',
    ],
    why: 'Wanting to grow keeps your life interesting, but it can make you forget to enjoy your life as it is now.',
    try: [
      'Write down three things you like about your life right now, so you see what’s already good.',
      'Take one evening off from self-improvement, so you get time to just enjoy.',
    ],
    watch: [
      'Notice when improving feels like pressure instead of fun.',
      'Notice what you already do well.',
    ],
  }),
  idea('ftw_growth_mindset_h_06', ['growth_mindset:high', 'locus_of_control:high'], {
    focus: [
      'When something goes wrong, you tend to look at what you could do better and make a plan.',
      'You usually take responsibility for setbacks and work out how to improve.',
      'When a plan fails, you tend to ask what you can change next time.',
    ],
    why: 'Owning your part helps you improve, but not every setback is something you could have changed.',
    try: [
      'Write down one part of a recent setback that wasn’t up to you, so you don’t carry all of it.',
      'Pick one change to make next time and let the rest go, so you can move forward.',
    ],
    watch: [
      'Notice when you take blame for something outside your control.',
      'Notice how often your plans actually work.',
    ],
  }),
  idea('ftw_growth_mindset_l_01', ['growth_mindset:low'], {
    focus: [
      'When choosing what to do, you tend to stick with things you’re already good at.',
      'You usually prefer doing what you know you can do well.',
      'When a new skill feels hard, you tend to decide it’s just not for you.',
    ],
    why: 'Sticking to your strengths makes sense, but some skills only feel hard to you at the start.',
    try: [
      'Try one new skill for ten minutes today, so you see how it feels after the start.',
      'Ask a friend how long it took them to learn something, so you know the slow start is normal.',
    ],
    watch: [
      'Notice when you decide you’re bad at something after one try.',
      'Notice how much easier things get with practice.',
    ],
  }),
  idea('ftw_growth_mindset_l_02', ['growth_mindset:low'], {
    focus: [
      'When something isn’t working, you tend to accept it rather than try to change it.',
      'You usually feel at peace with how things are.',
      'When a friend pushes you to change something, you tend to feel it’s fine as it is.',
    ],
    why: 'Being content saves you stress, but small changes might make some things easier for you.',
    try: [
      'Pick one small thing that bugs you and change it this week, so you see if it helps.',
      'Ask a friend what they’ve changed recently, so you get one new idea.',
    ],
    watch: [
      'Notice when something bothers you more than you let on.',
      'Notice whether a small change would be worth it.',
    ],
  }),
  idea('ftw_growth_mindset_l_03', ['growth_mindset:low'], {
    focus: [
      'When you get critical feedback, you tend to take it as a judgment of you as a person.',
      'You usually take criticism as a sign you’re not good at something.',
      'When your work is critiqued, you tend to feel discouraged for a while.',
    ],
    why: 'Feedback can sting, but it’s usually about one piece of your work, not about you as a person.',
    try: [
      'Write down one specific thing to try from the feedback, so it becomes a step, not a judgment.',
      'Ask the person what they think went well, so you get the full picture.',
    ],
    watch: [
      'Notice when feedback makes you want to quit.',
      'Notice how often feedback helped you later.',
    ],
  }),
  idea('ftw_growth_mindset_l_04', ['growth_mindset:low'], {
    focus: [
      'When things are going fine, you tend to see no reason to change them.',
      'You usually feel happy with the skills and routines you already have.',
      'When others talk about self-improvement, you tend to feel it’s not for you.',
    ],
    why: 'Being happy with what you have is a strength, and growth can be small and easy when you want it.',
    try: [
      'Pick one thing you enjoy and learn one new fact about it, so growth feels fun.',
      'Watch one short video about a hobby you like, so you learn without pressure.',
    ],
    watch: [
      'Notice what you’re curious about.',
      'Notice when you feel like trying something new.',
    ],
  }),
  idea('ftw_growth_mindset_l_05', ['growth_mindset:low'], {
    focus: [
      'When something new doesn’t work out at first, you tend to stop trying.',
      'You usually move on quickly when a new hobby feels hard.',
      'When you struggle at the start, you tend to think you’re not made for it.',
    ],
    why: 'Moving on saves you frustration, but many skills feel awkward for everyone at the start.',
    try: [
      'Give a new skill three tries before deciding, so you see past the awkward start.',
      'Write down one thing you got better at over time, so you remember it’s possible.',
    ],
    watch: [
      'Notice when you quit right after the first hard moment.',
      'Notice how others struggle at the start too.',
    ],
  }),
  idea('ftw_growth_mindset_l_06', ['growth_mindset:low', 'openness:low'], {
    focus: [
      'You tend to stick with the activities and skills you already know and enjoy.',
      'When friends try new hobbies, you usually prefer to stay with what you like.',
      'You tend to feel happiest doing the things you’ve done for years.',
    ],
    why: 'Knowing what you enjoy is a strength, but a small new thing can add some fun to your week.',
    try: [
      'Join a friend for one new activity this month, so you try it with someone you trust.',
      'Pick one familiar hobby and try a new version of it, so it feels new but safe.',
    ],
    watch: [
      'Notice when you say no to something new out of habit.',
      'Notice which old favorites still make you happy.',
    ],
  }),
];
