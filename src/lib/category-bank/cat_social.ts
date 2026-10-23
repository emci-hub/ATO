/** Everyday social time: Sociability + Harmony + Playfulness (bar). */
import type { BarCard } from './define';

export const CAT_SOCIAL: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You bring a warm hello and a joke when you sit down with friends or coworkers.',
        'When you’re with friends or coworkers, you keep the talk friendly and the mood light.',
        'You make a social plan feel easy: a place, a time and a reason to laugh.',
      ],
      strength: [
        'You make people feel welcome, and the room gets looser once you sit down.',
        'When a group goes quiet, you start the talk and get a laugh going.',
        'You get along with a lot of different people at the same table.',
      ],
      watchOut: [
        'Sometimes you keep the joke going when someone needs to talk about something serious.',
        'Because you want everyone comfortable, you might skip the hard thing you needed to say.',
        'Sometimes you give so much of the evening to the group that you go home with nothing left.',
      ],
      tryThis: [
        'Ask one friend a real question about their week, so the night has more than jokes.',
        'Take one quiet evening this week, so you have something left for the people you love.',
        'Tell a friend one honest thought you held back, so the friendship stays real.',
      ],
    },
    mid: {
      summary: [
        'You can be warm and funny in a group, but you also want a quiet hour and your own opinion.',
        'You join the plan when you have the hours, and you stay quieter when you don’t.',
        'You get along with people, but you’ll speak up or step back when you need to.',
      ],
      strength: [
        'You can join the joke and still say what you actually think.',
        'You read the room and match it, louder when they are loud and quieter when they aren’t.',
        'You know when to stay for the plan and when to take the night at home.',
      ],
      watchOut: [
        'Sometimes you go quiet in a group and people read it as you not caring.',
        'Because you match the room, your own mood can get lost in theirs.',
        'Sometimes you say yes to a plan on a night you needed to stay in.',
      ],
      tryThis: [
        'Text a friend that you had fun after your next hangout, so they know it landed.',
        'Pick one plan to skip this week, so the ones you want still have you.',
        'Share one opinion in your next group chat, so your view is in the thread.',
      ],
    },
    low: {
      summary: [
        'In a group you stay more reserved, and more direct, than most of the people there.',
        'When you’re in a big group, you listen and say only the thing you mean.',
        'You like a few real friends and a real talk more than a week full of plans.',
      ],
      strength: [
        'You say what you mean, so people can trust the words you actually use.',
        'You listen well when it is just you and one other person.',
        'Your friendships are few, but they are real, and the people in them know it.',
      ],
      watchOut: [
        'Sometimes people read your quiet, or your direct line, as cold.',
        'Because you skip the small talk, a new person can take longer to feel easy with you.',
        'Sometimes you miss the fun because the group felt like too much before you walked in.',
      ],
      tryThis: [
        'Smile and say hi to one new person this week, so they get a friendly hello from you.',
        'Join one group plan this month for an hour, so you stay part of the group.',
        'Send a friend a funny message today, so they see a lighter side of you.',
      ],
    },
  },
};
