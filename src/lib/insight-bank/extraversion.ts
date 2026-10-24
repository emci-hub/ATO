/** Sociability (extraversion): Outgoing (high) and Reserved (low). */
import { idea, type InsightIdea } from './define';

export const EXTRAVERSION_IDEAS: readonly InsightIdea[] = [
  idea('ftw_extraversion_h_01', ['extraversion:high'], {
    focus: [
      'After a long week, a plan with a friend usually lifts you more than a quiet night on the couch.',
      'On a quiet evening, the group chat can give you more of a lift than staying in with a show.',
      'You sometimes make a plan for tonight even when the people around you want the couch.',
    ],
    why: 'Being around people can fill you back up, but a friend who needs a quiet night might not keep your pace.',
    try: [
      'Text a friend to lock one plan this week, so you have a night to look forward to.',
      'Ask a quieter friend what hangout they would actually enjoy, so the plan works for both of you.',
    ],
    watch: [
      'Notice how you feel after a day with nothing on the calendar.',
      'Notice when a friend says yes to the plan and still looks tired.',
    ],
  }),
  idea('ftw_extraversion_h_02', ['extraversion:high'], {
    focus: [
      'With something on your mind, you usually call a friend before you know what you think.',
      'A problem at work can stay unclear until you talk it through out loud with your partner.',
      'You sometimes hit call on a hard day instead of sitting with it alone on the bus.',
    ],
    why: 'Saying it out loud can sort your thoughts, but you can share the story before you have decided what you want.',
    try: [
      'Before you call someone about a problem, write your view in one line in your notes, so the call starts from you.',
      'Ask the friend you talk to if they have a few minutes, so they can actually listen.',
    ],
    watch: [
      'Notice whether you feel clearer after the call or just more wound up.',
      'Notice how often you ask a friend to listen, and how often you ask them to fix it.',
    ],
  }),
  idea('ftw_extraversion_h_03', ['extraversion:high'], {
    focus: [
      'When the group chat goes quiet, you usually type something before the pause has a chance.',
      'In a meeting, you can be the person who talks first once the room goes still.',
      'A lull at dinner sometimes gets filled by you before the quiet person has started a sentence.',
    ],
    why: 'Keeping the talk going can help people around you relax, but a quieter friend might need that pause from you.',
    try: [
      'Next time the group goes quiet, wait five seconds before you speak, so someone else can start.',
      'Ask the quietest person at the table a direct question, so they get a turn.',
    ],
    watch: [
      'Notice when you fill a silence that someone else was about to use.',
      'Notice who speaks once you hold the next sentence.',
    ],
  }),
  idea('ftw_extraversion_h_04', ['extraversion:high'], {
    focus: [
      'Invites can get a yes from you even when the calendar for that week is already full.',
      'Your week usually fills with plans, and then no evening is left that is just yours.',
      'When friends are going out, you sometimes join even on a night you needed the couch.',
    ],
    why: 'Missing time with people usually bothers you, but a full calendar can leave you tired for the plan that matters.',
    try: [
      'Look at the week and pick one plan to skip, so one night stays free.',
      'Block one evening as a night in, so friends can see you are not free.',
    ],
    watch: [
      'Notice which plans you are excited about and which you accepted by default.',
      'Notice how Monday feels after a packed weekend.',
    ],
  }),
  idea('ftw_extraversion_h_05', ['extraversion:high'], {
    focus: [
      'At a new job, you can start a conversation with someone you do not know and keep it going.',
      'A party usually has you talking with new people before you have found your friends.',
      'You sometimes warm up to a new person fast and like hearing how their week went.',
    ],
    why: 'Your ease with new people can help them relax, but someone who warms up slowly might need more time before they open up.',
    try: [
      'Ask someone you met recently about a thing they mentioned, so they know you listened.',
      'Introduce two people you know who should meet, so that ease helps someone else.',
    ],
    watch: [
      'Notice when someone gives short answers and might want a slower pace.',
      'Notice which new people you actually text after the night.',
    ],
  }),
  idea('ftw_extraversion_h_06', ['extraversion:high', 'playfulness:high'], {
    focus: [
      'In a group, you usually bring the joke that gets the table talking.',
      'When friends get together, you can be the one pulling a laugh out of a flat moment.',
      'A hangout sometimes gets its pace from you joking and keeping the night moving.',
    ],
    why: 'Your jokes can lift the room, but a friend might want a serious minute that stays serious.',
    try: [
      'Next time you are with a friend, ask how they are really doing, so there is room past the jokes.',
      'Text a friend one thing that made you think of them, so it is not only the group chat.',
    ],
    watch: [
      'Notice when a friend laughs along and still seems quieter than usual.',
      'Notice what the talk becomes once the jokes stop.',
    ],
  }),
  idea('ftw_extraversion_l_01', ['extraversion:low'], {
    focus: [
      'You recharge with time to yourself, especially after a stretch around other people.',
      'Time to yourself is how you come back after being around other people.',
      'A stretch around other people can leave you wanting time to yourself afterward.',
    ],
    why: 'You use that time alone so you can show up for the next plan. Without it, the next one can feel like too much.',
    try: [
      'Next time the week fills up, keep one evening for yourself.',
      'Before you add another plan, leave one block of time that is just yours.',
    ],
    watch: [
      'Notice when you need time to yourself before you say yes to another plan.',
      'Notice the difference between wanting time to yourself and avoiding one particular plan.',
    ],
  }),
  idea('ftw_extraversion_l_02', ['extraversion:low'], {
    focus: [
      'In a meeting, you can have a good point and wait until the moment has already passed.',
      'When the group talks fast, your reply usually arrives in your head after the topic has moved.',
      'In a busy work chat, you sometimes think first, so your message lands after the thread has moved on.',
    ],
    why: 'You think the point through before you say it, which makes it a good one, but a fast meeting rarely leaves you a gap.',
    try: [
      'Write one point down before the next meeting, so you can say it early.',
      'Send your idea in the work chat after the meeting, so it still gets heard.',
    ],
    watch: [
      'Notice when you hold a point that someone else says later.',
      'Notice which rooms make it easier for you to speak.',
    ],
  }),
  idea('ftw_extraversion_l_03', ['extraversion:low'], {
    focus: [
      'A ringing phone usually gets a text back from you instead of you picking up.',
      'Even with a close friend, you can prefer the chat thread to a phone call.',
      'An unexpected call sometimes waits while you reply in a message once it stops ringing.',
    ],
    why: 'A text gives you time to think, but a friend or your family might feel closer after a short call.',
    try: [
      'Call one friend or family member for five minutes this week, so they hear your voice instead of a text.',
      'Text a friend to set a time for a call, so it is planned and easier for you.',
    ],
    watch: [
      'Notice how you feel after a call you did not want to take.',
      'Notice which people you are happy to call and why.',
    ],
  }),
  idea('ftw_extraversion_l_04', ['extraversion:low'], {
    focus: [
      'At a party, you usually find one person and stay in that conversation most of the night.',
      'One long talk with a friend can matter more to you than meeting a room of new people.',
      'At a big event, you sometimes look for a quiet corner or a face you already know.',
    ],
    why: 'One real conversation can mean more to you than a lot of small ones, and that is a strength in a close friendship.',
    try: [
      'Before the next event, decide when you will leave, so you can enjoy it without watching the clock.',
      'Pick one new person to say hi to at the next event, so you meet someone and can still leave on time.',
    ],
    watch: [
      'Notice which gatherings leave you tired and which leave you glad you went.',
      'Notice when you stay later than the time you picked.',
    ],
  }),
  idea('ftw_extraversion_l_05', ['extraversion:low'], {
    focus: [
      'When you are quiet in a group, people can think you are upset or not interested.',
      'Around new people you usually stay quiet, and some of them read that as you not liking them.',
      'In a meeting, listening instead of talking can look to coworkers like you stopped following.',
    ],
    why: 'Your quiet is usually just you listening, but people who do not know you yet cannot tell that from the outside.',
    try: [
      'Tell one coworker or new friend that you are quiet at first, so they do not take the silence personally.',
      'Send a short message after a hangout saying you had a good time, so people know you enjoyed it.',
    ],
    watch: [
      'Notice when someone checks on you because you have been quiet.',
      'Notice how you show a friend you like them when you barely talk.',
    ],
  }),
  idea('ftw_extraversion_l_06', ['extraversion:low', 'relatedness:high'], {
    focus: [
      'You can want the evening alone and still miss a close friend when the week has no plan with them.',
      'A big group plan sometimes feels like the wrong shape, because you want quiet and one real person.',
      'After a stretch alone, you usually want one real talk with someone close, not a crowded night.',
    ],
    why: 'You need both a quiet night and a close friend, so a small plan with one person can give you both.',
    try: [
      'Text one close friend to plan a quiet one-on-one, so you get company without a crowd.',
      'Call someone you miss for ten minutes tonight, so you stay close without booking a big night.',
    ],
    watch: [
      'Notice when an evening alone starts to feel lonely instead of restful.',
      'Notice which friends leave you rested after the hangout.',
    ],
  }),
];
