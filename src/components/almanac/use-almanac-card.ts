import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { AlmanacDay } from '@/hooks/use-almanac-day';
import { almanac, type AlmanacCard, type AlmanacSurface } from '@/lib/almanac';
export { cardIsShareable } from '@/lib/almanac-share';

export interface ShownAlmanacCard {
  card: AlmanacCard;
  text: string;
}

/** Today's card for a surface, cached for the day by the engine. Null = nothing to show. */
export function useAlmanacCard(surface: AlmanacSurface, day: AlmanacDay | null): ShownAlmanacCard | null {
  const [shown, setShown] = useState<ShownAlmanacCard | null>(null);
  const ctx = day?.ctx;
  useEffect(() => {
    if (!ctx) {
      setShown(null);
      return;
    }
    let live = true;
    void almanac
      .loadToday(surface, ctx, AsyncStorage)
      .then((result) => {
        // The engine caches the day's card, so a refetch gives the same one: keep what is on screen meanwhile.
        if (live) setShown(result?.source === 'card' ? { card: result.card, text: result.text } : null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [surface, ctx]);
  return shown;
}
