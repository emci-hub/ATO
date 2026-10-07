/** Independence (autonomy): Self-directed (high) and Guided (low). */
import { idea, type InsightIdea } from './define';

export const AUTONOMY_IDEAS: readonly InsightIdea[] = [
  idea('ftw_autonomy_h_01', ['autonomy:high'], {
    focus: [
      'When your boss gives you a task, you tend to want to do it your own way.',
      'You usually prefer to choose how you work rather than follow a set process.',
      'When someone tells you exactly how to do something, you tend to push back a little.',
    ],
    why: 'Doing things your way keeps you motivated, but a team might need you to follow the shared plan sometimes.',
    try: [
      'Ask your boss which parts of a task are fixed and which are up to you, so you know where you have room.',
      'Follow one process exactly this week, so you can see what it’s for.',
    ],
    watch: [
      'Notice when your way and the team’s way clash.',
      'Notice how you feel when you have full control of a task.',
    ],
  }),
  idea('ftw_autonomy_h_02', ['autonomy:high'], {
    focus: [
      'When someone checks on your work too often, you tend to feel annoyed and less motivated.',
      'You usually work best when people trust you to get it done.',
      'When a coworker keeps checking in, you tend to feel like they don’t trust you.',
    ],
    why: 'Freedom helps you do your best work, but others might check in because they need updates, not because they doubt you.',
    try: [
      'Send your boss a short update before they ask, so they don’t need to check in.',
      'Tell your team how you like to work, so they know when to check in.',
    ],
    watch: [
      'Notice whether a check-in is about trust or about their own needs.',
      'Notice how much freedom helps you.',
    ],
  }),
  idea('ftw_autonomy_h_03', ['autonomy:high'], {
    focus: [
      'When you make plans, you tend to decide first and tell people after.',
      'You usually make your own choices without asking for much input.',
      'When you have a decision to make, you tend to work it out alone.',
    ],
    why: 'Deciding for yourself keeps things moving, but people affected by your decision might want a say.',
    try: [
      'Ask one person for their view before your next big decision, so they feel included.',
      'Tell a friend or partner about a choice before you make it, so they’re not surprised.',
    ],
    watch: [
      'Notice when someone seems surprised by a decision you made.',
      'Notice whether asking first changes your choice.',
    ],
  }),
  idea('ftw_autonomy_h_04', ['autonomy:high'], {
    focus: [
      'When a rule doesn’t make sense to you, you tend to question it or find a way around it.',
      'You usually want to know why a rule exists before you follow it.',
      'When something at work is done one way just because, you tend to want to change it.',
    ],
    why: 'Questioning rules helps you fix ones that don’t work, but some exist for reasons you might not see.',
    try: [
      'Ask someone why a rule exists before you work around it, so you know what it protects.',
      'Pick one rule that bugs you and suggest a change, so you fix it the right way.',
    ],
    watch: [
      'Notice when you skip a rule and something goes wrong.',
      'Notice which rules you’re fine with and why.',
    ],
  }),
  idea('ftw_autonomy_h_05', ['autonomy:high'], {
    focus: [
      'When a project is your own idea, you tend to work on it with lots of energy.',
      'You usually care more about tasks you chose than ones you were handed.',
      'When you get to set your own goals, you tend to work much harder.',
    ],
    why: 'You’re driven by choice, so finding the part of any task that you can own tends to keep you going.',
    try: [
      'Pick one part of a task you were given and make it your own, so it feels like your project.',
      'Set one small goal for yourself today, so you have something that’s yours to chase.',
    ],
    watch: [
      'Notice how your energy changes between tasks you chose and tasks you were given.',
      'Notice what makes a task feel like yours.',
    ],
  }),
  idea('ftw_autonomy_h_06', ['autonomy:high', 'relatedness:low'], {
    focus: [
      'You tend to enjoy working and spending time on your own, and you don’t need much company to feel good.',
      'When you have free time, you usually spend it on your own projects rather than with groups.',
      'You tend to do your best work alone and feel fine without checking in with people.',
    ],
    why: 'Being self-sufficient gives you freedom, but friends might want more contact than you naturally reach for.',
    try: [
      'Text one friend this week just to check in, so they know you think of them.',
      'Invite someone to join you for part of a solo activity, so you share it without losing your space.',
    ],
    watch: [
      'Notice how long it’s been since you reached out to a friend.',
      'Notice whether time alone ever starts to feel lonely.',
    ],
  }),
  idea('ftw_autonomy_l_01', ['autonomy:low'], {
    focus: [
      'When you start a new task, you tend to feel better once someone explains exactly what’s expected.',
      'You usually work best when your boss gives you clear steps to follow.',
      'When a task is vague, you tend to want more direction before you begin.',
    ],
    why: 'Clear direction helps you do good work, but waiting for it can slow you down when nobody gives it.',
    try: [
      'Write down your best guess at the next step before asking, so you start moving on your own.',
      'Ask your boss one clear question at the start, so you get direction without waiting.',
    ],
    watch: [
      'Notice when you wait for instructions you could figure out yourself.',
      'Notice how well you do when you just start.',
    ],
  }),
  idea('ftw_autonomy_l_02', ['autonomy:low'], {
    focus: [
      'When friends make plans, you tend to happily go along with what they choose.',
      'You usually like it when someone else decides the plan.',
      'When a group needs a decision, you tend to let someone else lead.',
    ],
    why: 'Letting others lead makes you easy to plan with, but your ideas can be just as good as theirs.',
    try: [
      'Suggest one plan for your next hangout, so your ideas get a turn.',
      'Pick the restaurant next time, so friends get to see what you like.',
    ],
    watch: [
      'Notice when you have an idea but let someone else decide.',
      'Notice how it feels when your plan is the one picked.',
    ],
  }),
  idea('ftw_autonomy_l_03', ['autonomy:low'], {
    focus: [
      'When you face a decision, you tend to ask a few people what they’d do first.',
      'You usually like hearing other people’s advice before making a choice.',
      'When you’re unsure, you tend to check with a friend or family member before deciding.',
    ],
    why: 'Getting advice helps you see more options, but too many opinions can make it harder to hear your own.',
    try: [
      'Write down what you’d choose before asking anyone, so your own view comes first.',
      'Ask just one person this time, so the decision stays clear.',
    ],
    watch: [
      'Notice whether you already knew your answer before you asked.',
      'Notice how you feel about choices you made on your own.',
    ],
  }),
  idea('ftw_autonomy_l_04', ['autonomy:low'], {
    focus: [
      'When a job has a clear role and a steady routine, you tend to feel settled and do well.',
      'You usually like knowing who’s in charge at work and what your role is.',
      'When a team has clear roles, you tend to feel more comfortable.',
    ],
    why: 'A clear setup helps you focus, but changes at work can feel harder for you when roles shift.',
    try: [
      'Ask your boss about upcoming changes, so you have time to get ready.',
      'Take on one small task outside your role, so new things feel more familiar.',
    ],
    watch: [
      'Notice how you feel when your role is unclear.',
      'Notice when you handle a new task better than you expected.',
    ],
  }),
  idea('ftw_autonomy_l_05', ['autonomy:low'], {
    focus: [
      'When someone knows more than you about a topic, you tend to follow their lead.',
      'You usually trust people with more experience to decide.',
      'When there’s an expert in the room, you tend to keep your own ideas quiet.',
    ],
    why: 'Learning from experienced people is smart, but your own view can add something they missed.',
    try: [
      'Share one idea with someone more experienced this week, so they hear your view.',
      'Ask an expert why they’d do it that way, so you learn the reason, not just the answer.',
    ],
    watch: [
      'Notice when you agree with an expert before thinking it through.',
      'Notice when your idea turned out to be good.',
    ],
  }),
  idea('ftw_autonomy_l_06', ['autonomy:low', 'relatedness:high'], {
    focus: [
      'You tend to feel best making plans and decisions together with the people close to you.',
      'When you have a choice to make, you usually want your partner or friends involved.',
      'You tend to enjoy deciding things as a team more than on your own.',
    ],
    why: 'Deciding together keeps you close to people, but you can lose touch with what you want on your own.',
    try: [
      'Make one small choice today without asking anyone, so you practice trusting yourself.',
      'Write down what you want before a joint decision, so you bring your own view.',
    ],
    watch: [
      'Notice when you ask for input on something you’ve already decided.',
      'Notice how you feel when you choose on your own.',
    ],
  }),
];
