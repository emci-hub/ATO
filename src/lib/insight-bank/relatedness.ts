/** Connection (relatedness): Connected (high) and Self-contained (low). */
import { idea, type InsightIdea } from './define';

export const RELATEDNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_relatedness_h_01', ['relatedness:high'], {
    focus: [
      'When your week has been busy, you tend to miss having a real conversation with someone close.',
      'You usually need a few deep talks with friends to feel okay.',
      'When you go a while without real connection, you tend to feel a bit off.',
    ],
    why: 'Connection matters a lot to you, so busy weeks without it can leave you feeling flat.',
    try: [
      'Call a close friend for ten minutes today, so you get some real connection.',
      'Plan a dinner with someone you love this week, so you have something to look forward to.',
    ],
    watch: [
      'Notice how your mood changes after a real talk.',
      'Notice when you’ve gone too long without one.',
    ],
  }),
  idea('ftw_relatedness_h_02', ['relatedness:high'], {
    focus: [
      'At work, you tend to care a lot about getting along with your coworkers.',
      'You usually enjoy your job more when you like the people around you.',
      'When there’s tension on your team, you tend to feel it more than others.',
    ],
    why: 'Caring about people at work makes you a great teammate, but tension at work can affect you more.',
    try: [
      'Ask a coworker how their week is going, so you build a small connection.',
      'Eat lunch with someone from work this week, so you get to know them better.',
    ],
    watch: [
      'Notice how your workday feels when your team is getting along.',
      'Notice when work tension follows you home.',
    ],
  }),
  idea('ftw_relatedness_h_03', ['relatedness:high'], {
    focus: [
      'When you spend a few days alone, you tend to start feeling lonely.',
      'You usually feel low if you go too long without seeing friends.',
      'When plans fall through, you tend to feel the empty evening more than others.',
    ],
    why: 'Needing people is normal for you, so planning connection ahead helps you avoid lonely stretches.',
    try: [
      'Set up one plan for the weekend now, so you have connection to look forward to.',
      'Text a friend while you’re home alone tonight, so the evening feels less quiet.',
    ],
    watch: [
      'Notice how many days alone feel good and when it starts to feel lonely.',
      'Notice which small contacts lift your mood.',
    ],
  }),
  idea('ftw_relatedness_h_04', ['relatedness:high'], {
    focus: [
      'When a friend seems down, you tend to notice right away and reach out.',
      'You usually keep track of how your close friends and family are doing.',
      'When someone you love has a hard day, you tend to make time for them.',
    ],
    why: 'Caring for others comes naturally to you, but you need people who check on you too.',
    try: [
      'Tell a close friend how you’re doing, so they get a chance to support you.',
      'Ask a friend to call you this week, so you get some care back.',
    ],
    watch: [
      'Notice who checks in on you.',
      'Notice when you’re supporting everyone else but nobody is supporting you.',
    ],
  }),
  idea('ftw_relatedness_h_05', ['relatedness:high'], {
    focus: [
      'When a group of friends makes plans without you, you tend to feel left out.',
      'You usually care a lot about being included in group plans.',
      'When you see photos of friends out without you, you tend to feel it.',
    ],
    why: 'Wanting to belong is human, and feeling left out usually says more about how much you care than about the friendship.',
    try: [
      'Text the group to suggest the next plan, so you’re part of it from the start.',
      'Ask one friend if you can join next time, so they know you’d like to be included.',
    ],
    watch: [
      'Notice when you assume being left out was on purpose.',
      'Notice how often you’re included when you check.',
    ],
  }),
  idea('ftw_relatedness_h_06', ['relatedness:high', 'playfulness:high'], {
    focus: [
      'You tend to connect with people through jokes, games and fun plans.',
      'When you’re with friends, you usually want to laugh together.',
      'You tend to feel closest to people after a fun night together.',
    ],
    why: 'Fun brings you closer to people, but some friends might want quiet time with you too.',
    try: [
      'Plan a quiet hangout with a friend, so you connect in a different way.',
      'Send a friend a funny message today, so they know you’re thinking of them.',
    ],
    watch: [
      'Notice which friends you only see for fun plans.',
      'Notice when a friend might want a slower talk.',
    ],
  }),
  idea('ftw_relatedness_l_01', ['relatedness:low'], {
    focus: [
      'When you have a free day, you tend to enjoy spending it on your own.',
      'You usually feel fine going a while without seeing friends.',
      'When plans get cancelled, you tend to feel relieved to have time to yourself.',
    ],
    why: 'Being fine alone gives you freedom, but friends might wonder if you still want to see them.',
    try: [
      'Text one friend to say hi this week, so they know you still think of them.',
      'Plan one short hangout this month, so your friendships stay warm.',
    ],
    watch: [
      'Notice how long it’s been since you saw your close friends.',
      'Notice if friends stop reaching out.',
    ],
  }),
  idea('ftw_relatedness_l_02', ['relatedness:low'], {
    focus: [
      'At work, you tend to prefer focusing on your own tasks over team activities.',
      'You usually work best without much social contact.',
      'When there’s a team event, you tend to go for a little while and then head back to your work.',
    ],
    why: 'Working alone helps you focus, but some connection with coworkers can make work easier for you.',
    try: [
      'Say hi to one coworker you don’t usually talk to, so the team feels more familiar.',
      'Go to one team event this month, so coworkers get to know you.',
    ],
    watch: [
      'Notice how much easier work is when you know people.',
      'Notice when a coworker reaches out to you.',
    ],
  }),
  idea('ftw_relatedness_l_03', ['relatedness:low'], {
    focus: [
      'When you think of a friend, you tend not to text them unless there’s a reason.',
      'You usually don’t reach out unless you have something specific to say.',
      'When you miss someone, you tend to keep it to yourself.',
    ],
    why: 'You might not feel the need to stay in touch often, but friends often like hearing from you without a reason.',
    try: [
      'Text a friend when you think of them today, so they know it.',
      'Send someone a link or photo that reminded you of them, so they feel remembered.',
    ],
    watch: [
      'Notice how often you think of friends without telling them.',
      'Notice how people react when you reach out for no reason.',
    ],
  }),
  idea('ftw_relatedness_l_04', ['relatedness:low'], {
    focus: [
      'When small talk starts, you tend to keep it short and get back to your day.',
      'You usually don’t need much chat to feel good about your coworkers.',
      'When a neighbor stops to chat, you tend to keep it brief.',
    ],
    why: 'Keeping chats short saves your energy, but a few extra minutes can make people feel noticed.',
    try: [
      'Ask one follow-up question in your next small talk, so the other person feels noticed.',
      'Learn the name of someone you see often, so the next chat is easier.',
    ],
    watch: [
      'Notice how people respond when you chat a little longer.',
      'Notice who you’d like to know better.',
    ],
  }),
  idea('ftw_relatedness_l_05', ['relatedness:low'], {
    focus: [
      'When something hard happens, you tend to work through it alone before telling anyone.',
      'You usually process tough moments on your own.',
      'When you’re going through something, you tend not to mention it to friends.',
    ],
    why: 'Handling things yourself is a strength, but the people close to you might want to know what’s happening.',
    try: [
      'Tell one friend about something you’re dealing with, so they’re not left out.',
      'Text a friend a short update about a hard week, so they can check on you.',
    ],
    watch: [
      'Notice when keeping things to yourself makes them heavier.',
      'Notice how it feels when someone knows.',
    ],
  }),
  idea('ftw_relatedness_l_06', ['relatedness:low', 'extraversion:low'], {
    focus: [
      'You tend to enjoy quiet time alone and don’t feel a strong need to be social.',
      'When the weekend comes, you usually want to stay in and do your own thing.',
      'You tend to keep a small circle of friends and see them only now and then.',
    ],
    why: 'Quiet time suits you, but your friendships still need a little contact to stay close.',
    try: [
      'Text one friend this week to check in, so the friendship stays warm.',
      'Plan one short coffee with someone this month, so you stay in touch without a big outing.',
    ],
    watch: [
      'Notice when quiet time starts to feel lonely.',
      'Notice which friendships fade without contact.',
    ],
  }),
];
