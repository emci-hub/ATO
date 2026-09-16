/**
 * Category card format (Explore release polish, emci 2026-09-16).
 *
 * A category now reads as four short parts — summary, strength, watch-out,
 * try-this — instead of one prose statement. No schema change: the four parts
 * are stored as compact JSON inside the existing `category_statements.statement`
 * text column (600-char DB check, and the RPC truncates with `left()`, which
 * would corrupt JSON — so `serializeCategoryCard` guarantees it fits first).
 *
 * Rows written before this change are plain prose. `parseCategoryCard` renders
 * those as a summary-only card, so old cached results keep showing.
 */
export const CATEGORY_CARD_DB_MAX_CHARS = 600;
export const CATEGORY_CARD_FIELD_MAX = { summary: 140, strength: 140, watchOut: 140, tryThis: 120 } as const;

export interface CategoryCard {
  summary: string;
  strength: string | null;
  watchOut: string | null;
  tryThis: string | null;
}

type Stored = { v: 2; s: string; st: string; w: string; t: string };

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  // Cut by code point so an emoji is never split into a lone surrogate.
  const points = Array.from(clean);
  let out = '';
  for (const point of points) {
    if (out.length + point.length > max - 1) break;
    out += point;
  }
  return `${out.trimEnd()}…`;
}

/** Returns null when the JSON would still not fit the column — the caller treats that as a failed generation. */
export function serializeCategoryCard(card: {
  summary: string;
  strength: string;
  watchOut: string;
  tryThis: string;
}): string | null {
  let scale = 1;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const stored: Stored = {
      v: 2,
      s: clip(card.summary, Math.floor(CATEGORY_CARD_FIELD_MAX.summary * scale)),
      st: clip(card.strength, Math.floor(CATEGORY_CARD_FIELD_MAX.strength * scale)),
      w: clip(card.watchOut, Math.floor(CATEGORY_CARD_FIELD_MAX.watchOut * scale)),
      t: clip(card.tryThis, Math.floor(CATEGORY_CARD_FIELD_MAX.tryThis * scale)),
    };
    const text = JSON.stringify(stored);
    if (text.length <= CATEGORY_CARD_DB_MAX_CHARS) return text;
    scale *= 0.8;
  }
  return null;
}

/** New rows → full card. Old plain-prose rows → summary-only card. */
export function parseCategoryCard(statement: string): CategoryCard {
  const trimmed = statement.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<Stored>;
      if (parsed.v === 2 && typeof parsed.s === 'string' && parsed.s.trim()) {
        const opt = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
        return { summary: parsed.s.trim(), strength: opt(parsed.st), watchOut: opt(parsed.w), tryThis: opt(parsed.t) };
      }
    } catch {
      // Not our JSON — fall through and show it as prose.
    }
  }
  return { summary: trimmed, strength: null, watchOut: null, tryThis: null };
}
