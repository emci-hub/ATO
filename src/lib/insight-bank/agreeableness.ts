/** Harmony (agreeableness): Easygoing (high) and Frank (low). */
import { idea, type InsightIdea } from './define';

export const AGREEABLENESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_agreeableness_h_01', ['agreeableness:high'], {
    focus: [
      'Friends pick where to eat, and you usually say you’re fine with anything even when you want the noodle place.',
      'On a night out, the group’s pick can win even when you had a different place in mind.',
      'A group can’t decide, and you usually let everyone else choose while your favorite stays unsaid.',
    ],
    why: 'Going along keeps the chat easy, but your friends might like knowing the place you actually want.',
    try: [
      'Next time someone asks where to eat, name one real place, so your pick counts too.',
      'Tell a friend one outing you’d like this month, so the next plan includes you.',
    ],
    watch: [
      'Notice when you type “I don’t mind” and you do have a place in mind.',
      'Notice how friends react when you name the place you actually want.',
    ],
  }),
  idea('ftw_agreeableness_h_02', ['agreeableness:high'], {
    focus: [
      'A coworker says something you disagree with, and you usually nod so the meeting stays pleasant.',
      'You can skip the argument even when you think the point in the chat is wrong.',
      'A conversation gets tense, and you usually agree just so it gets easier for everyone there.',
    ],
    why: 'Keeping the room comfortable helps people relax, but holding your view back can leave you out of a decision that affects your work.',
    try: [
      'Next time you disagree, say “I see it a bit differently,” so your view is in the room.',
      'Write down one thing you disagreed with this week and what you’d say, so the words are ready.',
    ],
    watch: [
      'Notice when you agree out loud and disagree in your head.',
      'Notice what happens in the room when you do share a different view.',
    ],
  }),
  idea('ftw_agreeableness_h_03', ['agreeableness:high'], {
    focus: [
      'Someone needs help, and you usually drop what you’re doing, even with your own list still open.',
      'Friends’ needs can move ahead of the plan you had for your own afternoon.',
      'A family member asks for something, and you can say yes before you’ve looked at your day.',
    ],
    why: 'Helping feels good in the moment, but your own plans can get pushed later in the day without anyone noticing.',
    try: [
      'Before you say yes to the next favor, check your plans for that day, so you know what it costs.',
      'Do one thing just for you today, so your own list gets a turn.',
    ],
    watch: [
      'Notice when you’re already tired from helping and you still say yes to the next ask.',
      'Notice whether people ask you before anyone else, because you rarely say no.',
    ],
  }),
  idea('ftw_agreeableness_h_04', ['agreeableness:high'], {
    focus: [
      'Someone is rude to you, and you usually assume they’re having a bad day.',
      'A friend lets you down once, and you can still assume they had a good reason the next time.',
      'A friend cancels last minute, and you usually assume they have a good reason before you ask.',
    ],
    why: 'Assuming the best makes you kind to be around, but the same problem can happen again if you never name it.',
    try: [
      'If someone lets you down a second time, tell them how it affected your day, so it doesn’t just repeat.',
      'Write down one repeating thing with someone that bothers you, so you can see it on the page.',
    ],
    watch: [
      'Notice when you make an excuse for someone who hasn’t asked for one.',
      'Notice whether the same person keeps needing that patience from you.',
    ],
  }),
  idea('ftw_agreeableness_h_05', ['agreeableness:high'], {
    focus: [
      'You give feedback, and you usually soften it so much that the main point gets lost in the message.',
      'You can add so many kind words that the real criticism gets lost in the chat.',
      'A coworker asks for your opinion, and you usually talk about the good part and skip the problem.',
    ],
    why: 'You care about how the note will feel to them, but a clear point can help more than a gentle note they misread.',
    try: [
      'Next time you give feedback, put the main point in the first sentence, so it stays clear.',
      'Ask the person what they took from your feedback, so you know the point landed.',
    ],
    watch: [
      'Notice when someone keeps making the same mistake after your note.',
      'Notice whether you leave out the hard part when you talk to them.',
    ],
  }),
  idea('ftw_agreeableness_h_06', ['agreeableness:high', 'conflict_assertiveness:low'], {
    focus: [
      'Something bothers you, and you usually let it go instead of bringing it up in the chat.',
      'Small annoyances can stay with you, unsent, so the evening stays calm.',
      'A friend or partner upsets you, and you usually say it’s fine even when it isn’t.',
    ],
    why: 'Letting a small thing go keeps the evening calm, but the things you don’t mention can pile up and come out later.',
    try: [
      'Tell someone about one small thing that bothered you this week, so it doesn’t pile up.',
      'Write what you’d want to say before the talk, so the words are ready.',
    ],
    watch: [
      'Notice when you say “it’s fine” and keep thinking about it on the way home.',
      'Notice small annoyances that keep coming back in the same chat.',
    ],
  }),
  idea('ftw_agreeableness_l_01', ['agreeableness:low'], {
    focus: [
      'A friend asks for your opinion, and you usually give an honest answer even if it isn’t what they hoped.',
      'You can say what you think, even when other people in the room would soften the same point.',
      'Someone asks if you like their idea, and you usually tell them the truth about it.',
    ],
    why: 'People can trust what you say, but some friends might need one kind line before the honest part.',
    try: [
      'Next time you share a tough opinion, start with one thing you like, so the honest part is easier to hear.',
      'Ask a friend if they want feedback or just support, so you give them what they asked for.',
    ],
    watch: [
      'Notice how people react right after you give the honest opinion.',
      'Notice when a friend asks for support and you answer with advice instead.',
    ],
  }),
  idea('ftw_agreeableness_l_02', ['agreeableness:low'], {
    focus: [
      'Someone makes a weak argument in the chat, and you usually name the weak part right away.',
      'You can enjoy a real debate, even when other people would rather drop the topic and eat.',
      'A coworker’s plan has a gap, and you usually say so in front of the whole group.',
    ],
    why: 'You catch problems other people miss, but naming them in public can make people defensive instead of grateful.',
    try: [
      'Next time you spot a gap in someone’s plan, tell them privately, so they can fix it without an audience.',
      'Ask a question about the gap instead of naming it, so they get to find it too.',
    ],
    watch: [
      'Notice when a debate is fun for you and stressful for the other person.',
      'Notice whether people bring you ideas early or only once the work is finished.',
    ],
  }),
  idea('ftw_agreeableness_l_03', ['agreeableness:low'], {
    focus: [
      'You don’t want to do something, and you usually say no without much guilt about it.',
      'Plans that don’t interest you can get a no, even if the rest of the group is going.',
      'A coworker asks for a favor you don’t have time for, and you can decline without a long apology.',
    ],
    why: 'Saying no protects your time, but a quick no with no reason can feel cold to the person who asked.',
    try: [
      'Next time you say no, add one short reason, so it doesn’t sound like a comment on them.',
      'Offer a different time when you turn something down, so they know you’re still interested.',
    ],
    watch: [
      'Notice how people answer after you’ve turned their request down.',
      'Notice which requests you say no to quickly, and why.',
    ],
  }),
  idea('ftw_agreeableness_l_04', ['agreeableness:low'], {
    focus: [
      'Someone is very nice to you right away, and you usually wonder what they want from you.',
      'You can take a while to trust people who seem very friendly in the first conversation.',
      'A stranger is very warm, and you usually wait before you answer with the same warmth.',
    ],
    why: 'Waiting before you trust someone can protect you from people who aren’t genuine, but a genuine person might feel they have to prove themselves to you.',
    try: [
      'Next time someone is friendly, return one small kindness, so they know you saw it.',
      'Pick one person you’ve kept at a distance and ask them a real question, so you get to know them.',
    ],
    watch: [
      'Notice when you look for a hidden motive in someone’s kindness.',
      'Notice who has earned your trust, and how they did it.',
    ],
  }),
  idea('ftw_agreeableness_l_05', ['agreeableness:low'], {
    focus: [
      'A group picks a plan you don’t like, and you usually say so instead of going along.',
      'In group plans you can push for what you want, rather than agreeing and staying quiet.',
      'Friends choose something you don’t want, and you usually say so in the chat.',
    ],
    why: 'Speaking up means your pick gets counted, but friends might need you to go along now and then so the nights feel fair.',
    try: [
      'Let a friend pick the next plan without offering another, so they know you trust their choice.',
      'Ask the group what matters most to them before you share your view, so you can find a shared piece.',
    ],
    watch: [
      'Notice how often the group’s night ends up as the plan you wanted.',
      'Notice when going along with the group plan would cost you very little.',
    ],
  }),
  idea('ftw_agreeableness_l_06', ['agreeableness:low', 'conflict_assertiveness:high'], {
    focus: [
      'Something bothers you, and you usually bring it up right away and say exactly what you think.',
      'You can raise a problem as soon as you see it, even when other people would wait until later.',
      'A coworker does something that bothers you, and you usually tell them directly, the same day.',
    ],
    why: 'Being direct clears the thing up fast, but the other person might need a minute before they can hear what you said.',
    try: [
      'Next time you raise a problem, ask if it’s a good time first, so they’re ready to listen.',
      'Say what you agree on before what bothers you, so the talk starts on a shared piece.',
    ],
    watch: [
      'Notice when the other person goes quiet after you speak.',
      'Notice whether your tone matches how big the problem actually is.',
    ],
  }),
];
