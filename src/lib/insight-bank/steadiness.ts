/** Composure (steadiness): Steady (high) and Sensitive (low). */
import { idea, type InsightIdea } from './define';

export const STEADINESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_steadiness_h_01', ['steadiness:high'], {
    focus: [
      'When something goes wrong at work, you tend to stay calm while others get stressed.',
      'You usually stay calm when plans fall apart, even when others are upset.',
      'When a problem comes up, you tend to deal with it without getting upset.',
    ],
    why: 'Your calm helps others settle down, but people might not realize when something does bother you.',
    try: [
      'Tell a friend or partner about one thing that stressed you this week, so they know you have hard days too.',
      'Ask a stressed coworker what would help, so your calm turns into something useful for them.',
    ],
    watch: [
      'Notice when you say you’re fine but feel tired later.',
      'Notice how others act when you stay calm.',
    ],
  }),
  idea('ftw_steadiness_h_02', ['steadiness:high'], {
    focus: [
      'After an argument, you tend to move on quickly while the other person is still upset.',
      'You usually let go of a bad moment fast, even when others are still thinking about it.',
      'When a disagreement is over, you tend to feel done with it before your partner does.',
    ],
    why: 'Moving on fast keeps you steady, but someone else might need to talk it through before they feel okay.',
    try: [
      'Next time you disagree with someone, ask the other person if they want to talk more, so they don’t feel rushed.',
      'Text someone you argued with recently to check in, so they know it’s settled for both of you.',
    ],
    watch: [
      'Notice when you’re ready to move on but the other person isn’t.',
      'Notice whether a quick “it’s fine” leaves things unsaid.',
    ],
  }),
  idea('ftw_steadiness_h_03', ['steadiness:high'], {
    focus: [
      'When a friend is upset about something small, you tend to tell them it’s not a big deal.',
      'You usually see problems as smaller than others do, so people may feel you’re not taking them seriously.',
      'When someone is worried, you tend to want to calm them down before you hear the full story.',
    ],
    why: 'Your steady view can help, but people often need to feel heard before they can calm down.',
    try: [
      'Next time a friend is upset, say “that sounds hard” before anything else, so they feel heard.',
      'Ask one question about how someone feels before you share your view, so they know you care.',
    ],
    watch: [
      'Notice when you try to fix someone’s worry before they’ve finished talking.',
      'Notice how people respond when you just listen.',
    ],
  }),
  idea('ftw_steadiness_h_04', ['steadiness:high'], {
    focus: [
      'When you get bad news, you tend to deal with it and carry on with your day.',
      'You usually handle bad news without it taking over your whole day.',
      'When something goes wrong, you tend to feel more settled by the next day.',
    ],
    why: 'Bouncing back quickly is a real strength, but some things might deserve more of your attention than they get.',
    try: [
      'Take five minutes tonight to think about one hard thing from this week, so it gets the attention it needs.',
      'Write down how you actually felt about a recent setback, so you can see if it’s really settled.',
    ],
    watch: [
      'Notice when moving on quickly means skipping something worth a closer look.',
      'Notice what does bother you, even a little.',
    ],
  }),
  idea('ftw_steadiness_h_05', ['steadiness:high'], {
    focus: [
      'When friends or family are stressed, they tend to come to you because you stay calm.',
      'People tend to call you first when something goes wrong.',
      'When there’s a crisis in your family or friend group, you tend to be the one who handles it.',
    ],
    why: 'Being the calm one helps the people you care about, but you might need someone to lean on too.',
    try: [
      'Ask a friend how they’re doing and then share something of your own, so support goes both ways.',
      'Tell someone close one thing that’s been on your mind, so you get a turn to be listened to.',
    ],
    watch: [
      'Notice whether anyone checks on you the way you check on them.',
      'Notice when you feel tired from being the steady one.',
    ],
  }),
  idea('ftw_steadiness_h_06', ['steadiness:high', 'attachment_anxiety:low'], {
    focus: [
      'When a partner or friend is quiet for a day, you tend to assume they’re just busy.',
      'You usually don’t worry when someone takes a while to text back.',
      'When plans with a friend go quiet, you tend to trust it’ll work out.',
    ],
    why: 'Your trust keeps relationships relaxed, but a friend might sometimes need you to check in first.',
    try: [
      'Text a friend you haven’t heard from in a while, so they know you’re thinking of them.',
      'Ask your partner or a close friend if there’s anything on their mind, so nothing gets missed.',
    ],
    watch: [
      'Notice when a friend’s silence lasts longer than usual.',
      'Notice who usually reaches out first between you and your friends.',
    ],
  }),
  idea('ftw_steadiness_l_01', ['steadiness:low'], {
    focus: [
      'After a conversation, you tend to replay what you said and wonder how it came across.',
      'You usually think about awkward moments long after everyone else has forgotten them.',
      'When you say something you’re unsure about, you tend to go over it again that night.',
    ],
    why: 'Caring how you come across shows you value people, but replaying it can keep you up and drain your energy.',
    try: [
      'Write the moment down with one kinder way to see it, so it stops looping in your head.',
      'Text the person a quick follow-up if it’s really bugging you, so you can stop guessing.',
    ],
    watch: [
      'Notice when you replay a conversation more than once.',
      'Notice how often the other person even remembers the moment.',
    ],
  }),
  idea('ftw_steadiness_l_02', ['steadiness:low'], {
    focus: [
      'When something good or bad happens, you tend to feel it more strongly than the people around you.',
      'You usually feel the ups and downs of your day more than others do.',
      'When a small thing goes wrong, you tend to feel it for the rest of the day.',
    ],
    why: 'Feeling things deeply helps you understand others, but it can make a small problem take up a lot of your day.',
    try: [
      'Take three slow breaths before you react to the next bad news, so the feeling has a moment to settle.',
      'Write down what’s bothering you and rate it from one to ten, so you can see its real size.',
    ],
    watch: [
      'Notice how big a feeling is at first and how big it is an hour later.',
      'Notice which situations hit you harder than others.',
    ],
  }),
  idea('ftw_steadiness_l_03', ['steadiness:low'], {
    focus: [
      'When your boss gives you feedback, you tend to hear the criticism louder than the praise.',
      'You usually remember the one critical comment more than all the good ones.',
      'When someone points out a mistake, you tend to feel it for a while afterward.',
    ],
    why: 'You take feedback seriously, which helps you improve, but it can also make one comment feel bigger than it was meant.',
    try: [
      'Next time you get feedback, write down one good thing that was said too, so you keep the full picture.',
      'Ask the person what they think you did well, so you hear both sides.',
    ],
    watch: [
      'Notice when one critical comment shapes your whole view of a day.',
      'Notice how often feedback was meant more lightly than it felt.',
    ],
  }),
  idea('ftw_steadiness_l_04', ['steadiness:low'], {
    focus: [
      'Before a big event, you tend to worry about everything that might go wrong.',
      'You usually feel nervous for days before a hard conversation or an important plan.',
      'When something important is coming up, you tend to picture all the ways it could go badly.',
    ],
    why: 'Thinking ahead helps you prepare, but the worry can end up bigger than the event itself.',
    try: [
      'Write down your top worry and one thing you can do about it, so the worry turns into a plan.',
      'Plan something calming the night before your next big day, so you have something to look forward to.',
    ],
    watch: [
      'Notice how often the event goes better than you feared.',
      'Notice when worry stops helping you prepare.',
    ],
  }),
  idea('ftw_steadiness_l_05', ['steadiness:low'], {
    focus: [
      'When someone near you is in a bad mood, you tend to feel it too.',
      'You usually pick up on tension in a room before anyone says anything.',
      'When a friend or partner is upset, you tend to feel upset along with them.',
    ],
    why: 'Sensing others’ moods helps you care for people, but their bad day can end up becoming yours.',
    try: [
      'Next time you feel someone’s bad mood, take a short break alone, so you can tell your feelings from theirs.',
      'Ask yourself whose feeling it is before you react, so you don’t carry what isn’t yours.',
    ],
    watch: [
      'Notice when your mood shifts right after being around someone upset.',
      'Notice which people leave you feeling calmer.',
    ],
  }),
  idea('ftw_steadiness_l_06', ['steadiness:low', 'attachment_anxiety:high'], {
    focus: [
      'When a partner’s reply is shorter than usual, you tend to worry something is wrong.',
      'You usually notice small changes in how people talk to you and wonder what changed.',
      'When someone close seems distant, you tend to feel it right away and start to worry.',
    ],
    why: 'Noticing small changes shows how much you care, but it can make you worry before you know there’s anything wrong.',
    try: [
      'Next time you feel that worry, ask the person how their day is going, so you get real information.',
      'Put your phone away for half an hour after sending a message, so you’re not waiting on the reply.',
    ],
    watch: [
      'Notice what you assume when a reply is shorter than usual.',
      'Notice how often the reason turns out to have nothing to do with you.',
    ],
  }),
  idea('ftw_steadiness_h_07', ['steadiness:high'], {
    focus: [
      'When something unexpected happens, like a delay or a change of plans, you tend to take it in stride.',
      'You usually stay level when things go sideways, even when others are rattled.',
      'When a plan falls apart at the last minute, you tend to work out a new one calmly.',
    ],
    why: 'Staying level helps you act while others freeze, but friends might not realize something is bothering you.',
    try: [
      'Tell someone close how a stressful moment felt for you, so they know what is going on behind the calm.',
      'Say out loud what you’re doing next in a tense moment, so others can follow your lead.',
    ],
    watch: [
      'Notice how others look to you when things go wrong.',
      'Notice whether you feel the stress later, after the moment is over.',
    ],
  }),
  idea('ftw_steadiness_h_08', ['steadiness:high'], {
    focus: [
      'When someone cries or gets very emotional near you, you tend to stay calm and stay close.',
      'You usually stay steady when a friend is upset instead of getting upset with them.',
      'When a friend tells you something heavy, you tend to listen without reacting a lot.',
    ],
    why: 'Your calm can make it feel safe to talk, but a friend might read a quiet face as you not being moved.',
    try: [
      'Say one sentence about how it feels to hear what a friend shared, so they know you care.',
      'Ask “how can I help?” when a friend is upset, so your calm turns into support.',
    ],
    watch: [
      'Notice how friends react to your calm when they’re upset.',
      'Notice whether you show care with words or only by staying.',
    ],
  }),
  idea('ftw_steadiness_h_09', ['steadiness:high'], {
    focus: [
      'When you get criticism at work, you tend to think it over without taking it personally.',
      'You usually hear feedback as information and decide what to do with it.',
      'After a hard review, you tend to feel okay by the end of the day.',
    ],
    why: 'Taking feedback without getting shaken helps you improve, but you might skip over a point that matters because it didn’t sting.',
    try: [
      'Write down one piece of feedback and one action you’ll take, so it doesn’t fade away.',
      'Ask your boss a follow-up question about the feedback, so you know what they care about most.',
    ],
    watch: [
      'Notice which feedback you let go of too fast.',
      'Notice whether you bring it up again after a few days.',
    ],
  }),
  idea('ftw_steadiness_h_10', ['steadiness:high'], {
    focus: [
      'When you’re in a stressful stretch, you tend to keep going and say little about how it feels.',
      'You usually handle busy weeks without complaining, so people may not notice you’re stretched.',
      'During a rough month, you tend to look fine on the outside even when you’re tired.',
    ],
    why: 'Handling things quietly shows strength, but people can’t help if they can’t tell you’re carrying a lot.',
    try: [
      'Tell one person this week that you’ve had a lot on, so they can check in with you.',
      'Cancel or move one small thing in a busy week, so you have some space.',
    ],
    watch: [
      'Notice how tired you are on the days you say you’re fine.',
      'Notice who would help if you told them.',
    ],
  }),
  idea('ftw_steadiness_h_11', ['steadiness:high'], {
    focus: [
      'When you wake up after a bad day, you tend to feel like it’s a fresh start.',
      'You usually don’t carry yesterday’s mood into today.',
      'After a hard night of sleep, you tend to bounce back quickly once the day gets going.',
    ],
    why: 'Starting fresh helps you keep going, but a mood you skip past can come back if it’s not looked at.',
    try: [
      'Take two minutes at the end of a bad day to note what caused it, so you can fix it for tomorrow.',
      'Plan one easy, enjoyable thing after a rough day, so it ends well.',
    ],
    watch: [
      'Notice whether the same thing keeps ruining your days.',
      'Notice what helps you reset the fastest.',
    ],
  }),
  idea('ftw_steadiness_h_12', ['steadiness:high'], {
    focus: [
      'When a friend is panicking about something, you tend to tell them it will work out.',
      'You usually try to calm a worried friend with reasons not to worry.',
      'When someone near you is anxious about a decision, you tend to say it’s going to be fine.',
    ],
    why: 'Reassurance can help, but a worried friend may feel unheard if you jump to “it will be fine” before they finish.',
    try: [
      'Ask a worried friend what part is hardest before you reassure them, so you answer the real worry.',
      'Repeat back what a friend said in one sentence, so they know you heard them.',
    ],
    watch: [
      'Notice how a friend reacts when you reassure them quickly.',
      'Notice when you want to fix the feeling more than hear it.',
    ],
  }),
  idea('ftw_steadiness_l_07', ['steadiness:low'], {
    focus: [
      'After a stressful day, you tend to keep thinking about it at night.',
      'You usually find it hard to switch off when something is unresolved.',
      'When you lie down to sleep, you tend to replay the hard parts of the day.',
    ],
    why: 'Thinking things over means you take them seriously, but it can cost you sleep, which makes the next day harder.',
    try: [
      'Write down tomorrow’s first task before bed, so your mind has less to hold.',
      'Take a ten-minute walk or shower after work, so the day has a clear end.',
    ],
    watch: [
      'Notice what time your mind starts to replay the day.',
      'Notice how you feel after you write a worry down.',
    ],
  }),
  idea('ftw_steadiness_l_08', ['steadiness:low'], {
    focus: [
      'When you get good news, you tend to feel it more strongly than the people around you.',
      'You usually feel happy moments deeply, and they can stay with you for a long time.',
      'When a friend does something kind, you tend to be moved by it.',
    ],
    why: 'Feeling strongly makes good moments richer for you, but the same strength can make the low moments hit harder.',
    try: [
      'Tell a friend about one thing that made you happy today, so you enjoy it twice.',
      'Write one good moment down each day this week, so you can find them on a hard day.',
    ],
    watch: [
      'Notice what small things lift your mood the most.',
      'Notice how long a good feeling lasts compared with a bad one.',
    ],
  }),
  idea('ftw_steadiness_l_09', ['steadiness:low'], {
    focus: [
      'When you’re tired or hungry, you tend to feel upset about small things.',
      'You usually notice your mood dip when you haven’t slept or eaten well.',
      'On a day with little sleep, you tend to react more strongly than usual.',
    ],
    why: 'Your mood follows your body closely, so a basic need that isn’t met can look like a big problem.',
    try: [
      'Eat something and drink water before you decide how bad a problem is, so you judge it with a full tank.',
      'Plan a hard conversation for after a good night’s sleep, so you can handle it better.',
    ],
    watch: [
      'Notice how often your worst moods come when you’re tired or hungry.',
      'Notice how a problem looks after you’ve eaten or slept.',
    ],
  }),
  idea('ftw_steadiness_l_10', ['steadiness:low'], {
    focus: [
      'When plans change suddenly, you tend to feel thrown for a while.',
      'You usually need a little time to adjust when something unexpected happens.',
      'When you hear bad news, you tend to feel it in your body before you can think clearly.',
    ],
    why: 'Feeling it first is a normal response, but making big decisions in that moment can lead to choices you’d change later.',
    try: [
      'Tell people “I need a few minutes” after surprising news, so you can take the time you need.',
      'Take five slow breaths before you reply to an upsetting message, so your answer is calmer.',
    ],
    watch: [
      'Notice how long it takes before you can think clearly after a surprise.',
      'Notice whether you make a different choice after a night’s sleep.',
    ],
  }),
  idea('ftw_steadiness_l_11', ['steadiness:low'], {
    focus: [
      'When a friend sounds a little different on the phone, you tend to pick up on it right away.',
      'You usually notice small changes in how people act or sound.',
      'When someone’s tone shifts in a meeting, you tend to feel it even if no one says anything.',
    ],
    why: 'Noticing small changes makes you caring, but it can also lead you to read worry into something that was nothing.',
    try: [
      'Ask the person “is everything okay?” once, so you check instead of guess.',
      'Wait a day before you act on a change you noticed, so you can see whether it was a one-time thing.',
    ],
    watch: [
      'Notice how often your guesses about someone’s mood turn out right.',
      'Notice what you do after you pick up on a shift.',
    ],
  }),
  idea('ftw_steadiness_l_12', ['steadiness:low'], {
    focus: [
      'When you watch a sad or intense show, you tend to feel it for a while afterward.',
      'You usually carry the mood of a movie or the news with you for the rest of the evening.',
      'After reading upsetting news, you tend to feel low even though it didn’t happen to you.',
    ],
    why: 'Feeling for other people is a strength, but too much heavy news in a day can leave you worn out.',
    try: [
      'Pick a set time for news each day instead of checking all day, so it has an end.',
      'Follow a heavy show with something light, so your mood has a way to shift.',
    ],
    watch: [
      'Notice how much news you take in before your mood drops.',
      'Notice what helps your mood recover after heavy content.',
    ],
  }),
];
