/**
 * Every new line from the polish pass (emci approved the pass 2026-10-05).
 * Written in the moment voice (lib/voice/moment-voice.ts). Draft until emci
 * reads them: the draft badge shows in pre-launch builds while this is false.
 * Labels (button and section names) are plain on purpose.
 */
export const POLISH_COPY_REVIEWED = false;

// ── Your shape ───────────────────────────────────────────────────────────────
export const SHAPE_TITLE = 'Your shape';
export const SHAPE_CAPTION = 'Drawn from your answers, most of them given between notifications.';
export const SHAPE_TAP_HINT = 'Tap a point to see which trait it is.';
export const SHAPE_EMPTY_TITLE = 'Your shape is blank';
export const SHAPE_EMPTY_LINE =
  'Like a group chat everyone muted. Sixteen answers draw the first lines.';
export const SHAPE_EMPTY_BUTTON = 'Answer the first 16';

// ── Home ─────────────────────────────────────────────────────────────────────
export const WEEK_STRIP_TITLE = 'This week';
export const SEALED_READ_KICKER = 'Today’s read';
export const SEALED_READ_LINE = 'Still sealed, like that voice note saved for later.';
export const ROUND_RING_TITLE = 'This round';
export function roundRingLine(left: number): string {
  if (left <= 0) return 'All 16 answered.';
  if (left === 1) return 'One left. Shorter than a voice note.';
  return `${left} left. About one bus ride.`;
}

// ── Set / round done moment ──────────────────────────────────────────────────
export const SET_DONE_LATER = 'Later';
export const SET_DONE_NEXT = 'Keep going';
export const SET_DONE_COPY: Record<'set1' | 'set2' | 'all' | 'round', { title: string; line: string }> = {
  set1: {
    title: 'Set one, done.',
    line: 'Sixteen answers. More than the group chat got all week.',
  },
  set2: {
    title: 'Set two, done.',
    line: 'Thirty-two in. Somewhere a half-finished to-do list feels seen.',
  },
  all: {
    title: 'All 48, done.',
    line: 'Forty-eight answers. More honest than most bios.',
  },
  round: {
    title: 'Round done.',
    line: 'Sixteen more. The shape just got a little sharper.',
  },
};

// ── You ──────────────────────────────────────────────────────────────────────
export const STYLE_ROW_LABEL = 'Style';
export const TOKEN_NEXT_LABEL = 'Next +21';
export const TOKEN_RULES_LABEL = 'How tokens work';
export const YOUR_WEEK_TITLE = 'Your week';
export const YOUR_WEEK_DAYS = 'days opened';
export const YOUR_WEEK_ANSWERS = 'answers';
export const YOUR_WEEK_ME = 'That’s me';
export function yourWeekLine(daysOpened: number): string {
  if (daysOpened >= 4) return 'Opened more often than the banking app. Probably.';
  if (daysOpened >= 1) return 'A few visits, like checking a tracking number.';
  return 'A quiet week. Like a group chat on mute.';
}
export const SETTINGS_TITLE = 'Settings';

/** Every user-facing line above, for the voice check. */
export const POLISH_LINES: readonly string[] = [
  SHAPE_CAPTION,
  SHAPE_EMPTY_LINE,
  SEALED_READ_LINE,
  roundRingLine(1),
  roundRingLine(11),
  ...Object.values(SET_DONE_COPY).map((c) => c.line),
  yourWeekLine(5),
  yourWeekLine(2),
  yourWeekLine(0),
];
