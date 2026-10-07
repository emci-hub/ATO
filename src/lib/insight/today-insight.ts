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

import { ideaForTitle, ideaShareable } from '@/lib/insight-bank';

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
 *
 * Since the stored bank (2026-10-07) `read` is the focus and `do` is its trait
 * tags — or the private "ready" copy when the focus is not for other eyes
 * (`lockScreenInsight`).
 */
export const WIDGET_KIND = 'AtoCard';
export const TODAY_INSIGHT_KEY = 'ato.today-insight.v1';

/** The subset Home paints immediately and the widget mirrors. */
export interface CachedInsight {
  /**
   * Who this insight belongs to. Added 2026-09-15: the cache key carries no
   * user id (and cannot gain one without breaking the shipped widget's App
   * Group contract), so the owner travels inside the payload instead and
   * `loadCachedInsight` refuses a payload that belongs to someone else.
   * Optional only so a payload written before this shipped parses rather than
   * throwing — such a payload has no owner and is therefore never served to a
   * caller that asks for one.
   */
  userId?: string;
  day: number;
  ymd: string;
  theme: string;
  title: string;
  reflection: string;
  tryToday: string;
  watchFor: string;
}

export function cachedFromInsight(insight: DailyInsight, userId: string): CachedInsight {
  return {
    userId,
    day: insight.day,
    ymd: insight.ymd,
    theme: insight.theme,
    title: insight.title,
    reflection: insight.reflection,
    tryToday: insight.tryToday,
    watchFor: insight.watchFor,
  };
}

/** What the widget, a push or a share says when today's focus is not for other eyes. */
export const INSIGHT_PRIVATE_COPY = 'Today’s focus is ready.';

/**
 * What may leave the app for today's insight (emci, 2026-10-07): the focus and
 * its tags, and only when every trait it is about passes `isShareableLean`.
 * Anything else (a worry or struggle lean, or an old AI-written row that is not
 * in the bank) gets the private "ready" copy and no tags.
 */
export function lockScreenInsight(insight: Pick<CachedInsight, 'title' | 'theme'>): {
  text: string;
  tags: string | null;
} {
  const match = ideaForTitle(insight.title);
  if (!match || !ideaShareable(match.idea)) return { text: INSIGHT_PRIVATE_COPY, tags: null };
  return { text: insight.title, tags: insight.theme };
}

function writeWidget(insight: CachedInsight | null) {
  if (Platform.OS !== 'ios') return;
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    if (insight && insight.title.trim().length > 0) {
      const outside = lockScreenInsight(insight);
      storage.set('read', outside.text);
      storage.set('do', outside.tags ?? WIDGET_LINE_FOLLOW_UP);
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

/** What the widget's second row says while only the written line is up. */
export const WIDGET_LINE_FOLLOW_UP = 'Open ATO to go deeper.';

/**
 * The written daily line on the widget, for a day with no loaded insight yet.
 * Same card-era keys as above. Not AI-written, so it does not depend on AI
 * consent; `saveCachedInsight` still owns the widget whenever an insight exists.
 */
export function writeWidgetLine(line: string) {
  if (Platform.OS !== 'ios') return;
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set('read', line);
    storage.set('do', WIDGET_LINE_FOLLOW_UP);
    storage.set('hasCard', '1');
    ExtensionStorage.reloadWidget(WIDGET_KIND);
  } catch (err) {
    console.log('[widget] native write skipped:', err);
  }
}

/**
 * `expectedUserId` is the second half of the cross-account fix (the first being
 * `clearLocalAccountData`, which erases this key on delete and sign-out). Pass
 * it wherever the signed-in user is known and a wrong-owner paint would be
 * visible — Home does. A caller that genuinely has no user in hand (push
 * scheduling) omits it and gets whatever is cached, which is safe because the
 * key no longer survives the account that wrote it.
 */
export async function loadCachedInsight(expectedUserId?: string): Promise<CachedInsight | null> {
  try {
    const raw = await AsyncStorage.getItem(TODAY_INSIGHT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedInsight;
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.tryToday !== 'string') {
      return null;
    }
    // Unowned (pre-2026-09-15) payloads fail this too, on purpose: an insight
    // whose owner cannot be established must not be shown to a named user.
    if (expectedUserId !== undefined && parsed.userId !== expectedUserId) return null;
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
