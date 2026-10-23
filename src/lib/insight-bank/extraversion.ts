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
  idea('ftw_extraversion_h_07', ['extraversion:high'], {
    focus: [
      'When you work alone for a long stretch, you tend to feel your energy drop.',
      'You usually do your best work with other people around, even if you’re not talking.',
      'After a full day at home alone, you tend to feel restless and want to see someone.',
    ],
    why: 'Having people around keeps you going, but some tasks need quiet time that you might avoid without noticing.',
    try: [
      'Plan a quiet hour for focused work, then time with people after it, so you have something to look forward to.',
      'Go work from a café or call a friend on a break, so alone time doesn’t drain you.',
    ],
    watch: [
      'Notice how long you can focus alone before you reach for your phone.',
      'Notice what your energy is like after an hour of quiet work.',
    ],
  }),
  idea('ftw_extraversion_h_08', ['extraversion:high'], {
    focus: [
      'When a group chat is active, you tend to reply quickly and often.',
      'You usually have lots to say in group chats, and silence there bothers you a little.',
      'When friends text, you tend to answer within minutes and expect the same back.',
    ],
    why: 'Fast replies keep you close to friends, but others may answer on their own schedule and not mean anything by it.',
    try: [
      'Next time a friend takes a day to reply, wait before assuming anything, so you give them room.',
      'Mute one busy chat for an afternoon, so you can focus without missing anything important.',
    ],
    watch: [
      'Notice how you feel when a chat goes quiet.',
      'Notice how many times you check a chat in an hour.',
    ],
  }),
  idea('ftw_extraversion_h_09', ['extraversion:high'], {
    focus: [
      'When you’re at an event, you tend to be one of the last to leave.',
      'You usually don’t want a good night out to end, even when it’s getting late.',
      'When friends start heading home, you tend to suggest one more stop.',
    ],
    why: 'Keeping a good night going makes memories, but the next morning can feel harder if you stay out longer than you planned.',
    try: [
      'Pick a time to leave before you go out, so the night ends on your terms.',
      'Plan something you enjoy the next morning, so heading home earlier feels like a trade.',
    ],
    watch: [
      'Notice how you feel the morning after a late night.',
      'Notice whether the last hour of the night is as fun as the first.',
    ],
  }),
  idea('ftw_extraversion_h_10', ['extraversion:high'], {
    focus: [
      'When you meet people from different parts of your life, you tend to connect them to each other.',
      'You usually introduce friends who haven’t met and like seeing them get along.',
      'When someone is new to a group, you tend to make sure they feel included.',
    ],
    why: 'Bringing people together makes your circle warmer, but you can end up planning for everyone and forget what you want.',
    try: [
      'Ask a friend to organize the next get-together, so you get to show up and enjoy it.',
      'Tell one friend what you’d like to do this month, so your own plans get a turn.',
    ],
    watch: [
      'Notice how often you plan things for others.',
      'Notice whether people reach out to you or you reach out first.',
    ],
  }),
  idea('ftw_extraversion_h_11', ['extraversion:high'], {
    focus: [
      'When you tell a story, you tend to add detail and energy so it lands well.',
      'You usually hold the room when you talk, and others tend to listen.',
      'In a group, you tend to talk a lot more than the quieter people there.',
    ],
    why: 'Your energy makes conversations lively, but quieter people might not get a chance to share what they think.',
    try: [
      'Ask one quieter person in the group a direct question, so they have a way into the talk.',
      'Wait three seconds after you finish a story, so others can jump in.',
    ],
    watch: [
      'Notice who in the group hasn’t spoken yet.',
      'Notice how you feel when someone else takes the lead.',
    ],
  }),
  idea('ftw_extraversion_h_12', ['extraversion:high'], {
    focus: [
      'When you’re stressed, you tend to call or visit someone instead of working it out alone.',
      'You usually feel better after talking a hard day out loud with another person.',
      'When something goes wrong, you tend to tell a friend right away.',
    ],
    why: 'Talking things out helps you feel lighter, but friends are not always free, and some problems need quiet thinking too.',
    try: [
      'Write down what’s bothering you before you call, so you know what you want to say.',
      'Ask a friend if it’s a good time before you vent, so they can give you their full attention.',
    ],
    watch: [
      'Notice how you feel after ten quiet minutes alone with the problem.',
      'Notice which friends are good at listening when you’re upset.',
    ],
  }),
  idea('ftw_extraversion_l_07', ['extraversion:low'], {
    focus: [
      'When coworkers chat in the hall, you tend to say a short hello and keep walking.',
      'You usually find small talk with people you don’t know well tiring.',
      'At work, you tend to save your energy for the conversations that matter most.',
    ],
    why: 'Saving your energy lets you do better at the big conversations, but coworkers might see short hellos as distance.',
    try: [
      'Ask one coworker one friendly question this week, so they see you’re approachable.',
      'Pick one short chat a day to stay in a minute longer, so small talk adds up to a connection.',
    ],
    watch: [
      'Notice which small talk feels easy and which feels like effort.',
      'Notice how coworkers respond when you stay for a minute longer.',
    ],
  }),
  idea('ftw_extraversion_l_08', ['extraversion:low'], {
    focus: [
      'When you’re in a big, loud group, you tend to get tired faster than the people around you.',
      'You usually do better in a small group than in a crowd.',
      'At a busy event, you tend to look for a quiet corner or a break outside.',
    ],
    why: 'Smaller settings let you be at your best, but staying away from big events can mean missing people you care about.',
    try: [
      'Go to a big event early, when it’s quiet, so you meet people before the crowd.',
      'Plan a short break outside during the event, so you can stay longer.',
    ],
    watch: [
      'Notice how many people are around when your energy starts to drop.',
      'Notice whether you feel better after a short break.',
    ],
  }),
  idea('ftw_extraversion_l_09', ['extraversion:low'], {
    focus: [
      'After a social event, you tend to need time alone before you feel like yourself again.',
      'You usually need a quiet evening after a full weekend with people.',
      'When your calendar gets full of plans, you tend to feel worn out even if the plans were fun.',
    ],
    why: 'Time alone is how you recharge, but friends may take a quick exit or a slow reply as a sign you didn’t enjoy yourself.',
    try: [
      'Tell a friend you had a good time before you head home, so they know you enjoyed it.',
      'Leave one evening a week with no plans, so you have time to recover.',
    ],
    watch: [
      'Notice how many plans in a row it takes before you feel drained.',
      'Notice what you do to recharge and how long it takes.',
    ],
  }),
  idea('ftw_extraversion_l_10', ['extraversion:low'], {
    focus: [
      'When you have something to say, you tend to think it through before you speak.',
      'You usually prefer to send a message once you’ve thought about it than answer on the spot.',
      'In a quick back-and-forth, you tend to have your best answer a few minutes too late.',
    ],
    why: 'Thinking first makes your words clear, but in fast talks people may not wait for what you would have said.',
    try: [
      'Tell people “let me think about that” in a meeting, so you get time without going quiet.',
      'Send a follow-up message with your full thought after a talk, so your idea is heard.',
    ],
    watch: [
      'Notice when you have an answer ready just after the moment has passed.',
      'Notice which people give you time to think.',
    ],
  }),
  idea('ftw_extraversion_l_11', ['extraversion:low'], {
    focus: [
      'When it’s your birthday or you’re the center of attention, you tend to feel a little uncomfortable.',
      'You usually prefer a small dinner with a few people to a big party in your honor.',
      'When people make a fuss over you, you tend to wish it were over sooner.',
    ],
    why: 'A quieter celebration fits how you feel, but friends who plan something big are usually trying to show they care.',
    try: [
      'Tell a friend what kind of celebration you’d enjoy, so they can plan around it.',
      'When someone makes a fuss, say thank you before you change the subject, so they know it landed.',
    ],
    watch: [
      'Notice what part of being the center of attention feels hardest.',
      'Notice how friends react when you tell them what you’d like.',
    ],
  }),
  idea('ftw_extraversion_l_12', ['extraversion:low'], {
    focus: [
      'When you talk with one person at a time, you tend to go deeper than you do in a group.',
      'You usually open up more in a one-on-one chat than at a big gathering.',
      'With a close friend, you tend to have long, honest conversations.',
    ],
    why: 'Deep one-on-one talks build strong friendships, but friends you only see in groups might not get to know you.',
    try: [
      'Invite one person from a group you like to coffee, so you can talk the way you prefer.',
      'Send a friend one honest sentence about how you’ve been, so they get a glimpse of what you share one-on-one.',
    ],
    watch: [
      'Notice which friends you only see in groups.',
      'Notice how you feel after a one-on-one conversation compared with a group night.',
    ],
  }),
];
