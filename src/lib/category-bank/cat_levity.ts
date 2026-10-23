/** Levity: Playfulness + Directness + Compromise (bar). */
import type { BarCard } from './define';

export const CAT_LEVITY: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'You tend to bring humor into tense moments and still say what you think.',
        'When things get tense, you usually lighten the mood and help people find a fix.',
        'You tend to use jokes and honesty to keep hard moments from getting heavy.',
      ],
      strength: [
        'You usually ease tension so people can talk to you more openly.',
        'You tend to make hard talks feel less scary.',
        'You can be funny and fair in the same conversation.',
      ],
      watchOut: [
        'Sometimes your joke lands at the wrong moment for someone who’s upset.',
        'Because you keep things light, people might think you’re not taking it seriously.',
        'Sometimes humor covers up something you really need to say.',
      ],
      tryThis: [
        'Ask how someone feels before you joke about a tense moment, so they feel heard.',
        'Say the serious part first in your next hard talk, so the joke doesn’t hide it.',
        'Wait a moment before your next joke in a tense talk, so others can speak.',
      ],
    },
    mid: {
      summary: [
        'You can be funny in a tense moment or serious about it, depending on the people and the problem.',
        'You tend to use humor sometimes and plain talk other times when there’s conflict.',
        'When things get tense, you usually read the room before deciding to joke or to speak up.',
      ],
      strength: [
        'You tend to know when a joke will help and when it won’t.',
        'You can shift between light and serious as a talk needs.',
        'You usually keep hard moments from getting heavier than they need to be.',
      ],
      watchOut: [
        'Sometimes you misread the moment and joke when someone wanted quiet.',
        'Because you adjust, people might not know how you really feel.',
        'Sometimes you wait so long to decide that the moment passes you by.',
      ],
      tryThis: [
        'Ask a friend whether they want to laugh or talk, so you match their mood.',
        'Share one honest thought in your next tense moment, so your view is heard.',
        'Write down how you felt after a hard talk, so you know what you meant to say.',
      ],
    },
    low: {
      summary: [
        'You tend to take conflict seriously and keep quiet rather than joke or argue.',
        'When there’s tension, you usually stay serious and stay out of the back-and-forth.',
        'You tend to handle hard moments quietly and without humor.',
      ],
      strength: [
        'You usually treat other people’s problems with real care.',
        'You tend not to make tense moments worse.',
        'You can stay calm and respectful when others don’t.',
      ],
      watchOut: [
        'Sometimes tense moments feel heavier for you than they need to.',
        'Because you stay quiet, people might not know what you think.',
        'Sometimes you carry a disagreement around long after it’s over.',
      ],
      tryThis: [
        'Look for one small funny thing in a tense week, so it feels a little lighter.',
        'Say one sentence about how you see it in your next disagreement, so you’re heard.',
        'Take a short walk after a hard talk, so it doesn’t stay with you.',
      ],
    },
  },
};
