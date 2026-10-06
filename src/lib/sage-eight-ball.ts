/**
 * Fixed 8-ball answers, in the moment voice (emci, 2026-10-04: "rewrite them in
 * the voice that we want"; src/lib/voice/moment-voice.ts). Same shape as the
 * toy — ten yes, five not sure, five no — but each answer is one small moment
 * from how people live now, teased kindly, with no advice and no "you are".
 * They replace the classic toy lines. Rolls are local and infinite; nothing
 * here hits the model or the daily cap.
 *
 * Approved by emci 2026-10-06 (`EIGHT_BALL_COPY_REVIEWED`, docs/copy-review.md §8).
 */
export const EIGHT_BALL_COPY_REVIEWED = true;

export const EIGHT_BALL_ANSWERS = [
  // Yes
  'Yes. Typed, sent, no backspace.',
  'Yes. The group chat already agrees.',
  'Yes. It is in the calendar with a reminder.',
  'Yes. The tab can finally close.',
  'Definitely. Read receipt and everything.',
  'Yes. "On my way," and this time it is true.',
  'Yes. Battery at 100 and a charger in the bag.',
  'Most likely. Thumbs up from the whole chat.',
  'Yes, and no voice note needed.',
  'Signs point to yes. Three dots, then a yes.',
  // Not sure
  'Hard to say. The typing bubble keeps coming and going.',
  'Hazy. It will make more sense after the next notification.',
  'Not sure yet. It is in a tab marked "for later."',
  'Seen, not answered. Maybe later.',
  'Cannot tell. Still buffering.',
  // No
  'No. That one stays in drafts.',
  'No. Seen, then nothing for two days.',
  'Not this time. The group chat went quiet.',
  'My sources say no. Mostly the unread count.',
  'Very doubtful. Even autocorrect winced.',
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
 * Slot-machine flash delays before the real answer lands. Sum is about 2s so
 * a shake reads as a roll, not a flicker.
 */
export const EIGHT_BALL_FLASH_DELAYS_MS = [180, 220, 280, 360, 460, 600] as const;

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
