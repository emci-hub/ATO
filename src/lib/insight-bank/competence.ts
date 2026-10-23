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
      'Notice how often someone who volunteers is learning as they go.',
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
    why: 'Your effort to improve is a real strength, and doubts tend to shrink as you get more practice.',
    try: [
      'Write down one skill you’ve already improved, so you see your effort working.',
      'Ask someone for one tip on what you’re learning, so you improve faster.',
    ],
    watch: [
      'Notice whether your confidence shifts as you practice.',
      'Notice when you’re better at something than you were last month.',
    ],
  }),
  idea('ftw_competence_h_07', ['competence:high'], {
    focus: [
      'When someone asks how long a task will take, you tend to give a quick estimate and be confident in it.',
      'You usually think you can finish things faster than they end up taking.',
      'When you plan your day, you tend to fit in more than you can really do.',
    ],
    why: 'Believing you can get a lot done pushes you forward, but your plans may run out of time before they run out of tasks.',
    try: [
      'Add fifteen minutes to your next estimate, so you have room if something goes wrong.',
      'Write down how long three tasks actually took, so your next guesses are closer.',
    ],
    watch: [
      'Notice how often a task takes longer than you said.',
      'Notice what you leave out when you make an estimate.',
    ],
  }),
  idea('ftw_competence_h_08', ['competence:high'], {
    focus: [
      'When you don’t know something, you tend to find it hard to say so in front of others.',
      'You usually prefer to look it up quietly than ask in a meeting.',
      'When a topic is new to you, you tend to act as if you know it while you learn.',
    ],
    why: 'Staying confident helps you move, but saying “I don’t know” can build more trust than you expect.',
    try: [
      'Say “I’m not sure, let me find out” once this week, so you see how people react.',
      'Ask one question in a meeting where you don’t know the answer, so others feel free to ask too.',
    ],
    watch: [
      'Notice when you pretend to know and what you feel after.',
      'Notice how people respond when someone else admits they don’t know.',
    ],
  }),
  idea('ftw_competence_h_09', ['competence:high'], {
    focus: [
      'When a team asks who can handle a problem, you tend to be the first to say you can.',
      'You usually take on the hard problem because you trust yourself to solve it.',
      'When a project is at risk, you tend to step in and lead.',
    ],
    why: 'Stepping in helps teams that are stuck, but others may not get the chance to grow if you take the lead every time.',
    try: [
      'Ask a teammate to take the lead on one part, and offer to back them up, so they build their own skills.',
      'Wait ten seconds before you volunteer next time, so someone else can speak first.',
    ],
    watch: [
      'Notice who else could have taken the task.',
      'Notice how a teammate responds when you give them the lead.',
    ],
  }),
  idea('ftw_competence_h_10', ['competence:high'], {
    focus: [
      'When someone shows you a different way to do something, you tend to prefer your own method.',
      'You usually trust the way you already work, since it has served you well.',
      'When a coworker suggests a change to your process, you tend to explain why yours is better.',
    ],
    why: 'Trusting your methods keeps you quick, but another way can sometimes be faster or catch a problem you missed.',
    try: [
      'Try a coworker’s method once on a small task, so you can compare it with yours.',
      'Ask “what does your way do better?” the next time someone suggests a change, so you hear the reason.',
    ],
    watch: [
      'Notice how quickly you defend your method.',
      'Notice what you learn when you try another way.',
    ],
  }),
  idea('ftw_competence_h_11', ['competence:high'], {
    focus: [
      'When someone you know is learning, you tend to jump in with tips before they ask.',
      'You usually share what you know as soon as you see a friend struggle.',
      'When a friend is stuck on a task you know well, you tend to show them how.',
    ],
    why: 'Sharing what you know helps people, but a friend may want to work it out and not be told how.',
    try: [
      'Ask “do you want a tip or do you want to try first?” so the friend picks.',
      'Wait until you’re asked before you give a tip once this week, so you see what the friend does.',
    ],
    watch: [
      'Notice how a friend reacts to your help.',
      'Notice when you jump in because it’s hard to watch someone struggle.',
    ],
  }),
  idea('ftw_competence_h_12', ['competence:high'], {
    focus: [
      'When things go well, you tend to feel the result came from your skill.',
      'You usually give yourself credit for a win and move on to the next goal.',
      'When a project succeeds, you tend to feel you were the reason.',
    ],
    why: 'Believing in your skill keeps you motivated, but a team win often has other people’s work in it that deserves mention.',
    try: [
      'Name one person who helped with your last win and thank them, so they know it mattered.',
      'Write down what luck or help played a part in a recent success, so your view of it stays fair.',
    ],
    watch: [
      'Notice who helped with your last success.',
      'Notice how people react when you thank them in front of others.',
    ],
  }),
  idea('ftw_competence_l_07', ['competence:low'], {
    focus: [
      'When you show someone your work, you tend to point out the flaws first.',
      'You usually say “it’s not great, but…” before you share something you made.',
      'When you finish a piece of work, you tend to focus on what could be better.',
    ],
    why: 'Seeing what could be better helps you improve, but pointing out flaws first can hide good work from the people looking at it.',
    try: [
      'Share your next piece of work without a disclaimer, so the other person sees it fresh.',
      'Name one thing you like about your work before you name a flaw, so both get said.',
    ],
    watch: [
      'Notice how often you say sorry or “it’s not great” before sharing.',
      'Notice how people respond to your work when you leave the disclaimer out.',
    ],
  }),
  idea('ftw_competence_l_08', ['competence:low'], {
    focus: [
      'When you’re new at something, you tend to ask a lot of questions before you begin.',
      'You usually prefer to learn the basics well before you try the hard parts.',
      'When a task is unfamiliar, you tend to look for a guide first.',
    ],
    why: 'Learning well before you start helps you avoid mistakes, but some skills only come from trying and getting it slightly wrong.',
    try: [
      'Start a task with the first step you do know, so you begin before you feel fully ready.',
      'Set a limit on prep, like thirty minutes, and then try, so learning turns into doing.',
    ],
    watch: [
      'Notice how much prep you do before you try.',
      'Notice how much you learn once you’re actually doing.',
    ],
  }),
  idea('ftw_competence_l_09', ['competence:low'], {
    focus: [
      'When a friend or coworker asks you to teach them something, you tend to say you’re not the right person.',
      'You usually think someone else knows a skill better than you do.',
      'When people ask for your help, you tend to doubt you know enough.',
    ],
    why: 'Being careful about what you know keeps you honest, but others may see skills in you that you don’t.',
    try: [
      'Say yes to teaching one small thing you know well, so you see how much you do know.',
      'Ask a friend what they think you’re good at, so you hear it from outside.',
    ],
    watch: [
      'Notice how often people ask you for help.',
      'Notice what you know that the other person doesn’t.',
    ],
  }),
  idea('ftw_competence_l_10', ['competence:low'], {
    focus: [
      'When someone watches you work, you tend to feel your performance drop.',
      'You usually do better when no one is looking over your shoulder.',
      'When you have to demonstrate something live, you tend to worry you’ll make a mistake.',
    ],
    why: 'Being watched can make every small slip feel big, but most people watching are paying less attention to the details than you think.',
    try: [
      'Practice a task with one friendly person watching, so being seen feels more normal.',
      'Tell the person watching “I work better with a little space,” so they give you room.',
    ],
    watch: [
      'Notice what changes in your work when someone is watching.',
      'Notice how closely the observer was actually paying attention.',
    ],
  }),
  idea('ftw_competence_l_11', ['competence:low'], {
    focus: [
      'When you finish something, you tend to check it many times before you let anyone see it.',
      'You usually need a few passes before you feel okay about handing work in.',
      'When you’ve done a task well, you tend to wonder if you missed something.',
    ],
    why: 'Checking your work catches real mistakes, but after a few passes the extra checking mostly adds stress.',
    try: [
      'Decide how many checks you’ll do before you start, then stop at that number, so the work gets sent.',
      'Ask a coworker to look at it once, so you share the checking.',
    ],
    watch: [
      'Notice how many times you find a real mistake after the second check.',
      'Notice how you feel right after you hit send.',
    ],
  }),
  idea('ftw_competence_l_12', ['competence:low'], {
    focus: [
      'When you get a compliment on your skills, you tend to explain it away.',
      'You usually say “anyone could have done it” when someone praises you.',
      'When a boss says you did well, you tend to wonder what you got wrong.',
    ],
    why: 'Staying modest keeps you grounded, but brushing off praise can hide the proof that you are doing well.',
    try: [
      'Say “thank you, I worked hard on that” to the next compliment, so you take credit.',
      'Keep a note of praise you get, so you can read it on days you doubt yourself.',
    ],
    watch: [
      'Notice how fast you explain a compliment away.',
      'Notice what people actually said about your work.',
    ],
  }),
];
