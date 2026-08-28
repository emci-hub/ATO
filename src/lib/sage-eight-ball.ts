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

/**
 * Slot-machine flash delays before the real answer lands. Sum stays well
 * under 1.5s so repeated taps still feel snappy.
 */
export const EIGHT_BALL_FLASH_DELAYS_MS = [70, 80, 95, 120, 155, 200] as const;

export function eightBallRollMs(): number {
  return EIGHT_BALL_FLASH_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
}

/**
 * Filler lines for the reel. Never the final answer; skips the current line
 * when possible so the first flash is visibly different.
 */
export function pickEightBallFlashes(
  finalAnswer: string,
  previous?: string | null,
  count = EIGHT_BALL_FLASH_DELAYS_MS.length,
): string[] {
  const exclude = new Set<string>([finalAnswer]);
  if (previous && previous !== finalAnswer) exclude.add(previous);
  const pool = EIGHT_BALL_ANSWERS.filter((line) => !exclude.has(line));
  const source = pool.length > 0 ? pool : EIGHT_BALL_ANSWERS.filter((line) => line !== finalAnswer);
  const bag = [...source];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = bag[i];
    bag[i] = bag[j]!;
    bag[j] = swap!;
  }
  const flashes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    flashes.push(bag[i % bag.length]!);
  }
  return flashes;
}
