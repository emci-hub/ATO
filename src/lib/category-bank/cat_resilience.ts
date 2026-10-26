/** Resilience under pressure: Confidence + Growth + Composure (bar). */
import type { BarCard } from './define';

export const CAT_RESILIENCE: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'When something goes wrong, you stay calm, trust what you can do, and look for the lesson.',
        'You come back quickly after a setback at work or at home.',
        'You come out of a hard day with a clear next step.',
      ],
      strength: [
        'You stay steady when the pressure builds at work or at home.',
        'When something fails, you take the lesson and you try again.',
        'You trust yourself to handle a hard problem when it shows up.',
      ],
      watchOut: [
        'Sometimes you push through stress when you really need a break.',
        'Sometimes people hand you more than your share.',
        'Sometimes you expect other people to come back as fast as you do.',
      ],
      tryThis: [
        'Take a real break after a stressful day so you are ready for the next one.',
        'Ask a stressed friend what they need, so your calm can be useful to them too.',
        'Say no to one extra task this week, so you don’t carry more than your share.',
      ],
    },
    mid: {
      summary: [
        'You handle some kinds of pressure well, and other kinds stay with you for a while.',
        'When a setback hits, you usually come back, but it can take you some time.',
        'Short-term pressure is manageable for you, but prolonged strain can wear you down.',
      ],
      strength: [
        'You come back from a setback, and you pick up one useful piece on the way.',
        'You know which stresses you handle well and which ones sit with you.',
        'You can stay steady when you’ve had time to get ready.',
      ],
      watchOut: [
        'Sometimes a surprise setback hits you harder than you expected.',
        'Sometimes you doubt the work you can usually do.',
        'Sometimes you hold a setback longer than the actual problem lasted.',
      ],
      tryThis: [
        'Write down one setback you got through, so you can see that you did.',
        'Plan a calm evening after your next big deadline, so you have time to reset.',
        'Ask a friend how they handle a stressful week, so you hear one new idea.',
      ],
    },
    low: {
      summary: [
        'You feel pressure in your body, and a setback can stay with you well past the day.',
        'When something goes wrong, you tend to doubt yourself afterward.',
        'You need extra time after a stressful stretch to feel steady again.',
      ],
      strength: [
        'You take a problem seriously, and you prepare for it with care.',
        'You can tell when someone else is struggling.',
        'You know where your limits are, so you can plan the week around them.',
      ],
      watchOut: [
        'Sometimes one bad meeting makes the rest of your week feel harder.',
        'Sometimes you skip a challenge you could have handled.',
        'Sometimes your doubt after a mistake lasts longer than the mistake did.',
      ],
      tryThis: [
        'Write down one rough week you got through, so you have a reminder for the next one.',
        'Take three slow breaths before your next stressful task, so you start quieter.',
        'Tell a friend about a setback this week, so you don’t carry it alone.',
      ],
    },
  },
};
