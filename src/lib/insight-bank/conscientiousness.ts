/** Follow-through (conscientiousness): Structured (high) and Flexible (low). */
import { idea, type InsightIdea } from './define';

export const CONSCIENTIOUSNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_conscientiousness_h_01', ['conscientiousness:high'], {
    focus: [
      'The sink is empty and your laptop is usually still open on the couch past the time you meant to stop.',
      'A blank Saturday can start with your to-do list, and the couch waits until the last box is checked.',
      'Your laundry usually gets folded before you sit down, even when nothing on the list is due.',
    ],
    why: 'Checking off the list can settle the evening, but a rest on the couch starts to feel like something you have to earn.',
    try: [
      'Put a rest block on today’s calendar, so sitting on the couch counts as finished.',
      'Pick a clock time tonight to close the laptop, so you stop with boxes still open.',
    ],
    watch: [
      'Notice when you feel guilty on the couch with one chore still on the list.',
      'Notice how many of today’s boxes actually had to be done before dark.',
    ],
  }),
  idea('ftw_conscientiousness_h_02', ['conscientiousness:high'], {
    focus: [
      'A last-minute text that moves dinner can annoy you, even when the new restaurant is one you like.',
      'Your calendar still shows 7pm after a friend moves it, and the change can stick on the bus home.',
      'When Friday’s reservation slides, you sometimes stay irritated even though the new time works.',
    ],
    why: 'Lining the week up ahead helps you feel ready, so a sudden text can feel like the prep you did was wasted.',
    try: [
      'Next time a plan moves, list what is still the same, so the change looks smaller.',
      'Leave one evening this week empty on the calendar, so a change has room to land.',
    ],
    watch: [
      'Notice whether you are mad about the new restaurant or about the calendar change.',
      'Notice how fast you settle once you are sitting at the new plan.',
    ],
  }),
  idea('ftw_conscientiousness_h_03', ['conscientiousness:high'], {
    focus: [
      'In the work chat, you usually post the schedule before anyone else has typed a plan.',
      'The shared doc for a group project can sit empty until you fill in the dates yourself.',
      'On a friend trip, you sometimes end up holding the booking list because you want it done right.',
    ],
    why: 'Your dates keep the trip moving, but the group can start leaving every booking and time to you.',
    try: [
      'Ask one person to own the restaurant booking, so the plan is not all in your chat.',
      'Write down what you are handling for the group this week, so you can see if the load is fair.',
    ],
    watch: [
      'Notice when you grab a task in the chat before anyone else has replied.',
      'Notice whether the tiredness is from your own work or from everyone else’s list.',
    ],
  }),
  idea('ftw_conscientiousness_h_04', ['conscientiousness:high'], {
    focus: [
      'An email can sit in drafts while you reread it, even when the first version was already fine.',
      'Before a hand-in, you usually go over the same paragraph in the doc more than once.',
      'A text with your name on it sometimes gets one more comma fix right before you send it.',
    ],
    why: 'Care with the details makes the work strong, but that extra pass can eat time you wanted for something else.',
    try: [
      'Set a five-minute timer on the next review and send the email when it ends, so done is done.',
      'Before you send the next message, read it once and then send it, so you see it land fine.',
    ],
    watch: [
      'Notice when the edits stop changing what the other person will actually see.',
      'Notice how often anyone mentions the small detail you fixed.',
    ],
  }),
  idea('ftw_conscientiousness_h_05', ['conscientiousness:high'], {
    focus: [
      'A coworker asks for a favor in chat, you say yes, and the task usually stays on your list until it is done.',
      'A promise you made too fast on Tuesday can still own your Thursday night.',
      'When a friend needs a thing done, your name is usually the first one that comes up in the group chat.',
    ],
    why: 'People trust you because the thing actually gets done, and that trust can fill your week with their tasks.',
    try: [
      'Before you say yes to the next ask, wait an hour, so you can check your calendar first.',
      'List what you have promised people this week, so you can see what to hand back.',
    ],
    watch: [
      'Notice when you type yes in chat before you have opened your own calendar.',
      'Notice which promises you make because saying yes is the habit.',
    ],
  }),
  idea('ftw_conscientiousness_h_06', ['conscientiousness:high', 'steadiness:low'], {
    focus: [
      'The file is in on time, and you can still be awake at midnight thinking about the slide deck.',
      'You usually hit the deadline, and the worry about it can outlast the work itself.',
      'A week of due dates gets finished, while your shoulders can stay tight the whole time.',
    ],
    why: 'Caring is part of why the file goes in on time, but carrying that worry to the couch can leave you worn out.',
    try: [
      'Write tomorrow’s first task on a note before bed, so your mind does not hold the deck overnight.',
      'Take a five-minute walk after the next big send, so the day has a real stop.',
    ],
    watch: [
      'Notice when you are still worrying about a file that is already sent.',
      'Notice how your morning feels the day after a deadline passes.',
    ],
  }),
  idea('ftw_conscientiousness_l_01', ['conscientiousness:low'], {
    focus: [
      'A moved dinner barely registers for you, but your dry cleaning can sit by the door for days.',
      'You handle a shifted meeting fine, and small errands can wait when the calendar does not force them.',
      'With a blank Saturday, the pharmacy run usually waits until you are out of what you needed.',
    ],
    why: 'A flexible week handles a surprise well for you, but a chore with no time on your calendar can wait until it is stressful.',
    try: [
      'Pick one errand you have been skipping and do the first five minutes now, so it starts moving.',
      'Put the pharmacy and one other errand on the calendar this week, so they get a time.',
    ],
    watch: [
      'Notice which chores you keep sliding onto tomorrow’s list.',
      'Notice how the kitchen feels once a chore you put off is finally done.',
    ],
  }),
  idea('ftw_conscientiousness_l_02', ['conscientiousness:low'], {
    focus: [
      'When friends ask about Saturday in the chat, your reply is usually closer to the day than a yes.',
      'Your weekend plans usually get a real yes on Saturday morning, not when the group chat asks on Wednesday.',
      'A friend trying to book a table can get a maybe from you while the night stays open.',
    ],
    why: 'Leaving Saturday open lets you follow your mood, but a friend who books ahead can feel unsure you are coming.',
    try: [
      'Text one friend a clear yes or no about Saturday, so they can book the table.',
      'Pick one weekend plan now and leave the other nights open, so you get both.',
    ],
    watch: [
      'Notice when a friend asks twice in the chat about the same night.',
      'Notice whether an open Saturday feels free or like you are stuck.',
    ],
  }),
  idea('ftw_conscientiousness_l_03', ['conscientiousness:low'], {
    focus: [
      'Your desk looks messy to a roommate, and you can still pull the charger out of the pile.',
      'The kitchen counter can look chaotic, and you usually know which bag has the keys.',
      'Mail on your dresser sometimes sits there until someone else points at the pile.',
    ],
    why: 'A little mess does not slow you down, but it can stress a partner or roommate who shares the kitchen.',
    try: [
      'Spend ten minutes clearing one shared counter today, so the people you live with get a break.',
      'Pick one hook for your keys and wallet, so the morning search gets shorter.',
    ],
    watch: [
      'Notice when you spend a few minutes hunting for the keys you just had.',
      'Notice how the people you live with react to the shared counter.',
    ],
  }),
  idea('ftw_conscientiousness_l_04', ['conscientiousness:low'], {
    focus: [
      'A new morning alarm for a workout can go strong for a week, then you turn it off.',
      'You usually open a habit app at full speed, and the streak can fade after a few weeks.',
      'When the same run route gets dull, you sometimes drift off it without a big decision.',
    ],
    why: 'Interest pulls you more than a routine does, so a habit can stick when it stays a little fun.',
    try: [
      'Make today’s version five minutes instead of thirty, so it is easy to keep going.',
      'Change one thing about a habit that is fading, like the route or the playlist, so it feels new enough.',
    ],
    watch: [
      'Notice the morning a habit starts to feel like a chore on the list.',
      'Notice which habits you kept and what was different about them.',
    ],
  }),
  idea('ftw_conscientiousness_l_05', ['conscientiousness:low'], {
    focus: [
      'A long text from a friend can sit opened while you wait for the right reply.',
      'You usually mean to answer, and the message that needs a real thought can stay unanswered.',
      'A voice note that needs a careful reply can slip past the evening you meant to send one.',
    ],
    why: 'You want the reply to be a good one, but waiting for the perfect moment can leave a friend wondering if you saw the text.',
    try: [
      'Reply to one waiting text now with two honest lines, so the friend knows you saw it.',
      'Set a reminder for the texts you want to answer properly, so they do not slip past the day.',
    ],
    watch: [
      'Notice how many chats you have opened and not answered.',
      'Notice whether a short reply would have been enough for that text.',
    ],
  }),
  idea('ftw_conscientiousness_l_06', ['conscientiousness:low', 'openness:high'], {
    focus: [
      'A new idea in your notes can pull you off the half-finished project sitting on the desk.',
      'When a fresh plan shows up, you usually leave the open tab and start the new one.',
      'Your list sometimes holds more new starts than finished projects, because another idea keeps arriving.',
    ],
    why: 'Following a new idea keeps the week interesting, but the project you care about most can need you to stay with it longer.',
    try: [
      'Write the new idea in a note instead of opening it, so you can finish the one on the desk first.',
      'Pick the unfinished project you would be proudest to close and work on it for ten minutes.',
    ],
    watch: [
      'Notice what was open on the desk the last time a new idea pulled you away.',
      'Notice which unfinished projects you still care about.',
    ],
  }),
];
