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
    why: 'Wanting reassurance is normal, but the relief from asking can fade fast, so it helps you to have other ways to feel steady.',
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
    why: 'Caring about the friendship makes you look for reasons, but a cancellation is often just about the other person’s day.',
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
      'Wait a few hours before sending your next message to someone who feels distant, so you can see how you feel.',
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
    why: 'Trusting people helps relationships grow fast, but it can also help you to see how someone acts over time.',
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
  idea('ftw_attachment_anxiety_h_07', ['attachment_anxiety:high'], {
    focus: [
      'When you see that a message was read but not answered, you tend to wonder what that means.',
      'You usually notice the “read” mark and feel uneasy when no reply comes.',
      'When someone is online but hasn’t texted you back, you tend to take it personally.',
    ],
    why: 'Noticing replies shows how much you value the person, but there are many reasons for a quiet phone that have nothing to do with you.',
    try: [
      'Write down two ordinary reasons someone might not have replied yet, so the worry has company.',
      'Put your phone in another room for twenty minutes after you send a message, so you stop checking.',
    ],
    watch: [
      'Notice how often the reason for a slow reply turns out to be simple.',
      'Notice what you do with your hands and eyes while you wait.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_08', ['attachment_anxiety:high'], {
    focus: [
      'After an argument with someone close, you tend to want to make up right away.',
      'You usually find it hard to leave a disagreement unresolved overnight.',
      'When you and a friend or partner are on bad terms, you tend to feel it all day.',
    ],
    why: 'Wanting to repair things shows you care, but pushing to fix it right away can leave the other person without time to cool down.',
    try: [
      'Tell the person “I’d like to talk when you’re ready,” so you share your need without pressing.',
      'Do something you enjoy for an hour while you wait for a reply, so the waiting is easier.',
    ],
    watch: [
      'Notice how the other person responds when you give them time.',
      'Notice what you feel in the hour before you reach out.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_09', ['attachment_anxiety:high'], {
    focus: [
      'When you feel unsure about a relationship, you tend to ask for reassurance more than once.',
      'You usually need to hear that things are okay, and the feeling fades after a day or two.',
      'When someone says they care about you, you tend to feel better for a while and then want to hear it again.',
    ],
    why: 'Asking for reassurance is a way of getting close, but if you ask often, the other person might start to feel pressure.',
    try: [
      'Write down three things the person has done that show they care, so you can read them when you doubt.',
      'Wait one day before you ask the same question again, so you see how you feel on your own.',
    ],
    watch: [
      'Notice how long the reassurance lasts each time.',
      'Notice what is happening right before you ask for it.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_10', ['attachment_anxiety:high'], {
    focus: [
      'When you see a friend’s photos with other people, you tend to wonder where you fit in.',
      'You usually notice who’s invited and who’s not, and think about why.',
      'When a friend posts a night out you weren’t at, you tend to feel a little left out.',
    ],
    why: 'Seeing a friend’s plans can touch on your wish to be included, but a post shows one moment, not how much a friend values you.',
    try: [
      'Text the friend about something fun you want to do soon, so you make a plan of your own.',
      'Skip photo feeds for one evening, so you see less of what you weren’t part of.',
    ],
    watch: [
      'Notice which posts make your mood dip.',
      'Notice how you feel after you reach out with a plan.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_11', ['attachment_anxiety:high'], {
    focus: [
      'When you write a message to someone close, you tend to reread it several times before sending.',
      'You usually think hard about how a message will sound before you send it.',
      'When you text a partner or a friend you care about, you tend to worry you said it wrong.',
    ],
    why: 'Taking care with words shows how much you value the person, but long rereading can make a simple message feel heavy.',
    try: [
      'Send the next message after one reread, so you practice letting it go.',
      'Tell yourself “this is good enough” before you hit send, so the habit has a stopping point.',
    ],
    watch: [
      'Notice how many times you read a message before you send it.',
      'Notice whether the other person ever reacts to the wording you worried about.',
    ],
  }),
  idea('ftw_attachment_anxiety_h_12', ['attachment_anxiety:high'], {
    focus: [
      'When your partner spends time with friends you don’t know, you tend to wonder if they’d rather be there.',
      'You usually feel a little uneasy when someone close is having fun without you.',
      'When a friend gets close to someone new, you tend to worry they’ll need you less.',
    ],
    why: 'Wanting to be important to the people you love is natural, but their other friendships rarely take anything away from yours.',
    try: [
      'Ask the person how their time with friends went, so you hear about it from them.',
      'Plan something you look forward to while they’re out, so the time apart has its own point.',
    ],
    watch: [
      'Notice what you picture when you’re apart.',
      'Notice how things feel once they’re back.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_07', ['attachment_anxiety:low'], {
    focus: [
      'When a friend is quiet for a week, you tend to assume they’re busy and reach out when it fits.',
      'You usually don’t take a gap in contact personally.',
      'When someone you like goes quiet, you tend to give them space without much thought.',
    ],
    why: 'Giving space keeps friendships relaxed, but a friend who is struggling might read your silence as not caring.',
    try: [
      'Send a quick “thinking of you” text to someone you haven’t heard from, so they know you’re around.',
      'Ask a friend how they’ve been after a long gap, so you catch up on what you missed.',
    ],
    watch: [
      'Notice which friends are quiet because they’re busy and which because something’s wrong.',
      'Notice how a short check-in lands.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_08', ['attachment_anxiety:low'], {
    focus: [
      'When a plan is loose, you tend to trust that your friend will follow through.',
      'You usually don’t need a confirmation text to feel sure a plan is on.',
      'When someone says “let’s catch up soon,” you tend to take it at face value.',
    ],
    why: 'Trusting people makes plans feel light for you, but without a date, a loose plan can drift away.',
    try: [
      'Suggest a specific day to a friend you said “soon” to, so the plan becomes real.',
      'Send a short message the day before a plan, so both of you remember.',
    ],
    watch: [
      'Notice which loose plans actually happened.',
      'Notice how often a date makes a plan more likely to happen.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_09', ['attachment_anxiety:low'], {
    focus: [
      'After an argument, you tend to feel okay about waiting until things calm down.',
      'You usually don’t need to settle a disagreement right away to feel secure.',
      'When a friend is upset with you, you tend to trust that things will be fine.',
    ],
    why: 'Waiting lets tempers cool, but a friend who needs to talk may feel you’re not as bothered as they are.',
    try: [
      'Tell the other person “I’m okay, and I’m up for talking whenever you are,” so they know you care.',
      'Check in the next day after an argument, so it doesn’t sit open for a week.',
    ],
    watch: [
      'Notice whether the other person needs more attention than you gave.',
      'Notice how a quick check-in changes how things feel.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_10', ['attachment_anxiety:low'], {
    focus: [
      'When a close friend or partner needs reassurance, you tend to find it hard to see why.',
      'You usually feel secure without hearing it often, so a friend’s need for it can surprise you.',
      'When someone asks if you’re still okay, you tend to wonder why they’re asking.',
    ],
    why: 'Your steadiness can feel safe to others, but people who need more reassurance may read your calm as distance.',
    try: [
      'Tell a friend one thing you appreciate about them today, so they hear it without asking.',
      'Ask someone close what helps them feel sure of you, so you can give it easily.',
    ],
    watch: [
      'Notice who in your life likes to hear that they matter.',
      'Notice how a kind word from you lands.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_11', ['attachment_anxiety:low'], {
    focus: [
      'When a relationship is going well, you tend to enjoy it without looking for signs it might end.',
      'You usually take good times at face value instead of waiting for a problem.',
      'In a new relationship, you tend to let it develop without much worry.',
    ],
    why: 'Enjoying things as they are keeps you relaxed, but small signs of trouble may go unnoticed until they feel bigger.',
    try: [
      'Ask your partner or friend once a month how things feel for them, so you hear it directly.',
      'Say one small thing that bugged you recently, so it gets said while it’s small.',
    ],
    watch: [
      'Notice what you do when you sense a small tension.',
      'Notice how the other person responds when you check in.',
    ],
  }),
  idea('ftw_attachment_anxiety_l_12', ['attachment_anxiety:low'], {
    focus: [
      'When you and a friend have a few busy weeks apart, you tend to pick up where you left off.',
      'You usually find friendships easy to return to after a long gap.',
      'When you see an old friend again, you tend to feel as close as you ever were.',
    ],
    why: 'Easy reunions help your friendships last, but a friend who felt dropped may need a word about it first.',
    try: [
      'Start your next catch-up with “I’ve missed you,” so the friend knows the gap wasn’t about them.',
      'Set a rough date to talk again before you hang up, so the next gap is shorter.',
    ],
    watch: [
      'Notice how an old friend reacts when you say you missed them.',
      'Notice who you would call if you had a free hour today.',
    ],
  }),
];
