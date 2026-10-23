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
      'Ask the person what they took from your feedback, so you know your point landed.',
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
      'Offer a different time or option when you turn something down, so they know you’re still interested.',
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
  idea('ftw_agreeableness_h_07', ['agreeableness:high'], {
    focus: [
      'When you bump into someone or make a small mistake, you tend to say sorry first.',
      'You usually apologize quickly, even in moments where it wasn’t your fault.',
      'When there’s a little tension, you tend to say sorry to make it go away.',
    ],
    why: 'Saying sorry keeps things friendly, but doing it for everything can make your real apologies mean less to you and others.',
    try: [
      'Swap one “sorry” today for “thank you” or “excuse me,” so you say what you mean.',
      'Before you apologize, ask yourself if you did something wrong, so your sorry means something.',
    ],
    watch: [
      'Notice how many times you say sorry in a day.',
      'Notice when you apologize to end a tense moment.',
    ],
  }),
  idea('ftw_agreeableness_h_08', ['agreeableness:high'], {
    focus: [
      'When you need a favor, you tend to wait because you don’t want to bother anyone.',
      'You usually find it easier to help others than to ask for help.',
      'When someone offers to help you, you tend to say you’re fine.',
    ],
    why: 'You like to be easy on people, but friends often want to help and may feel shut out when you don’t ask.',
    try: [
      'Ask one person for a small favor this week, so you see how willing they are.',
      'Say yes to the next offer of help you get, so people see you let them in.',
    ],
    watch: [
      'Notice when you need help and don’t ask.',
      'Notice how a friend reacts when you ask for something small.',
    ],
  }),
  idea('ftw_agreeableness_h_09', ['agreeableness:high'], {
    focus: [
      'When a coworker asks you to take on one more thing, you tend to say yes even when you’re full.',
      'You usually find it hard to say no to a request at work.',
      'When your boss or a friend asks for a favor, you tend to agree before you check your time.',
    ],
    why: 'Saying yes builds goodwill, but too many yeses can leave you stretched and unable to do your best on any of them.',
    try: [
      'Say “let me check my week and get back to you” to the next request, so you have time to decide.',
      'Pick one request this week to turn down kindly, so your yeses mean more.',
    ],
    watch: [
      'Notice how full your week is when you say yes.',
      'Notice how people react to a kind no.',
    ],
  }),
  idea('ftw_agreeableness_h_10', ['agreeableness:high'], {
    focus: [
      'When a friend is late or cancels, you tend to say it’s okay even if it bothered you.',
      'You usually give people the benefit of the doubt when they let you down.',
      'When someone forgets something they promised, you tend to let it slide.',
    ],
    why: 'Giving people room keeps friendships easy, but if you never say it bothered you, they may not know to change.',
    try: [
      'Tell a friend one small thing that bothered you, in a calm sentence, so they know.',
      'Next time a plan changes, say you were looking forward to it, so they know it mattered.',
    ],
    watch: [
      'Notice how often you say it’s fine when it isn’t.',
      'Notice whether the same thing keeps happening with the same person.',
    ],
  }),
  idea('ftw_agreeableness_h_11', ['agreeableness:high'], {
    focus: [
      'When someone complains to you, you tend to listen and agree even if you see it differently.',
      'You usually take a friend’s side when they vent, even if you’re not sure they’re right.',
      'When a coworker talks about a problem, you tend to say what they want to hear.',
    ],
    why: 'Being on someone’s side feels kind in the moment, but it can keep a friend from hearing a view that you think would help them.',
    try: [
      'Next time a friend vents, ask what they want from you, so you know whether to listen or give your view.',
      'Share one honest thought gently after listening, so your support goes a bit further.',
    ],
    watch: [
      'Notice when you agree on the outside but think something else.',
      'Notice whether a friend wants advice or just a listener.',
    ],
  }),
  idea('ftw_agreeableness_h_12', ['agreeableness:high'], {
    focus: [
      'When a server or customer service worker makes a mistake, you tend to stay patient and kind.',
      'You usually stay friendly with people who are having a rough day, even when it costs you.',
      'When a stranger is rude, you tend to let it go without saying anything.',
    ],
    why: 'Kindness makes hard moments easier for others, but you can end up taking on rudeness that you’d be fine pushing back on.',
    try: [
      'When something is truly not okay, say one calm sentence about it, so it doesn’t sit with you afterward.',
      'Keep your patience, and add a small thank-you to the person who handled it well, so kindness goes both ways.',
    ],
    watch: [
      'Notice how you feel an hour after a rude moment you let go.',
      'Notice when being kind and being quiet turn out to be different things.',
    ],
  }),
  idea('ftw_agreeableness_l_07', ['agreeableness:low'], {
    focus: [
      'When a conversation turns into a debate, you tend to enjoy pushing back on an idea.',
      'You usually argue a point hard because you like testing whether it holds up.',
      'When friends disagree with you, you tend to treat it as a good discussion.',
    ],
    why: 'Debating sharpens ideas, but friends may feel attacked when you meant it as a game.',
    try: [
      'Tell a friend “I’m just testing the idea” before you push back, so they know it isn’t personal.',
      'Ask a friend what they think before you share your view, so the talk feels like a two-way street.',
    ],
    watch: [
      'Notice who in the group looks uncomfortable when you push back.',
      'Notice whether you enjoy the debate more than the other person does.',
    ],
  }),
  idea('ftw_agreeableness_l_08', ['agreeableness:low'], {
    focus: [
      'When someone praises you, you tend to wonder if they mean it.',
      'You usually take compliments with a pinch of salt until you see proof.',
      'When people are very positive, you tend to look for what they’re leaving out.',
    ],
    why: 'Being skeptical protects you from empty flattery, but real praise can slip past you unnoticed.',
    try: [
      'Next time someone says something kind, say thank you and nothing more, so you let it in.',
      'Write down one compliment you got this week, so you see it more than once.',
    ],
    watch: [
      'Notice how quickly you question a compliment.',
      'Notice which people’s praise you believe right away.',
    ],
  }),
  idea('ftw_agreeableness_l_09', ['agreeableness:low'], {
    focus: [
      'When you text, you tend to keep it short and to the point.',
      'You usually say what you need in the fewest words, without extra warm-up.',
      'When you write an email, you tend to skip the pleasantries and get to the request.',
    ],
    why: 'Short messages save you time, but a warm word at the start can keep a short message from sounding cold.',
    try: [
      'Add a short friendly line to your next message, like “hope your day’s good,” so it reads warmer.',
      'Read one message aloud before you send it, so you can hear how it might sound to the other person.',
    ],
    watch: [
      'Notice which people reply warmly to your short messages and which go quiet.',
      'Notice how a friendly opener changes the reply you get.',
    ],
  }),
  idea('ftw_agreeableness_l_10', ['agreeableness:low'], {
    focus: [
      'When someone asks you to do something you think is a bad idea, you tend to say so.',
      'You usually don’t go along with a plan you don’t believe in.',
      'When a group is excited about something you doubt, you tend to speak up instead of staying quiet.',
    ],
    why: 'Your honesty can save the group from mistakes, but excited people may hear it as you not wanting them to enjoy it.',
    try: [
      'Name one thing you like about a plan before you raise your concern, so people hear you’re on their side.',
      'Offer a different option along with your doubt, so the group has something to work with.',
    ],
    watch: [
      'Notice how a group reacts when you start with what you like.',
      'Notice whether your doubt is about the plan or about how it was brought up.',
    ],
  }),
  idea('ftw_agreeableness_l_11', ['agreeableness:low'], {
    focus: [
      'When you have to split something fairly, you tend to look out for your share.',
      'You usually make sure you’re not giving up more than you’re getting.',
      'When money or time is shared, you tend to keep track so it stays even.',
    ],
    why: 'Keeping things fair protects you from being taken advantage of, but counting too closely can make friends feel watched.',
    try: [
      'Let one small thing go unevenly this week and see how it feels, so you test whether the count matters.',
      'Offer to cover something small for a friend, so they know the count isn’t the point.',
    ],
    watch: [
      'Notice which things you keep count of.',
      'Notice how you feel when a friend gives more than they get.',
    ],
  }),
  idea('ftw_agreeableness_l_12', ['agreeableness:low'], {
    focus: [
      'When a family member gives you advice you didn’t ask for, you tend to say you’ll do it your way.',
      'You usually push back on unwanted advice instead of nodding along.',
      'At family gatherings, you tend to hold your ground when someone pushes an opinion on you.',
    ],
    why: 'Holding your ground keeps your choices yours, but the people who offered the advice may have only wanted to help.',
    try: [
      'Say “thanks, I’ll think about it” to the next piece of advice you don’t want, so the talk stays kind.',
      'Ask the person why they gave the advice, so you know what they were worried about.',
    ],
    watch: [
      'Notice when advice is really worry from someone who cares.',
      'Notice how family reacts when you answer calmly.',
    ],
  }),
];
