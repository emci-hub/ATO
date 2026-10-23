/** Confidence (competence): Assured (high) and Cautious (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const COMPETENCE_IDEAS: readonly InsightIdea[] = [
  idea('ftw_competence_h_01', ['competence:high'], {
    focus: [
      'A hard task shows up in the work chat, and you usually volunteer before the thread moves on.',
      'A tough item on the agenda can feel doable to you, even when others in the meeting would skip it.',
      'Something difficult needs an owner, and you usually say you’ve got it before anyone else does.',
    ],
    why: 'Taking the hard task builds your skill, but saying yes to every one can leave you with more than you can do well.',
    try: [
      'Before you volunteer next time, check the tasks already on your list, so you don’t add one too many.',
      'Give one task to a coworker who wants to learn it, so you both get something from it.',
    ],
    watch: [
      'Notice when you say yes in the chat before you know how long the task will take.',
      'Notice who else in the meeting might want a turn at the hard task.',
    ],
  }),
  idea('ftw_competence_h_02', ['competence:high'], {
    focus: [
      'Stuck on a problem, you usually keep going alone because you’re sure you’ll figure the file out.',
      'A stuck line in the doc can feel solvable to you, so you stay with it instead of asking for help.',
      'A task gets hard, and you usually push on alone rather than ask the coworker next to you.',
    ],
    why: 'Trusting your skills keeps you in the work, but a question can save the hour you’d spend stuck on the same line.',
    try: [
      'Set a twenty-minute limit on being stuck, then ask someone, so you don’t lose the afternoon.',
      'Ask a coworker how they’d approach the problem, so you get a fresh look at the file.',
    ],
    watch: [
      'Notice how long you stay stuck in the doc before you ask.',
      'Notice how much time one short question saves.',
    ],
  }),
  idea('ftw_competence_h_03', ['competence:high'], {
    focus: [
      'Someone slow on a task can have you wanting to take the keyboard and finish it yourself.',
      'You usually find it faster to do the thing than to explain the steps in the chat.',
      'A teammate struggles with the file, and you can step in and finish the last part for them.',
    ],
    why: 'Your speed gets the task done, but taking it back can keep them from learning it and leave you with the extra work.',
    try: [
      'Next time someone is slow, give them one tip instead of taking over, so they learn the step.',
      'Pick one task to teach someone this week, so you don’t have to do it the next time.',
    ],
    watch: [
      'Notice when you take a task back from someone who was mid-way through it.',
      'Notice how people improve when you let them finish the step.',
    ],
  }),
  idea('ftw_competence_h_04', ['competence:high'], {
    focus: [
      'You finish a piece of work and usually feel sure it’s good, so you send it the same hour.',
      'Showing your work to other people can feel comfortable, even before a second read.',
      'Your boss asks for an update, and you usually feel ready to share what’s on the page.',
    ],
    why: 'Feeling sure of the draft helps you send it, but reading it once more can catch a small mistake first.',
    try: [
      'Read the work once more before you send it, so a small mistake gets caught.',
      'Ask one person for a look at your next project, so you hear another view of the draft.',
    ],
    watch: [
      'Notice when a small mistake slips through in something you sent fast.',
      'Notice which feedback actually changes the next draft.',
    ],
  }),
  idea('ftw_competence_h_05', ['competence:high'], {
    focus: [
      'You try something new and usually expect to pick it up before the week is out.',
      'A new skill can feel learnable to you over a few evenings, and you start before you feel sure of it.',
      'A new hobby usually gets you started fast, without much worry about looking clumsy at first.',
    ],
    why: 'Expecting to learn fast gets you started, but it can feel frustrating when the skill takes longer than you pictured.',
    try: [
      'Give a new skill a full week before you judge your progress, so you see the real pace.',
      'Write down one thing you’ve improved at this month, so the progress is on the page.',
    ],
    watch: [
      'Notice how you feel when a new skill takes longer than the week you pictured.',
      'Notice which skills came quickly and which ones took the whole month.',
    ],
  }),
  idea('ftw_competence_h_06', ['competence:high', 'self_efficacy:high'], {
    focus: [
      'A big goal comes up, and you usually believe you can reach it, so you start the same day.',
      'A hard goal can feel possible to you, so you write a high one on the list.',
      'Someone doubts the plan in the chat, and you can feel even more sure you’ll do it anyway.',
    ],
    why: 'Believing you can do it gets you started on the big goal, but the small steps are what get it finished.',
    try: [
      'Write the first three steps toward your next goal, so the path is on the page.',
      'Ask a friend what could go wrong with the plan, so you’re ready for that part.',
    ],
    watch: [
      'Notice when the plan skips the boring steps in the middle.',
      'Notice which goals you finished and which step actually got you there.',
    ],
  }),
  idea('ftw_competence_l_01', ['competence:low'], {
    focus: [
      'A new task at work can have you wondering, before you open the file, if you can do it well.',
      'You usually doubt yourself in the minutes before you start something you haven’t done.',
      'Your boss gives you something important, and you can worry you’re not ready for that meeting.',
    ],
    why: 'The doubt can make you careful and prepared, but it can also stop you from starting a task you’d be good at.',
    try: [
      'Write down one similar task you’ve done well, so you have proof on the page.',
      'Start the task with the easiest part, so the first ten minutes are already done.',
    ],
    watch: [
      'Notice when the worry is bigger than the task in front of you.',
      'Notice how the task goes once you’ve actually started it.',
    ],
  }),
  idea('ftw_competence_l_02', ['competence:low'], {
    focus: [
      'Before a presentation, you usually prepare more slides and more notes than the meeting needs.',
      'You can practice a lot in an empty room before you do the same thing in front of people.',
      'Something important on the calendar can have you preparing past the point where you already know it.',
    ],
    why: 'Being prepared helps you walk in calmer, but past a point the extra practice only adds to the stress.',
    try: [
      'Set a stopping time for the prep, so you have an hour to rest before the meeting.',
      'Say the talk once out loud, then stop, so you trust what you already know.',
    ],
    watch: [
      'Notice when another practice run stops making you feel better.',
      'Notice how the meeting goes compared with what you feared the night before.',
    ],
  }),
  idea('ftw_competence_l_03', ['competence:low'], {
    focus: [
      'Someone asks for volunteers, and you usually wait for a more experienced person to take it.',
      'You can let others take the new project because you’re unsure you’d do the first version well.',
      'An opening at work can have you thinking someone else on the team is the better fit.',
    ],
    why: 'Being careful about what you take on can protect your week, but you might skip a task you were already ready to do.',
    try: [
      'Offer to take one small task this week, so you get a chance to show the work.',
      'Ask your boss what you’d need to learn for the next opening, so you know the actual gap.',
    ],
    watch: [
      'Notice when you talk yourself out of raising your hand.',
      'Notice how often the person who volunteers is learning the task as they go.',
    ],
  }),
  idea('ftw_competence_l_04', ['competence:low'], {
    focus: [
      'Someone praises your work, and you usually point at the part that went wrong instead.',
      'A compliment about your skills can be hard to take, and you change the subject in the chat.',
      'Your boss says you did well, and you can decide they’re just being nice in the meeting.',
    ],
    why: 'A quick “it was nothing” keeps the moment light, but it can hide from you how good the work was.',
    try: [
      'Next time someone praises you, say “thank you” and stop there, so the compliment lands.',
      'Write down one compliment you got this week, so you can look back at the actual words.',
    ],
    watch: [
      'Notice when you answer a compliment with a criticism of your own work.',
      'Notice what people actually praise when they mention your work.',
    ],
  }),
  idea('ftw_competence_l_05', ['competence:low'], {
    focus: [
      'A coworker does well in the meeting, and you usually compare notes with yourself and feel behind.',
      'You can notice what other people do better than you, faster than you notice your own file.',
      'Friends’ updates can have you forgetting how far your own year has actually moved.',
    ],
    why: 'Seeing someone else’s skill can push you to try, but the comparison can hide the progress in your own work.',
    try: [
      'Write one thing you can do now that you couldn’t do a year ago, so your progress is on the page.',
      'Ask a coworker how they learned a skill you admire, so the comparison turns into a how.',
    ],
    watch: [
      'Notice when comparing your work to theirs leaves you feeling worse.',
      'Notice how much you’ve learned since this time last year.',
    ],
  }),
  idea('ftw_competence_l_06', ['competence:low', 'growth_mindset:high'], {
    focus: [
      'Unsure of a skill, you usually keep practicing the same move until it feels ready.',
      'You can doubt yourself at the start and still stay with the work until it gets better.',
      'Something hard usually becomes a thing for you to learn, not a reason to close the laptop.',
    ],
    why: 'The extra practice is doing real work for you, and the doubt usually gets quieter once you’ve done it a few more times.',
    try: [
      'Write down one skill you’ve already improved, so you can see the practice working.',
      'Ask someone for one tip on what you’re learning, so the next session goes faster.',
    ],
    watch: [
      'Notice whether you feel steadier after a few practice sessions.',
      'Notice when you’re better at the thing than you were last month.',
    ],
  }),
];
