import { useCallback, useEffect, useState } from 'react';

import { loadTodayCard, type TodayCard } from '@/lib/today-card';
import { onTodayCardChanged } from '@/lib/today-card-events';

/** Same Read + Do payload Home and the widget render. */
export function useTodayCard() {
  const [card, setCard] = useState<TodayCard | null>(null);

  const reload = useCallback(async () => {
    setCard(await loadTodayCard());
  }, []);

  useEffect(() => {
    reload();
    return onTodayCardChanged(() => {
      reload();
    });
  }, [reload]);

  return { card, reload };
}
