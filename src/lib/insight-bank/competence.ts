/** Confidence (competence): Assured (high) and Cautious (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const COMPETENCE_IDEAS: readonly InsightIdea[] = [
  idea('ftw_competence_h_01', ['competence:high'], {
    focus: [
      'When a hard task comes up at work, you tend to volunteer for it.',
      'You usually feel ready to take on challenges others might avoid.',
      'When something difficult needs doing, you tend to say “I’ve got it.”',
    ],
    why: 'Your confidence helps you grow, but taking on every hard task can leave you with more work than you can do well.',
    try: [
      'Before you volunteer next time, check what’s already on your list, so you don’t take on too much.',
      'Hand one task to a coworker who wants to learn it, so you both benefit.',
    ],
    watch: [
      'Notice when you say yes before you know how long something will take.',
      'Notice who else might want a chance at the hard task.',
    ],
  }),
  idea('ftw_competence_h_02', ['competence:high'], {
    focus: [
      'When you get stuck, you tend to keep trying on your own because you’re sure you’ll figure it out.',
      'You usually believe you can solve a problem without help.',
      'When a task gets hard, you tend to push on alone rather than ask a coworker.',
    ],
    why: 'Trusting your skills is great, but asking for help can save you time you’d spend stuck.',
    try: [
      'Set a twenty-minute limit on being stuck, then ask someone, so you don’t lose an afternoon.',
      'Ask a coworker how they’d approach your problem, so you get a fresh idea.',
    ],
    watch: [
      'Notice how long you stay stuck before asking.',
      'Notice how much time a quick question saves.',
    ],
  }),
  idea('ftw_competence_h_03', ['competence:high'], {
    focus: [
      'When someone else is slow at a task, you tend to want to take over and do it yourself.',
      'You usually find it faster to do things yourself than to explain them.',
      'When a teammate struggles, you tend to step in and finish it for them.',
    ],
    why: 'Your skill makes you fast, but taking over can keep others from learning and leave you with extra work.',
    try: [
      'Next time someone’s slow, give them a tip instead of taking over, so they learn it.',
      'Pick one task to teach someone this week, so you don’t have to do it next time.',
    ],
    watch: [
      'Notice when you take a task back from someone.',
      'Notice how people improve when you let them try.',
    ],
  }),
  idea('ftw_competence_h_04', ['competence:high'], {
    focus: [
      'When you finish something, you tend to feel sure it’s good and share it right away.',
      'You usually feel comfortable showing your work to others.',
      'When your boss asks for an update, you tend to feel ready to show what you have.',
    ],
    why: 'Feeling sure of your work helps you move fast, but a quick second look can catch small mistakes.',
    try: [
      'Read your work once more before you send it, so small mistakes get caught.',
      'Ask one person for feedback on your next project, so you hear another view.',
    ],
    watch: [
      'Notice when a small mistake slips through.',
      'Notice which feedback actually improves your work.',
    ],
  }),
  idea('ftw_competence_h_05', ['competence:high'], {
    focus: [
      'When you try something new, you tend to expect to pick it up quickly.',
      'You usually feel sure you can learn a new skill if you put in the time.',
      'When starting a new hobby, you tend to jump in without much worry.',
    ],
    why: 'Expecting to learn fast gets you started, but it can feel frustrating when something takes longer than you thought.',
    try: [
      'Give a new skill a full week before judging your progress, so you see the real pace.',
      'Write down one thing you’ve improved at this month, so you can see progress.',
    ],
    watch: [
      'Notice how you feel when something new takes longer than you expected.',
      'Notice which skills came quickly and which took time.',
    ],
  }),
  idea('ftw_competence_h_06', ['competence:high', 'self_efficacy:high'], {
    focus: [
      'When a big goal comes up, you tend to believe you can reach it and start right away.',
      'You usually feel sure you can handle hard things, so you aim high.',
      'When someone doubts a plan, you tend to feel even more sure you can do it.',
    ],
    why: 'Your belief in yourself helps you go after big goals, but planning the small steps helps you finish them.',
    try: [
      'Write down the first three steps toward your next goal, so you have a clear path.',
      'Ask a friend what could go wrong with your plan, so you’re ready for it.',
    ],
    watch: [
      'Notice when your plan skips the boring steps.',
      'Notice which goals you finished and how you got there.',
    ],
  }),
  idea('ftw_competence_l_01', ['competence:low'], {
    focus: [
      'When you get a new task at work, you tend to wonder if you can do it well.',
      'You usually doubt yourself before you start something new.',
      'When your boss gives you something important, you tend to worry you’re not ready.',
    ],
    why: 'Doubting yourself can make you careful and prepared, but it can also stop you from trying things you’d be good at.',
    try: [
      'Write down one similar task you’ve done well before, so you have proof you can do it.',
      'Start the task with the easiest part, so you build momentum.',
    ],
    watch: [
      'Notice when your worry is bigger than the task.',
      'Notice how the task goes once you start.',
    ],
  }),
  idea('ftw_competence_l_02', ['competence:low'], {
    focus: [
      'Before a presentation or meeting, you tend to prepare more than you probably need to.',
      'You usually practice a lot before doing something in front of others.',
      'When you have something important coming up, you tend to over-prepare to feel ready.',
    ],
    why: 'Being prepared helps you feel calm, but at some point extra practice just adds to your stress.',
    try: [
      'Set a stopping time for your prep, so you have time to rest before the big day.',
      'Practice once out loud, then stop, so you trust what you know.',
    ],
    watch: [
      'Notice when more practice stops making you feel better.',
      'Notice how the event goes compared to how you feared.',
    ],
  }),
  idea('ftw_competence_l_03', ['competence:low'], {
    focus: [
      'When someone asks for volunteers, you tend to wait for someone more experienced to step up.',
      'You usually let others take on new projects because you’re unsure you’d do them well.',
      'When an opportunity comes up at work, you tend to think someone else is better for it.',
    ],
    why: 'Being careful about what you take on is smart, but you might be more ready than you think.',
    try: [
      'Volunteer for one small task this week, so you get a chance to show what you can do.',
      'Ask your boss what you’d need to learn for the next opportunity, so you know the gap.',
    ],
    watch: [
      'Notice when you talk yourself out of trying.',
      'Notice how often people who volunteer know less than you.',
    ],
  }),
  idea('ftw_competence_l_04', ['competence:low'], {
    focus: [
      'When someone praises your work, you tend to point out what went wrong instead.',
      'You usually find it hard to accept a compliment about your skills.',
      'When your boss says you did well, you tend to think they’re just being nice.',
    ],
    why: 'Being modest is kind, but it can keep you from seeing how good your work actually is.',
    try: [
      'Next time someone praises you, just say “thank you,” so the compliment lands.',
      'Write down one compliment you got this week, so you can look back on it.',
    ],
    watch: [
      'Notice when you answer a compliment with a criticism of yourself.',
      'Notice what people actually praise you for.',
    ],
  }),
  idea('ftw_competence_l_05', ['competence:low'], {
    focus: [
      'When you see a coworker do well, you tend to compare yourself and feel behind.',
      'You usually notice what others do better than you.',
      'When you look at friends’ progress, you tend to forget how far you’ve come.',
    ],
    why: 'Noticing others’ skills can inspire you, but comparing yourself can hide your own progress.',
    try: [
      'Write down one thing you can do now that you couldn’t do a year ago, so you see your progress.',
      'Ask a coworker how they learned a skill you admire, so comparing turns into learning.',
    ],
    watch: [
      'Notice when comparing yourself makes you feel worse.',
      'Notice how much you’ve learned this year.',
    ],
  }),
  idea('ftw_competence_l_06', ['competence:low', 'growth_mindset:high'], {
    focus: [
      'When you’re unsure of your skills, you tend to keep practicing until you feel ready.',
      'You usually doubt yourself at first, but you keep working to get better.',
      'When something is hard for you, you tend to treat it as something to learn rather than a reason to quit.',
    ],
    why: 'Your effort to improve is a real strength, and it means your doubts usually shrink with time.',
    try: [
      'Write down one skill you’ve already improved, so you see your effort working.',
      'Ask someone for one tip on what you’re learning, so you improve faster.',
    ],
    watch: [
      'Notice how your confidence grows as you practice.',
      'Notice when you’re better at something than you were last month.',
    ],
  }),
];
