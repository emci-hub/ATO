/** Openness to life: Curiosity + Sociability (bar). */
import type { BarCard } from './define';

export const CAT_OPENNESS: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You tend to say yes to new places, new people and new plans, and you usually bring others along.',
        'When something new comes up, you’re usually curious about it and happy to try it with friends.',
        'You tend to enjoy meeting new people and trying new things more than sticking to the usual.',
      ],
      strength: [
        'You usually make new plans happen and get people excited about them.',
        'You tend to be easy to meet and quick to try something new.',
        'When a group is stuck, you usually suggest something fresh to do.',
      ],
      watchOut: [
        'Sometimes you move on to the next new thing before friends are ready.',
        'Because you love new plans, quieter friends might feel pulled along.',
        'Sometimes you fill your calendar with so much that there’s no time left for you to rest.',
      ],
      tryThis: [
        'Ask a quieter friend what they’d like to do, so the next plan fits them too.',
        'Leave one evening this week free, so you have time to rest.',
        'Go back to one place you already love, so you see what the familiar still offers.',
      ],
    },
    mid: {
      summary: [
        'You can enjoy new things and new people, but you also like your familiar spots and quiet nights.',
        'You tend to try new things when the mood is right and stick with what you know when it isn’t.',
        'You usually balance going out with staying in, and new plans with old favorites.',
      ],
      strength: [
        'You can enjoy a new adventure and a quiet night in, so you fit in with many kinds of friends.',
        'You tend to pick new things on purpose, not just because they’re new.',
        'You can be social when it counts and recharge when you need to.',
      ],
      watchOut: [
        'Sometimes you say no to something new just because you’re tired that day.',
        'Because you’re flexible, you might go along with plans that don’t really suit you.',
        'Sometimes you wait for the right mood and miss a chance you’d have enjoyed.',
      ],
      tryThis: [
        'Say yes to one new plan this week, so you keep trying new things.',
        'Plan one quiet night and one night out this week, so you get both.',
        'Text a friend about something new you’d like to try, so it becomes a real plan.',
      ],
    },
    low: {
      summary: [
        'You tend to enjoy familiar places, close friends and quiet plans more than big crowds or new things.',
        'When you get free time, you usually stick with what you know you’ll enjoy.',
        'You tend to prefer a small group and a known plan over meeting lots of new people.',
      ],
      strength: [
        'You tend to know exactly what you enjoy, and you make time for it.',
        'Your close friends usually get your full attention, because you don’t spread yourself thin.',
        'You tend to be steady and easy to plan with, because you know what you like.',
      ],
      watchOut: [
        'Sometimes you skip a new plan you might have enjoyed.',
        'Because you like the familiar, friends might stop inviting you to new things.',
        'Sometimes you miss meeting someone great because the setting felt too new to you.',
      ],
      tryThis: [
        'Say yes to one small new thing this week, so new feels a little more familiar.',
        'Invite one close friend to try a new place with you, so it feels easier.',
        'Ask a friend what they’ve tried lately, so you hear about new things without pressure.',
      ],
    },
  },
};
