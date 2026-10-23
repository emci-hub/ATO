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
      'Set a timer for your next review and send it when the timer ends, so you send it once it’s good enough.',
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
      'You usually keep your promises, even the ones you said yes to too fast.',
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
      'Take a five-minute walk after your next big task, so you have a moment to unwind.',
    ],
    watch: [
      'Notice when you’re worrying about work that’s already on track.',
      'Notice how you feel the day after a deadline passes.',
    ],
  }),
  idea('ftw_conscientiousness_l_01', ['conscientiousness:low'], {
    focus: [
      'Plans changing doesn’t bother you much, but chores and errands tend to pile up without a set time.',
      'You handle changing plans well, but small tasks can pile up when there’s no deadline.',
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
    why: 'Interest tends to drive you more than routine, so habits can stick when they stay a little fun.',
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
      'Notice what you were working on the last time a new idea pulled you away.',
      'Notice which unfinished things still matter to you.',
    ],
  }),
  idea('ftw_conscientiousness_h_07', ['conscientiousness:high'], {
    focus: [
      'Before a trip, you tend to pack early and double-check the list.',
      'You usually have your bag, tickets and plans sorted well before you leave.',
      'When you travel, you tend to prepare for problems that may never come.',
    ],
    why: 'Preparing well means fewer surprises, but extra planning can take time and energy that you might have enjoyed more.',
    try: [
      'Drop one item from your next packing list, so you practice trusting that you can buy it if needed.',
      'Set a time to stop packing and stick to it, so the prep doesn’t take over your evening.',
    ],
    watch: [
      'Notice which prep tasks you do for peace of mind and not because you need them.',
      'Notice how you feel once the bag is closed.',
    ],
  }),
  idea('ftw_conscientiousness_h_08', ['conscientiousness:high'], {
    focus: [
      'When you have a free hour, you tend to look for something useful to do with it.',
      'You usually find resting harder than finishing a task.',
      'On a day off, you tend to feel better after you’ve checked a few things off your list.',
    ],
    why: 'Getting things done feels good, but a rest that always has to be earned can leave you tired.',
    try: [
      'Pick one hour this weekend with no tasks in it, so you practice resting without a reason.',
      'Put one enjoyable thing on your list, so doing it counts as getting something done.',
    ],
    watch: [
      'Notice when you feel guilty about sitting still.',
      'Notice how you feel after a day with nothing on the list.',
    ],
  }),
  idea('ftw_conscientiousness_h_09', ['conscientiousness:high'], {
    focus: [
      'When a coworker hands in work late or half-done, you tend to feel it more than they do.',
      'You usually notice when someone else doesn’t follow through, and it bothers you.',
      'When a friend says they’ll do something and doesn’t, you tend to remember it.',
    ],
    why: 'Your own reliability makes it easy to notice gaps in others, but they may not know how much it matters to you.',
    try: [
      'Next time someone misses a deadline, ask what got in the way, so you understand before you decide how you feel.',
      'Tell a coworker or friend what you need from them and by when, so you aren’t relying on guesses.',
    ],
    watch: [
      'Notice when you take on someone else’s unfinished work without being asked.',
      'Notice how often your own standard is the one others are missing.',
    ],
  }),
  idea('ftw_conscientiousness_h_10', ['conscientiousness:high'], {
    focus: [
      'When you spend money, you tend to track it and know where it went.',
      'You usually keep an eye on your budget and notice small charges.',
      'When bills come due, you tend to pay them early so nothing slips.',
    ],
    why: 'Watching your money protects you from surprises, but checking it all the time can make small purchases feel heavy.',
    try: [
      'Set a small amount each month for spending without tracking, so some choices stay easy.',
      'Check your accounts on one set day each week, so you aren’t checking all week.',
    ],
    watch: [
      'Notice how you feel after a small, unplanned purchase.',
      'Notice how often you check your balance in a week.',
    ],
  }),
  idea('ftw_conscientiousness_h_11', ['conscientiousness:high'], {
    focus: [
      'When guests are coming over, you tend to clean and prepare more than anyone expects.',
      'You usually put in a lot of work before hosting, so the home is just right.',
      'Before friends visit, you tend to tidy up even when they say not to bother.',
    ],
    why: 'Your effort makes people feel welcome, but being worn out before they arrive can make it hard to enjoy the visit.',
    try: [
      'Pick two things to do before guests come and skip the rest, so you have energy left for them.',
      'Ask a friend to bring something next time you host, so you share the work.',
    ],
    watch: [
      'Notice whether guests care about the things you spend time on.',
      'Notice how much energy you have when they arrive.',
    ],
  }),
  idea('ftw_conscientiousness_h_12', ['conscientiousness:high'], {
    focus: [
      'When you start a task, you tend to want to finish it in one sitting.',
      'You usually find it hard to leave a project half-done at the end of the day.',
      'When you’re in the middle of something, you tend to keep going past the time you planned.',
    ],
    why: 'Finishing in one go keeps your work tidy, but staying late can cut into rest and time with other people.',
    try: [
      'Write the next step at the end of your workday, so stopping feels safe.',
      'Set an alarm for when you plan to stop, so the evening stays yours.',
    ],
    watch: [
      'Notice what time you actually stop on days you plan to stop early.',
      'Notice whether a half-done task looks worse at night than it does in the morning.',
    ],
  }),
  idea('ftw_conscientiousness_l_07', ['conscientiousness:low'], {
    focus: [
      'When a deadline is far away, you tend to put it off until the pressure builds.',
      'You usually do your best focus in the last stretch before something is due.',
      'When you have lots of time, you tend to leave the work until it gets close.',
    ],
    why: 'Pressure can help you focus, but starting late leaves no room for surprises and can feel stressful at the end.',
    try: [
      'Do the first ten minutes of a task today that’s due next week, so it already has a start.',
      'Put a smaller deadline on the calendar halfway to the real one, so the work spreads out.',
    ],
    watch: [
      'Notice how you feel in the day or two before a deadline.',
      'Notice what makes a task easier to start.',
    ],
  }),
  idea('ftw_conscientiousness_l_08', ['conscientiousness:low'], {
    focus: [
      'When you plan to meet someone, you tend to leave later than you meant to.',
      'You usually underestimate how long it takes to get ready or get there.',
      'When you set a time, you tend to arrive close to it or a few minutes after.',
    ],
    why: 'Fitting a lot into your day shows you enjoy it, but running late can make the people waiting feel less important.',
    try: [
      'Add ten minutes to how long you think it takes to get somewhere today, so you arrive on time.',
      'Text a friend when you leave, so they know when to expect you.',
    ],
    watch: [
      'Notice what you do in the last ten minutes before you leave.',
      'Notice how people react when you arrive a bit late.',
    ],
  }),
  idea('ftw_conscientiousness_l_09', ['conscientiousness:low'], {
    focus: [
      'When you finish eating or cooking, you tend to leave the dishes for later.',
      'You usually leave small chores undone until they start to bother you.',
      'When your space gets messy, you tend to clean it all at once instead of a little each day.',
    ],
    why: 'Leaving small jobs saves effort in the moment, but they can pile into one big job that feels harder for you to start.',
    try: [
      'Do one small chore right now, like a single plate or a drawer, so the pile stops growing.',
      'Do one chore during something you already do, like a call, so it gets done without extra effort.',
    ],
    watch: [
      'Notice which chores you leave first and why.',
      'Notice how you feel after you clear a small space.',
    ],
  }),
  idea('ftw_conscientiousness_l_10', ['conscientiousness:low'], {
    focus: [
      'When bills, appointments or forms need doing, you tend to wait until the last day.',
      'You usually leave boring paperwork until you have to deal with it.',
      'When a reminder pops up, you tend to dismiss it and plan to do it later.',
    ],
    why: 'Putting off boring tasks keeps your day lighter now, but missed dates can cost you money or time later.',
    try: [
      'Book one appointment or pay one bill right now, so it’s off your mind.',
      'Set a reminder for a time you’re free instead of during work, so you can act on it.',
    ],
    watch: [
      'Notice which tasks you dismiss the most.',
      'Notice how it feels when something small is finally done.',
    ],
  }),
  idea('ftw_conscientiousness_l_11', ['conscientiousness:low'], {
    focus: [
      'When someone asks you to follow a detailed process, you tend to skip steps that seem small.',
      'You usually get the main part right and miss the small details.',
      'When you fill out something long, you tend to rush the last part.',
    ],
    why: 'Moving fast gets the main work done, but small missed details can mean you go back to fix them later.',
    try: [
      'Before you hand something in, read it once more from the end, so you catch missed details.',
      'Ask a coworker to look over one piece of your work, so a second pair of eyes catches the little things.',
    ],
    watch: [
      'Notice which kinds of details you miss most often.',
      'Notice how much time you spend fixing small errors later.',
    ],
  }),
  idea('ftw_conscientiousness_l_12', ['conscientiousness:low'], {
    focus: [
      'When you make a promise to a friend, you mean it but might forget about it a week later.',
      'You usually say yes with good intentions, then lose track of the detail.',
      'When a friend asks for a favor, you tend to agree and then the day gets away from you.',
    ],
    why: 'Your yes is sincere, but forgetting can leave a friend feeling like it didn’t matter to you.',
    try: [
      'Put every yes in your phone with a date right away, so you don’t have to remember it.',
      'Text a friend a short update on something you promised, so they know you haven’t forgotten.',
    ],
    watch: [
      'Notice which promises you remember and which slip.',
      'Notice how a friend reacts when you follow up on something small.',
    ],
  }),
];
