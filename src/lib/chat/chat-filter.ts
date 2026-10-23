/**
 * Circle chat filter (Step 14, Apple 1.2): runs on the phone, because the server can't read the text.
 *
 * Narrow on purpose (core content policy, docs/copy-review-rules.md): swearing and adult jokes are
 * allowed. It only flags slurs aimed at a group (the same lists as names, `name-filter.ts`) and
 * explicit sexual words. A flag never deletes anything: an incoming message is hidden behind
 * "Tap to show", an outgoing one asks for a second tap. Pass/fail pairs: `check:circle-chat`.
 */
import { SAFE_WORDS, SLURS_ANYWHERE, SLURS_WHOLE, foldForFilter } from '@/lib/name-filter';

/** Whole words only: explicit enough that a friend didn't ask for them out of nowhere. */
export const SEXUAL_WHOLE = [
  'nudes',
  'dickpic',
  'dickpics',
  'blowjob',
  'handjob',
  'porn',
  'sext',
  'sexting',
] as const;

/** On the name list to stop impersonation, not slurs: a chat about history stays readable. */
export const CHAT_NOT_FLAGGED = ['hitler', 'kkk', 'nazi'] as const;

/** Two-word forms of the same thing ("dick pic"), matched on the folded words. */
const SEXUAL_PAIRS: readonly (readonly [string, string])[] = [
  ['dick', 'pic'],
  ['dick', 'pics'],
  ['send', 'nudes'],
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

function words(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[013457@$]/g, (ch) => LEET[ch] ?? ch)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

export type ChatFlag = 'slur' | 'sexual';

/** Why this message would be hidden, or null when it reads as normal. */
export function chatFlag(raw: string): ChatFlag | null {
  const folded = foldForFilter(raw);
  if (!folded) return null;
  const ws = words(raw);
  const scrubbed = ws
    .filter((w) => !(SAFE_WORDS as readonly string[]).includes(w))
    .map(foldForFilter)
    .join(' ');
  const skip = CHAT_NOT_FLAGGED as readonly string[];
  const anywhere = SLURS_ANYWHERE.filter((s) => !skip.includes(s));
  const whole = SLURS_WHOLE.filter((s) => !skip.includes(s)) as readonly string[];
  if (anywhere.some((s) => scrubbed.split(' ').some((w) => w.includes(s)))) return 'slur';
  if (ws.some((w) => whole.includes(w))) return 'slur';
  if (ws.some((w) => (SEXUAL_WHOLE as readonly string[]).includes(w))) return 'sexual';
  for (let i = 0; i + 1 < ws.length; i++) {
    if (SEXUAL_PAIRS.some(([a, b]) => ws[i] === a && ws[i + 1] === b)) return 'sexual';
  }
  return null;
}
