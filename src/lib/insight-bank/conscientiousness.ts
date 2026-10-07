/** Follow-through (conscientiousness): Structured (high) and Flexible (low). */
import { idea, type InsightIdea } from './define';

export const CONSCIENTIOUSNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_conscientiousness_h_01', ['conscientiousness:high'], {
    focus: [
      'You tend to keep working through your to-do list even when you’re tired and could stop.',
      'When there’s still something on your list, you usually find it hard to relax.',
      'You tend to feel restless on a day off if a few tasks are still unfinished.',
    ],
    why: 'Finishing things gives you a sense of control, but rest can start to feel like something you have to earn.',
    try: [
      'Put one thing on today’s list that’s just for rest, so taking a break counts as getting something done.',
      'Pick a time tonight to stop working, so the list doesn’t decide when your day ends.',
    ],
    watch: [
      'Notice when you feel guilty for resting with tasks still left.',
      'Notice how much of your list actually had to be done today.',
    ],
  }),
  idea('ftw_conscientiousness_h_02', ['conscientiousness:high'], {
    focus: [
      'When plans change last minute, you tend to feel thrown off even if the new plan is fine.',
      'You usually find it hard when a friend changes plans you already had in your calendar.',
      'When a set plan falls through, you tend to feel annoyed for longer than you’d expect.',
    ],
    why: 'Planning ahead helps you feel ready, so a sudden change can feel like losing the time you spent getting ready.',
    try: [
      'Next time plans change, take a minute to list what’s still the same, so the change feels smaller.',
      'Leave one evening this week with no plan at all, so you can practice going with it.',
    ],
    watch: [
      'Notice whether you’re upset about the new plan or about the change itself.',
      'Notice how quickly you settle once the new plan starts.',
    ],
  }),
  idea('ftw_conscientiousness_h_03', ['conscientiousness:high'], {
    focus: [
      'In group projects, you tend to take over the organizing because you want it done right.',
      'When coworkers are slow to plan, you usually step in and make the schedule yourself.',
      'You tend to end up as the planner in any group because you care about getting it done.',
    ],
    why: 'Your planning keeps things on track, but people can start relying on you for all of it without noticing the extra work.',
    try: [
      'Ask one person in your group to own a part of the plan, so it isn’t all on you.',
      'Write down what you’re doing for the group this week, so you can see if the load is fair.',
    ],
    watch: [
      'Notice when you take on a task before anyone else has a chance to.',
      'Notice whether you’re tired from your own work or from everyone else’s.',
    ],
  }),
  idea('ftw_conscientiousness_h_04', ['conscientiousness:high'], {
    focus: [
      'You tend to check your work a few extra times before you send it, even when it’s already good.',
      'Before you send an email or hand something in, you usually go over it more than once.',
      'When something has your name on it, you tend to keep fixing small details.',
    ],
    why: 'Caring about details makes your work strong, but extra checking can take time you’d rather spend elsewhere.',
    try: [
      'Set a timer for your next review and send it when the timer ends, so good enough gets out the door.',
      'Before you send your next message, read it once and then hit send, so you can see it go fine.',
    ],
    watch: [
      'Notice when the changes you’re making stop making a real difference.',
      'Notice how often someone else even sees the details you fixed.',
    ],
  }),
  idea('ftw_conscientiousness_h_05', ['conscientiousness:high'], {
    focus: [
      'When someone asks you for help, you tend to say yes because you know you’ll follow through.',
      'You usually keep every promise you make, even the ones you said yes to too fast.',
      'When a friend or coworker needs something done, you’re often the one they ask first.',
    ],
    why: 'People trust you because you deliver, and that trust can quietly fill your week with other people’s tasks.',
    try: [
      'Before you say yes to the next request, wait an hour, so you can check if you have room.',
      'List what you’ve promised people this week, so you can see if anything should be handed back.',
    ],
    watch: [
      'Notice when you say yes before you’ve checked your own plans.',
      'Notice which promises you make out of habit.',
    ],
  }),
  idea('ftw_conscientiousness_h_06', ['conscientiousness:high', 'steadiness:low'], {
    focus: [
      'When a deadline gets close, you tend to stay on top of it, but the stress can keep you up at night.',
      'You usually meet your deadlines, but you tend to worry about them more than the work needs.',
      'When you have a lot due, you tend to get it all done while feeling tense the whole time.',
    ],
    why: 'Caring a lot is part of why you finish things, but carrying that worry home can wear you down.',
    try: [
      'Write tomorrow’s first task down before bed, so your mind doesn’t have to hold it overnight.',
      'Take a five-minute walk after your next big task, so the tension has somewhere to go.',
    ],
    watch: [
      'Notice when you’re worrying about work that’s already on track.',
      'Notice how you feel the day after a deadline passes.',
    ],
  }),
  idea('ftw_conscientiousness_l_01', ['conscientiousness:low'], {
    focus: [
      'Plans changing doesn’t bother you much, but chores and errands tend to pile up without a set time.',
      'You adapt to new plans easily, but small tasks tend to stack up when there’s no deadline.',
      'When nothing’s on the calendar, you tend to let small tasks wait until they become urgent.',
    ],
    why: 'Being flexible helps you handle surprises, but tasks without a deadline can end up waiting until they’re stressful.',
    try: [
      'Pick one small task you’ve been putting off and do the first five minutes now, so it starts moving.',
      'Put two errands on your calendar for this week, so they get a time instead of waiting.',
    ],
    watch: [
      'Notice which tasks you keep moving to tomorrow.',
      'Notice how you feel once a small task you put off is finally done.',
    ],
  }),
  idea('ftw_conscientiousness_l_02', ['conscientiousness:low'], {
    focus: [
      'When friends ask what you want to do this weekend, you tend to say you’ll decide closer to the day.',
      'You usually prefer to make weekend plans the day of, instead of locking them in early.',
      'When someone wants to plan ahead with you, you tend to keep your answer open as long as you can.',
    ],
    why: 'Keeping plans open lets you follow your mood, but friends who plan ahead might feel unsure if you’re coming.',
    try: [
      'Text one friend a clear yes or no about a plan this week, so they can plan around you.',
      'Pick one plan for the weekend now and keep the rest open, so you get both.',
    ],
    watch: [
      'Notice when a friend asks twice about the same plan.',
      'Notice whether keeping things open makes you feel free or stuck.',
    ],
  }),
  idea('ftw_conscientiousness_l_03', ['conscientiousness:low'], {
    focus: [
      'You tend to know where things are in your own mess, even when it looks like chaos to others.',
      'Your space usually looks messy to others, but you tend to find what you need fine.',
      'When your room or desk gets cluttered, you tend not to notice until someone points it out.',
    ],
    why: 'A little mess doesn’t slow you down, but it can stress out a partner or roommate who shares the space with you.',
    try: [
      'Spend ten minutes clearing one shared spot today, so the people you live with get a break.',
      'Pick one place for your keys and wallet, so your mornings go smoother.',
    ],
    watch: [
      'Notice when you spend time looking for something you just had.',
      'Notice how the people you live with react to shared spaces.',
    ],
  }),
  idea('ftw_conscientiousness_l_04', ['conscientiousness:low'], {
    focus: [
      'When you start a new habit, you tend to go strong for a week and then let it slide.',
      'You usually begin new routines with a lot of energy, but they tend to fade after a few weeks.',
      'When a new workout or habit gets repetitive, you tend to drift away from it.',
    ],
    why: 'You’re driven by interest more than routine, so habits tend to stick when they stay a little fun for you.',
    try: [
      'Make your habit smaller today, like five minutes instead of thirty, so it’s easy to keep going.',
      'Change one thing about a habit that’s fading, so it feels new enough to continue.',
    ],
    watch: [
      'Notice the day a habit starts to feel like a chore.',
      'Notice which habits you’ve kept and what made them different.',
    ],
  }),
  idea('ftw_conscientiousness_l_05', ['conscientiousness:low'], {
    focus: [
      'When a text needs a real answer, you tend to leave it for later and then forget it.',
      'You usually mean to reply to messages, but the ones that need thought tend to sit unanswered.',
      'When friends send long messages, you tend to wait for the right moment to reply, and it slips.',
    ],
    why: 'You want to give a good answer, but waiting for the perfect time can leave friends wondering if you saw it.',
    try: [
      'Reply to one waiting message now with a short note, so the friend knows you saw it.',
      'Set a reminder for the texts you want to answer properly, so they don’t slip away.',
    ],
    watch: [
      'Notice how many messages you’ve opened but not answered.',
      'Notice whether a short reply would have been enough.',
    ],
  }),
  idea('ftw_conscientiousness_l_06', ['conscientiousness:low', 'openness:high'], {
    focus: [
      'You tend to jump from idea to idea, so lots of things get started and fewer get finished.',
      'When a new idea grabs you, you usually drop what you were doing and chase it.',
      'You tend to have more exciting plans than finished ones, because new ideas keep showing up.',
    ],
    why: 'Following new ideas keeps your life interesting, but the things you care about most might need you to stay with them longer.',
    try: [
      'Write new ideas in a note instead of starting them, so you can finish one thing first.',
      'Pick the one unfinished project you’d be proudest to complete and work on it for ten minutes.',
    ],
    watch: [
      'Notice when a new idea shows up right as the current one gets hard.',
      'Notice which unfinished things still matter to you.',
    ],
  }),
];
