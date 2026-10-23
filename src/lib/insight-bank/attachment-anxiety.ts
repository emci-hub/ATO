/** Reassurance (attachment_anxiety): Watchful (high) and Trusting (low). Private on every share surface. */
import { idea, type InsightIdea } from './define';

export const ATTACHMENT_ANXIETY_IDEAS: readonly InsightIdea[] = [
  idea('ftw_attachment_anxiety_h_01', ['attachment_anxiety:high'], {
    focus: [
      'A friend is slow to text back, and you usually check your phone again before the bus stops.',
      'On the couch, your phone stays face up, and a slow reply can pull your eyes back to the screen.',
      'A read receipt at dinner can stay with you, and you open the chat again to see if anything new arrived.',
    ],
    why: 'You care about staying close, so a quiet gap in a text thread can feel like distance even when your friend is just busy.',
    try: [
      'Put your phone in the kitchen for twenty minutes after you text a friend, so you’re not watching the screen.',
      'Text a different friend while one reply is still missing, so the evening isn’t hanging on a single chat.',
    ],
    watch: [
      'Notice how many times you open a chat that still has no new message.',
      'Notice what the slow reply turned out to be the last few times.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_02', ['attachment_anxiety:high'], {
    focus: [
      'A short text from your partner can send you a “you good?” before the night is over.',
      'At the end of a quiet dinner, you sometimes ask if everything is okay before the check arrives.',
      'You sometimes open old messages when the week has felt shaky, looking for a sign things are still good.',
    ],
    why: 'Asking “are we okay?” can settle you for an evening, but the relief fades fast, so another way to feel steady helps you too.',
    try: [
      'Before you ask if things are okay, write three recent signs that they are, so you can see them on the page.',
      'Tell your partner one thing that helps when you feel unsure, so they know what to say next time.',
    ],
    watch: [
      'Notice how long the calm lasts after someone tells you things are fine.',
      'Notice what usually starts the worry, a short text or a quiet night.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_03', ['attachment_anxiety:high'], {
    focus: [
      'A friend cancels dinner, and you can spend the walk home wondering if you did something wrong.',
      'The dropped plan stays on your calendar, and you usually take it personally even when the reason was plain.',
      'A friend drops Saturday in the group chat, and you scroll back for something you might have said.',
    ],
    why: 'You look for a reason because the friendship matters, but a cancellation is often just about their day.',
    try: [
      'Text your friend a new date when they cancel, so the chat turns toward the next plan.',
      'Write down the reason they gave and stop there, so you don’t fill in a different one.',
    ],
    watch: [
      'Notice when you add a reason that nobody in the chat actually gave.',
      'Notice how the friendship feels the next time you sit down with them.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_04', ['attachment_anxiety:high'], {
    focus: [
      'Your partner is quiet in the kitchen after work, and the first thought can be that it is about you.',
      'A close friend’s texts get shorter than yesterday, and you usually notice before anyone says why.',
      'After dinner on the couch, someone close is quieter, and you might replay what you said that morning.',
    ],
    why: 'You notice a quiet mood quickly, which helps you look after people, but it can also send you to blame yourself first.',
    try: [
      'Ask your partner how their day went, so you hear what is actually going on.',
      'Tell yourself one other reason they might be quiet, so the first guess isn’t the only one.',
    ],
    watch: [
      'Notice when your first guess is that you said the wrong thing.',
      'Notice how often the real reason was their day, not something you did.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_05', ['attachment_anxiety:high'], {
    focus: [
      'A quieter friendship can push you to offer another evening this week, just to keep it close.',
      'You sometimes send another text before a friend has answered the last one.',
      'After a few days of them not starting the chat, you sometimes reach out more than you did last month.',
    ],
    why: 'Extra messages show you care, but sometimes the other person just needs a day, not another text from you.',
    try: [
      'Wait a few hours before the next message to someone who feels distant, so you can see how you feel.',
      'Take an evening for a show or a walk you like, so your mood isn’t tied to one chat.',
    ],
    watch: [
      'Notice when you text to calm your own worry rather than to talk.',
      'Notice whether they reach out too once you leave the chat alone for a day.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_06', ['attachment_anxiety:high', 'attachment_avoidance:low'], {
    focus: [
      'A day with no text from your partner can feel long, and you usually want a goodnight message.',
      'A quiet Sunday with someone close can leave you unsure, even after a week of daily check-ins.',
      'Your week sits easier when a call is on the calendar, and a stretch with no plan can worry you.',
    ],
    why: 'Daily contact is part of how you feel close, and saying how often you like to talk can help a partner give it to you.',
    try: [
      'Tell your partner how often you like to talk, so you both know what a good week looks like.',
      'Plan a call or a visit ahead of time, so a quiet day still has something on the calendar.',
    ],
    watch: [
      'Notice how you feel on days with fewer texts from them.',
      'Notice whether your partner knows how much contact you like.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_01', ['attachment_anxiety:low'], {
    focus: [
      'A friend is slow to reply, and you usually pocket your phone and finish the bus ride.',
      'A few weeks can pass with no text, and you still trust the friendship is fine.',
      'Silence from someone you know usually reads to you as a busy week, not a problem between you.',
    ],
    why: 'Your easy trust keeps friendships relaxed, but a quiet phone can look to some friends like you stopped caring.',
    try: [
      'Text a friend you haven’t talked to in a while, so they see you still in the thread.',
      'Send a short check-in to someone who has been quiet, so they know you noticed.',
    ],
    watch: [
      'Notice which friends you only hear from when they text you first.',
      'Notice if anyone seems surprised when you do send a check-in.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_02', ['attachment_anxiety:low'], {
    focus: [
      'Your partner heads out without you, and you usually take the couch for your own evening.',
      'Saturday with their friends usually feels fine to you, and you keep the plan you already had.',
      'A few busy days from someone close usually don’t feel personal, and you wait until they’re free.',
    ],
    why: 'Feeling settled gives both of you room, but a partner may still want to hear that you missed them.',
    try: [
      'Tell your partner you missed them after a night apart, so they know the time mattered.',
      'Ask how their night out went, so they can tell you were thinking of them.',
    ],
    watch: [
      'Notice whether people close to you want more check-in texts than you send.',
      'Notice how a partner reacts when you say you missed them after a night out.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_03', ['attachment_anxiety:low'], {
    focus: [
      'A cold-sounding text usually reads to you as someone typing between tasks.',
      'A one-word reply in the chat usually means busy to you, not a friend who is annoyed.',
      'A blunt email from a coworker can look like a full inbox, and you move on to the next one.',
    ],
    why: 'Reading a message kindly can save you a lot of worry, though you sometimes miss it when someone is actually upset.',
    try: [
      'If a message feels off, ask “all good?” in the thread, so you aren’t guessing.',
      'Reply to one short text with a warmer line, so the thread stays easy.',
    ],
    watch: [
      'Notice when a short reply might mean more than a busy hour.',
      'Notice how people respond when you check in with one light question.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_04', ['attachment_anxiety:low'], {
    focus: [
      'A good week with your partner can pass without you asking to hear that things are okay.',
      'Dinner can come and go while things are good, and you usually don’t turn it into a talk about the two of you.',
      'A friend’s care usually feels clear to you without a text that spells it out.',
    ],
    why: 'Feeling sure helps you relax at home, but people close to you might still like to hear that they matter.',
    try: [
      'Tell one person today what you like about them, so it isn’t left as a guess.',
      'Send a partner or a friend a short note that you’re glad they’re around, so they hear it.',
    ],
    watch: [
      'Notice who in your life likes things said out loud.',
      'Notice how people react when you send a kind text for no special reason.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_05', ['attachment_anxiety:low'], {
    focus: [
      'A new person at a party can get your trust quickly, and you might talk about your week on the way home.',
      'Over a second coffee, you usually believe a new friend means what they say.',
      'A Saturday promise from a new friend usually sounds true to you, and you plan your weekend around it.',
    ],
    why: 'Trusting people can help a new friendship move fast, but you might miss it when their plans don’t match what they said.',
    try: [
      'Look at whether a new friend keeps one small plan, so the trust has a real Saturday behind it.',
      'Give a new friendship a few weeks before you share a very private story, so trust can grow both ways.',
    ],
    watch: [
      'Notice whether what people say matches what they actually do.',
      'Notice who keeps a small promise, like showing up when they said they would.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_06', ['attachment_anxiety:low', 'extraversion:high'], {
    focus: [
      'A night out can leave you with new friends, and you usually don’t replay where you stand on the ride home.',
      'At a full table, you usually feel at ease and assume people are glad you came.',
      'A new group at dinner can feel easy, and you trust they’ll get comfortable with you once the food arrives.',
    ],
    why: 'Feeling at ease helps other people relax near you, but a quieter friend might need a plan that isn’t the whole group.',
    try: [
      'Ask a quieter friend to get food with just you, so they get your full attention.',
      'Text someone you met recently about a next plan, so the new friendship has a second step.',
    ],
    watch: [
      'Notice which friends you only see when the whole group is out.',
      'Notice who might want one plan with just you.',
    ],
  }),
];
