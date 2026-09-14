/**
 * Today's insight as Home and the iOS widget see it — the local cache, the
 * widget write, and the change event. Replaces src/lib/today-card.ts, which
 * did the same three jobs for the deleted Read/Do card.
 *
 * The AsyncStorage cache exists for one reason: Home must render today's
 * content on mount without waiting on a network fetch or a generation, so a
 * returning user never sees a flash of empty state. `daily_insights` is the
 * source of truth; this is only a paint-fast copy.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

import { emitDailyInsightChanged } from './events';
import type { DailyInsight } from './store';

export const APP_GROUP = 'group.com.emgens.ato';

/**
 * The widget kind and App Group keys are still the CARD-era names
 * (`AtoCard`, `read`, `do`, `hasCard`). Deliberate: the widget binary already
 * on people's home screens reads exactly these, and a shipped widget cannot be
 * updated over OTA. So the client keeps writing them, sourced from the insight
 * — `read` from the title, `do` from what to try today. Renaming them to
 * `AtoInsight` / `title` / `tryToday` needs a native build and lands with it
 * (T-H3), not before, or every installed widget goes blank.
 */
export const WIDGET_KIND = 'AtoCard';
export const TODAY_INSIGHT_KEY = 'ato.today-insight.v1';

/** The subset Home paints immediately and the widget mirrors. */
export interface CachedInsight {
  day: number;
  ymd: string;
  theme: string;
  title: string;
  reflection: string;
  tryToday: string;
  watchFor: string;
}

export function cachedFromInsight(insight: DailyInsight): CachedInsight {
  return {
    day: insight.day,
    ymd: insight.ymd,
    theme: insight.theme,
    title: insight.title,
    reflection: insight.reflection,
    tryToday: insight.tryToday,
    watchFor: insight.watchFor,
  };
}

function writeWidget(insight: CachedInsight | null) {
  if (Platform.OS !== 'ios') return;
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    if (insight && insight.title.trim().length > 0) {
      storage.set('read', insight.title);
      storage.set('do', insight.tryToday);
      storage.set('hasCard', '1');
    } else {
      storage.set('read', '');
      storage.set('do', '');
      storage.set('hasCard', '0');
    }
    ExtensionStorage.reloadWidget(WIDGET_KIND);
  } catch (err) {
    console.log('[widget] native write skipped:', err);
  }
}

export async function loadCachedInsight(): Promise<CachedInsight | null> {
  try {
    const raw = await AsyncStorage.getItem(TODAY_INSIGHT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedInsight;
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.tryToday !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Cache today's insight for Home, mirror it to the widget, and notify listeners. */
export async function saveCachedInsight(insight: CachedInsight | null): Promise<void> {
  if (insight) {
    await AsyncStorage.setItem(TODAY_INSIGHT_KEY, JSON.stringify(insight));
  } else {
    await AsyncStorage.removeItem(TODAY_INSIGHT_KEY);
  }
  writeWidget(insight);
  emitDailyInsightChanged();
}
