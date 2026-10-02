/**
 * Push copy. No fake urgency, no streak language, no "you're losing…".
 * Morning is today's daily line. Sunday is "you showed up N" — the days the app
 * was opened that week. The evening push is a Check reminder and is switched
 * off in push.ts while the Check loop is parked (there is nothing to log).
 */

import { cueAfterYou } from '@/lib/voice/cue';

export const PUSH_PATHS = {
  morning: '/',
  evening: '/?focus=check',
  insight: '/explore',
  // Was '/week' — that screen is a "Rebuilt" placeholder, so the weekly push
  // landed on a dead end. Home until the week view is rebuilt (2026-10-01).
  sunday: '/',
} as const;

export type PushKind = keyof typeof PUSH_PATHS;

export interface PushPayload {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
}

export const MORNING_PUSH_TITLE = 'ATO';
export const MORNING_PUSH_FALLBACK = 'Today’s line is ready.';

export function morningPush(read: string): PushPayload {
  const body = read.trim();
  return {
    kind: 'morning',
    // Was 'Sage · coach' / 'Your Read is ready.' — both named things the app no
    // longer has (emci 2026-10-02). The installed widget's own header still says
    // SAGE · COACH; that is native and needs a new build to change.
    title: MORNING_PUSH_TITLE,
    body: body.length > 0 ? body : MORNING_PUSH_FALLBACK,
    url: PUSH_PATHS.morning,
  };
}

export function eveningPush(windDownCue?: string | null): PushPayload {
  const cue = windDownCue?.trim() ? cueAfterYou(windDownCue.trim()) : '';
  return {
    kind: 'evening',
    title: 'Check today',
    body: cue
      ? `When you ${cue}, log today's Check — did it or skipped, either one counts.`
      : 'Did you do it, or skip? Either one counts.',
    url: PUSH_PATHS.evening,
  };
}

/** Uses an already-generated, already-visible category statement — nothing new is generated for the push itself. */
export function insightPush(categoryLabel: string, statementBody: string): PushPayload {
  const body = statementBody.trim();
  return {
    kind: 'insight',
    title: categoryLabel,
    body: body.length > 0 ? body : 'A new read is ready in Categories.',
    url: PUSH_PATHS.insight,
  };
}

export function sundayPush(input: { showedUp: number; recap: string }): PushPayload {
  const showed =
    input.showedUp === 0
      ? 'Nothing logged this week. That’s fine — the week is still yours.'
      : input.showedUp === 1
        ? 'You showed up 1.'
        : `You showed up ${input.showedUp}.`;
  const recap = input.recap.trim();
  return {
    kind: 'sunday',
    title: 'This week',
    body: recap.length > 0 ? `${recap} ${showed}` : showed,
    url: PUSH_PATHS.sunday,
  };
}

/**
 * Honest recap line from this week's logged Reads. Empty is honest, not invented.
 *
 * Returns '' rather than a sentence when there is no Read text, because since
 * 2026-09-14 Checks stop carrying Read/Do — an all-null week is now the normal
 * case for anyone who logged, not evidence that they didn't. The old
 * 'Nothing logged this week.' string sat directly beside 'You showed up 5.'
 * and contradicted it. Callers render the count themselves and skip an empty
 * recap.
 */
export function recapFromReads(reads: Array<string | null | undefined>): string {
  const lines = reads
    .map((read) => (read ?? '').trim())
    .filter((read) => read.length > 0);
  if (lines.length === 0) return '';
  const latest = lines[lines.length - 1];
  if (lines.length === 1) return latest;
  return `${lines.length} Reads. Latest: ${latest}`;
}

const URGENCY = /streak|losing|don't miss|dont miss|you'll fall behind|youll fall behind|keep it going or else/i;

export function copyHasFakeUrgency(text: string): boolean {
  return URGENCY.test(text);
}

export function pathFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const url = (data as { url?: unknown }).url;
  if (typeof url !== 'string' || url.length === 0) return null;
  if (url === '/home' || url === 'home' || url === '/(tabs)' || url === '/(tabs)/index') {
    return PUSH_PATHS.morning;
  }
  return url;
}
