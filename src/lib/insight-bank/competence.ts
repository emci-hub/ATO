/** Confidence (competence): Assured (high) and Cautious (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const COMPETENCE_IDEAS: readonly InsightIdea[] = [
  idea("ftw_competence_h_01", ["competence:high"], {
    focus: [
      "Your answers suggest you trust that a hard task can be handled.",
      "From your answers, you trust that a hard task can be handled.",
      "The pattern in your answers is that you trust that a hard task can be handled.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_02", ["competence:high"], {
    focus: [
      "The catch in your answers is a trust that skips a needed check.",
      "What this can cost you is a trust that skips a needed check.",
      "A cost worth naming for you is a trust that skips a needed check.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_03", ["competence:high"], {
    focus: [
      "Someone else might notice that you trust a hard task even when doubt is available.",
      "From the outside, you trust a hard task even when doubt is available.",
      "Other people can see that you trust a hard task even when doubt is available.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_04", ["competence:high"], {
    focus: [
      "What you might miss is a check the trust skipped.",
      "Your answers leave room to miss a check the trust skipped.",
      "A thing you might skip is a check the trust skipped.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_05", ["competence:high"], {
    focus: [
      "The helpful side for you shows up when trust lets the hard task move.",
      "Your answers also show a use when trust lets the hard task move.",
      "There is a use for you when trust lets the hard task move.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_h_06", ["competence:high", "self_efficacy:high"], {
    focus: [
      "Your answers suggest two things at once: you trust the hard task, and you expect to finish.",
      "Both can be true for you in the same week: you trust the hard task, and you expect to finish.",
      "In the same week, you trust the hard task, and you expect to finish.",
    ],
    why: "The upside for you is a hard task that moves. The catch is a trust that skips a needed check.",
    try: [
      "Next time you choose, name whether the task still needs a check first.",
      "Before you decide, check what doubt is pointing at.",
    ],
    watch: [
      "Notice when you skip a check the task needed.",
      "Notice if the doubt was pointing at a real gap.",
    ],
  }),
  idea("ftw_competence_l_01", ["competence:low"], {
    focus: [
      "Your answers suggest you doubt that a hard task can be pulled off.",
      "From your answers, you doubt that a hard task can be pulled off.",
      "The pattern in your answers is that you doubt that a hard task can be pulled off.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_02", ["competence:low"], {
    focus: [
      "The catch in your answers is a doubt that stops the start.",
      "What this can cost you is a doubt that stops the start.",
      "A cost worth naming for you is a doubt that stops the start.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_03", ["competence:low"], {
    focus: [
      "Someone else might notice that you doubt a hard task even when a small start is available.",
      "From the outside, you doubt a hard task even when a small start is available.",
      "Other people can see that you doubt a hard task even when a small start is available.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_04", ["competence:low"], {
    focus: [
      "What you might miss is the small start that was available.",
      "Your answers leave room to miss the small start that was available.",
      "A thing you might skip is the small start that was available.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_05", ["competence:low"], {
    focus: [
      "The helpful side for you shows up when an honest doubt can be useful.",
      "Your answers also show a use when an honest doubt can be useful.",
      "There is a use for you when an honest doubt can be useful.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
    ],
  }),
  idea("ftw_competence_l_06", ["competence:low", "growth_mindset:high"], {
    focus: [
      "Your answers suggest two things at once: you doubt the hard task, and you look for the change.",
      "Both can be true for you in the same week: you doubt the hard task, and you look for the change.",
      "In the same week, you doubt the hard task, and you look for the change.",
    ],
    why: "The upside for you is an honest doubt. The catch is a doubt that stops the start.",
    try: [
      "Next time you choose, name the smallest start that still counts first.",
      "Before you decide, check whether the doubt is about the whole task.",
    ],
    watch: [
      "Notice when the doubt stops you before a start.",
      "Notice if a small start would have been enough.",
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
      'You usually prefer to look it up quietly rather than ask in a meeting.',
      'When a topic is new to you, you tend to act as if you already know it.',
    ],
    why: 'Saying “I don’t know” can build more trust than you expect.',
    try: [
      'Say “I’m not sure, let me find out” once this week.',
      'Ask one question in a meeting when you don’t know the answer.',
    ],
    watch: [
      'Notice how you feel when you pretend to know something.',
      'Notice how people respond when someone else admits they don’t know.',
    ],
  }),
  idea('ftw_competence_h_09', ['competence:high'], {
    focus: [
      'When a team asks who can handle a problem, you tend to be the first to say you can.',
      'You usually take on the hard problem because you trust yourself to solve it.',
      'You tend to step in and lead when a project is at risk.',
    ],
    why: 'Stepping in helps teams that are stuck, but others may not get the chance to grow if you take the lead every time.',
    try: [
      'Ask a teammate to take the lead on one part and offer to back them up.',
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
    why: 'Another way can sometimes be faster or catch a problem you missed.',
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
      'Notice when you jump in before someone asks for help.',
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
      'You tend to focus on what could be better when you finish a piece of work.',
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
      'Notice how closely people actually pay attention when you work.',
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
      'Decide how many checks you will do before you start, and stick to that number.',
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
      'You tend to dismiss praise as something anyone could have done.',
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
