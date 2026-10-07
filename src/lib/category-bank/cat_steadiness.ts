/** Steadiness: Follow-through + Harmony + Composure (bar). */
import type { BarCard } from './define';

export const CAT_STEADINESS: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You tend to stay calm, keep your plans and get along with people, even when the week gets busy.',
        'When things get stressful at work or at home, you usually stay even and keep going.',
        'You tend to be the steady one your friends and coworkers can count on day to day.',
      ],
      strength: [
        'When plans get messy, you usually keep your cool and get things back on track.',
        'You tend to follow through on what you said and stay pleasant while you do it.',
        'People can usually count on you to show up calm and ready.',
      ],
      watchOut: [
        'Sometimes you stay so even that people don’t notice when you need help.',
        'Because you keep things smooth, you might hold back a problem that needs saying.',
        'Sometimes you carry more than your share because you make it look easy.',
      ],
      tryThis: [
        'Tell one person something that’s been bothering you this week, so they know you have hard days too.',
        'Ask for help with one task today, so you’re not the only one holding things together.',
        'Say no to one small request this week, so your calm doesn’t turn into extra work.',
      ],
    },
    mid: {
      summary: [
        'You can be calm and organized on some days and more stirred up on others, depending on what’s going on.',
        'Your steadiness tends to depend on the week: some days you’re on top of things, other days it feels like a lot.',
        'You usually keep things together, but stress or a messy schedule can throw you off for a bit.',
      ],
      strength: [
        'You can adapt to the day, staying steady when it matters and loosening up when it doesn’t.',
        'You tend to notice when things are off, and you can usually get back on track.',
        'You can relate to people who are calm and to people who are stressed, because you’ve been both.',
      ],
      watchOut: [
        'Sometimes a hard week throws your routines off more than you’d like.',
        'Because your mood shifts with the day, people might not know which version of you to expect.',
        'Sometimes you lose track of plans when stress shows up.',
      ],
      tryThis: [
        'Pick one small routine to keep this week no matter what, so busy days have an anchor.',
        'Write down what usually throws you off, so you can see it coming next time.',
        'Plan a quiet hour after your busiest day this week, so you have time to reset.',
      ],
    },
    low: {
      summary: [
        'You tend to feel things strongly and go with the moment, so your days can change a lot.',
        'When something upsets you, you usually feel it fully, and plans can shift with your mood.',
        'You tend to react honestly and in the moment, rather than keeping everything even.',
      ],
      strength: [
        'You usually react honestly, so people know where they stand with you.',
        'When something matters, you feel it and you show it, which makes you easy to read.',
        'You can switch plans quickly when your gut tells you something’s off.',
      ],
      watchOut: [
        'Sometimes a strong feeling can push your plans or a talk off course.',
        'Because you react in the moment, you might say something before you’ve thought it through.',
        'Sometimes your plans change so often that people around you lose track.',
      ],
      tryThis: [
        'Wait ten minutes before replying to the next message that upsets you, so you answer the way you mean to.',
        'Write down one plan for tomorrow and keep it, so you have one fixed thing in your day.',
        'Take three slow breaths before your next hard conversation, so you start calm.',
      ],
    },
  },
};
