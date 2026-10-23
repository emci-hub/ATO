/** Sociability (extraversion): Outgoing (high) and Reserved (low). */
import { idea, type InsightIdea } from './define';

export const EXTRAVERSION_IDEAS: readonly InsightIdea[] = [
  idea('ftw_extraversion_h_01', ['extraversion:high'], {
    focus: [
      'After a long week, you tend to feel better by seeing friends rather than staying home.',
      'When you’re low on energy, being around people usually helps you more than being alone.',
      'You tend to recharge by making plans, even on days when others would want a quiet night.',
    ],
    why: 'Being around people gives you energy, but friends who need quiet nights might not keep up with your pace.',
    try: [
      'Text a friend to make a plan for this week, so you have something to look forward to.',
      'Ask a quieter friend what kind of hangout they’d enjoy, so you find a plan that works for both of you.',
    ],
    watch: [
      'Notice how your energy changes after a day with no plans.',
      'Notice when a friend says yes to plans but seems tired.',
    ],
  }),
  idea('ftw_extraversion_h_02', ['extraversion:high'], {
    focus: [
      'When something’s on your mind, you tend to talk it through with someone before you know what you think.',
      'You usually figure out how you feel by talking about it with a friend or partner.',
      'When you have a problem, you tend to call someone instead of thinking it over alone.',
    ],
    why: 'Talking out loud helps you sort your thoughts, but it can mean you share before you’ve decided what you want.',
    try: [
      'Before you call someone about a problem, write your own view in one line, so you start from it.',
      'Ask the friend you vent to if they have time first, so they can really listen.',
    ],
    watch: [
      'Notice whether you feel clearer after talking or just more wound up.',
      'Notice how often you ask friends to listen versus to help.',
    ],
  }),
  idea('ftw_extraversion_h_03', ['extraversion:high'], {
    focus: [
      'When a conversation goes quiet, you tend to jump in and fill the silence.',
      'You usually keep the conversation going in a group, especially when it starts to drag.',
      'In a quiet room, you tend to be the one who starts talking first.',
    ],
    why: 'Keeping conversations going helps people feel at ease, but quieter people might need a pause from you before they speak up.',
    try: [
      'Next time a group goes quiet, wait five seconds before you speak, so someone else gets a chance.',
      'Ask the quietest person in your next conversation a direct question, so they get space to talk.',
    ],
    watch: [
      'Notice when you fill a silence that someone else was about to fill.',
      'Notice who speaks up when you hold back.',
    ],
  }),
  idea('ftw_extraversion_h_04', ['extraversion:high'], {
    focus: [
      'When invites come in, you tend to say yes to most of them, even when your week is already full.',
      'You usually fill your calendar with plans and then find there’s no time left for yourself.',
      'When friends are going out, you tend to join even when you need rest.',
    ],
    why: 'You usually don’t want to miss time with people, but a full calendar can leave you tired for the plans that matter most.',
    try: [
      'Look at your week and pick one plan to skip, so you have a free night.',
      'Block off one evening as a night in, so your friends know you’re not free.',
    ],
    watch: [
      'Notice which plans you’re excited about and which you agreed to by default.',
      'Notice how you feel the day after a packed weekend.',
    ],
  }),
  idea('ftw_extraversion_h_05', ['extraversion:high'], {
    focus: [
      'When you meet someone new, you tend to make conversation easily and keep it going.',
      'At parties or new jobs, you usually find it easy to talk to people you don’t know.',
      'You tend to warm up to new people fast and like getting to know them.',
    ],
    why: 'Your ease with new people helps others relax, but people who warm up slowly might need more time before they open up.',
    try: [
      'Ask someone you met recently a follow-up question about something they said, so they know you listened.',
      'Introduce two people you know who should meet, so your ease with people helps someone else.',
    ],
    watch: [
      'Notice when someone gives short answers and might need a slower pace.',
      'Notice which new people you actually follow up with.',
    ],
  }),
  idea('ftw_extraversion_h_06', ['extraversion:high', 'playfulness:high'], {
    focus: [
      'In a group, you tend to bring the jokes and the energy that get everyone talking.',
      'When friends get together, you’re usually the one getting people laughing.',
      'You tend to make group hangouts more fun by joking around and keeping things moving.',
    ],
    why: 'Your humor and energy lift a room, but sometimes a friend might want to talk about something serious.',
    try: [
      'Next time you’re with a friend, ask how they’re really doing, so there’s room for more than jokes.',
      'Text a friend something that made you think of them, so you connect one-on-one too.',
    ],
    watch: [
      'Notice when a friend laughs along but seems quieter than usual.',
      'Notice what conversations you have when the jokes stop.',
    ],
  }),
  idea('ftw_extraversion_l_01', ['extraversion:low'], {
    focus: [
      'After a busy week, you tend to want a quiet night at home more than a night out.',
      'When your calendar gets full of social plans, you usually feel tired before the week is over.',
      'You tend to recharge best with time alone, especially after a lot of time around people.',
    ],
    why: 'Quiet time helps you reset, and protecting it means you show up as yourself when you do see people.',
    try: [
      'Block one evening this week for yourself, so you have time to recharge.',
      'Text a friend to suggest coffee for an hour, so you see them without draining yourself.',
    ],
    watch: [
      'Notice how many social plans you can do before you need a break.',
      'Notice the difference between needing quiet and avoiding something.',
    ],
  }),
  idea('ftw_extraversion_l_02', ['extraversion:low'], {
    focus: [
      'In meetings, you tend to have a good idea but wait so long that the moment passes.',
      'When a group is talking fast, you usually think of your point after the conversation moves on.',
      'You tend to think before you speak, so in busy group chats your reply can come late.',
    ],
    why: 'You think things through before you speak, which makes your points good, but fast groups rarely leave a gap for you.',
    try: [
      'Write one point down before your next meeting, so you can share it early.',
      'Send your idea to your boss or a coworker after the meeting, so it still gets heard.',
    ],
    watch: [
      'Notice when you hold back an idea that someone else says later.',
      'Notice which settings make it easier for you to speak up.',
    ],
  }),
  idea('ftw_extraversion_l_03', ['extraversion:low'], {
    focus: [
      'When someone calls you, you tend to let it ring and text back instead.',
      'You usually prefer texting over phone calls, even with close friends.',
      'When a call comes in unexpectedly, you tend to wait and reply by message.',
    ],
    why: 'Texting gives you time to think, but some friends or family might feel closer to you after a quick call.',
    try: [
      'Call one friend or family member for five minutes this week, so they hear your voice.',
      'Text a friend to set a time for a call, so it’s planned and easier for you.',
    ],
    watch: [
      'Notice how you feel after a call you didn’t want to take.',
      'Notice which people you’re happy to call and why.',
    ],
  }),
  idea('ftw_extraversion_l_04', ['extraversion:low'], {
    focus: [
      'At parties, you tend to find one person to talk to and stay with them most of the night.',
      'You usually prefer one long conversation with a friend over meeting lots of people.',
      'When you’re at a big event, you tend to look for a quiet corner or a familiar face.',
    ],
    why: 'One real conversation can mean more to you than a lot of small ones, and that’s a strength in close friendships.',
    try: [
      'Before your next event, decide when you’ll leave, so you can enjoy it without watching the clock.',
      'Pick one new person to say hi to at your next event, so you meet someone without forcing it.',
    ],
    watch: [
      'Notice which kinds of gatherings leave you tired and which leave you happy.',
      'Notice when you stay longer than you wanted to.',
    ],
  }),
  idea('ftw_extraversion_l_05', ['extraversion:low'], {
    focus: [
      'When you’re quiet in a group, people sometimes think you’re upset or not interested.',
      'You tend to be quiet around new people, and some of them read it as you not liking them.',
      'When you’re listening instead of talking, coworkers might think you’re checked out.',
    ],
    why: 'Your quiet is usually just you listening, but people who don’t know you yet can’t tell that from the outside.',
    try: [
      'Tell one coworker or new friend that you’re quiet at first, so they don’t take it personally.',
      'Send a short message after a hangout saying you had fun, so people know you enjoyed it.',
    ],
    watch: [
      'Notice when someone checks in on you because you’re quiet.',
      'Notice how you show people you like them without many words.',
    ],
  }),
  idea('ftw_extraversion_l_06', ['extraversion:low', 'relatedness:high'], {
    focus: [
      'You tend to need time alone, but you also miss your close friends when you don’t see them.',
      'You usually want quiet time and close friends, so big group plans can feel like the wrong fit.',
      'When you’ve been alone a while, you tend to want one real talk with someone close.',
    ],
    why: 'You need both space and connection, so small plans with close friends tend to give you the best of both.',
    try: [
      'Text one close friend to plan a quiet one-on-one, so you get connection without a crowd.',
      'Call someone you miss for ten minutes, so you stay close without a big plan.',
    ],
    watch: [
      'Notice when time alone starts to feel lonely instead of restful.',
      'Notice which friends you feel rested around.',
    ],
  }),
];
