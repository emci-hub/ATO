import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

import type { Check } from '@/lib/checks';
import { emitTodayCardChanged } from '@/lib/today-card-events';
import type { VoiceCardResult, VoiceSource } from '@/lib/voice/types';

export const APP_GROUP = 'group.com.emgens.ato';
export const WIDGET_KIND = 'AtoCard';
export const TODAY_CARD_KEY = 'ato.today-card.v1';

export interface TodayCard {
  day: number;
  read: string;
  do: string;
  source: VoiceSource;
  /** Home-only. Never written to the widget. */
  nudge?: string | null;
}

function writeWidget(card: TodayCard | null) {
  if (Platform.OS !== 'ios') return;
  try {
    const storage = new ExtensionStorage(APP_GROUP);
    if (card && card.read.trim().length > 0) {
      storage.set('read', card.read);
      storage.set('do', card.do);
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

/**
 * Home card from an already-logged Check. Fresh installs have empty
 * AsyncStorage, so this is the path that shows today's Read/Do/Nudge
 * without waiting for Dawn.
 */
export function todayCardFromCheck(
  check: Pick<Check, 'day' | 'read_text' | 'do_text' | 'source' | 'nudge_text'>,
): TodayCard | null {
  const read = check.read_text?.trim() ?? '';
  const doText = check.do_text?.trim() ?? '';
  if (!read || !doText) return null;
  return {
    day: check.day,
    read,
    do: doText,
    source: check.source,
    nudge: check.nudge_text,
  };
}

export async function loadTodayCard(): Promise<TodayCard | null> {
  try {
    const raw = await AsyncStorage.getItem(TODAY_CARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TodayCard;
    if (!parsed || typeof parsed.read !== 'string' || typeof parsed.do !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the current Read + Do for Home and the iOS widget. Nudge stays in-app. */
export async function saveTodayCard(card: TodayCard | null): Promise<void> {
  if (card) {
    await AsyncStorage.setItem(TODAY_CARD_KEY, JSON.stringify(card));
  } else {
    await AsyncStorage.removeItem(TODAY_CARD_KEY);
  }
  writeWidget(card);
  emitTodayCardChanged();
}

/** Write Home + widget from a Dawn router result. Skips crisis / empty. */
export async function persistRoutedCard(result: VoiceCardResult): Promise<void> {
  if (result.kind !== 'card' || !result.card) return;
  await saveTodayCard({
    day: result.day,
    read: result.card.read,
    do: result.card.do,
    source: result.source,
    nudge: result.nudge ?? result.card.nudge ?? null,
  });
}
