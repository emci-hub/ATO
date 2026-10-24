/** Agency: Growth + Ownership + Self-belief (bar). */
import type { BarCard } from './define';

export const CAT_AGENCY: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'When something goes wrong, you look for the part you can change and you try that part again.',
        'You trust that another try can move the result, so a hard week doesn’t end the task.',
        'You treat a miss as something you can get better at, and you change one thing next time.',
      ],
      strength: [
        'You take the miss as yours to work on, and you turn it into a next step.',
        'When a task is hard, you treat it as something you can learn, and you try it again.',
        'You believe you can handle a new task, so you start it instead of handing it off.',
      ],
      watchOut: [
        'Sometimes you blame yourself for a result that was never in your hands.',
        'Sometimes you keep pushing past the hour you needed to stop.',
        'Sometimes you expect to fix the whole problem yourself, with nobody else in it.',
      ],
      tryThis: [
        'Write down one thing this week that wasn’t up to you, so you can put that part down.',
        'Take one break from improving a thing, so you can look at what you’ve already finished.',
        'Ask someone for help with one problem, so you aren’t solving it on your own.',
      ],
    },
    mid: {
      summary: [
        'You change the parts you can and leave the rest, and which is which depends on the day.',
        'When something goes wrong, you sometimes look for a fix and sometimes let the afternoon go.',
        'You try hard when you feel ready, and you hold back when you aren’t sure you can do it.',
      ],
      strength: [
        'You can tell a problem you can change from one that is already out of your hands.',
        'You can name what you did well today and what you got wrong, in the same breath.',
        'You push on the day it matters and rest on the day it doesn’t.',
      ],
      watchOut: [
        'Sometimes you let a thing go that one small step from you could have changed.',
        'Sometimes you skip a chance you could have tried.',
        'Sometimes one setback makes you doubt yourself more than the miss was worth.',
      ],
      tryThis: [
        'Pick one thing you’ve accepted and try one small change, so you can see if it moves.',
        'Write down one setback and one thing you learned from it, so the miss has a use.',
        'Say yes to one small challenge this week, so you add to what you can already do.',
      ],
    },
    low: {
      summary: [
        'You let things arrive as they are, and you don’t push hard to change how they turn out.',
        'When something goes wrong, you point at luck or timing more than at what you did.',
        'You feel unsure about a hard new task, and you are content to stay with what you already know.',
      ],
      strength: [
        'You stay calm when the result is out of your hands and there is nothing left to redo.',
        'You don’t blame yourself for a result you couldn’t control.',
        'You can feel fine without trying to improve every part of the day.',
      ],
      watchOut: [
        'Sometimes you accept a result you could have moved with one small step.',
        'Sometimes you miss how much your own work mattered.',
        'Sometimes doubt stops you from trying a task you would have handled fine.',
      ],
      tryThis: [
        'Pick one small problem and take one step on it today, so you can see what moves.',
        'Write down one win and what you did to make it happen, so your part is on the page.',
        'Try one new skill for ten minutes, so you see how it feels after the start.',
      ],
    },
  },
};
