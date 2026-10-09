/** Pure helper for `reject-log.ts` (no React Native imports, so the offline check can pin it). */

/**
 * Reason only: a rule reason can quote the model ("name not in entry: Kyoto",
 * "number not in entry: 5"), so only the plain lowercase rule words are kept.
 */
export function reasonOnly(reason: string): string {
  return reason
    .split(':')
    .map((part) => part.trim())
    .filter((part) => /^[a-z][a-z -]*$/.test(part))
    .join(': ')
    .slice(0, 120);
}
