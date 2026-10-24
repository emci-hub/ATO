/** Communication: Directness + Compromise (bar). */
import type { BarCard } from './define';

export const CAT_COMMUNICATION: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'When you disagree, you say your view in a way you can both live with.',
        'You speak clearly, and you still pay attention to how the other person feels.',
        'You take a hard talk straight on, and you still try to make the ending fair.',
      ],
      strength: [
        'When you and a friend disagree, you keep the talk on the problem, not on them.',
        'You say what you need, and you ask what the other person needs before you close it.',
        'You make a hard talk feel fair to the person sitting across from you.',
      ],
      watchOut: [
        'Sometimes you offer a fix before the other person has finished.',
        'Sometimes you push to talk before they are ready.',
        'Sometimes you work so hard at being fair that the talk leaves you worn out.',
      ],
      tryThis: [
        'Ask the other person to finish their point before you suggest a fix, so they get heard.',
        'Let one small disagreement wait a day, so you both come back calmer.',
        'Take a short break after a hard talk, so you have something left for yourself.',
      ],
    },
    mid: {
      summary: [
        'You speak up on the things that matter to you and let the smaller ones go.',
        'When there’s a disagreement, you pick the moment before you say what you think.',
        'With one friend you say it straight, and with another you keep it easy, depending on who’s across from you.',
      ],
      strength: [
        'You know which disagreements are worth having and which ones can stay small.',
        'You can change how you talk so it fits the person in front of you.',
        'You keep a small annoyance small instead of turning it into a fight.',
      ],
      watchOut: [
        'Sometimes you let something go that was worth saying out loud.',
        'Sometimes your own view gets lost.',
        'Sometimes you bring the whole pile up at once.',
      ],
      tryThis: [
        'Say one small thing that bothered you this week, so it doesn’t sit and grow.',
        'Write down what you want before a hard talk, so you don’t lose your point.',
        'Ask a friend how they like to handle a disagreement, so you can meet them partway.',
      ],
    },
    low: {
      summary: [
        'In a disagreement you stay quiet, and you keep your own view to yourself.',
        'When the room gets tense, you stay out of the argument and keep your opinion in.',
        'You stay out of the argument, but you don’t change your mind just to end it.',
      ],
      strength: [
        'You stay calm, and you don’t make a disagreement bigger than it is.',
        'You think before you speak when the moment is tense.',
        'You know what you believe, even on the days you don’t say it out loud.',
      ],
      watchOut: [
        'Sometimes people don’t know you disagree until long after the talk is over.',
        'Sometimes a problem that bothers you keeps happening.',
        'Sometimes keeping your view inside leaves you feeling unheard.',
      ],
      tryThis: [
        'Text the person one sentence about what you think, so your view gets heard.',
        'Ask one question in your next disagreement, so you are part of the talk.',
        'Write down what you would want to say, so it’s easier to share later.',
      ],
    },
  },
};
