import { Redirect } from 'expo-router';

/**
 * Old `/sage` links (pushes, saved deep links, a stale `router.push`) land on
 * Insights, which replaced Sage on 2026-10-14. Kept as its own route so the
 * redirect works over OTA without a native build. Pinned by `check:tab-rename`.
 */
export default function SageRedirect() {
  return <Redirect href="/insights" />;
}
