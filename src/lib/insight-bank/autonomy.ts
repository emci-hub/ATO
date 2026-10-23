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
      'Pick one rule that bugs you and suggest a change, so the team can look at it with you.',
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
  idea('ftw_autonomy_h_07', ['autonomy:high'], {
    focus: [
      'When you learn a new tool or skill, you tend to dive in and work it out yourself.',
      'You usually skip the tutorial and figure things out by trying them.',
      'When something is new, you tend to prefer exploring it alone before asking anyone.',
    ],
    why: 'Learning by doing makes the skill yours, but a quick tip from someone who knows can save you hours.',
    try: [
      'Ask one person how they use a tool you’re learning, so you can pick up a shortcut.',
      'Set a time limit on figuring something out alone, so you know when to ask.',
    ],
    watch: [
      'Notice how much time you spend solving something others could explain in a minute.',
      'Notice what you enjoy most about working it out yourself.',
    ],
  }),
  idea('ftw_autonomy_h_08', ['autonomy:high'], {
    focus: [
      'When you plan your day, you tend to want to set the order and the pace yourself.',
      'You usually do your best work when you pick when and how to do it.',
      'When your schedule is set by someone else, you tend to feel restless.',
    ],
    why: 'Setting your own pace gives you energy, but teammates may need to know when you’ll be available.',
    try: [
      'Share your plan for the day with one teammate, so they know when to expect your work.',
      'Pick a fixed time each day for messages, so you keep your pace without leaving people waiting.',
    ],
    watch: [
      'Notice which parts of your day you want to control most.',
      'Notice how others cope when they can’t tell what you’re doing.',
    ],
  }),
  idea('ftw_autonomy_h_09', ['autonomy:high'], {
    focus: [
      'When someone offers advice you didn’t ask for, you tend to hear it as a sign they doubt you.',
      'You usually prefer to reach your own conclusion before hearing what others think.',
      'When people tell you what to do, you tend to want to do the opposite.',
    ],
    why: 'Wanting to decide for yourself keeps your choices your own, but advice is often meant as care and can have useful facts in it.',
    try: [
      'Say “thanks, I’ll think about it” to unwanted advice, so you keep both the peace and your choice.',
      'Pick one piece of advice you got this month and test it, so you see whether it holds up.',
    ],
    watch: [
      'Notice when you reject advice before you’ve heard all of it.',
      'Notice how often advice turned out to be useful.',
    ],
  }),
  idea('ftw_autonomy_h_10', ['autonomy:high'], {
    focus: [
      'When you travel, you tend to want your own plan, even with a group.',
      'You usually need some time on a trip to wander off on your own.',
      'When friends plan everything together, you tend to want a free block of your own.',
    ],
    why: 'Having your own time keeps you enjoying the trip, but the group may wonder if you’d rather be elsewhere.',
    try: [
      'Tell the group early which block of time you’d like to keep for yourself, so they plan around it.',
      'Join one group activity fully before you go off alone, so everyone feels included.',
    ],
    watch: [
      'Notice how the group feels when you step away.',
      'Notice how you feel when you return to them.',
    ],
  }),
  idea('ftw_autonomy_h_11', ['autonomy:high'], {
    focus: [
      'When you share a job with someone, you tend to split it so each of you has your own part.',
      'You usually prefer to own a piece of the work from start to finish.',
      'When you work on a team, you tend to want a clear area that is yours.',
    ],
    why: 'Owning a piece gives you pride in the result, but the parts have to fit together, and that takes some back-and-forth.',
    try: [
      'Check in with your teammate halfway through a split job, so the pieces fit at the end.',
      'Share what you’re planning for your part in two sentences, so others can plan around it.',
    ],
    watch: [
      'Notice when pieces of your work don’t match what teammates expected.',
      'Notice how early you share what you’re doing.',
    ],
  }),
  idea('ftw_autonomy_h_12', ['autonomy:high'], {
    focus: [
      'When you ask for help, you tend to want it on your terms and not take over.',
      'You usually accept help best when it leaves the decision to you.',
      'When someone helps you too much, you tend to feel your choices are being taken away.',
    ],
    why: 'Wanting to stay in charge keeps you invested, but helpers may not know how much help you want unless you tell them.',
    try: [
      'Tell a helper what you want from them, like “just check my numbers,” so they match what you need.',
      'Thank someone for help and say how it made your job easier, so they know what worked.',
    ],
    watch: [
      'Notice how much help feels right and how much feels like too much.',
      'Notice how people react when you say what you need.',
    ],
  }),
  idea('ftw_autonomy_l_07', ['autonomy:low'], {
    focus: [
      'When you get an open-ended task, you tend to want to know what a good result looks like first.',
      'You usually do your best when the goal and steps are clear.',
      'When there are no instructions, you tend to feel unsure where to start.',
    ],
    why: 'Clear goals help you do solid work, but waiting for them can slow you down when no one has time to explain.',
    try: [
      'Write down what you think a good result looks like and send it to your boss, so you can start with a check.',
      'Ask one question about the goal before you begin, so you know what to aim at.',
    ],
    watch: [
      'Notice how long you wait for instructions before you begin.',
      'Notice how much you can do before you need an answer.',
    ],
  }),
  idea('ftw_autonomy_l_08', ['autonomy:low'], {
    focus: [
      'When a friend or partner makes a decision for both of you, you tend to feel relieved.',
      'You usually feel glad when someone else picks the plan and you can join in.',
      'When you have too many choices, you tend to ask someone else to decide.',
    ],
    why: 'Letting others decide takes pressure off you, but over time your own wishes may not get a chance to be heard.',
    try: [
      'Pick one small decision this week and make it yourself, so you build the habit.',
      'Tell a friend your top choice before you ask what they think, so your view is in the mix.',
    ],
    watch: [
      'Notice which decisions you hand over and which you keep.',
      'Notice how it feels to decide something small on your own.',
    ],
  }),
  idea('ftw_autonomy_l_09', ['autonomy:low'], {
    focus: [
      'When you start at a new place, you tend to learn best by following someone who knows the ropes.',
      'You usually pick up a routine faster when someone shows you.',
      'When you join a team, you tend to watch how others do things before you start.',
    ],
    why: 'Learning from people who know saves you time, but you may need to step out on your own before you feel ready.',
    try: [
      'Ask your guide to watch you do one task on your own, so you get feedback while you try.',
      'Suggest one small change you noticed, so you start to add your own touch.',
    ],
    watch: [
      'Notice when you could try something before being shown.',
      'Notice how others react when you offer an idea.',
    ],
  }),
  idea('ftw_autonomy_l_10', ['autonomy:low'], {
    focus: [
      'When your manager checks in on your work, you tend to find it helpful.',
      'You usually like to know you’re on the right track from someone you trust.',
      'When a mentor gives direction, you tend to follow it closely.',
    ],
    why: 'Regular check-ins keep your work on course, but relying on them too much can leave you waiting when no one is around.',
    try: [
      'Write down one decision you can make without checking, so you start to trust your call.',
      'Ask your manager what you can decide on your own, so you know where the line is.',
    ],
    watch: [
      'Notice which decisions you check that you already know the answer to.',
      'Notice how your confidence changes when you make a call on your own.',
    ],
  }),
  idea('ftw_autonomy_l_11', ['autonomy:low'], {
    focus: [
      'When you plan something for yourself, you tend to ask what others would do first.',
      'You usually look for a model to follow before you make your own plan.',
      'When you set up a new routine, you tend to copy one that works for someone else.',
    ],
    why: 'Using proven examples saves you from guessing, but a routine that fits someone else may not fit you.',
    try: [
      'Change one part of a borrowed routine to suit you, so it becomes yours.',
      'Write what you like about the plan you copied, so you know what to keep.',
    ],
    watch: [
      'Notice which parts of a borrowed plan don’t fit you.',
      'Notice what you would choose with no example to follow.',
    ],
  }),
  idea('ftw_autonomy_l_12', ['autonomy:low'], {
    focus: [
      'When a group has a leader you trust, you tend to be happy to follow.',
      'You usually do well in a team where someone sets the direction.',
      'When someone else takes charge of a project, you tend to feel you can focus on your part.',
    ],
    why: 'Trusting a leader lets you focus on doing your part well, but a leader may want your ideas and not know you have them.',
    try: [
      'Share one idea with your leader this week, so they hear what you think.',
      'Offer to lead a small piece of the project, so you practice setting direction.',
    ],
    watch: [
      'Notice when you have a view you don’t share.',
      'Notice how your leader reacts when you offer one.',
    ],
  }),
];
