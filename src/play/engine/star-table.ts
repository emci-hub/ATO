/**
 * StarTable — per-star item scaling table (data stub; mirrors the live merge
 * numbers in `playStore.ts`, which stays the source of truth until the
 * forever engine wires this table in).
 *
 * One row per star tier 0…5: how much a worn copy's mults scale at that star
 * (`mult_scale`, +10% per star) and the honest risky-merge success % to reach
 * the NEXT star (`merge_success`; null at the cap). Rows are authored in
 * `src/play/data/stars.json` — code reads ids/rows only.
 */
import rawStars from '../data/stars.json';

export type StarRow = {
  star: number;
  /** Worn-copy mult scale at this star (1.0 at ★0, +0.1 per star). */
  mult_scale: number;
  /** Risky-merge success % to the next star; null at the cap (nothing above). */
  merge_success: number | null;
};

/** Authoring defaults, used only when stars.json is missing/malformed. */
const FALLBACK_STARS: readonly StarRow[] = [
  { star: 0, mult_scale: 1.0, merge_success: 0.7 },
  { star: 1, mult_scale: 1.1, merge_success: 0.55 },
  { star: 2, mult_scale: 1.2, merge_success: 0.4 },
  { star: 3, mult_scale: 1.3, merge_success: 0.28 },
  { star: 4, mult_scale: 1.4, merge_success: 0.18 },
  { star: 5, mult_scale: 1.5, merge_success: null },
];

/** Parsed star table (validated, falls back on malformed rows). */
export const STAR_TABLE: readonly StarRow[] = parseStars(rawStars);

function parseStars(raw: unknown): readonly StarRow[] {
  if (!Array.isArray(raw)) return FALLBACK_STARS;
  const rows: StarRow[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry == null) continue;
    const row = entry as Record<string, unknown>;
    if (typeof row.star !== 'number' || !Number.isFinite(row.star)) continue;
    if (typeof row.mult_scale !== 'number' || !Number.isFinite(row.mult_scale)) continue;
    const success =
      row.merge_success == null
        ? null
        : typeof row.merge_success === 'number' && Number.isFinite(row.merge_success)
          ? row.merge_success
          : null;
    rows.push({ star: Math.floor(row.star), mult_scale: row.mult_scale, merge_success: success });
  }
  return rows.length > 0 ? rows : FALLBACK_STARS;
}

/** Highest star in the table (the merge cap). */
export function maxStar(): number {
  return STAR_TABLE.length > 0 ? STAR_TABLE[STAR_TABLE.length - 1].star : 5;
}

/** The row for a star (falls back to the nearest in-range row). */
export function starRow(star: number): StarRow | undefined {
  const wanted = Math.max(0, Math.floor(star));
  return STAR_TABLE.find((row) => row.star === wanted);
}

/** Mult scale at a star (1.0 base — a ★2 copy scales mults ×1.2). */
export function starMultScale(star: number): number {
  return starRow(star)?.mult_scale ?? 1 + 0.1 * Math.max(0, star);
}

/** Risky-merge success % at a star (null at the cap). */
export function starMergeSuccess(star: number): number | null {
  const row = starRow(star);
  if (!row) return null;
  return row.merge_success;
}
