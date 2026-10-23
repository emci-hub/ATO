/** Growth (growth_mindset): Learning (high) and Settled (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const GROWTH_MINDSET_IDEAS: readonly InsightIdea[] = [
  idea('ftw_growth_mindset_h_01', ['growth_mindset:high'], {
    focus: [
      'After you send the wrong file, you usually open a note and write what you would do on the next one.',
      'A burned pan can have you reading the recipe again before it is even in the sink.',
      'The missed bus sometimes has you checking a better route before the annoyance fades.',
    ],
    why: 'Pulling a lesson from a miss can help your next try, but not every mistake of yours needs a note; some can just be let go.',
    try: [
      'Write one lesson from a recent miss, then close the note, so you can move on.',
      'Let one small mistake go today without picking it apart, so you get a break from the review.',
    ],
    watch: [
      'Notice when the lesson from a mistake turns into replaying it on the couch.',
      'Notice which lessons you actually use the next time.',
    ],
  }),
  idea('ftw_growth_mindset_h_02', ['growth_mindset:high'], {
    focus: [
      'When a project is done, you usually ask what you could have done better before you enjoy it.',
      'Notes from your boss can be welcome to you, even when they are hard to read.',
      'A comment on your doc sometimes reads to you as useful, not as a hit on you.',
    ],
    why: 'Asking for notes can help you improve fast, but asking too often can make people feel they have to critique you.',
    try: [
      'Ask for a note on one specific part, so the answer is easy to give.',
      'Name one thing that went well before you ask what to change, so you see the good too.',
    ],
    watch: [
      'Notice when you go straight to the critique and skip the praise in the same message.',
      'Notice which notes actually changed the next version.',
    ],
  }),
  idea('ftw_growth_mindset_h_03', ['growth_mindset:high'], {
    focus: [
      'A hard task can look more appealing to you than the easy one sitting next to it.',
      'You usually keep going on something new even when the steps have you frustrated.',
      'When the choice is easy or hard, you sometimes pick the hard one because it stretches you.',
    ],
    why: 'A hard problem can pull you in, but an easy win and a real rest matter for you too.',
    try: [
      'Do one easy thing you enjoy today, like the show you keep skipping, so you get a break from pushing.',
      'Pick one goal for this month, so you are not split across five of them.',
    ],
    watch: [
      'Notice when you pick the hard option just because it is hard.',
      'Notice how you feel after an easy, fun day with nothing to improve.',
    ],
  }),
  idea('ftw_growth_mindset_h_04', ['growth_mindset:high'], {
    focus: [
      'When a friend says they are bad at cooking, you usually tell them they can learn the dish.',
      'You can be the person in the chat who tells someone to try the thing one more time.',
      'If a friend is ready to drop a class, you sometimes nudge them toward one more week.',
    ],
    why: 'Believing a friend can get better can lift them, but sometimes they just need you to listen.',
    try: [
      'Ask a friend if they want encouragement or just to talk, so you give them what they asked for.',
      'Share a time you struggled and then got better, so the encouragement has a real story.',
    ],
    watch: [
      'Notice when a friend wants to be heard, not told what to try.',
      'Notice how people respond when you tell them to try again.',
    ],
  }),
  idea('ftw_growth_mindset_h_05', ['growth_mindset:high'], {
    focus: [
      'A look at your week can turn into a list of things you want to get better at.',
      'You usually have a course tab and a skill video open beside the work you already do.',
      'Free time on the couch sometimes goes to learning something instead of the show you meant to watch.',
    ],
    why: 'Wanting to get better keeps the week interesting, but it can make you forget to enjoy the life you already have.',
    try: [
      'Write down three things you like about your life right now, so you see what is already good.',
      'Take one evening off from lessons and videos, so you get time to just enjoy the night.',
    ],
    watch: [
      'Notice when getting better starts to feel like pressure instead of fun.',
      'Notice what you already do well and have stopped counting.',
    ],
  }),
  idea('ftw_growth_mindset_h_06', ['growth_mindset:high', 'locus_of_control:high'], {
    focus: [
      'When a plan fails, you usually look at your part and write what you would change next time.',
      'A setback can have you making a new plan before you have sat with the fact that it failed.',
      'You sometimes ask what you can change on the next try, and the question comes fast.',
    ],
    why: 'Owning your part can help the next plan, but not every setback was something you could have changed.',
    try: [
      'Write down one part of a recent setback that was not up to you, so you do not carry all of it.',
      'Pick one change for next time and let the other ones go, so you can move forward.',
    ],
    watch: [
      'Notice when you take the blame for something the calendar or another person decided.',
      'Notice how often the new plan actually works.',
    ],
  }),
  idea('ftw_growth_mindset_l_01', ['growth_mindset:low'], {
    focus: [
      'Choosing what to do, you usually pick the task you already know you can do well.',
      'A new skill that feels hard on the first try can get set aside by you as not for you.',
      'You sometimes stay with the job you already do well and leave the unfamiliar one on the list.',
    ],
    why: 'Staying with what you do well makes sense, but some skills only feel hard in the first sitting.',
    try: [
      'Try one new skill for ten minutes today, a recipe or a short lesson, so you see how it feels after the start.',
      'Ask a friend how long a skill took them, so the slow start has a real number on it.',
    ],
    watch: [
      'Notice when you decide you are bad at something after one try.',
      'Notice how much easier a task gets once you have practiced it.',
    ],
  }),
  idea('ftw_growth_mindset_l_02', ['growth_mindset:low'], {
    focus: [
      'When something is not working, you usually leave it and get on with the day.',
      'A push to change your morning routine can get an easy “it is fine” from you.',
      'You can feel at ease with how the week runs, even when someone else would tweak it.',
    ],
    why: 'Being content can save you a lot of stress, but a small change might make one annoying thing easier.',
    try: [
      'Pick one small thing that bugs you and change it this week, so you can see if it helps.',
      'Ask a friend what they changed recently, so you get one new idea.',
    ],
    watch: [
      'Notice when something bothers you more than you say out loud.',
      'Notice whether one small change would be worth the effort.',
    ],
  }),
  idea('ftw_growth_mindset_l_03', ['growth_mindset:low'], {
    focus: [
      'A critical note on your work can land as a judgment of you, not of the paragraph.',
      'You usually hear criticism as a sign you are not good at the thing itself.',
      'After your work is critiqued, you can feel discouraged for the rest of the afternoon.',
    ],
    why: 'A critique can sting for the rest of the day, but it is usually about one paragraph, not about you as a person.',
    try: [
      'Write down one specific thing to try from the note, so it becomes a step instead of a verdict.',
      'Ask the person what they think went well in the draft, so you hear more than the critique.',
    ],
    watch: [
      'Notice when a note makes you want to quit the task.',
      'Notice how often a critique helped you on a later draft.',
    ],
  }),
  idea('ftw_growth_mindset_l_04', ['growth_mindset:low'], {
    focus: [
      'When things are going fine, you usually see no reason to change the routine that works.',
      'You can feel happy with the skills you already have and the way your week already runs.',
      'Talk of a new course sometimes sounds to you like something for other people.',
    ],
    why: 'Being happy with what you have is a real strength, and a little learning can stay small and easy when you want it.',
    try: [
      'Pick one thing you enjoy and learn one new fact about it, so the learning feels like fun.',
      'Watch one short video about a hobby you like, so you learn without a whole course.',
    ],
    watch: [
      'Notice what you are curious about when nobody is pushing you.',
      'Notice when you feel like trying something new on a day nobody is pushing you.',
    ],
  }),
  idea('ftw_growth_mindset_l_05', ['growth_mindset:low'], {
    focus: [
      'When something new does not work the first time, you usually stop and move on.',
      'A new hobby that feels awkward can get dropped by you before the second try.',
      'You sometimes read a rough start as proof the thing is not for you.',
    ],
    why: 'Moving on can save you the frustration, but a lot of skills feel awkward for everyone at the start.',
    try: [
      'Give a new skill three tries before you decide, so you see past the awkward start.',
      'Write down one thing you got better at over time, so you remember a slow start can be normal.',
    ],
    watch: [
      'Notice when you quit a new thing right after the first hard moment.',
      'Notice how other people struggle at the start of the same thing.',
    ],
  }),
  idea('ftw_growth_mindset_l_06', ['growth_mindset:low', 'openness:low'], {
    focus: [
      'You usually stick with hobbies you already know: the same show, the same walk, the same kitchen.',
      'When friends try a new hobby, you can prefer to stay with the one you already like.',
      'Your happiest evenings sometimes look like the things you have done for years.',
    ],
    why: 'Knowing what you enjoy is a strength, but skipping every new idea can leave the week with nothing fresh in it.',
    try: [
      'Join a friend for one new activity this month, so the new thing has someone you trust in it.',
      'Pick one familiar hobby and try a new version of it, so it feels new and still safe.',
    ],
    watch: [
      'Notice when you say no to a new plan out of habit.',
      'Notice which old favorites, the show or the walk, still make you happy.',
    ],
  }),
];
