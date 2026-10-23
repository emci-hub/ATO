/** Self-belief (self_efficacy): Bold (high) and Hesitant (low). The low side stays private on share surfaces. */
import { idea, type InsightIdea } from './define';

export const SELF_EFFICACY_IDEAS: readonly InsightIdea[] = [
  idea('ftw_self_efficacy_h_01', ['self_efficacy:high'], {
    focus: [
      'When someone asks if you can handle a task, you usually say yes before you have heard the details.',
      'A new problem can land and you already trust you will find a way through it.',
      'You sometimes take the extra work in the chat because you believe you can figure it out.',
    ],
    why: 'Your confidence helps you take on new things, but a quick yes can leave you with too much on the list.',
    try: [
      'Before you say yes next time, ask for a day to think, so you are sure you have room.',
      'Write down what you have already agreed to this week, so you know the load.',
    ],
    watch: [
      'Notice when you agree in the chat before you know the details of the task.',
      'Notice how often the quick yes actually works out.',
    ],
  }),
  idea('ftw_self_efficacy_h_02', ['self_efficacy:high'], {
    focus: [
      'A goal you set for the year can be bigger than the one a friend would have picked for you.',
      'You usually aim high, at a number or a title other people would call too much.',
      'Planning the year, you sometimes pick a target that stretches past what you have done before.',
    ],
    why: 'A big goal can push you forward, but missing one can feel larger than the miss actually was.',
    try: [
      'Break your biggest goal into one step you can finish this week, so the goal feels doable.',
      'Write down one goal you have already reached, so you see the progress.',
    ],
    watch: [
      'Notice how you feel when a goal takes longer than the date you set.',
      'Notice the small wins along the way to the big one.',
    ],
  }),
  idea('ftw_self_efficacy_h_03', ['self_efficacy:high'], {
    focus: [
      'When something unexpected happens, you usually feel ready to deal with it on the spot.',
      'A plan that changes at the last minute can leave you still confident in the work chat.',
      'You sometimes jump in and start solving a problem before the room has finished describing it.',
    ],
    why: 'Your confidence in a messy moment can help other people feel safer, but a minute of thinking can make the plan better.',
    try: [
      'Take one minute to think before you act on the next surprise, so the plan is clearer.',
      'Ask someone else for their idea before you jump in, so you have more than one option.',
    ],
    watch: [
      'Notice when jumping in fast skips a better option on the table.',
      'Notice how other people feel when you take charge.',
    ],
  }),
  idea('ftw_self_efficacy_h_04', ['self_efficacy:high'], {
    focus: [
      'When someone gives you advice, you usually feel you already know what to do.',
      'A tip from a coworker can lose to your own way of doing the task.',
      'Starting something new, you sometimes skip the instructions and figure the thing out yourself.',
    ],
    why: 'Trusting your own way saves time, but a tip from someone else can make the task easier.',
    try: [
      'Read the instructions for one new thing this week, so you can see if they save time.',
      'Ask someone who knows the task one question before you start, so you skip a common mistake.',
    ],
    watch: [
      'Notice when a tip you skipped in the instructions would have helped.',
      'Notice how often you figure a thing out on your own.',
    ],
  }),
  idea('ftw_self_efficacy_h_05', ['self_efficacy:high'], {
    focus: [
      'When a friend doubts themselves, you usually tell them they can do the thing.',
      'A nervous text from a friend can get encouragement from you before you offer help with the actual task.',
      'You sometimes cheer a person on through a challenge and assume that is the support they need.',
    ],
    why: 'Your belief can lift other people, but some of them need practical help from you more than encouragement.',
    try: [
      'Ask a nervous friend what would help them most, so the support fits.',
      'Offer to help a friend with one step of a scary task, so they are not doing it alone.',
    ],
    watch: [
      'Notice when a friend needs help with the task, not only encouragement.',
      'Notice how your confidence lands on the people around you.',
    ],
  }),
  idea('ftw_self_efficacy_h_06', ['self_efficacy:high', 'openness:high'], {
    focus: [
      'When something new comes up, you usually say yes and trust you will figure it out.',
      'A chance you have never tried can get a yes from you before you have a plan.',
      'You sometimes jump into a new thing without much worry about how it will go.',
    ],
    why: 'Curiosity plus confidence helps you try a lot, but a little planning can help a new thing go more smoothly.',
    try: [
      'Before your next new thing, write down one thing that could go wrong, so you are ready.',
      'Ask someone who has done it before for one tip, so you start with that in hand.',
    ],
    watch: [
      'Notice when your confidence carries you through a new task you had not done before.',
      'Notice when ten minutes of prep would have helped the new thing.',
    ],
  }),
  idea('ftw_self_efficacy_l_01', ['self_efficacy:low'], {
    focus: [
      'When something big comes up, you usually wonder if you can handle it.',
      'A challenge on the calendar can bring doubt before you have even opened the file.',
      'If someone asks you to take on more, you sometimes feel unsure you can do it.',
    ],
    why: 'Doubt can make you careful, but it can also stop you from trying a thing you would handle fine.',
    try: [
      'Write down one hard task you already handled, so you have proof you can do the next one.',
      'Start with the smallest part of the hard task today, so the file gets opened.',
    ],
    watch: [
      'Notice when the doubt is louder than the facts in front of you.',
      'Notice how the thing goes once you start.',
    ],
  }),
  idea('ftw_self_efficacy_l_02', ['self_efficacy:low'], {
    focus: [
      'When you need to start something hard, you usually put it off.',
      'You can wait until you feel ready, and the ready feeling can take a long time to show up.',
      'A big task on the list sometimes gets delayed while you wait for a better moment to begin.',
    ],
    why: 'Waiting until you feel ready makes sense to you, but the ready feeling often comes after you start the task.',
    try: [
      'Set a timer for five minutes and start the hard task, so you get past the blank page.',
      'Pick the easiest first step and do it now, so you get a little momentum.',
    ],
    watch: [
      'Notice how you feel after you have only just started.',
      'Notice which tasks on the list you put off most.',
    ],
  }),
  idea('ftw_self_efficacy_l_03', ['self_efficacy:low'], {
    focus: [
      'When you finish something, you usually check with someone before you feel sure it is good.',
      'A decision can sit until you have asked a friend if it is the right one.',
      'You sometimes want a second look at your work before you trust it enough to send.',
    ],
    why: 'Checking with someone else is careful, but your own judgment might be better than you think.',
    try: [
      'Send one piece of work this week without asking first, so you practice trusting your own read.',
      'Write down your own answer before you ask, so you can see if you were right.',
    ],
    watch: [
      'Notice how often your first answer was the right one.',
      'Notice how you feel when you trust your own read.',
    ],
  }),
  idea('ftw_self_efficacy_l_04', ['self_efficacy:low'], {
    focus: [
      'When an opportunity looks hard, you usually let it pass.',
      'A safer option on the list can win over the challenge, even when the challenge interests you.',
      'A chance to try something new at work sometimes gets a no from you before you have looked closely.',
    ],
    why: 'Choosing the safe option protects you from a public miss, but it can also keep you from finding out what you can do.',
    try: [
      'Say yes to one small challenge at work this week, so you see what you can handle.',
      'Ask a friend to try something new with you, so it feels less exposed.',
    ],
    watch: [
      'Notice when you say no out of doubt, not from a lack of interest.',
      'Notice how you feel after you try something hard.',
    ],
  }),
  idea('ftw_self_efficacy_l_05', ['self_efficacy:low'], {
    focus: [
      'When something goes wrong, you usually read it as proof you cannot do the thing.',
      'Your mistakes can stay louder in your head than the wins from the same week.',
      'After a struggle, you sometimes tell yourself you are not up to the task.',
    ],
    why: 'Being hard on yourself can feel ordinary, but it can make the next challenge look bigger than it is.',
    try: [
      'Write down one win from this week, so you have proof the week was not only the miss.',
      'Talk to yourself the way you would talk to a friend after a mistake, so you stay fair.',
    ],
    watch: [
      'Notice the words you use on yourself after a mistake at work.',
      'Notice when you skip a win and go straight to the next task.',
    ],
  }),
  idea('ftw_self_efficacy_l_06', ['self_efficacy:low', 'competence:low'], {
    focus: [
      'Facing something new, you usually doubt both your skills and your chances.',
      'You can feel unsure you can do a hard thing, even when you have done a similar one before.',
      'When the work gets challenging, you sometimes worry you are not up to it.',
    ],
    why: 'Doubts like these are common, and they can shrink once you try a small piece and see how it goes.',
    try: [
      'Write down three things you have done that once felt too hard, so you see your own record.',
      'Pick one small challenge on this week’s list and finish it, so you have a fresh win.',
    ],
    watch: [
      'Notice when a doubt turns out to be wrong.',
      'Notice how much you have done that once felt hard.',
    ],
  }),
];
