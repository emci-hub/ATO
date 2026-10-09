/**
 * Shared AI library (wave93, emci 2026-10-09): "library first, AI tops up".
 *
 * People whose leanings fall in the same BUCKET share AI cards. A tap serves
 * an unseen card from the bucket for free; only an empty bucket costs a new
 * AI card (5 ATO tokens), which the SERVER writes, checks and adds to the
 * library for the next person. The phone never sends card text: it sends the
 * kind and the bucket key, and the `ai-library` Edge Function rebuilds the
 * prompt from the key with this same code (bundled by
 * `scripts/gen-ai-library-bundle.ts`, pinned by `check:ai-library`).
 *
 * Pure: no I/O here, so the bundle runs on Deno and the check runs on Node.
 */

export const LIBRARY_KINDS = ['deep_dive', 'story', 'legend'] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export function isLibraryKind(value: unknown): value is LibraryKind {
  return typeof value === 'string' && (LIBRARY_KINDS as readonly string[]).includes(value);
}

/**
 * Bumped when a kind's prompt or card shape changes: a card is served only to
 * a phone asking for the same version (old cards are never shown by a newer
 * prompt, and a newer card never reaches an older app).
 */
export const LIBRARY_VERSION: Readonly<Record<LibraryKind, string>> = {
  deep_dive: 'l1',
  story: 'l1',
  legend: 'l1',
};

/** Free library cards a day per kind (server: `app_config.library_free_daily_cap`). */
export const LIBRARY_FREE_DAILY = 10;

/** "You and N others got this card" only from this many people up (never who). */
export const LIBRARY_SHARED_MIN = 5;

/** "You and 11 others got this card." — null under 5 people (never who). */
export function sharedCardLine(others: number | null): string | null {
  return others != null && others >= LIBRARY_SHARED_MIN - 1 ? `You and ${others} others got this card.` : null;
}

/** Bucket keys: short, lowercase, no spaces (server CHECK uses the same shape). */
export const BUCKET_KEY_RE = /^[a-z0-9_|:=+,.!-]{3,255}$/;

/** One card the AI wrote, with the angle it was written from. */
export interface LibraryCardDraft<T> {
  angle: string;
  card: T;
}

/** The checked answer of one AI call: the cards that passed, or why none did. */
export interface LibraryParse<T> {
  cards: LibraryCardDraft<T>[];
  reason: string | null;
}

/** Every kind answers the same questions for the server. */
export interface LibraryKindSpec<Spec, Card> {
  kind: LibraryKind;
  /** The key → what the prompt needs, or null for a key this code doesn't know. */
  parseBucket(key: string): Spec | null;
  /** Angles this bucket can be written from, in order of preference. */
  angles(spec: Spec): readonly string[];
  /** How many cards one call writes (2 for deep dives, 1 otherwise). */
  cardsPerCall: number;
  buildPrompt(spec: Spec, angles: readonly string[]): { prompt: string; maxOutputTokens: number };
  parse(raw: string, spec: Spec, angles: readonly string[]): LibraryParse<Card>;
  /** A stored card read back (loose), or null. */
  readCard(raw: unknown): Card | null;
}

/** FNV-1a, 32-bit: a stable small hash for seeding per bucket (no per-person seed). */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
