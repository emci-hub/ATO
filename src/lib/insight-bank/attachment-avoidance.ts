/** Personal space (attachment_avoidance): Private (high) and Close (low). Private on every share surface. */
import { idea, type InsightIdea } from './define';

export const ATTACHMENT_AVOIDANCE_IDEAS: readonly InsightIdea[] = [
  idea('ftw_attachment_avoidance_h_01', ['attachment_avoidance:high'], {
    focus: [
      'When a relationship gets very close, you tend to want a little more space.',
      'You usually need time to yourself, even with people you love.',
      'When someone wants to spend every day together, you tend to feel crowded.',
    ],
    why: 'Needing space is normal for you, but a partner might read it as distance unless you explain it.',
    try: [
      'Tell your partner or a close friend when you need time alone, so they don’t take it personally.',
      'Plan your alone time ahead, so the people close to you know when to expect you back.',
    ],
    watch: [
      'Notice when you pull back right after a very close moment.',
      'Notice how people respond when you explain what you need.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_02', ['attachment_avoidance:high'], {
    focus: [
      'When someone asks how you’re really doing, you tend to say you’re fine.',
      'You usually keep your feelings to yourself, even with people you trust.',
      'When something is hard, you tend to deal with it on your own before telling anyone.',
    ],
    why: 'Handling things yourself feels safer to you, but people who care about you might want the chance to help.',
    try: [
      'Tell one person something small that’s been on your mind, so sharing gets a little easier.',
      'Answer the next “how are you” with one honest detail, so the conversation can go deeper.',
    ],
    watch: [
      'Notice when you say “fine” out of habit.',
      'Notice how it feels when you do share something.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_03', ['attachment_avoidance:high'], {
    focus: [
      'When you’re struggling, you tend to figure it out alone instead of asking for help.',
      'You usually handle problems yourself, even when a friend would gladly help.',
      'When work gets to be too much, you tend to push through on your own.',
    ],
    why: 'Being able to handle things alone is a real strength, but help can make hard things lighter for you.',
    try: [
      'Ask one person for help with something small this week, so asking feels normal.',
      'Text a friend about something hard you’re handling, so they know what’s going on.',
    ],
    watch: [
      'Notice when you turn down help you could actually use.',
      'Notice how people react when you do ask.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_04', ['attachment_avoidance:high'], {
    focus: [
      'When a partner talks about long-term plans, you tend to feel uneasy and change the subject.',
      'You usually prefer to keep things light when people talk about the future together.',
      'When someone asks where things are going, you tend to want more time to answer.',
    ],
    why: 'Taking your time with big steps protects your space, but a partner may need to know you’re thinking about it.',
    try: [
      'Tell your partner one thing you look forward to doing together, so they know you’re in it.',
      'Write down what makes you uneasy about future plans, so you can explain it when you’re ready.',
    ],
    watch: [
      'Notice when you change the subject during serious talks.',
      'Notice which future plans actually feel good to you.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_05', ['attachment_avoidance:high'], {
    focus: [
      'When someone is very affectionate with you, you tend to feel a bit uncomfortable.',
      'You usually show you care through actions rather than words or hugs.',
      'When a friend says something very emotional, you tend to not know what to say back.',
    ],
    why: 'Showing care through actions is real care, but the people close to you might also need to hear it.',
    try: [
      'Say one kind thing out loud to someone close today, so they hear what you usually show.',
      'Send a short message telling a friend you appreciate them, so the words are there for them to keep.',
    ],
    watch: [
      'Notice how you show love without saying it.',
      'Notice what you feel when someone says something kind to you.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_06', ['attachment_avoidance:high', 'autonomy:high'], {
    focus: [
      'You tend to like doing things your own way and on your own time, even in a relationship.',
      'When you share a home or plans with someone, you usually want room to decide things yourself.',
      'You tend to keep your own routines and plans, even when you’re close with someone.',
    ],
    why: 'Your independence keeps you true to yourself, but a partner might feel left out of decisions that affect them.',
    try: [
      'Ask your partner or roommate for input on one small decision, so they feel included.',
      'Tell someone close about a plan you made on your own, so they don’t feel shut out.',
    ],
    watch: [
      'Notice when you make a decision that affects someone else without asking them.',
      'Notice whether people close to you feel part of your plans.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_01', ['attachment_avoidance:low'], {
    focus: [
      'When you’re close to someone, you tend to want to share your day and spend lots of time together.',
      'You usually feel happiest when you’re in regular contact with the people you love.',
      'When something happens, you tend to want to tell your partner or best friend right away.',
    ],
    why: 'Your openness makes people feel wanted, but someone who needs more space might feel a bit crowded.',
    try: [
      'Ask your partner or a close friend how much time together feels good to them, so you can match it.',
      'Plan one thing you enjoy doing alone this week, so your time apart feels good too.',
    ],
    watch: [
      'Notice when someone close needs time to themselves.',
      'Notice how you feel during time apart.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_02', ['attachment_avoidance:low'], {
    focus: [
      'When something is bothering you, you tend to share it with someone close right away.',
      'You usually talk about your feelings openly with people you trust.',
      'When you feel something, you tend to say it rather than keep it inside.',
    ],
    why: 'Sharing openly builds closeness, but some friends might need a moment before they’re ready to share back with you.',
    try: [
      'Ask a friend how they’re doing before you share your news, so the talk goes both ways.',
      'Write your feelings in a note first, so you can choose which part to share.',
    ],
    watch: [
      'Notice whether the people you talk to share back.',
      'Notice when someone seems unsure how to respond to what you share.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_03', ['attachment_avoidance:low'], {
    focus: [
      'When you have a problem, you tend to ask friends or family for help early.',
      'You usually feel comfortable leaning on people you trust.',
      'When you’re stuck, you tend to reach out instead of figuring it out alone.',
    ],
    why: 'Asking for help makes problems lighter, and it lets people feel trusted, as long as you also help back.',
    try: [
      'Offer to help a friend with something this week, so the support goes both ways.',
      'Try one small problem on your own first, so you see what you can handle.',
    ],
    watch: [
      'Notice how often you help the people who help you.',
      'Notice which problems you could solve yourself.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_04', ['attachment_avoidance:low'], {
    focus: [
      'When you care about someone, you tend to show it with hugs, kind words and lots of contact.',
      'You usually say how you feel about people out loud.',
      'When a friend does something kind, you tend to tell them how much it meant.',
    ],
    why: 'Showing warmth openly makes people feel loved, but some people you care about might be less comfortable with lots of it.',
    try: [
      'Ask a friend how they like to be shown care, so your warmth reaches them the way they like.',
      'Send one friend a thank-you message today, so they know their help mattered.',
    ],
    watch: [
      'Notice who leans in when you show warmth and who pulls back a little.',
      'Notice how different friends show care back to you.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_05', ['attachment_avoidance:low'], {
    focus: [
      'When you’re in a relationship, you tend to enjoy talking about plans for the future together.',
      'You usually like making long-term plans with the people you’re close to.',
      'When things are going well, you tend to want to talk about what’s next.',
    ],
    why: 'Planning together shows commitment, but a partner who moves slower might need more time to get there with you.',
    try: [
      'Ask your partner what they’re excited about right now, so you plan around both of you.',
      'Pick one near-term plan to enjoy together, so the future talk doesn’t take over.',
    ],
    watch: [
      'Notice when a partner goes quiet during future talks.',
      'Notice how it feels to enjoy right now without planning ahead.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_06', ['attachment_avoidance:low', 'relatedness:high'], {
    focus: [
      'You tend to feel happiest when you’re close to people and talking often.',
      'When your friends or partner are around, you usually feel more like yourself.',
      'You tend to need real connection with people to feel good about your week.',
    ],
    why: 'Your need for closeness keeps your relationships strong, but busy weeks can leave you feeling lonely.',
    try: [
      'Text two friends to plan something this week, so you have connection to look forward to.',
      'Call someone you love on a quiet evening, so the day ends with a real talk.',
    ],
    watch: [
      'Notice how your mood changes after a week with little contact.',
      'Notice which people make you feel most like yourself.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_07', ['attachment_avoidance:high'], {
    focus: [
      'When a friend or partner wants to talk about feelings, you tend to keep it short.',
      'You usually find it easier to talk about plans and facts than about how you feel.',
      'When a talk gets personal, you tend to steer it to something lighter.',
    ],
    why: 'Keeping it light protects your comfort, but people close to you may feel they only know part of what you think.',
    try: [
      'Share one real feeling with someone you trust this week, in a sentence or two, so they know a bit more.',
      'Tell a friend “I need a minute, and I’ll come back to this,” so a pause doesn’t feel like a closed door.',
    ],
    watch: [
      'Notice the moment you change the subject.',
      'Notice how a friend reacts when you share a little more than usual.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_08', ['attachment_avoidance:high'], {
    focus: [
      'After a weekend with a partner or family, you tend to want time alone to feel like yourself.',
      'You usually need a quiet day after lots of time with people close to you.',
      'When you spend several days together on a trip, you tend to look for a bit of space.',
    ],
    why: 'Needing space is normal, but a person who loves you may take your need to withdraw as a sign that something is wrong.',
    try: [
      'Tell the person “I need an hour to myself, and then I’d love to hang out,” so they know it isn’t about them.',
      'Plan your alone time before a long trip, so you can ask for it calmly.',
    ],
    watch: [
      'Notice how the other person feels when you step away without saying why.',
      'Notice how long you need to feel like yourself again.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_09', ['attachment_avoidance:high'], {
    focus: [
      'When someone says they miss you, you tend to feel pleased and a bit pressured.',
      'You usually like knowing you’re missed, but you don’t always know how to respond.',
      'When a friend wants more contact than you do, you tend to pull back a little.',
    ],
    why: 'Mixed feelings about closeness are common, but a friend who wants more may not know you feel warmly too.',
    try: [
      'Reply to “I miss you” with one warm sentence, so they know you care even if you don’t say much.',
      'Set a regular time to talk to someone close, so contact doesn’t depend on a mood.',
    ],
    watch: [
      'Notice what you feel in the first second after someone says they miss you.',
      'Notice how you feel when a friend goes a long time without reaching out.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_10', ['attachment_avoidance:high'], {
    focus: [
      'When a friend or partner is going through something hard, you tend to help with tasks more than with talk.',
      'You usually show you care by fixing something practical, like a ride or a meal.',
      'When someone close is upset, you tend to feel unsure what to say and offer help instead.',
    ],
    why: 'Practical help is real care, but some people also need to hear you say you’re there.',
    try: [
      'Add one sentence like “I’m here if you want to talk” when you offer help, so they hear it too.',
      'Ask the person “do you want help or just company?” so you give the kind they need.',
    ],
    watch: [
      'Notice which kind of support you find easy to give.',
      'Notice how people react when you add a few warm words.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_11', ['attachment_avoidance:high'], {
    focus: [
      'When you’re with someone new, you tend to take a long time to share personal things.',
      'You usually wait until you trust someone before you open up.',
      'When a new friend asks about your family or past, you tend to give short answers.',
    ],
    why: 'Taking time to trust protects you, but a friend may not realize you like them if you keep most things private.',
    try: [
      'Share one small personal detail with a new friend, so the friendship has something to build on.',
      'Tell a new friend you like them in a simple way, so they know you’re interested even if you’re quiet.',
    ],
    watch: [
      'Notice how much you share in the first few months of a friendship.',
      'Notice who knows the most about you and why.',
    ],
  }),
  idea('ftw_attachment_avoidance_h_12', ['attachment_avoidance:high'], {
    focus: [
      'When your plans depend on another person, you tend to want a way to do things on your own too.',
      'You usually keep your own money, space or routine, even with someone close.',
      'When a relationship asks for more of your time, you tend to feel your independence is at stake.',
    ],
    why: 'Holding on to your own life keeps you steady, but a partner might read it as you not being fully in.',
    try: [
      'Tell your partner what part of your independence matters most to you, so they know what you’re protecting.',
      'Choose one thing to share more fully this month, so closeness has room to grow on your terms.',
    ],
    watch: [
      'Notice which parts of your independence you guard most.',
      'Notice how your partner feels about the way you split time and space.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_07', ['attachment_avoidance:low'], {
    focus: [
      'When you’re happy about something, you tend to want to tell someone right away.',
      'You usually share good news with a friend or partner within minutes.',
      'When something funny happens, you tend to text it to someone close.',
    ],
    why: 'Sharing your day builds closeness, but someone with a busy day may not have the room to match your pace.',
    try: [
      'Keep a story for when a friend has time, so they can give it their full attention.',
      'Ask a friend how their day is before you share yours, so you meet them where they are.',
    ],
    watch: [
      'Notice how quickly a friend replies when you text during their workday.',
      'Notice who loves to hear your news and who prefers it later.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_08', ['attachment_avoidance:low'], {
    focus: [
      'When your partner or a friend wants time alone, you tend to wonder if something is wrong.',
      'You usually feel a little hurt when someone close asks for space.',
      'When a friend needs a quiet weekend, you tend to take it a bit personally.',
    ],
    why: 'Valuing closeness is a strength, but someone else’s need for space is usually about energy, not about you.',
    try: [
      'Ask the person “is this just a recharge?” so you check instead of assume.',
      'Plan something you enjoy while they have space, so the time apart has its own purpose.',
    ],
    watch: [
      'Notice what you think when a friend says they need time alone.',
      'Notice how the friend feels after the space.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_09', ['attachment_avoidance:low'], {
    focus: [
      'When you’re upset, you tend to reach for someone close rather than deal with it alone.',
      'You usually feel better after you talk to a partner, friend or family member.',
      'When a hard day ends, you tend to want to debrief with someone you trust.',
    ],
    why: 'Talking things out helps you feel supported, but relying on one person can leave them feeling like the only listener.',
    try: [
      'Talk to two or three different people this week, so no one carries it all.',
      'Write down what you want to say before you call, so the conversation is easy for both of you.',
    ],
    watch: [
      'Notice who you turn to first when you’re upset.',
      'Notice whether that person has the energy to listen that day.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_10', ['attachment_avoidance:low'], {
    focus: [
      'When you’re alone for a whole weekend, you tend to feel a little flat.',
      'You usually find long stretches without company hard.',
      'On a quiet Sunday, you tend to look for someone to talk to or do something with.',
    ],
    why: 'Wanting people around keeps your life warm, but time on your own is also a skill that gets easier with practice.',
    try: [
      'Spend one hour alone doing something you enjoy, so you see that it can feel good.',
      'Plan your solo time on a day you’re in a good mood, so it starts well.',
    ],
    watch: [
      'Notice how long it takes before you want company.',
      'Notice what you enjoy doing on your own.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_11', ['attachment_avoidance:low'], {
    focus: [
      'When you care about someone, you tend to want to know their whole life, not just the surface.',
      'You usually ask personal questions and hope the other person asks you back.',
      'When you meet someone you like, you tend to share a lot early on.',
    ],
    why: 'Opening up quickly makes people feel welcome, but some take longer to warm up and may feel rushed by you.',
    try: [
      'Ask a new friend one question and let them answer fully before you share, so they set the pace.',
      'Share a little less than you could in the first few chats, so the other person can catch up.',
    ],
    watch: [
      'Notice whether the other person matches how much you share.',
      'Notice how a friend acts if you slow down.',
    ],
  }),
  idea('ftw_attachment_avoidance_l_12', ['attachment_avoidance:low'], {
    focus: [
      'When you plan your future, you tend to picture the people you love in it.',
      'You usually make big choices with the people close to you in mind.',
      'When you think about moving or changing jobs, you tend to think first about who you’d leave behind.',
    ],
    why: 'Keeping people in your plans makes your choices warm, but it can slow down a decision that mostly affects you.',
    try: [
      'Write down what you want from a choice before you talk to anyone, so you know your own view.',
      'Ask someone close what they’d do in your place, so you hear a view without handing the choice over.',
    ],
    watch: [
      'Notice how much weight you give others when you decide.',
      'Notice what you would pick if no one else were affected.',
    ],
  }),
];
