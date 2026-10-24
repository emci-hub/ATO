/** Sociability (extraversion): Outgoing (high) and Reserved (low). */
import { idea, type InsightIdea } from './define';

export const EXTRAVERSION_IDEAS: readonly InsightIdea[] = [
  idea("ftw_extraversion_h_01", ["extraversion:high"], {
    focus: [
      "Your answers suggest you look for time with other people.",
      "From your answers, you look for time with other people.",
      "The pattern in your answers is that you look for time with other people.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_02", ["extraversion:high"], {
    focus: [
      "The catch in your answers is a week with no time left to come back.",
      "What this can cost you is a week with no time left to come back.",
      "A cost worth naming for you is a week with no time left to come back.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_03", ["extraversion:high"], {
    focus: [
      "Someone else might notice that you pick time with other people over a quiet evening.",
      "From the outside, you pick time with other people over a quiet evening.",
      "Other people can see that you pick time with other people over a quiet evening.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_04", ["extraversion:high"], {
    focus: [
      "What you might miss is time to yourself after a full week.",
      "Your answers leave room to miss time to yourself after a full week.",
      "A thing you might skip is time to yourself after a full week.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_05", ["extraversion:high"], {
    focus: [
      "The helpful side for you shows up when company is what the day needs.",
      "Your answers also show a use when company is what the day needs.",
      "There is a use for you when company is what the day needs.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_h_06", ["extraversion:high", "playfulness:high"], {
    focus: [
      "Your answers suggest two things at once: you want people around, and you turn it into play.",
      "Both can be true for you in the same week: you want people around, and you turn it into play.",
      "In the same week, you want people around, and you turn it into play.",
    ],
    why: "The upside for you is company. The catch is a week with no time left to come back.",
    try: [
      "Next time you choose, name whether the week still has time to yourself first.",
      "Before you decide, check whether you want the plan or just the company.",
    ],
    watch: [
      "Notice when the week fills up and you have no time left.",
      "Notice if you wanted the quiet evening instead.",
    ],
  }),
  idea("ftw_extraversion_l_01", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself.",
      "From your answers, you recharge with time to yourself.",
      "The pattern in your answers is that you recharge with time to yourself.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_02", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself, and the next plan can feel like too much.",
      "What this can cost you is a next plan that feels like too much.",
      "A cost worth naming for you is a next plan that feels like too much.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_03", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself after time around other people.",
      "From the outside, you recharge with time to yourself after time with other people.",
      "Other people can see that you recharge with time to yourself after time with other people.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_04", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself, so a plan you like can still wait.",
      "Your answers leave room to miss a plan you would have enjoyed.",
      "A thing you might skip is a plan you would have enjoyed.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_05", ["extraversion:low"], {
    focus: [
      "You recharge with time to yourself before you add another plan.",
      "Your answers also show a use when you need time to yourself before the next plan.",
      "There is a use for you when you need time to yourself before the next plan.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea("ftw_extraversion_l_06", ["extraversion:low", "relatedness:high"], {
    focus: [
      "You recharge with time to yourself, and you need a real tie.",
      "Both can be true for you in the same week: you recharge with time to yourself, and you need a real tie.",
      "In the same week, you recharge with time to yourself, and you need a real tie.",
    ],
    why: "The upside for you is time to come back. The catch is a next plan that feels like too much.",
    try: [
      "Next time you choose, name one block that is just yours first.",
      "Before you decide, check whether the next plan leaves you time to yourself.",
    ],
    watch: [
      "Notice when the next plan feels like too much.",
      "Notice if you skipped a plan you would have liked.",
    ],
  }),
  idea('ftw_extraversion_h_07', ['extraversion:high'], {
    focus: [
      'When you work alone for a long stretch, you tend to feel worn out.',
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
      'Notice how you feel after an hour of quiet work.',
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
      'When you tell a story, you tend to add detail and pace so it lands well.',
      'You usually hold the room when you talk, and others tend to listen.',
      'In a group, you tend to talk a lot more than the quieter people there.',
    ],
    why: 'The way you tell it makes conversations lively, but quieter people might not get a chance to share what they think.',
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
      'At work, you tend to save your attention for the conversations that matter most.',
    ],
    why: 'Saving your attention lets you do better at the big conversations, but coworkers might see short hellos as distance.',
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
      'Notice how many people are around when you start to feel worn out.',
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
