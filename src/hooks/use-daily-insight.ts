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
 */
export function useDailyInsight() {
  const [insight, setInsight] = useState<CachedInsight | null>(null);

  const reload = useCallback(async () => {
    setInsight(await loadCachedInsight());
  }, []);

  useEffect(() => {
    reload();
    return onDailyInsightChanged(() => {
      reload();
    });
  }, [reload]);

  return { insight, reload };
}
