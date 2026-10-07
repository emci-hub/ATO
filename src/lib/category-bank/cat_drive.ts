/** Drive: Independence + Confidence + Connection (bar). */
import type { BarCard } from './define';

export const CAT_DRIVE: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You tend to go after what you want with confidence, and you care about the people you do it with.',
        'When you set a goal, you usually believe you can reach it and want to share the win.',
        'You tend to feel driven when you have freedom, a challenge and people who matter around you.',
      ],
      strength: [
        'You usually take charge of your goals and bring energy to whatever you start.',
        'When something is hard, you tend to trust yourself and keep going.',
        'You tend to motivate people around you because you care and you show up.',
      ],
      watchOut: [
        'Sometimes you take on so much that your rest gets pushed aside.',
        'Because you’re driven, you might expect the same pace from people around you.',
        'Sometimes you push ahead before checking if others are ready.',
      ],
      tryThis: [
        'Pick one goal to pause this week, so you have energy for the rest.',
        'Ask a teammate or friend how their goals are going, so it isn’t all about yours.',
        'Take one evening off from your goals, so you come back with more energy.',
      ],
    },
    mid: {
      summary: [
        'Your drive tends to come and go with the task: some things fire you up and others feel like a chore.',
        'You usually push hard for things you care about and coast on things you don’t.',
        'You can be very motivated, but it tends to depend on who you’re working with and what it’s for.',
      ],
      strength: [
        'You tend to save your energy for things that matter to you.',
        'You can work alone or with people, depending on what the task needs.',
        'You usually know which goals are worth pushing for.',
      ],
      watchOut: [
        'Sometimes tasks you don’t care about slip until they become urgent.',
        'Because your drive depends on interest, people might not know when you’ll be fully in.',
        'Sometimes you wait for motivation to show up before you start.',
      ],
      tryThis: [
        'Pick one task you’ve been avoiding and do ten minutes now, so it starts moving.',
        'Write down why one boring task matters, so you have a reason to finish it.',
        'Ask a friend or coworker to do one task with you, so it feels less like a chore.',
      ],
    },
    low: {
      summary: [
        'You tend to work best with clear direction and a steady pace, rather than chasing big goals.',
        'When a goal feels big, you usually take it slowly and like some guidance along the way.',
        'You tend to prefer a calm, clear plan over pushing hard on your own.',
      ],
      strength: [
        'You tend to follow a plan well and do careful work.',
        'You usually think before you jump into something, which saves you mistakes.',
        'You can be content without chasing the next big thing.',
      ],
      watchOut: [
        'Sometimes you wait for someone else to set the goal instead of setting your own.',
        'Because you take it slow, chances can pass before you’re ready.',
        'Sometimes you doubt you can do something you’d actually do well.',
      ],
      tryThis: [
        'Set one small goal for yourself this week, so you get to choose the direction.',
        'Write down one thing you did well recently, so you see what you can do.',
        'Ask a friend to check in on one goal with you, so you have support.',
      ],
    },
  },
};
