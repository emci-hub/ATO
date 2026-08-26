/**
 * Push copy. No fake urgency, no streak language, no "you're losing…".
 * Morning is the Read itself. Evening is a Check reminder. Sunday is the
 * week's recap plus "you showed up N".
 */

export const PUSH_PATHS = {
  morning: '/',
  evening: '/?focus=check',
  sunday: '/week',
} as const;

export type PushKind = keyof typeof PUSH_PATHS;

export interface PushPayload {
  kind: PushKind;
  title: string;
  body: string;
  url: string;
}

export function morningPush(read: string): PushPayload {
  const body = read.trim();
  return {
    kind: 'morning',
    title: 'Read',
    body: body.length > 0 ? body : 'Your Read is ready.',
    url: PUSH_PATHS.morning,
  };
}

export function eveningPush(): PushPayload {
  return {
    kind: 'evening',
    title: 'Check today',
    body: 'Did you do it, or skip? Either one counts.',
    url: PUSH_PATHS.evening,
  };
}

export function sundayPush(input: { showedUp: number; recap: string }): PushPayload {
  const showed =
    input.showedUp === 1 ? 'You showed up 1.' : `You showed up ${input.showedUp}.`;
  const recap = input.recap.trim();
  return {
    kind: 'sunday',
    title: 'This week',
    body: recap.length > 0 ? `${recap} ${showed}` : showed,
    url: PUSH_PATHS.sunday,
  };
}

/** Honest recap line from this week's logged Reads. Empty is honest, not invented. */
export function recapFromReads(reads: string[]): string {
  const lines = reads.map((read) => read.trim()).filter((read) => read.length > 0);
  if (lines.length === 0) return 'Nothing logged this week.';
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
