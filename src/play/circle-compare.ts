/**
 * Circle compare (master plan Step 7b, docs/circle-design.md option B) — pure rules + copy, no React, no I/O.
 *
 * Per-friend opt-in, OFF by default, and it needs BOTH people's switch on (server: wave105
 * `circle_compare_allowed`). What a friend sees of you is only your shareable STRENGTHS, as keys
 * ("openness:high") that the phone turns into the fixed phrases below: up to 3 of yours, and the ones you both
 * have. Never a number, a score, a "who is more", a raw trait value, attachment, a struggle-side lean,
 * the daily Read/Do text or anything typed. The server list of private leans is pinned against
 * `COMPARE_PRIVATE` by `check:circle-compare`.
 */

export const CIRCLE_COMPARE_COPY_REVIEWED = false;

/** Keys the phone will ever print. A key outside this table is dropped, so a changed server cannot leak a lean. */
export const COMPARE_PHRASES: Readonly<Record<string, string>> = {
  'openness:high': 'likes trying the untried option',
  'openness:low': 'sticks with what works',
  'conscientiousness:high': 'sees a plan through',
  'conscientiousness:low': 'stays flexible when plans change',
  'extraversion:high': 'brings energy to a room',
  'extraversion:low': 'recharges with quiet time',
  'agreeableness:high': 'keeps things easy for others',
  'agreeableness:low': 'holds their ground',
  'steadiness:high': 'shakes off a bad day quickly',
  'conflict_assertiveness:high': 'says what they think in a disagreement',
  'conflict_cooperativeness:high': 'looks for something both sides can live with',
  'autonomy:high': 'likes doing it their own way',
  'autonomy:low': 'happy to follow a good plan',
  'competence:high': 'trusts themselves with a hard thing',
  'relatedness:high': 'likes a real connection',
  'relatedness:low': 'comfortable on their own',
  'growth_mindset:high': 'treats a flop as practice',
  'locus_of_control:high': 'acts like their choices matter',
  'self_efficacy:high': 'believes they can figure it out',
  'playfulness:high': 'keeps things playful',
  'playfulness:low': 'keeps it serious when it counts',
};

/**
 * Leans that are never shared. The same list is in wave105 `_compare_strengths`: both attachment axes, and the
 * low side of these axes (the conflict lows are stricter than `isShareableLean` on purpose).
 */
export const COMPARE_PRIVATE_AXES: readonly string[] = ['attachment_anxiety', 'attachment_avoidance'];
export const COMPARE_PRIVATE_LOW_AXES: readonly string[] = [
  'steadiness',
  'competence',
  'self_efficacy',
  'growth_mindset',
  'locus_of_control',
  'conflict_assertiveness',
  'conflict_cooperativeness',
];

export function compareKeyIsShareable(key: string): boolean {
  const [axis, lean] = key.split(':');
  if (!axis || (lean !== 'high' && lean !== 'low')) return false;
  if (COMPARE_PRIVATE_AXES.includes(axis)) return false;
  if (lean === 'low' && COMPARE_PRIVATE_LOW_AXES.includes(axis)) return false;
  return Object.prototype.hasOwnProperty.call(COMPARE_PHRASES, key);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const obj = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v != null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Keys → phrases, shareable only, no repeats, at most `cap`. */
export function comparePhrases(raw: unknown, cap = 3): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== 'string' || !compareKeyIsShareable(k)) continue;
    const phrase = COMPARE_PHRASES[k];
    if (!out.includes(phrase)) out.push(phrase);
    if (out.length >= cap) break;
  }
  return out;
}

export type CircleCompareFriend = { peer: string; mine: boolean; allowed: boolean };
export type CircleCompareList = { preview: string[]; friends: CircleCompareFriend[] };

export function parseCompareList(raw: unknown): CircleCompareList | null {
  const r = obj(raw);
  if (!r || !Array.isArray(r.friends)) return null;
  const friends: CircleCompareFriend[] = [];
  for (const row of r.friends.slice(0, 200)) {
    const f = obj(row);
    if (!f || typeof f.peer !== 'string' || !UUID.test(f.peer)) continue;
    friends.push({ peer: f.peer, mine: f.mine === true, allowed: f.allowed === true });
  }
  return { preview: comparePhrases(r.preview), friends };
}

export type CircleCompareCard = { shared: string[]; theirs: string[] };

/** `{ ok, shared, theirs }` → a card, or null. Unknown / private keys are dropped. */
export function parseCompareCard(raw: unknown): CircleCompareCard | null {
  const r = obj(raw);
  if (!r || r.ok !== true) return null;
  return { shared: comparePhrases(r.shared, 6), theirs: comparePhrases(r.theirs) };
}

/* ------------------------------------------------------------------ copy --- */

export const COMPARE_UI = {
  menu: 'Compare strengths',
  title: (handle: string) => `Compare with @${handle}`,
  /** The consent line: exactly what a friend sees. */
  consent:
    'If you both switch this on, each of you sees up to 3 of the other’s strengths, and the ones you share. No scores, no numbers, nothing you answered or typed. Off any time, and it stops straight away.',
  previewFor: (handle: string) => `What @${handle} would see of you`,
  previewNone: 'Nothing yet. Answer more questions and your strengths show up here.',
  switchLabel: (handle: string, on: boolean) => `Compare strengths with @${handle}, ${on ? 'on' : 'off'}`,
  switchOn: 'Compare is on',
  switchOff: 'Compare is off',
  waiting: (handle: string) => `Waiting for @${handle} to switch it on too.`,
  sharedTitle: 'What you two share',
  sharedNone: 'Nothing in common yet. That can change as you both answer more.',
  theirsTitle: (handle: string) => `@${handle} tends to…`,
  theirsNone: 'No strengths to show yet.',
  notAllowed: 'Compare is off on one side.',
  loading: 'Looking…',
  error: 'Can’t reach your Circle right now.',
} as const;
