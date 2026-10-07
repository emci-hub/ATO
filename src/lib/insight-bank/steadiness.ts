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
      'You usually see problems as smaller than others do, which can feel like you’re not taking them seriously.',
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
      'When something goes wrong, you tend to sleep fine and feel better by morning.',
    ],
    why: 'Bouncing back quickly is a real strength, but some things might deserve more of your attention than they get.',
    try: [
      'Take five minutes tonight to think about one hard thing from this week, so it gets the attention it needs.',
      'Write down how you actually felt about a recent setback, so you know it’s been dealt with.',
    ],
    watch: [
      'Notice when moving on quickly means skipping something you should look at.',
      'Notice what does bother you, even a little.',
    ],
  }),
  idea('ftw_steadiness_h_05', ['steadiness:high'], {
    focus: [
      'When friends or family are stressed, they tend to come to you because you stay calm.',
      'You’re usually the person people call when something goes wrong.',
      'When there’s a crisis in your family or friend group, you tend to be the one who handles it.',
    ],
    why: 'Being the calm one is a gift to people you care about, but you might need someone to lean on too.',
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
    why: 'Thinking ahead helps you prepare, but the worry can feel worse than the event usually turns out to be for you.',
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
      'Notice when you start guessing what a short reply means.',
      'Notice how often the reason turns out to have nothing to do with you.',
    ],
  }),
];
