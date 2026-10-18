/**
 * Turf War map theme — the player's pick from the Setup sheet (step T8, emci 2026-10-17: option A, a picker).
 *
 * Device-local (AsyncStorage), read synchronously through a tiny external store so the board never waits on it
 * (same pattern as fx-quality.ts). Defaults to the alley. Paint only: no reward, rule or layout change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { DEFAULT_TURF_THEME, isTurfThemeId, type TurfThemeId } from '@/play/turf-theme';

export const TURF_THEME_KEY = 'ato.play.boardTheme.v1';

let current: TurfThemeId = DEFAULT_TURF_THEME;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getTurfTheme(): TurfThemeId {
  return current;
}

export function setTurfTheme(next: TurfThemeId): void {
  if (next === current) return;
  current = next;
  emit();
  AsyncStorage.setItem(TURF_THEME_KEY, next).catch(() => {
    // Device preference only — a failed save just means next launch is the alley.
  });
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(TURF_THEME_KEY);
    if (isTurfThemeId(raw) && raw !== current) {
      current = raw;
      emit();
    }
  } catch {
    // Keep the default.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadOnce();
  return () => {
    listeners.delete(listener);
  };
}

/** The live pick; loads the saved value on first use. */
export function useTurfTheme(): TurfThemeId {
  return useSyncExternalStore(subscribe, getTurfTheme, getTurfTheme);
}
