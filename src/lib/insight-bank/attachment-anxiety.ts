/** Reassurance (attachment_anxiety): Watchful (high) and Trusting (low). Private on every share surface. */
import { idea, type InsightIdea } from './define';

export const ATTACHMENT_ANXIETY_IDEAS: readonly InsightIdea[] = [
  idea('ftw_attachment_anxiety_h_01', ['attachment_anxiety:high'], {
    focus: [
      'When someone takes a while to reply, you tend to check your phone more and wonder why.',
      'You usually notice when a friend is slower to text back than usual.',
      'When a message is left on read, you tend to think about it more than you’d like.',
    ],
    why: 'You care about staying close, so a gap in contact can feel like a sign of distance even when it isn’t.',
    try: [
      'Put your phone in another room for twenty minutes after you text someone, so you’re not waiting on it.',
      'Text a different friend while you wait, so your attention isn’t on one reply.',
    ],
    watch: [
      'Notice how many times you check for a reply.',
      'Notice what the real reason turned out to be the last few times.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_02', ['attachment_anxiety:high'], {
    focus: [
      'When you’re unsure where you stand with someone, you tend to ask if everything is okay.',
      'You usually feel better once a partner or friend tells you things are fine.',
      'When a relationship feels uncertain, you tend to look for signs that it’s still good.',
    ],
    why: 'Wanting reassurance is normal, but asking often can leave you feeling less sure instead of more.',
    try: [
      'Before you ask if things are okay, write down three recent signs that they are, so you can see them.',
      'Tell your partner or a close friend one thing you need when you’re unsure, so they can help.',
    ],
    watch: [
      'Notice how long the relief lasts after someone reassures you.',
      'Notice what tends to set off the worry.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_03', ['attachment_anxiety:high'], {
    focus: [
      'When a friend cancels plans, you tend to wonder if they’re upset with you.',
      'You usually take a cancelled plan a little personally, even when the reason is simple.',
      'When someone backs out of plans, you tend to look for what you might have done.',
    ],
    why: 'Caring about the friendship makes you look for reasons, but most cancellations are about the other person’s day.',
    try: [
      'Text your friend a new date when they cancel, so you focus on the next plan.',
      'Write down the reason they gave and leave it at that, so you don’t fill in a different one.',
    ],
    watch: [
      'Notice when you add a reason that nobody gave.',
      'Notice how the friendship feels the next time you see them.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_04', ['attachment_anxiety:high'], {
    focus: [
      'When your partner seems a little off, you tend to wonder if it has something to do with you.',
      'You usually pick up on small changes in how close people act toward you.',
      'When someone close is quieter than usual, you tend to think about what you might have said.',
    ],
    why: 'You read people closely, which helps you care for them, but it can also lead you to blame yourself first.',
    try: [
      'Ask your partner how their day was, so you learn what’s really going on.',
      'Tell yourself one other reason they might be quiet, so your first guess isn’t the only one.',
    ],
    watch: [
      'Notice when your first guess is that you did something wrong.',
      'Notice how often the real reason was about their day.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_05', ['attachment_anxiety:high'], {
    focus: [
      'When you worry a friendship is slipping, you tend to give more of your time to keep it close.',
      'You usually try harder with people when you sense distance.',
      'When a friend seems less interested, you tend to reach out more often.',
    ],
    why: 'Putting in effort shows you care, but sometimes the other person just needs time, not more from you.',
    try: [
      'Wait a day before sending your next message to someone who feels distant, so you can see how you feel.',
      'Spend an evening on something you enjoy, so your mood isn’t tied to one friendship.',
    ],
    watch: [
      'Notice when you reach out to calm your own worry rather than to connect.',
      'Notice whether the other person reaches out too when you give them space.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_06', ['attachment_anxiety:high', 'attachment_avoidance:low'], {
    focus: [
      'You tend to want lots of closeness with a partner, and short gaps in contact can feel long.',
      'When you’re close to someone, you usually want to talk often and feel unsure after quiet days.',
      'You tend to feel best in relationships with daily contact, and quieter stretches can worry you.',
    ],
    why: 'Wanting closeness is a strength in relationships, and saying what you need can help a partner give it to you.',
    try: [
      'Tell your partner how often you like to talk, so you both know what feels good.',
      'Plan a call or visit ahead of time, so you have something to look forward to on quiet days.',
    ],
    watch: [
      'Notice how you feel on days with less contact.',
      'Notice whether a partner knows how much contact you like.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_01', ['attachment_anxiety:low'], {
    focus: [
      'When a friend is slow to reply, you usually don’t think twice about it.',
      'You tend to trust that a friendship is fine, even if you haven’t talked in weeks.',
      'When you haven’t heard from someone in a while, you usually assume things are still good.',
    ],
    why: 'Your trust keeps your friendships relaxed, but some friends might read your quiet as you not caring.',
    try: [
      'Text a friend you haven’t talked to in a while, so they know you still think of them.',
      'Send a quick check-in to someone who’s been quiet, so they know you noticed.',
    ],
    watch: [
      'Notice which friends you only hear from when they reach out first.',
      'Notice if anyone seems surprised when you do check in.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_02', ['attachment_anxiety:low'], {
    focus: [
      'When your partner goes out without you, you usually feel fine and enjoy your own time.',
      'You tend to feel relaxed when a partner spends time with their own friends.',
      'When someone close is busy for a few days, you usually don’t take it personally.',
    ],
    why: 'Feeling settled in a relationship gives both of you room, but a partner may want you to say you missed them.',
    try: [
      'Tell your partner or a close friend you missed them after time apart, so they know it mattered.',
      'Ask how their time away went, so they feel you were thinking of them.',
    ],
    watch: [
      'Notice whether people close to you want more check-ins than you do.',
      'Notice how a partner reacts when you say you missed them.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_03', ['attachment_anxiety:low'], {
    focus: [
      'When a message sounds a bit cold, you tend to read it as rushed rather than upset.',
      'You usually assume a short text means someone is busy, not annoyed.',
      'When a coworker’s email sounds blunt, you tend to read it as a busy day.',
    ],
    why: 'Reading messages kindly saves you a lot of worry, though it can mean you sometimes miss when someone is upset.',
    try: [
      'If a message feels off, ask a simple “all good?” so you know for sure.',
      'Reply to one short message with a warm note, so the conversation stays easy.',
    ],
    watch: [
      'Notice when a short reply might actually mean something more.',
      'Notice how people respond when you check in lightly.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_04', ['attachment_anxiety:low'], {
    focus: [
      'You tend to feel sure of your close relationships without needing to hear it often.',
      'When things are good with a partner, you usually don’t feel a need to talk about it.',
      'You usually trust how people feel about you without asking.',
    ],
    why: 'Feeling sure helps you relax, but people close to you might still like to hear how much they matter to you.',
    try: [
      'Tell one person today what you like about them, so they don’t have to guess.',
      'Send a partner or friend a short message saying you’re glad they’re around, so they hear it.',
    ],
    watch: [
      'Notice who in your life likes to hear things out loud.',
      'Notice how people react when you say something kind out of nowhere.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_05', ['attachment_anxiety:low'], {
    focus: [
      'When you meet someone new, you tend to trust them quickly and open up.',
      'You usually believe people mean what they say, even early on.',
      'When a new friend makes a promise, you tend to believe they’ll keep it.',
    ],
    why: 'Trusting people helps relationships grow fast, but it helps you to see how someone acts over time too.',
    try: [
      'Pay attention to whether a new friend follows through on one small plan, so trust has something to build on.',
      'Give a new friendship a few weeks before sharing your most private things, so trust can grow both ways.',
    ],
    watch: [
      'Notice whether what people say matches what they do.',
      'Notice who keeps their small promises.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_06', ['attachment_anxiety:low', 'extraversion:high'], {
    focus: [
      'You tend to make friends easily and don’t worry much about where you stand with them.',
      'When you’re out with people, you usually feel at ease and assume they like having you there.',
      'You tend to feel comfortable in new groups and trust people will warm up to you.',
    ],
    why: 'Feeling at ease helps others relax around you, but a quieter friend might need more from you to feel close.',
    try: [
      'Ask a quieter friend to do something one-on-one, so they get your full attention.',
      'Text someone you met recently to follow up, so the new friendship has a next step.',
    ],
    watch: [
      'Notice which friends you see only in groups.',
      'Notice who might want more one-on-one time with you.',
    ],
  }),
];
