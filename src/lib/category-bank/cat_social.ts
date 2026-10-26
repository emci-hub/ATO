/** Everyday social time: Sociability + Harmony + Playfulness (bar). */
import type { BarCard } from './define';

export const CAT_SOCIAL: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You greet people warmly and keep the mood light.',
        'When you’re with friends or coworkers, you keep the talk friendly and the mood light.',
        'You make a social plan feel easy: a place, a time and a reason to laugh.',
      ],
      strength: [
        'You make people feel welcome, and the room gets looser once you sit down.',
        'You help keep the conversation moving when a group goes quiet.',
        'You get along with a lot of different people.',
      ],
      watchOut: [
        'Sometimes you keep things light even when a conversation turns serious.',
        'Sometimes you avoid saying hard things.',
        'Sometimes you give so much to a group that you end up drained.',
      ],
      tryThis: [
        'Ask one friend a real question about their week, so the night has more than jokes.',
        'Take one quiet evening this week, so you have something left for the people you love.',
        'Share an honest thought with a friend so the friendship stays genuine.',
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
        'Sometimes your own mood gets lost in the room.',
        'Sometimes you say yes to a plan on a night you needed to stay in.',
      ],
      tryThis: [
        'Text a friend that you had fun after your next hangout, so they know it landed.',
        'Pick one plan to skip this week, so the ones you want still have you.',
        'Share your opinion in your next conversation so people hear where you stand.',
      ],
    },
    low: {
      summary: [
        'In a group you stay more reserved, and more direct, than most of the people there.',
        'When you are in a big group, you listen and say only what you mean.',
        'You prefer a few close friends and real conversation over a week full of plans.',
      ],
      strength: [
        'You say what you mean, so people know they can trust your word.',
        'You listen well when it is just you and one other person.',
        'You keep a small circle of close friends who know where they stand with you.',
      ],
      watchOut: [
        'Sometimes people read your quiet, or your direct line, as cold.',
        'Sometimes a new person takes longer to feel easy with you.',
        'Sometimes a group feels like too much before you walk in.',
      ],
      tryThis: [
        'Say hello to one new person this week to start an easy connection.',
        'Join one group plan this month for an hour to stay connected.',
        'Send a friend a funny message today, so they see a lighter side of you.',
      ],
    },
  },
};
