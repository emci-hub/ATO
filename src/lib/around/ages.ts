/**
 * Whether a show's ages string is flagged 18+ (or 19+, same Wave 2 gate).
 * Null / all-ages / 16+ are not gated. Under-18s may still mark going there.
 */
export function showRequires18(ages: string | null | undefined): boolean {
  if (!ages || !ages.trim()) return false;
  const text = ages.trim().toLowerCase();
  if (/\b(18|19)\s*\+/.test(text)) return true;
  if (/\b(18|19)\s*(and|&)\s*(over|older)/.test(text)) return true;
  return false;
}

export const GOING_UNDER_18_MESSAGE = 'This night is 18+. ATO uses the birthday you already gave us.';
export const COLOR_BLOB_MIN = 3;
