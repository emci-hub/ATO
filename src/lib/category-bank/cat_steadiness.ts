/** Steadiness: Follow-through + Harmony + Composure (bar). */
import type { BarCard } from './define';

export const CAT_STEADINESS: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You keep the plan, stay even when the talk gets loud, and still answer when work runs late.',
        'When the week gets loud at work or at home, you finish what you said and keep your voice level.',
        'Your friends and coworkers can text you on a bad day and still get a calm reply.',
      ],
      strength: [
        'When the plan falls apart, you stay calm and name the next thing that has to happen.',
        'You do the thing you said you would, and you stay pleasant with the people in the room.',
        'People can hand you a messy afternoon and still get you at the table, ready.',
      ],
      watchOut: [
        'Sometimes you stay so even that nobody sees you needed help with the hard part.',
        'Because you keep the room smooth, you might sit on a problem that needed saying.',
        'Sometimes you take the extra task because you made the last one look easy.',
      ],
      tryThis: [
        'Tell one person one thing that bothered you this week, so they see the hard day too.',
        'Ask for help with one task today, so you are not the only one holding the list.',
        'Say no to one small request this week, so your calm doesn’t turn into extra work.',
      ],
    },
    mid: {
      summary: [
        'Some days you keep the plan and stay calm, and other days a messy inbox throws the afternoon off.',
        'Your week decides it: one day the list gets done, and the next day the same list feels like too much.',
        'You keep most of the week together, but a loud day or a broken plan can mess up the rest.',
      ],
      strength: [
        'You stay steady for the meeting that matters and loosen up once you are home.',
        'You notice when the day is off, and you can usually get the next hour back on track.',
        'You can sit with a calm friend and a stressed one, because you’ve had both kinds of days.',
      ],
      watchOut: [
        'Sometimes a hard week knocks your routines off more than you wanted.',
        'Because your mood moves with the day, people might not know which version of you is coming to dinner.',
        'Sometimes you lose the plan when the stress shows up in the same afternoon.',
      ],
      tryThis: [
        'Pick one small routine to keep this week, so a busy day still has one steady part.',
        'Write down what usually throws your day off, so you can see it before it lands.',
        'Plan a quiet hour after your busiest day, so you have a place to reset.',
      ],
    },
    low: {
      summary: [
        'You feel a sharp text in your chest, and the evening plan can move with that feeling.',
        'When something upsets you, you feel it all the way through, and the calendar can shift with it.',
        'You answer in the moment, out loud, instead of saving the feeling for later.',
      ],
      strength: [
        'You react in the open, so people know where they stand with you before the night is over.',
        'When something matters, you show it on your face, and people don’t have to guess.',
        'You can change the plan the same hour it stops feeling right to you.',
      ],
      watchOut: [
        'Sometimes a strong feeling pushes the plan, or the talk, off the evening you meant to keep.',
        'Because you answer in the moment, you might send the text before you’ve read it back.',
        'Sometimes your plans change so often that the people around you can’t keep up.',
      ],
      tryThis: [
        'Wait ten minutes before you reply to the next text that stings, so the answer is the one you mean.',
        'Write one plan for tomorrow and keep it, so the day has one fixed thing.',
        'Take three slow breaths before your next hard talk, so you start with a quieter voice.',
      ],
    },
  },
};
