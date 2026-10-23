/** Everyday social energy: Sociability + Harmony + Playfulness (bar). */
import type { BarCard } from './define';

export const CAT_SOCIAL: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You tend to bring warmth, jokes and easy energy to the people around you.',
        'When you’re with friends or coworkers, you usually keep things friendly and fun.',
        'You tend to make social plans feel easy and light.',
      ],
      strength: [
        'You usually make people feel welcome and relaxed.',
        'When a group is quiet, you tend to get the conversation and the laughs going.',
        'You tend to get along with all kinds of people.',
      ],
      watchOut: [
        'Sometimes you keep things light when someone needs to talk to you about something serious.',
        'Because you want everyone happy, you might skip saying something hard.',
        'Sometimes you give so much energy to the group that you run low yourself.',
      ],
      tryThis: [
        'Ask one friend a real question about their week, so there’s room for more than fun.',
        'Take one quiet evening this week, so you recharge for the people you love.',
        'Tell a friend one honest thought you’ve held back, so the friendship stays real.',
      ],
    },
    mid: {
      summary: [
        'You can be warm and fun in a group, but you also like your quiet time and your own opinions.',
        'You tend to be social when you have the energy and more reserved when you don’t.',
        'You usually get along with people, but you’ll speak up or step back when you need to.',
      ],
      strength: [
        'You can join the fun and also say what you think.',
        'You tend to read the room and match it.',
        'You usually know when to be social and when to recharge.',
      ],
      watchOut: [
        'Sometimes you go quiet in a group and people read it as you not caring.',
        'Because you match the room, your own mood might get lost.',
        'Sometimes you say yes to plans when you needed a night in.',
      ],
      tryThis: [
        'Text a friend to say you had fun after your next hangout, so they know.',
        'Pick one plan to skip this week, so you have energy for the ones you want.',
        'Share one opinion in your next group chat, so your view is part of it.',
      ],
    },
    low: {
      summary: [
        'You tend to be more reserved, serious and direct in groups than most people.',
        'When you’re in a big group, you usually prefer to listen and say only what you mean.',
        'You tend to like a few real friends and real talk more than lots of social plans.',
      ],
      strength: [
        'You usually say what you mean, so people can trust your words.',
        'You tend to be a good listener in one-on-one talks.',
        'Your friendships tend to be few but real.',
      ],
      watchOut: [
        'Sometimes people read your quiet or direct style as cold.',
        'Because you skip small talk, new people might take longer to warm up to you.',
        'Sometimes you miss the fun because the group felt like a lot to you.',
      ],
      tryThis: [
        'Smile and say hi to one new person this week, so they see your friendly side.',
        'Join one group plan this month for an hour, so you stay part of things.',
        'Send a friend a funny message today, so they see your lighter side.',
      ],
    },
  },
};
