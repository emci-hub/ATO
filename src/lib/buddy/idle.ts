/**
 * The small things the mini guy says when tapped with no news waiting.
 * Written in the moment voice (src/lib/voice/moment-voice.ts): short, a little
 * dry, never advice. They are about him and this moment, not about the
 * person's traits, so they are safe to show to anyone.

 */
import { IDLE_NOTE_PREFIX, type BuddyNote } from './notes';

// emci approved 2026-10-02.
export const BUDDY_COPY_REVIEWED = true;

export const BUDDY_IDLE_LINES: readonly string[] = [
  'Hi. I live up here.',
  'Nothing new. You checked anyway.',
  'You tapped me to see what would happen. This is what happens.',
  'All caught up. Suspicious.',
  'No news. I would have said.',
  'Still here. Still small.',
  'No notifications. Enjoy the quiet.',
  'That tickles, for the record.',
  'Tap again, same guy.',
  'I was mid-nap, but go on.',
  'Yes, I felt that.',
  'Nothing to report. I checked twice.',
];

/**
 * The next idle line: a different one from last time, in a fixed walk through
 * the list, so repeated taps do not show the same line twice in a row.
 */
export function nextIdleNote(tapCount: number): BuddyNote {
  const line = BUDDY_IDLE_LINES[tapCount % BUDDY_IDLE_LINES.length]!;
  // The count is in the id so the same line can be said again on a later lap.
  return { id: `${IDLE_NOTE_PREFIX}${tapCount}`, title: line, body: '', loud: false };
}
