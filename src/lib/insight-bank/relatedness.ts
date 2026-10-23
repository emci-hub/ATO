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
    why: 'Wanting to belong is human, and feeling left out can say more about how much you care than about the friendship.',
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
  idea('ftw_relatedness_h_07', ['relatedness:high'], {
    focus: [
      'When a friend tells you something about their life, you tend to remember it and ask about it later.',
      'You usually keep track of the details in your friends’ lives, like their appointments and worries.',
      'When someone you know has a big day coming, you tend to check in on it.',
    ],
    why: 'Remembering details makes people feel seen, but keeping up with many lives can leave you with little time for your own.',
    try: [
      'Write the next big date for each close friend in your calendar, so you remember without effort.',
      'Pick one evening this week with no check-ins to do, so you have time for yourself.',
    ],
    watch: [
      'Notice how many people you keep up with in a week.',
      'Notice how it feels to take a day off from it.',
    ],
  }),
  idea('ftw_relatedness_h_08', ['relatedness:high'], {
    focus: [
      'When a friend moves away or a group drifts apart, you tend to feel it for a long time.',
      'You usually find endings in friendships hard to accept.',
      'When someone close pulls back, you tend to work to keep the connection alive.',
    ],
    why: 'Valuing your friendships means you work to keep them, but not every friendship will stay the same size.',
    try: [
      'Set a call with a far-away friend this month, so the friendship has a regular rhythm.',
      'Tell a friend you miss the old days, so the feeling is shared and not carried alone.',
    ],
    watch: [
      'Notice which friendships you keep working on and which are mutual.',
      'Notice how you feel when a friendship changes shape.',
    ],
  }),
  idea('ftw_relatedness_h_09', ['relatedness:high'], {
    focus: [
      'When you walk into a room of people you don’t know, you tend to look for someone to talk to.',
      'You usually start conversations with strangers at events, in lines or at work.',
      'When you’re new somewhere, you tend to meet people quickly.',
    ],
    why: 'Reaching out makes new places feel like home faster, but you might spread your time across many light contacts.',
    try: [
      'Pick two people from a new group to get to know better, so some connections go deeper.',
      'Follow up with one new person this week, so a quick chat turns into a friendship.',
    ],
    watch: [
      'Notice which new contacts you follow up with.',
      'Notice who you feel known by after a few months.',
    ],
  }),
  idea('ftw_relatedness_h_10', ['relatedness:high'], {
    focus: [
      'When you’re happy about something, you tend to feel better once you share it.',
      'You usually don’t feel a good moment is complete until you tell someone.',
      'When you have news, you tend to want to share it with people who care.',
    ],
    why: 'Sharing doubles a good moment, but friends who are having a hard time may not have room to celebrate with you right then.',
    try: [
      'Ask a friend how they are before you share your news, so you know if the time is right.',
      'Write the good news down first and share it later too, so it lasts longer.',
    ],
    watch: [
      'Notice what a friend is going through when you share news.',
      'Notice how you feel when no one is around to tell.',
    ],
  }),
  idea('ftw_relatedness_h_11', ['relatedness:high'], {
    focus: [
      'When you work from home for many days, you tend to miss having people around.',
      'You usually do better when you have a coworker or friend nearby, even if you’re not talking.',
      'When your day has no contact with anyone, you tend to feel a little flat by evening.',
    ],
    why: 'Having people around keeps you going, but a day alone is easier if you plan for it.',
    try: [
      'Plan one short call or a walk with someone on your longest solo day, so the day has contact in it.',
      'Go to a place with other people to work once this week, so you get company without a plan.',
    ],
    watch: [
      'Notice at what point in a solo day your mood dips.',
      'Notice what kind of contact helps the most.',
    ],
  }),
  idea('ftw_relatedness_h_12', ['relatedness:high'], {
    focus: [
      'When a friend is going through a hard time, you tend to put your own plans aside to be with them.',
      'You usually drop what you’re doing to be there for someone close.',
      'When someone you love needs you, you tend to make time even when you’re tired.',
    ],
    why: 'Showing up matters a lot to people, but giving everything can leave you with little energy for yourself.',
    try: [
      'Tell a friend how much time you can give today, so they know what to expect and you can rest.',
      'Ask another friend to help support the person, so you’re not the only one.',
    ],
    watch: [
      'Notice how tired you are after you support someone.',
      'Notice who supports you when you need it.',
    ],
  }),
  idea('ftw_relatedness_l_07', ['relatedness:low'], {
    focus: [
      'When a plan with friends falls through, you tend to feel a little relieved.',
      'You usually enjoy a canceled plan because it gives you the evening back.',
      'When you have a free night, you tend to choose staying in over going out.',
    ],
    why: 'Time to yourself is valuable, but friends can feel the relief when you cancel and may stop inviting you.',
    try: [
      'Say yes to one invitation this week that sounds easy, so friends know you still want in.',
      'Tell a friend when you cancel that you’d like to reschedule, so they know it’s about the evening and not them.',
    ],
    watch: [
      'Notice how often you feel relieved when a plan is canceled.',
      'Notice how you feel the morning after you went out.',
    ],
  }),
  idea('ftw_relatedness_l_08', ['relatedness:low'], {
    focus: [
      'When you have a hobby, you tend to enjoy doing it alone more than in a group.',
      'You usually take on a project solo and prefer it that way.',
      'When your interest is specific, you tend to find fewer people who share it, and you’re fine with that.',
    ],
    why: 'Doing things solo lets you go deep, but a shared interest can add something you wouldn’t find alone.',
    try: [
      'Share one thing you made or learned with one person, so your interest has an audience.',
      'Look for one online group about your hobby and read it for a week, so you see if it adds anything.',
    ],
    watch: [
      'Notice what you gain from doing a hobby alone.',
      'Notice how you feel when someone shows interest in it.',
    ],
  }),
  idea('ftw_relatedness_l_09', ['relatedness:low'], {
    focus: [
      'When you go to a group event, you tend to feel it’s more of a duty than a pleasure.',
      'You usually go to gatherings because you should and leave once you’ve been seen.',
      'When a family or work event comes up, you tend to count how long you need to stay.',
    ],
    why: 'Going out of duty shows you care in your own way, but spending the evening counting the minutes can make it feel longer for you.',
    try: [
      'Pick one person at the next event to talk to properly, so the evening has one good part.',
      'Decide when you’ll leave before you arrive, so you can relax until then.',
    ],
    watch: [
      'Notice which gatherings you enjoy once you’re there.',
      'Notice which part of an event you dread most.',
    ],
  }),
  idea('ftw_relatedness_l_10', ['relatedness:low'], {
    focus: [
      'When you share news about your life, you tend to wait until it is settled.',
      'You usually tell people about a decision after you’ve made it and not while you’re deciding.',
      'When something is going on in your life, you tend to keep it to yourself for a while.',
    ],
    why: 'Handling things privately lets you think clearly, but friends may feel left out when they hear late.',
    try: [
      'Tell one close friend about something you’re still deciding, so they can be part of it.',
      'Send a short note when something big happens, so people hear it from you.',
    ],
    watch: [
      'Notice who finds out about your news last.',
      'Notice how a friend reacts when you share before it’s settled.',
    ],
  }),
  idea('ftw_relatedness_l_11', ['relatedness:low'], {
    focus: [
      'When someone gets very close very fast, you tend to want to slow things down.',
      'You usually prefer a few close friends to a wide circle.',
      'When a new person wants to spend a lot of time with you, you tend to pull back a little.',
    ],
    why: 'A small circle gives you depth, but a friend who wants more may not understand that slowing down isn’t rejection.',
    try: [
      'Tell a new friend how you like friendship to go, like “I like to take things slowly,” so they know.',
      'Suggest a regular time to meet, so the contact is steady without being too much.',
    ],
    watch: [
      'Notice how many people you consider close friends.',
      'Notice how a new friend responds when you set the pace.',
    ],
  }),
  idea('ftw_relatedness_l_12', ['relatedness:low'], {
    focus: [
      'When you could call a friend, you tend to go a long time without it.',
      'You usually think warmly of friends without reaching out to say so.',
      'When a friend’s birthday or event passes, you tend to remember a day late.',
    ],
    why: 'Your friends matter to you even when you don’t say it, but they can only know if you show it.',
    try: [
      'Send a two-line message to a friend today, so they know you were thinking of them.',
      'Put your close friends’ birthdays in your calendar, so reaching out takes no memory.',
    ],
    watch: [
      'Notice who you think of but haven’t contacted.',
      'Notice how a friend reacts to a short message out of the blue.',
    ],
  }),
];
