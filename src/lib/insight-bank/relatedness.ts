/** Connection (relatedness): Connected (high) and Self-contained (low). */
import { idea, type InsightIdea } from './define';

export const RELATEDNESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_relatedness_h_01', ['relatedness:high'], {
    focus: [
      'After a busy week, you usually miss a real conversation with someone close more than you miss the sleep.',
      'A few days without a deep talk can leave you a bit off, even if the calendar was full.',
      'You sometimes need a real call with a friend before the week feels okay again.',
    ],
    why: 'A real conversation matters a lot to you, so a busy week without one can leave you feeling flat.',
    try: [
      'Call a close friend for ten minutes today, so you get a real conversation in.',
      'Plan a dinner with someone you love this week, so you have it on the calendar.',
    ],
    watch: [
      'Notice how your mood changes after a real phone call.',
      'Notice when it has been too many days since the last one.',
    ],
  }),
  idea('ftw_relatedness_h_02', ['relatedness:high'], {
    focus: [
      'At work, you usually care a lot about whether you are getting along with the people around you.',
      'Your day can feel better when you like the coworkers in the room, and worse when you do not.',
      'Tension on the team sometimes stays with you longer than it stays with everyone else.',
    ],
    why: 'Caring about the people at work makes you a good teammate, but tension there can follow you home.',
    try: [
      'Ask a coworker how their week is going over lunch, so you build a small connection.',
      'Eat lunch with someone from work this week, so you get to know them past the chat.',
    ],
    watch: [
      'Notice how the workday feels when the team is getting along.',
      'Notice when work tension follows you onto the couch at home.',
    ],
  }),
  idea('ftw_relatedness_h_03', ['relatedness:high'], {
    focus: [
      'A few days alone can start to feel lonely to you, even if the first night was a relief.',
      'You usually feel low if too long passes without seeing a friend.',
      'When a plan falls through, the empty evening sometimes hits you harder than it hits other people.',
    ],
    why: 'Needing people is ordinary for you, so putting a plan on the calendar ahead can spare you a lonely stretch.',
    try: [
      'Set up one plan for the weekend now, so you have company to look forward to.',
      'Text a friend while you are home alone tonight, so the evening feels less quiet.',
    ],
    watch: [
      'Notice how many days alone feel good, and when lonely starts.',
      'Notice which small texts lift your mood on a quiet night.',
    ],
  }),
  idea('ftw_relatedness_h_04', ['relatedness:high'], {
    focus: [
      'When a friend seems down, you usually notice in the chat and reach out the same day.',
      'You can keep a running sense of how your close friends and family are doing.',
      'A hard day for someone you love sometimes gets time from you before your own list does.',
    ],
    why: 'Checking on other people comes easily to you, but you need people who check on you too.',
    try: [
      'Tell a close friend how you are doing, so they get a chance to support you.',
      'Ask a friend to call you this week, so some of the care comes back.',
    ],
    watch: [
      'Notice who checks in on you the way you check in on them.',
      'Notice when you are supporting everyone else and nobody is supporting you.',
    ],
  }),
  idea('ftw_relatedness_h_05', ['relatedness:high'], {
    focus: [
      'When a group of friends makes plans without you, you usually feel left out.',
      'Photos of friends out without you can bother you for the rest of the night.',
      'Being included in the group plan sometimes matters to you more than the plan itself.',
    ],
    why: 'Wanting a place in the group is ordinary, and feeling left out can say more about how much you care than about the friendship.',
    try: [
      'Text the group to suggest the next plan, so you are part of it from the start.',
      'Ask one friend if you can join next time, so they know you would like to be included.',
    ],
    watch: [
      'Notice when you assume being left out of the chat was on purpose.',
      'Notice how often you are included once you actually check.',
    ],
  }),
  idea('ftw_relatedness_h_06', ['relatedness:high', 'playfulness:high'], {
    focus: [
      'You usually get close to people through jokes, a game, or a fun plan on the calendar.',
      'With friends, you can want the night to be one where you laugh together.',
      'You sometimes feel closest to someone after a fun night, more than after a quiet coffee.',
    ],
    why: 'Fun brings you closer to people, but some friends might want a quiet hour with you too.',
    try: [
      'Plan a quiet hangout with a friend, so you connect without a game or a big night.',
      'Send a friend a funny message today, so they know you are thinking of them.',
    ],
    watch: [
      'Notice which friends you only see when the plan is fun.',
      'Notice when a friend might want a slower talk than the game night.',
    ],
  }),
  idea('ftw_relatedness_l_01', ['relatedness:low'], {
    focus: [
      'A free day usually feels good to you spent on your own, with no plan on the calendar.',
      'You can feel fine going a while without seeing friends.',
      'A cancelled plan sometimes brings relief, because the evening is yours again.',
    ],
    why: 'Being fine alone gives you freedom, but a friend might wonder if you still want to see them.',
    try: [
      'Text one friend a plain hi this week, so they know you still think of them.',
      'Plan one short hangout this month, so the friendship stays warm.',
    ],
    watch: [
      'Notice how long it has been since you saw your close friends.',
      'Notice if friends stop reaching out once you have been quiet for a while.',
    ],
  }),
  idea('ftw_relatedness_l_02', ['relatedness:low'], {
    focus: [
      'At work, you usually prefer your own tasks to a team lunch or a group activity.',
      'You can do your best work with the chat muted and nobody stopping by.',
      'A team event sometimes gets a short visit from you, and then you head back to the work.',
    ],
    why: 'Working alone helps you focus, but a little connection with coworkers can make the work easier.',
    try: [
      'Say hi to one coworker you do not usually talk to, so the team feels more familiar.',
      'Go to one team lunch this month, so coworkers get to know you past the work chat.',
    ],
    watch: [
      'Notice how much easier the work is once you know the people.',
      'Notice when a coworker reaches out to you in the chat.',
    ],
  }),
  idea('ftw_relatedness_l_03', ['relatedness:low'], {
    focus: [
      'When you think of a friend, you usually do not text them unless you have a reason.',
      'A passing thought of someone can stay in your head instead of becoming a message.',
      'You sometimes keep it to yourself when you miss a person, and the chat stays quiet.',
    ],
    why: 'You might not feel the need to stay in touch often, but friends often like hearing from you with no reason attached.',
    try: [
      'Text a friend the moment you think of them today, so they know it was them.',
      'Send someone a link or a photo that reminded you of them, so they feel remembered.',
    ],
    watch: [
      'Notice how often you think of a friend and do not tell them.',
      'Notice how a friend reacts when you text them for no reason.',
    ],
  }),
  idea('ftw_relatedness_l_04', ['relatedness:low'], {
    focus: [
      'When small talk starts, you usually keep it short and get back to your day.',
      'You can feel fine about your coworkers without much chat in the kitchen.',
      'A neighbor who stops to talk sometimes gets a brief reply from you, and then you move on.',
    ],
    why: 'Keeping the chat short saves your evening, but a few extra minutes can make a person feel noticed.',
    try: [
      'Ask one follow-up question in your next kitchen chat, so the other person feels noticed.',
      'Learn the name of the neighbor you see often, so the next chat is easier.',
    ],
    watch: [
      'Notice how people respond when you stay in the chat a little longer.',
      'Notice who you would like to know better.',
    ],
  }),
  idea('ftw_relatedness_l_05', ['relatedness:low'], {
    focus: [
      'When something hard happens, you usually work through it alone before you tell anyone.',
      'A tough week can stay off the group chat until you have already handled it yourself.',
      'You sometimes do not mention what you are going through, even to a close friend.',
    ],
    why: 'Handling it yourself is a strength, but the people close to you might want to know what is happening.',
    try: [
      'Tell one friend about something you are dealing with, so they are not left out of it.',
      'Text a friend two lines about a hard week, so they can check on you.',
    ],
    watch: [
      'Notice when keeping a hard thing to yourself makes it heavier.',
      'Notice how it feels once someone knows.',
    ],
  }),
  idea('ftw_relatedness_l_06', ['relatedness:low', 'extraversion:low'], {
    focus: [
      'A quiet weekend at home can suit you, with no strong pull to be social.',
      'When the weekend comes, you usually want the couch and your own thing, not a group plan.',
      'You sometimes keep a small circle and see them only now and then.',
    ],
    why: 'Quiet time suits you, but a friendship still needs a little contact or it cools off.',
    try: [
      'Text one friend this week just to check in, so the chat does not go cold.',
      'Plan one short coffee with one friend this month, so you stay in touch without a big night out.',
    ],
    watch: [
      'Notice when a quiet weekend starts to feel lonely.',
      'Notice which friendships fade when the chat goes quiet.',
    ],
  }),
];
