/**
 * Dev-lab Home overrides. Storage is written from /dev-lab; Home is not wired yet.
 * Readers return null unless __DEV__ — production never honours these keys.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AskPick } from '@/lib/ask';
import type { TodaySlot } from '@/lib/today-slot';

export const SLOT_OVERRIDE_KEY = 'ato.dev.slot-override.v1';
export const ASK_OVERRIDE_KEY = 'ato.dev.ask-override.v1';

export const SLOT_OVERRIDE_KINDS: readonly TodaySlot['kind'][] = [
  'crisis',
  'missed_check',
  'note',
  'ask',
  'week',
  'none',
];

export const ASK_OVERRIDE_KINDS: readonly AskPick['kind'][] = [
  'sage_knows',
  'ranking',
  'scenario',
];

function isSlotKind(value: string): value is TodaySlot['kind'] {
  return (SLOT_OVERRIDE_KINDS as readonly string[]).includes(value);
}

function isAskKind(value: string): value is AskPick['kind'] {
  return (ASK_OVERRIDE_KINDS as readonly string[]).includes(value);
}

export async function loadStoredSlotOverride(): Promise<TodaySlot['kind'] | null> {
  const raw = await AsyncStorage.getItem(SLOT_OVERRIDE_KEY);
  if (!raw || !isSlotKind(raw)) return null;
  return raw;
}

export async function loadStoredAskOverride(): Promise<AskPick['kind'] | null> {
  const raw = await AsyncStorage.getItem(ASK_OVERRIDE_KEY);
  if (!raw || !isAskKind(raw)) return null;
  return raw;
}

export async function writeSlotOverride(kind: TodaySlot['kind']): Promise<void> {
  await AsyncStorage.setItem(SLOT_OVERRIDE_KEY, kind);
}

export async function writeAskOverride(kind: AskPick['kind']): Promise<void> {
  await AsyncStorage.setItem(ASK_OVERRIDE_KEY, kind);
}

export async function clearSlotOverride(): Promise<void> {
  await AsyncStorage.removeItem(SLOT_OVERRIDE_KEY);
}

export async function clearAskOverride(): Promise<void> {
  await AsyncStorage.removeItem(ASK_OVERRIDE_KEY);
}

export async function readSlotOverride(): Promise<TodaySlot['kind'] | null> {
  if (!__DEV__) return null;
  return loadStoredSlotOverride();
}

export async function readAskOverride(): Promise<AskPick['kind'] | null> {
  if (!__DEV__) return null;
  return loadStoredAskOverride();
}
