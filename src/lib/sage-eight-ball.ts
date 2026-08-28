/**
 * Fixed Magic 8-ball answers. Rolls are local and infinite; nothing here
 * hits the model or the daily cap.
 */

export const EIGHT_BALL_ANSWERS = [
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes — definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
] as const;

export type EightBallAnswer = (typeof EIGHT_BALL_ANSWERS)[number];

/** Pick a response from the fixed set. Skips an immediate repeat when possible. */
export function rollEightBall(previous?: string | null): EightBallAnswer {
  const pool = EIGHT_BALL_ANSWERS;
  let next = pool[Math.floor(Math.random() * pool.length)];
  if (next === previous) {
    const idx = pool.indexOf(next);
    next = pool[(idx + 1) % pool.length];
  }
  return next;
}
