/**
 * Old in-app paths that moved. Pure (no React Native) so `check:tab-rename`
 * can pin it in Node; `+native-intent.ts` uses it for cold-start links.
 */
export function legacyRedirect(path: string): string | null {
  // Sage was replaced by Insights (2026-10-14): old links land there.
  if (/^\/?sage\/?$/.test(path)) return '/insights';
  return null;
}
