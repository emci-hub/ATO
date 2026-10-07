/** Resilience under pressure: Confidence + Growth + Composure (bar). */
import type { BarCard } from './define';

export const CAT_RESILIENCE: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'When things go wrong, you tend to stay calm, trust your skills and look for what to learn.',
        'You usually recover quickly from setbacks at work or at home.',
        'You tend to handle pressure well and come out of it stronger.',
      ],
      strength: [
        'You usually stay steady when pressure builds.',
        'When something fails, you tend to learn from it and try again.',
        'You tend to trust yourself to handle hard things.',
      ],
      watchOut: [
        'Sometimes you push through stress that really needed a break.',
        'Because you handle pressure well, people might give you more than your share.',
        'Sometimes you expect others to recover as fast as you do.',
      ],
      tryThis: [
        'Take a real break after your next stressful day, so you have energy for the next one.',
        'Ask a stressed friend what they need, so your steadiness helps them too.',
        'Say no to one extra task this week, so you don’t carry too much.',
      ],
    },
    mid: {
      summary: [
        'You tend to handle some kinds of pressure well, while others stay with you for a while.',
        'When setbacks happen, you usually recover, but it can take you some time.',
        'You can stay steady under pressure, but a hard week can still get to you.',
      ],
      strength: [
        'You tend to recover from setbacks and learn something along the way.',
        'You usually know which stresses you handle well.',
        'You can stay steady when you have time to prepare.',
      ],
      watchOut: [
        'Sometimes a surprise setback hits you harder than you expect.',
        'Because some pressure gets to you, you might doubt your skills after a bad day.',
        'Sometimes you hold on to a setback longer than you need to.',
      ],
      tryThis: [
        'Write down one setback you got through, so you remember you can do it.',
        'Plan a calm evening after your next big deadline, so you have time to reset.',
        'Ask a friend how they handle stress, so you get a new idea.',
      ],
    },
    low: {
      summary: [
        'You tend to feel pressure strongly, and setbacks can stay with you for a while.',
        'When something goes wrong, you usually feel it deeply and doubt yourself afterward.',
        'You tend to find stressful times hard and need extra time to recover.',
      ],
      strength: [
        'You tend to take problems seriously and prepare carefully.',
        'You usually understand when others are struggling, because you’ve been there.',
        'You know your limits, so you can plan around them.',
      ],
      watchOut: [
        'Sometimes one setback makes your whole week feel harder.',
        'Because you feel pressure deeply, you might avoid challenges you could handle.',
        'Sometimes your doubt after a mistake lasts longer than the mistake does.',
      ],
      tryThis: [
        'Write down one hard thing you got through before, so you remember you can do it.',
        'Take three slow breaths before your next stressful task, so you start calmer.',
        'Tell a friend about a setback this week, so you don’t carry it alone.',
      ],
    },
  },
};
