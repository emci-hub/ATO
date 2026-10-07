/** Agency: Growth + Ownership + Self-belief (bar). */
import type { BarCard } from './define';

export const CAT_AGENCY: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You tend to believe your effort shapes how things turn out, and you keep learning when it’s hard.',
        'When something goes wrong, you usually look for what you can change and try again.',
        'You tend to trust that you can get better at things and change how they turn out.',
      ],
      strength: [
        'You usually take responsibility and turn setbacks into a plan.',
        'When something is hard, you tend to see it as a chance to learn.',
        'You tend to believe you can handle new things, so you try them.',
      ],
      watchOut: [
        'Sometimes you blame yourself for things that weren’t in your control.',
        'Because you believe effort matters, you might push yourself too hard.',
        'Sometimes you expect to fix everything yourself.',
      ],
      tryThis: [
        'Write down one thing this week that wasn’t up to you, so you don’t carry all of it.',
        'Take one break from improving something, so you can enjoy what you’ve already done.',
        'Ask someone for help with one problem, so you don’t have to solve it alone.',
      ],
    },
    mid: {
      summary: [
        'You tend to believe you can change some things and accept others, depending on the situation.',
        'When things go wrong, you sometimes look for what to fix and sometimes let it go.',
        'You usually try hard when you feel ready, and hold back when you’re unsure.',
      ],
      strength: [
        'You can tell the difference between what you can change and what you can’t.',
        'You tend to keep a balanced view of your wins and your mistakes.',
        'You can push when it matters and rest when it doesn’t.',
      ],
      watchOut: [
        'Sometimes you let something go that you could have changed.',
        'Because you’re unsure some days, you might skip a chance to try.',
        'Sometimes a setback makes you doubt yourself more than it should.',
      ],
      tryThis: [
        'Pick one thing you’ve accepted and try one small change, so you see if it moves.',
        'Write down one setback and one thing you learned from it, so it becomes useful.',
        'Say yes to one small challenge this week, so you build on what you can do.',
      ],
    },
    low: {
      summary: [
        'You tend to accept things as they come and don’t push hard to change them.',
        'When something goes wrong, you usually see it as luck or timing more than your doing.',
        'You tend to feel unsure about taking on hard things, and you’re happy with what you know.',
      ],
      strength: [
        'You usually stay calm when things are out of your hands.',
        'You tend not to blame yourself for things you couldn’t control.',
        'You can feel content without needing to improve everything.',
      ],
      watchOut: [
        'Sometimes you accept something you could have changed with a small step.',
        'Because you credit luck, you might not see how much your effort mattered.',
        'Sometimes doubt stops you from trying something you’d handle fine.',
      ],
      tryThis: [
        'Pick one small problem and take one step on it today, so you see what you can change.',
        'Write down one success and what you did to make it happen, so you see your part.',
        'Try one new skill for ten minutes, so you see how it feels past the start.',
      ],
    },
  },
};
