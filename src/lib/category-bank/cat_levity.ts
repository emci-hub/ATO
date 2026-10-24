/** Levity: Playfulness + Directness + Compromise (bar). */
import type { BarCard } from './define';

export const CAT_LEVITY: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You bring a joke into a tense moment, and you still say what you actually think.',
        'When things get tense, you lighten the mood and help people look for a fix.',
        'You lighten a hard moment, and you still say it plain.',
      ],
      strength: [
        'You ease the tension, so the person across from you can keep talking.',
        'You make a hard talk feel less sharp for the person sitting with you.',
        'In one tense talk you can make a joke and still give the other person a fair turn.',
      ],
      watchOut: [
        'Sometimes your joke lands at the wrong moment for someone who is upset.',
        'Sometimes people think you aren’t taking it seriously.',
        'Sometimes the joke covers a thing you needed to say in plain words.',
      ],
      tryThis: [
        'Ask how someone feels before you joke about a tense moment, so they feel heard.',
        'Say the serious part first in your next hard talk, so the joke doesn’t hide it.',
        'Wait a moment before your next joke in a tense talk, so other people can speak.',
      ],
    },
    mid: {
      summary: [
        'You can joke in a tense moment or stay serious, depending on the people and the problem.',
        'You use a joke some days and plain talk on others when there’s a conflict.',
        'When things get tense, you look at the room before you joke or speak up.',
      ],
      strength: [
        'You can tell when a joke will help and when it will make things worse.',
        'You can shift from light to serious as the talk needs it.',
        'You keep a hard moment from getting heavier than the problem actually is.',
      ],
      watchOut: [
        'Sometimes you misread the moment and joke when someone wanted quiet.',
        'Sometimes people don’t know what you actually feel.',
        'Sometimes you wait so long to pick a tone that the moment passes.',
      ],
      tryThis: [
        'Ask a friend whether they want a laugh or a real talk, so you match what they need.',
        'Share one honest thought in your next tense moment, so your view is heard.',
        'Write down how you felt after a hard talk, so you know what you meant to say.',
      ],
    },
    low: {
      summary: [
        'You take a conflict seriously, and you stay quiet rather than joke or argue.',
        'When there’s tension, you stay serious and you stay out of the back-and-forth.',
        'You handle a hard moment quietly, and you leave the jokes out of it.',
      ],
      strength: [
        'You treat other people’s problems with real care.',
        'You don’t add noise to a moment that is already tense.',
        'You can stay calm and respectful when the other people in the room don’t.',
      ],
      watchOut: [
        'Sometimes a tense moment feels heavier for you than the problem calls for.',
        'Sometimes people don’t hear what you think.',
        'Sometimes you carry a disagreement around long after the talk is over.',
      ],
      tryThis: [
        'Look for one small funny thing in a tense week, so the week feels a little lighter.',
        'Say one sentence about how you see it in your next disagreement, so you get heard.',
        'Take a short walk after a hard talk, so it doesn’t stay with you all night.',
      ],
    },
  },
};
