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
];
