/** Composure (steadiness): Steady (high) and Sensitive (low). */
import { idea, type InsightIdea } from './define';

export const STEADINESS_IDEAS: readonly InsightIdea[] = [
  idea('ftw_steadiness_h_01', ['steadiness:high'], {
    focus: [
      'When something goes wrong at work, you usually stay calm while other people get stressed.',
      'A plan that falls apart can leave you steady, even when the people around you are upset.',
      'You sometimes deal with a problem in the work chat without getting upset about it.',
    ],
    why: 'Your calm can help other people settle, but they might not realize when something does bother you.',
    try: [
      'Tell a friend or your partner one thing that stressed you this week, so they know you have hard days too.',
      'Ask a stressed coworker what would help right now, so your calm becomes a useful offer.',
    ],
    watch: [
      'Notice when you say you are fine and feel tired later.',
      'Notice how other people act when you stay calm.',
    ],
  }),
  idea('ftw_steadiness_h_02', ['steadiness:high'], {
    focus: [
      'After an argument, you usually move on while the other person is still upset.',
      'A bad moment can leave you done with it fast, even when your partner is still thinking about it.',
      'Once a disagreement is over, you sometimes feel finished before the other person does.',
    ],
    why: 'Moving on fast keeps you steady, but the other person might need to talk it through before they feel okay.',
    try: [
      'Next time you disagree, ask if they want to talk more, so they do not feel rushed.',
      'Text someone you argued with recently to check in, so you both know it is settled.',
    ],
    watch: [
      'Notice when you are ready to move on and the other person is not.',
      'Notice whether a quick “it is fine” leaves things unsaid.',
    ],
  }),
  idea('ftw_steadiness_h_03', ['steadiness:high'], {
    focus: [
      'When a friend is upset about something small, you usually tell them it is not a big deal.',
      'A worry that looks small to you can have you calming the person down before you have heard the whole story.',
      'You sometimes see a problem as smaller than the person telling it, and they can feel unheard.',
    ],
    why: 'Your steady view of a problem can help, but people often need to feel heard before they can calm down.',
    try: [
      'Next time a friend is upset, say that it sounds hard before you shrink it, so they feel heard.',
      'Ask one question about how a friend feels before you share your view, so they know you heard them.',
    ],
    watch: [
      'Notice when you try to shrink someone’s worry before they have finished talking.',
      'Notice how a friend responds when you listen and do not fix it yet.',
    ],
  }),
  idea('ftw_steadiness_h_04', ['steadiness:high'], {
    focus: [
      'When you get bad news, you usually deal with it and carry on with the rest of the day.',
      'A hard message can fail to take over your whole afternoon.',
      'When something goes wrong, you sometimes feel more settled by the next morning.',
    ],
    why: 'Getting back to the day quickly is a real strength, but some things might deserve more of your attention than they get.',
    try: [
      'Take five minutes tonight to think about one hard thing from this week, so it gets a real look.',
      'Write down how you actually felt about a recent setback, so you can see if it is really settled.',
    ],
    watch: [
      'Notice when moving on quickly means skipping something that deserved a closer look.',
      'Notice which piece of bad news does bother you, even a little.',
    ],
  }),
  idea('ftw_steadiness_h_05', ['steadiness:high'], {
    focus: [
      'When friends or family are stressed, they usually come to you because you stay calm.',
      'A crisis in the group chat can land in your messages first.',
      'You sometimes end up as the person who handles it when something goes wrong in the family.',
    ],
    why: 'Being the calm one helps the people you care about, but you might need someone who asks how you are too.',
    try: [
      'Ask a friend how they are doing and then share something of your own, so support goes both ways.',
      'Tell someone close one thing that has been on your mind, so you get a turn to be listened to.',
    ],
    watch: [
      'Notice whether anyone texts to check on you the way you check on them.',
      'Notice when you feel tired from being the steady one in the chat.',
    ],
  }),
  idea('ftw_steadiness_h_06', ['steadiness:high', 'attachment_anxiety:low'], {
    focus: [
      'When a partner or a friend is quiet for a day, you usually assume they are just busy.',
      'A slow reply can sit in your chat without you worrying about what it means.',
      'When plans with a friend go quiet, you sometimes trust it will work out and leave the thread.',
    ],
    why: 'Your trust keeps a relationship relaxed, but a friend might sometimes need you to check in first.',
    try: [
      'Text a friend you have not heard from in a while, so they know you are thinking of them.',
      'Ask your partner or a close friend if anything is on their mind, so nothing gets missed.',
    ],
    watch: [
      'Notice when a friend’s silence in the chat lasts longer than usual.',
      'Notice who usually sends the first text between you and your friends.',
    ],
  }),
  idea('ftw_steadiness_l_01', ['steadiness:low'], {
    focus: [
      'After a conversation, you usually replay what you said and wonder how it came across.',
      'An awkward line can stay with you that night, long after everyone else has forgotten it.',
      'You sometimes go over a thing you were unsure about once you are back on the couch.',
    ],
    why: 'Caring how you come across shows you value people, but replaying it can keep you up and drain the next day.',
    try: [
      'Write the moment down with one kinder way to see it, so it stops looping.',
      'Text the person a quick follow-up if it is really bugging you, so you can stop guessing.',
    ],
    watch: [
      'Notice when you replay a conversation on the couch more than once.',
      'Notice how often the other person even remembers the line you keep replaying.',
    ],
  }),
  idea('ftw_steadiness_l_02', ['steadiness:low'], {
    focus: [
      'A good thing or a bad thing can hit you harder than it hits the people around you.',
      'You usually feel the ups and downs of the day more than the coworkers in the same room.',
      'A small thing going wrong sometimes stays with you for the rest of the afternoon.',
    ],
    why: 'Feeling things strongly can help you understand other people, but a small problem can take up a lot of your day.',
    try: [
      'Take three slow breaths before you answer the next bad text, so the feeling has a moment to settle.',
      'Write down what is bothering you and rate it from one to ten, so you can see its size.',
    ],
    watch: [
      'Notice how big a feeling is at the first text and how big it is an hour later.',
      'Notice which kinds of news hit you harder than the rest of the day.',
    ],
  }),
  idea('ftw_steadiness_l_03', ['steadiness:low'], {
    focus: [
      'When your boss gives you notes, you usually hear the criticism louder than the praise.',
      'One critical line in a message can stay with you more than all the good lines around it.',
      'A pointed-out mistake sometimes sits with you for a while after the meeting ends.',
    ],
    why: 'You take the notes seriously, which helps you improve, but one comment can feel bigger than it was meant to.',
    try: [
      'Next time you get notes, write down one good thing that was said too, so you keep the full picture.',
      'Ask the person what they think you did well in the work, so you hear both sides of the note.',
    ],
    watch: [
      'Notice when one critical comment shapes your whole view of the day.',
      'Notice how often the note was meant more lightly than it felt.',
    ],
  }),
  idea('ftw_steadiness_l_04', ['steadiness:low'], {
    focus: [
      'Before a big event, you usually worry through the ways it might go wrong.',
      'A hard conversation on the calendar can make you nervous for days before it happens.',
      'When something important is coming up, you sometimes picture the bad versions in detail.',
    ],
    why: 'Thinking ahead can help you prepare, but the worry can end up bigger than the event itself.',
    try: [
      'Write down your top worry about the event and one thing you can do about it, so it turns into a plan.',
      'Plan something calming the night before your next big day, so you have a softer landing.',
    ],
    watch: [
      'Notice how often the event goes better than the version you pictured.',
      'Notice when the worry stops helping you prepare.',
    ],
  }),
  idea('ftw_steadiness_l_05', ['steadiness:low'], {
    focus: [
      'When someone near you is in a bad mood, you usually feel it too.',
      'Tension in a room can register with you before anyone has said what is wrong.',
      'If a friend or your partner is upset, you sometimes feel upset along with them.',
    ],
    why: 'Sensing other people’s moods helps you care for them, but their bad day can end up becoming yours.',
    try: [
      'Next time you catch someone’s bad mood, step out for a minute, so you can tell yours from theirs.',
      'Ask yourself whose feeling it is before you react, so you do not carry what is not yours.',
    ],
    watch: [
      'Notice when your mood shifts right after you have been around someone upset.',
      'Notice which people leave you calmer after you leave the room.',
    ],
  }),
  idea('ftw_steadiness_l_06', ['steadiness:low', 'attachment_anxiety:high'], {
    focus: [
      'When a partner’s reply is shorter than usual, you usually worry something is wrong.',
      'A small change in how someone texts you can have you wondering what shifted.',
      'If someone close seems distant in the chat, you sometimes feel it right away and start to worry.',
    ],
    why: 'Noticing a small change shows how much you care, but it can make you worry before you know anything is wrong.',
    try: [
      'Next time you feel that worry, ask how their day is going, so you get real information.',
      'Put your phone in another room for half an hour after you send a message, so you are not waiting on the reply.',
    ],
    watch: [
      'Notice what you assume when a partner’s reply is shorter than usual.',
      'Notice how often the short reply turns out to have nothing to do with you.',
    ],
  }),
];
