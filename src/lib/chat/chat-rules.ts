/**
 * Circle chat rules + copy (Step 14). Pure: no I/O, so `check:circle-chat` can test it.
 * Server: wave108_circle_chat.sql. I/O: chat-store.ts. Keys: chat-crypto.ts. Filter: chat-filter.ts.
 */

/** Characters per message (the server allows 8000 of ciphertext; 1000 chars fits with room). */
export const CHAT_MAX_CHARS = 1000;
/** A report carries the reported message plus this many before it (emci 2026-10-21). */
export const CHAT_REPORT_CONTEXT_BEFORE = 5;
/** Ciphertext lives this long on the server (wave108 cron). */
export const CHAT_RETENTION_DAYS = 30;

export const CHAT_REPORT_REASON_IDS = ['harassment', 'hate', 'sexual', 'spam', 'impersonation', 'other'] as const;
export type ChatReportReason = (typeof CHAT_REPORT_REASON_IDS)[number];

export type ChatLevel = 'none' | 'warned' | 'chat_off' | 'banned';

/** One message as the screen holds it, oldest first. `text` null = this phone can't open it. */
export type ChatLine = { id: string; mine: boolean; text: string | null; at: string };

/**
 * What a report sends: the reported line and up to 5 lines before it (oldest first), only lines
 * this phone could open. Null when the reported line isn't one the friend sent.
 */
export function reportContext(
  lines: readonly ChatLine[],
  reportedId: string,
): { id: string; mine: boolean; text: string; at: string }[] | null {
  const i = lines.findIndex((l) => l.id === reportedId);
  if (i < 0) return null;
  const target = lines[i]!;
  if (target.mine || target.text == null) return null;
  return lines
    .slice(Math.max(0, i - CHAT_REPORT_CONTEXT_BEFORE), i + 1)
    .filter((l): l is ChatLine & { text: string } => l.text != null)
    .map((l) => ({ id: l.id, mine: l.mine, text: l.text.slice(0, 2000), at: l.at }));
}

export const CHAT_UI = {
  title: (handle: string) => `@${handle}`,
  privacyLine: `Only you two can read this. Messages delete after ${CHAT_RETENTION_DAYS} days. A report sends us the message you report and the ${CHAT_REPORT_CONTEXT_BEFORE} before it.`,
  placeholder: 'Message',
  inputLabel: 'Write a message',
  send: 'Send',
  sendFlagged: 'Tap again to send',
  flaggedOut: 'This might land badly. Tap Send again if you mean it.',
  hiddenIn: 'Hidden: might be offensive. Tap to show.',
  cantOpen: 'Sent to an older phone. Can’t open it here.',
  empty: 'No messages yet.',
  loading: 'Loading…',
  loadOlder: 'Load older',
  tooLong: (n: number) => `${n} over the limit`,
  report: 'Report',
  reportTitle: 'Report this message',
  reportReasons: {
    harassment: 'Harassing me',
    hate: 'Hate or slurs',
    sexual: 'Sexual stuff I didn’t want',
    spam: 'Spam or scam',
    impersonation: 'Pretending to be someone',
    other: 'Something else',
  } satisfies Record<ChatReportReason, string>,
  reported: 'Thanks. We read every report within a day.',
  cancel: 'Cancel',
  block: 'Block',
  blockArmed: (handle: string) => `Tap again to block @${handle}`,
  blocked: 'Blocked. They won’t be told.',
  back: 'Back',
  noPeerKey: (handle: string) => `@${handle} hasn’t opened chat yet. You can message once they do.`,
  needUpdate: 'Chat needs the latest version of ATO from the App Store.',
  notFriends: 'You can only message people in your Circle.',
  warned: 'A message you sent was reported and broke the rules. Next time, chat turns off.',
  warnedOk: 'Got it',
  chatOff: 'Chat is off for your account after reports.',
  error: 'Something went wrong. Try again.',
  rateLimited: 'That’s a lot of messages. Take a breather.',
  keyChanged: 'Their phone changed. Try sending again.',
  signedOut: 'Sign in to use chat.',
} as const;
