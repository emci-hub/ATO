/** Steadiness: Follow-through + Harmony + Composure (bar). */
import type { BarCard } from './define';

export const CAT_STEADINESS: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You keep the plan, stay even when the talk gets loud, and still answer when work runs late.',
        'When things get stressful, you finish what you agreed to do.',
        'Your friends and coworkers can text you on a bad day and still get a calm reply.',
      ],
      strength: [
        'When a plan falls apart, you focus on the next step.',
        'You do the thing you said you would, and you stay pleasant with the people in the room.',
        'People can hand you a messy afternoon and still get you at the table, ready.',
      ],
      watchOut: [
        'Sometimes you stay so calm that people do not realize you need help.',
        'Sometimes you stay quiet about a problem that needs to be addressed.',
        'Sometimes you take on extra tasks.',
      ],
      tryThis: [
        'Tell one person one thing that bothered you this week, so they see the hard day too.',
        'Ask for help with one task today, so you are not the only one holding the list.',
        'Say no to one small request this week, so your calm doesn’t turn into extra work.',
      ],
    },
    mid: {
      summary: [
        'Some days you stay calm, and other days unexpected disruptions throw you off.',
        'How steady you feel can vary noticeably from one day to the next.',
        'You keep most of the week together, but a loud day or a broken plan can mess up the rest.',
      ],
      strength: [
        'You stay steady during high-pressure moments and relax once the pressure is off.',
        'You notice when the day is off, and you can usually get the next hour back on track.',
        'You feel comfortable around both calm people and stressed people.',
      ],
      watchOut: [
        'Sometimes a hard week knocks your routines off more than you wanted.',
        'Sometimes people don’t know which version of you is coming to dinner.',
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
        'A tense message can change how you want to spend the rest of the day.',
        'When something upsets you, it often changes what you feel like doing.',
        'You answer in the moment, out loud, instead of saving the feeling for later.',
      ],
      strength: [
        'You react openly, so people know where they stand with you.',
        'When something matters, people can tell right away how you feel.',
        'You can change the plan the same hour it stops feeling right to you.',
      ],
      watchOut: [
        'Sometimes a strong feeling disrupts the plans you meant to keep.',
        'Sometimes you send a message before you have time to read it back.',
        'Sometimes your plans change so often that the people around you can’t keep up.',
      ],
      tryThis: [
        'Wait ten minutes before you reply to a message that upsets you, so your answer is the one you mean.',
        'Write one plan for tomorrow and keep it, so the day has one fixed thing.',
        'Take three slow breaths before your next hard talk, so you start with a quieter voice.',
      ],
    },
  },
};
