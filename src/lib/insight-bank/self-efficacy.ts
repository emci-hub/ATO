/** Self-belief (self_efficacy): Bold (high) and Hesitant (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const SELF_EFFICACY_IDEAS: readonly InsightIdea[] = [
  idea('ftw_self_efficacy_h_01', ['self_efficacy:high'], {
    focus: [
      'When someone asks if you can handle something, you tend to say yes right away.',
      'You usually believe you can figure out whatever comes your way.',
      'When a challenge comes up, you tend to trust you’ll find a way.',
    ],
    why: 'Your confidence helps you take on new things, but saying yes too quickly can leave you with too much to do.',
    try: [
      'Before you say yes next time, ask for a day to think, so you’re sure you have room.',
      'Write down what you’ve already agreed to this week, so you know your load.',
    ],
    watch: [
      'Notice when you agree before you know the details.',
      'Notice how often your quick yes works out.',
    ],
  }),
  idea('ftw_self_efficacy_h_02', ['self_efficacy:high'], {
    focus: [
      'When you set a goal, you tend to aim high.',
      'You usually go for big goals that others might think are too much.',
      'When planning your year, you tend to pick goals that stretch you.',
    ],
    why: 'Big goals push you forward, but missing one can feel bigger than it should.',
    try: [
      'Break your biggest goal into one step for this week, so it feels doable.',
      'Write down one goal you’ve already reached, so you see your progress.',
    ],
    watch: [
      'Notice how you feel when a goal takes longer than planned.',
      'Notice the small wins along the way.',
    ],
  }),
  idea('ftw_self_efficacy_h_03', ['self_efficacy:high'], {
    focus: [
      'When something unexpected happens, you tend to feel ready to deal with it.',
      'You usually stay confident when plans suddenly change.',
      'When there’s a problem, you tend to jump in and start solving it.',
    ],
    why: 'Your confidence in a crisis helps others feel safe, but taking a moment to think can make your plan better.',
    try: [
      'Take one minute to think before acting in your next surprise, so your plan is clear.',
      'Ask someone else for their idea before you jump in, so you have more options.',
    ],
    watch: [
      'Notice when acting fast skips a better option.',
      'Notice how others feel when you take charge.',
    ],
  }),
  idea('ftw_self_efficacy_h_04', ['self_efficacy:high'], {
    focus: [
      'When someone gives you advice, you tend to feel you already know what to do.',
      'You usually trust your own way of doing things over others’ tips.',
      'When you start something new, you tend to skip the instructions and figure it out.',
    ],
    why: 'Trusting yourself saves time, but a tip from someone else can make things easier for you.',
    try: [
      'Read the instructions for one new thing this week, so you see if it saves time.',
      'Ask an expert one question before you start, so you avoid a common mistake.',
    ],
    watch: [
      'Notice when a tip you ignored would have helped.',
      'Notice how often you figure things out on your own.',
    ],
  }),
  idea('ftw_self_efficacy_h_05', ['self_efficacy:high'], {
    focus: [
      'When a friend doubts themselves, you tend to tell them they can do it.',
      'You usually believe in people and tell them so.',
      'When someone is nervous about a challenge, you tend to cheer them on.',
    ],
    why: 'Your belief can lift others, but some people need practical help from you more than encouragement.',
    try: [
      'Ask a nervous friend what would help them most, so your support fits.',
      'Offer to help a friend with one step of a scary task, so they’re not alone.',
    ],
    watch: [
      'Notice when a friend needs help, not just encouragement.',
      'Notice how your confidence affects the people around you.',
    ],
  }),
  idea('ftw_self_efficacy_h_06', ['self_efficacy:high', 'openness:high'], {
    focus: [
      'When something new comes up, you tend to say yes and trust you’ll figure it out.',
      'You usually jump into new things without worrying much about how they’ll go.',
      'When a chance comes up, you tend to go for it even if you’ve never done it before.',
    ],
    why: 'Your mix of curiosity and confidence helps you try a lot, but a little planning can help new things go smoother.',
    try: [
      'Before your next new thing, write down one thing that could go wrong, so you’re ready.',
      'Ask someone who’s done it before for one tip, so you start smarter.',
    ],
    watch: [
      'Notice when your confidence carries you through something new.',
      'Notice when a little prep would have helped.',
    ],
  }),
  idea('ftw_self_efficacy_l_01', ['self_efficacy:low'], {
    focus: [
      'When something big comes up, you tend to wonder if you can handle it.',
      'You usually doubt yourself before a challenge.',
      'When someone asks you to take on more, you tend to feel unsure you can do it.',
    ],
    why: 'Doubt can make you careful, but it can also stop you from trying things you’d handle fine.',
    try: [
      'Write down one hard thing you handled before, so you remember you can do it.',
      'Start with the smallest part of the task today, so it feels doable.',
    ],
    watch: [
      'Notice when your doubt is louder than the facts.',
      'Notice how things go once you start.',
    ],
  }),
  idea('ftw_self_efficacy_l_02', ['self_efficacy:low'], {
    focus: [
      'When you need to start something hard, you tend to put it off.',
      'You usually wait until you feel ready before you start, and that can take a while.',
      'When a task feels big, you tend to delay starting it.',
    ],
    why: 'Waiting until you feel ready makes sense, but the ready feeling often comes after you start.',
    try: [
      'Set a timer for five minutes and start the task, so you get past the beginning.',
      'Pick the easiest first step and do it now, so you build some momentum.',
    ],
    watch: [
      'Notice how you feel after just starting.',
      'Notice which tasks you put off most.',
    ],
  }),
  idea('ftw_self_efficacy_l_03', ['self_efficacy:low'], {
    focus: [
      'When you finish something, you tend to check with someone before you feel sure it’s good.',
      'You usually want a second opinion before you trust your work.',
      'When you make a decision, you tend to ask others if it’s the right one.',
    ],
    why: 'Checking with others is careful, but your own judgment is often better than you think.',
    try: [
      'Send one piece of work this week without asking first, so you practice trusting yourself.',
      'Write down your own answer before asking, so you can see if you were right.',
    ],
    watch: [
      'Notice how often your first answer was right.',
      'Notice how you feel when you trust yourself.',
    ],
  }),
  idea('ftw_self_efficacy_l_04', ['self_efficacy:low'], {
    focus: [
      'When an opportunity looks hard, you tend to let it pass.',
      'You usually pick safer options over challenges.',
      'When there’s a chance to try something new at work, you tend to hold back.',
    ],
    why: 'Choosing safe options protects you from failing, but it can also keep you from finding out what you can do.',
    try: [
      'Say yes to one small challenge this week, so you see what you can handle.',
      'Ask a friend to try something new with you, so it feels less scary.',
    ],
    watch: [
      'Notice when you say no out of doubt, not lack of interest.',
      'Notice how you feel after trying something hard.',
    ],
  }),
  idea('ftw_self_efficacy_l_05', ['self_efficacy:low'], {
    focus: [
      'When something goes wrong, you tend to think it proves you can’t do it.',
      'You usually remember your mistakes more than your wins.',
      'When you struggle, you tend to tell yourself you’re not good enough.',
    ],
    why: 'Being hard on yourself can feel normal, but it can make each challenge feel bigger than it is.',
    try: [
      'Write down one win from this week, so you have proof you’re doing okay.',
      'Talk to yourself like you’d talk to a friend after a mistake, so you stay kind.',
    ],
    watch: [
      'Notice how you talk to yourself after a mistake.',
      'Notice when you skip over your own wins.',
    ],
  }),
  idea('ftw_self_efficacy_l_06', ['self_efficacy:low', 'competence:low'], {
    focus: [
      'When you face something new, you tend to doubt both your skills and your chances.',
      'You usually feel unsure you can do hard things, even when you’ve done them before.',
      'When work gets challenging, you tend to worry you’re not up to it.',
    ],
    why: 'These doubts are common, and they usually shrink each time you try something and see how it goes.',
    try: [
      'Write down three things you’ve done that once felt too hard, so you see your track record.',
      'Pick one small challenge this week and finish it, so you have a fresh win.',
    ],
    watch: [
      'Notice when your doubts turn out to be wrong.',
      'Notice how much you’ve done that once felt hard.',
    ],
  }),
];
