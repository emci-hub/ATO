/** Communication: Directness + Compromise (bar). */
import type { BarCard } from './define';

export const CAT_COMMUNICATION: BarCard = {
  shape: 'bar',
  cells: {
    high: {
      summary: [
        'When there’s a disagreement, you tend to say what you think and then look for a fix that works for both of you.',
        'You usually speak up clearly and still care about how the other person feels.',
        'You tend to handle hard talks directly and fairly.',
      ],
      strength: [
        'When you disagree with someone, you usually focus on fixing the problem together.',
        'You tend to say what you need while also asking what the other person needs.',
        'You usually make hard talks feel fair.',
      ],
      watchOut: [
        'Sometimes you jump to fixing it before the other person has had their say.',
        'Because you want to settle things, you might push to talk before others are ready.',
        'Sometimes you work so hard at being fair that it wears you out.',
      ],
      tryThis: [
        'Ask the other person to finish their point before you suggest a fix, so they feel heard.',
        'Let one small disagreement wait a day, so you both come in calmer.',
        'Take a short break after a hard talk, so you have energy left for yourself.',
      ],
    },
    mid: {
      summary: [
        'You tend to speak up on some things and let others go, depending on how much they matter.',
        'When there’s a disagreement, you usually pick your moments to say what you think.',
        'You can be direct or easygoing in a talk, depending on who you’re with.',
      ],
      strength: [
        'You usually know which disagreements are worth having.',
        'You can adjust how you talk to fit the person.',
        'You tend to keep small things small.',
      ],
      watchOut: [
        'Sometimes you let something go that was worth saying.',
        'Because you adjust to people, your own view might get lost.',
        'Sometimes you hold back and then bring it all up later at once.',
      ],
      tryThis: [
        'Say one small thing that bothered you this week, so it doesn’t build up.',
        'Write down what you want before a hard talk, so you don’t lose your view.',
        'Ask a friend how they like to handle disagreements, so you can meet them halfway.',
      ],
    },
    low: {
      summary: [
        'You tend to keep quiet in disagreements and hold on to your own view inside.',
        'When there’s tension, you usually stay out of the argument and keep your opinion to yourself.',
        'You tend to avoid arguing, but you don’t easily change your mind either.',
      ],
      strength: [
        'You usually stay calm and don’t make disagreements bigger.',
        'You tend to think before you speak in a tense moment.',
        'You know what you believe, even when you don’t say it out loud.',
      ],
      watchOut: [
        'Sometimes people don’t know you disagree until much later.',
        'Because you stay quiet, a problem that bothers you might keep happening.',
        'Sometimes keeping your view inside makes you feel unheard.',
      ],
      tryThis: [
        'Text the person one sentence about what you think, so your view is heard.',
        'Ask one question in your next disagreement, so you’re part of the talk.',
        'Write down what you’d want to say, so it’s easier to share later.',
      ],
    },
  },
};
