/** Independence (autonomy): Self-directed (high) and Guided (low). */
import { idea, type InsightIdea } from './define';

export const AUTONOMY_IDEAS: readonly InsightIdea[] = [
  idea('ftw_autonomy_h_01', ['autonomy:high'], {
    focus: [
      'Your boss hands you a task, and you usually want to do it your way rather than from their steps.',
      'A set process in the work doc can feel too fixed, and you prefer to choose how the work gets done.',
      'Someone walks you through every click, and you can push back a little before you’ve even started.',
    ],
    why: 'Doing the task your way keeps you motivated, but a team might need you on the shared plan for the parts that touch their work.',
    try: [
      'Ask your boss which parts of a task are fixed and which are yours, so you know where you have room.',
      'Do one process exactly as written this week, so you can see what the steps are for.',
    ],
    watch: [
      'Notice when your way and the team’s doc clash on the same task.',
      'Notice how the work feels when the whole task is yours.',
    ],
  }),
  idea('ftw_autonomy_h_02', ['autonomy:high'], {
    focus: [
      'A boss who checks the doc too often can leave you annoyed, and the task gets harder to care about.',
      'You usually do your best work once people leave the task with you and stop checking the chat.',
      'A coworker’s third check-in of the morning can feel like they don’t trust you with the file.',
    ],
    why: 'Room to work helps you do the job well, but a check-in can be about their update, not a doubt about you.',
    try: [
      'Send your boss a short update before they ask, so they don’t need to message the thread.',
      'Tell your team when you like a check-in, so they know the hour that actually helps.',
    ],
    watch: [
      'Notice whether a check-in is about trust or about a status they need.',
      'Notice how the afternoon feels when nobody messages you about the doc.',
    ],
  }),
  idea('ftw_autonomy_h_03', ['autonomy:high'], {
    focus: [
      'You usually decide the plan first and tell people after, once it’s already on your calendar.',
      'A choice can get made at your kitchen table, with very little input from anyone else.',
      'Faced with a decision, you usually work it out alone before you bring it to the group chat.',
    ],
    why: 'Deciding on your own keeps the week moving, but people the choice lands on might want a say before it’s booked.',
    try: [
      'Ask one person for their view before your next big decision, so they’re in it before you book it.',
      'Tell a friend or partner about a choice before you make it, so the calendar isn’t a surprise.',
    ],
    watch: [
      'Notice when someone seems surprised by a plan you already booked.',
      'Notice whether asking first actually changes the choice.',
    ],
  }),
  idea('ftw_autonomy_h_04', ['autonomy:high'], {
    focus: [
      'A rule that doesn’t make sense can have you questioning it, or finding a way around the form.',
      'You usually want the reason for a rule before you follow it on the next task.',
      'A “we’ve always done it this way” at work can make you want to change the step.',
    ],
    why: 'Questioning a rule helps you fix ones that waste the afternoon, but some rules exist for a reason you might not see yet.',
    try: [
      'Ask someone why a rule exists before you work around it, so you know what the rule is guarding.',
      'Pick one rule that bothers you and suggest a change, so the team can look at it with you.',
    ],
    watch: [
      'Notice when you skip a step and something later goes wrong.',
      'Notice which rules you’re fine with once you know the reason.',
    ],
  }),
  idea('ftw_autonomy_h_05', ['autonomy:high'], {
    focus: [
      'A project that started as your idea usually gets your best hours, late and early.',
      'A task you chose can matter more to you than the one that landed in your inbox assigned.',
      'Once you set the goal yourself, you can work much harder than you do on a handed-down list.',
    ],
    why: 'Choice is what keeps you going, so the part of a task you can own is the part that actually gets finished.',
    try: [
      'Pick one part of a task you were given and make that part yours, so it feels like your project.',
      'Set one small goal for yourself today, so the list has something that’s yours.',
    ],
    watch: [
      'Notice how your focus shifts between a task you chose and a task you were given.',
      'Notice what makes a task feel like yours instead of an assignment.',
    ],
  }),
  idea('ftw_autonomy_h_06', ['autonomy:high', 'relatedness:low'], {
    focus: [
      'A free evening usually goes to your own project, and you don’t need company to feel fine about it.',
      'Given an open Saturday, you usually spend it on your own work rather than a group plan.',
      'You can do your best work alone and feel okay without a check-in from the group chat.',
    ],
    why: 'Being able to run your own day gives you freedom, but friends might want more contact than you reach for on your own.',
    try: [
      'Text one friend this week just to check in, so they know you thought of them.',
      'Ask someone to join part of a solo plan, so you share an hour and keep the rest.',
    ],
    watch: [
      'Notice how long it’s been since you texted a friend first.',
      'Notice whether time alone ever starts to feel lonely by Sunday.',
    ],
  }),
  idea('ftw_autonomy_l_01', ['autonomy:low'], {
    focus: [
      'A new task can feel better once someone explains what “done” looks like before you start.',
      'You usually work best when your boss gives you the steps, not only the goal in the chat.',
      'A vague assignment can have you waiting for more direction before you open the file.',
    ],
    why: 'Clear steps help you do good work, but waiting for them can stall you when nobody in the chat gives any.',
    try: [
      'Write your best guess at the next step before you ask, so you’ve already started.',
      'Ask your boss one clear question at the start, so you get direction without waiting all morning.',
    ],
    watch: [
      'Notice when you wait for instructions you could sketch yourself.',
      'Notice how the task goes once you just open the file.',
    ],
  }),
  idea('ftw_autonomy_l_02', ['autonomy:low'], {
    focus: [
      'Friends make the plan, and you usually go along happily with whatever they put in the chat.',
      'You can like it when someone else picks the restaurant and the time.',
      'A group that needs a decision usually gets your silence while someone else leads.',
    ],
    why: 'Letting others pick the plan makes you easy company, but your idea for the night can be just as good as theirs.',
    try: [
      'Name one plan for the next hangout, so your idea gets a turn in the chat.',
      'Pick the restaurant next time, so friends see what you actually like.',
    ],
    watch: [
      'Notice when you have a place in mind and still let someone else decide.',
      'Notice how it feels when the plan in the chat is the one you named.',
    ],
  }),
  idea('ftw_autonomy_l_03', ['autonomy:low'], {
    focus: [
      'A decision on your plate usually starts with you asking a few people what they’d do.',
      'You can like hearing advice in the group chat before you pick.',
      'Unsure about a choice, you usually check with a friend or your family before you decide.',
    ],
    why: 'Other views show you more options, but too many replies can make it harder to hear what you already wanted.',
    try: [
      'Write what you’d choose before you ask anyone, so your own view is on the page first.',
      'Ask just one person this time, so you get one view instead of a crowd of replies.',
    ],
    watch: [
      'Notice whether you already knew your answer before you asked the chat.',
      'Notice how you feel about a choice you made with the phone face down.',
    ],
  }),
  idea('ftw_autonomy_l_04', ['autonomy:low'], {
    focus: [
      'A job with a clear role and a steady routine can leave you settled, and the work goes well.',
      'A project with a named lead usually feels better to you, because you know your part of the file.',
      'A team with named roles on the doc usually feels more comfortable to you than a loose one.',
    ],
    why: 'A clear role helps you focus on the work, but a shift in who does what can feel harder until the new setup is written down.',
    try: [
      'Ask your boss what changes are coming, so you have time to get ready.',
      'Take one small task outside your usual role, so a new kind of work feels more familiar.',
    ],
    watch: [
      'Notice how you feel on a day when nobody is sure who owns the task.',
      'Notice when a new task goes better than you expected once you start it.',
    ],
  }),
  idea('ftw_autonomy_l_05', ['autonomy:low'], {
    focus: [
      'Someone who knows the topic better usually gets your follow, and you let them lead the call.',
      'You can trust a more experienced coworker to decide when you’re both looking at the same problem.',
      'An expert in the meeting can have you keeping your own idea in the notes, unsaid.',
    ],
    why: 'Learning from people with more experience is useful, but your own view can add something they missed on the call.',
    try: [
      'Share one idea with a more experienced coworker in the meeting, so they hear it from you.',
      'Ask an expert why they’d do it that way, so you learn the reason, not only the answer.',
    ],
    watch: [
      'Notice when you agree with an expert before you’ve thought the point through.',
      'Notice when an idea you almost kept quiet turned out to be useful.',
    ],
  }),
  idea('ftw_autonomy_l_06', ['autonomy:low', 'relatedness:high'], {
    focus: [
      'Plans and decisions usually feel best when you make them with the people close to you, not alone.',
      'A choice on the calendar can have you wanting your partner or friends in the text before you lock it.',
      'Picking a place for dinner can feel better with your partner in the text than choosing alone.',
    ],
    why: 'Deciding together keeps you close to people, but you can lose track of what you want when the chat picks for you.',
    try: [
      'Make one small choice today without asking anyone, so you practice hearing your own pick.',
      'Write what you want before a joint decision, so you bring your own line into the talk.',
    ],
    watch: [
      'Notice when you ask the chat for input on a choice you’ve already made.',
      'Notice how you feel after you choose with the phone left in the other room.',
    ],
  }),
];
