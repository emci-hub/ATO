/** Harmony (agreeableness): Easygoing (high) and Frank (low). */
import { idea, type InsightIdea } from './define';

export const AGREEABLENESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_agreeableness_h_01', ['agreeableness:high'], {
    focus: [
      'When friends pick where to eat, you tend to say you’re fine with anything, even when you have a favorite.',
      'You usually go along with what others want, even when you’d pick something else.',
      'When a group can’t decide, you tend to let everyone else choose.',
    ],
    why: 'Going along keeps things easy, but your friends might like knowing what you actually want.',
    try: [
      'Next time someone asks where to eat, name one real option, so your preference counts too.',
      'Tell a friend one thing you’d like to do this month, so the next plan includes you.',
    ],
    watch: [
      'Notice when you say “I don’t mind” but actually do.',
      'Notice how friends react when you share a real preference.',
    ],
  }),
  idea('ftw_agreeableness_h_02', ['agreeableness:high'], {
    focus: [
      'When a coworker says something you disagree with, you tend to nod along to keep the peace.',
      'You usually avoid arguing, even when you think someone is wrong.',
      'When a conversation gets tense, you tend to agree just to make it easier.',
    ],
    why: 'Keeping the peace helps people feel comfortable, but holding back can leave your view out of decisions that affect you.',
    try: [
      'Next time you disagree, say “I see it a bit differently,” so you share your view gently.',
      'Write down one thing you disagreed with this week and what you’d say, so it’s easier next time.',
    ],
    watch: [
      'Notice when you agree out loud but disagree inside.',
      'Notice what happens when you do share a different view.',
    ],
  }),
  idea('ftw_agreeableness_h_03', ['agreeableness:high'], {
    focus: [
      'When someone needs help, you tend to drop what you’re doing, even when you’re busy.',
      'You usually put friends’ needs ahead of your own plans.',
      'When a family member asks for something, you tend to say yes before thinking about your own day.',
    ],
    why: 'Helping others feels good to you, but your own needs can quietly slide to the bottom of the list.',
    try: [
      'Before you say yes to the next favor, check your plans for that day, so you know what it costs you.',
      'Do one thing just for you today, so your needs get a turn too.',
    ],
    watch: [
      'Notice when you feel tired from helping and still say yes.',
      'Notice whether people ask you first because you rarely say no.',
    ],
  }),
  idea('ftw_agreeableness_h_04', ['agreeableness:high'], {
    focus: [
      'When someone is rude to you, you tend to assume they’re having a bad day.',
      'You usually assume the best about people, even after they let you down.',
      'When a friend cancels last minute, you tend to assume they have a good reason.',
    ],
    why: 'Assuming the best makes you kind to be around, but it can mean you let the same problem happen more than once.',
    try: [
      'If someone lets you down twice, tell them how it affected you, so it doesn’t keep happening.',
      'Write down one pattern with someone that bothers you, so you can see it clearly.',
    ],
    watch: [
      'Notice when you make excuses for someone who hasn’t asked for one.',
      'Notice whether the same person keeps needing your patience.',
    ],
  }),
  idea('ftw_agreeableness_h_05', ['agreeableness:high'], {
    focus: [
      'When you give feedback, you tend to soften it so much that the main point gets lost.',
      'You usually wrap criticism in so much kindness that people miss what you meant.',
      'When a coworker asks for your opinion, you tend to focus on the good and skip the problem.',
    ],
    why: 'You care about people’s feelings, but clear feedback can help them more than a gentle message they misread.',
    try: [
      'Next time you give feedback, say the main point in one plain sentence first, so it’s clear.',
      'Ask the person to repeat back what they heard, so you know your point landed.',
    ],
    watch: [
      'Notice when someone keeps making the same mistake after your feedback.',
      'Notice whether you leave out the hard part when you talk to someone.',
    ],
  }),
  idea('ftw_agreeableness_h_06', ['agreeableness:high', 'conflict_assertiveness:low'], {
    focus: [
      'When something bothers you, you tend to let it go instead of bringing it up.',
      'You usually keep small annoyances to yourself so things stay calm.',
      'When a friend or partner upsets you, you tend to say it’s fine even when it isn’t.',
    ],
    why: 'Letting things go keeps the peace, but small things you don’t mention can build up and come out later.',
    try: [
      'Tell someone about one small thing that bothered you this week, so it doesn’t build up.',
      'Write down what you’d want to say before talking, so the words are ready.',
    ],
    watch: [
      'Notice when you say “it’s fine” but keep thinking about it.',
      'Notice small annoyances that keep coming back.',
    ],
  }),
  idea('ftw_agreeableness_l_01', ['agreeableness:low'], {
    focus: [
      'When a friend asks for your opinion, you tend to give an honest answer, even if it’s not what they hoped.',
      'You usually say what you think, even when others would soften it.',
      'When someone asks if you like their idea, you tend to tell them the truth.',
    ],
    why: 'People can trust what you say, but some friends might need you to start with something kind before the honest part.',
    try: [
      'Next time you share a tough opinion, start with one thing you like, so the honest part lands better.',
      'Ask a friend if they want feedback or just support, so you give them what they need.',
    ],
    watch: [
      'Notice how people react right after you give your honest opinion.',
      'Notice when someone asks for support and you give advice instead.',
    ],
  }),
  idea('ftw_agreeableness_l_02', ['agreeableness:low'], {
    focus: [
      'When someone makes a weak argument, you tend to point it out right away.',
      'You usually enjoy a good debate, even when others would rather drop the topic.',
      'When a coworker’s plan has a gap, you tend to say so in front of the group.',
    ],
    why: 'You catch problems others miss, but pointing them out in public can make people defensive instead of grateful.',
    try: [
      'Next time you spot a problem in someone’s plan, tell them one-on-one, so they can fix it calmly.',
      'Ask a question about the gap instead of naming it, so the other person gets to find it too.',
    ],
    watch: [
      'Notice when a debate is fun for you but stressful for the other person.',
      'Notice whether people bring you ideas early or wait until they’re finished.',
    ],
  }),
  idea('ftw_agreeableness_l_03', ['agreeableness:low'], {
    focus: [
      'When you don’t want to do something, you tend to say no without much guilt.',
      'You usually say no to plans that don’t interest you, even if others are going.',
      'When a coworker asks for a favor you don’t have time for, you tend to decline easily.',
    ],
    why: 'Saying no protects your time, but a quick no without a reason can feel cold to the person asking.',
    try: [
      'Next time you say no, add one short reason, so the other person doesn’t take it personally.',
      'Offer a different time or option when you turn something down, so the door stays open.',
    ],
    watch: [
      'Notice how people respond after you turn them down.',
      'Notice which requests you say no to quickly and why.',
    ],
  }),
  idea('ftw_agreeableness_l_04', ['agreeableness:low'], {
    focus: [
      'When someone is really nice to you right away, you tend to wonder what they want.',
      'You usually take a while to trust people who seem very friendly at first.',
      'When a stranger is very warm, you tend to wait and see before you warm up.',
    ],
    why: 'Your caution protects you from people who aren’t genuine, but it can make genuine people feel like they have to prove themselves.',
    try: [
      'Next time someone is friendly, return one small kind gesture, so they know you noticed.',
      'Pick one person you’ve kept at a distance and ask them a real question, so you get to know them better.',
    ],
    watch: [
      'Notice when you look for a catch in someone’s kindness.',
      'Notice who has earned your trust and how they did it.',
    ],
  }),
  idea('ftw_agreeableness_l_05', ['agreeableness:low'], {
    focus: [
      'When a group picks a plan you don’t like, you tend to say so instead of going along.',
      'You usually push for what you want in group plans rather than quietly agreeing.',
      'When friends choose something you’re not into, you tend to make it known.',
    ],
    why: 'Speaking up means your needs get counted, but friends might need you to give in now and then so it feels fair.',
    try: [
      'Let a friend pick the next plan without a counteroffer, so they know you trust their choice.',
      'Ask the group what matters most to them before sharing your view, so you can find common ground.',
    ],
    watch: [
      'Notice how often the group ends up doing what you wanted.',
      'Notice when going along would cost you very little.',
    ],
  }),
  idea('ftw_agreeableness_l_06', ['agreeableness:low', 'conflict_assertiveness:high'], {
    focus: [
      'When something bothers you, you tend to bring it up right away and say exactly what you think.',
      'You usually raise problems as soon as you see them, even when others would wait.',
      'When a coworker does something that bothers you, you tend to tell them directly.',
    ],
    why: 'Being direct clears things up fast, but the other person might need a moment before they can hear what you said.',
    try: [
      'Next time you raise a problem, ask if it’s a good time first, so the person is ready to listen.',
      'Say what you agree on before what bothers you, so the talk starts on common ground.',
    ],
    watch: [
      'Notice when the other person goes quiet after you speak up.',
      'Notice whether your tone matches how big the problem is.',
    ],
  }),
];
