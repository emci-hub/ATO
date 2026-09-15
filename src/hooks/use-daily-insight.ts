import { useCallback, useEffect, useState } from 'react';

import { onDailyInsightChanged } from '@/lib/insight/events';
import { loadCachedInsight, type CachedInsight } from '@/lib/insight/today-insight';

/**
 * Today's insight as Home and the widget render it.
 *
 * This is an AsyncStorage read and nothing else — no fetch, no generation.
 * Sage mounts this for Talk grounding, and a mount must never trigger a paid
 * call or block on the network. Home owns fetching and generating, then writes
 * through saveCachedInsight, which fires the event this subscribes to.
 *
 * `expectedUserId` is REQUIRED in effect: while it is undefined this hook holds
 * at null and reads nothing. That covers the window found in review — the
 * session resolves asynchronously, so Home's first renders have no user id, and
 * an `undefined`-means-don't-check hook would paint the cached insight
 * unchecked during exactly the restore window the ownership check exists for.
 * The cost is that Home's insight appears a frame or two later on a cold start;
 * the alternative is briefly showing one account another account's text.
 *
 * A caller that genuinely has no user and does not care (push scheduling) calls
 * `loadCachedInsight()` directly instead of using this hook.
 *
 * Changing `expectedUserId` re-reads, so an account switch cannot leave the
 * previous account's insight on screen.
 */
export function useDailyInsight(expectedUserId?: string) {
  const [insight, setInsight] = useState<CachedInsight | null>(null);

  const reload = useCallback(async () => {
    if (expectedUserId === undefined) {
      setInsight(null);
      return;
    }
    setInsight(await loadCachedInsight(expectedUserId));
  }, [expectedUserId]);

  useEffect(() => {
    reload();
    return onDailyInsightChanged(() => {
      reload();
    });
  }, [reload]);

  return { insight, reload };
}
