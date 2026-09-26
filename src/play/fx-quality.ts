/**
 * Effects Quality — the player's attack-effects setting (EFFECTS_PLAN step 5).
 *
 *   full    — every effect: glow strokes, impacts, charge-ups. Cap 12 on screen.
 *   minimal — core shape only (one stroke, one impact ring). Cap 6.
 *   off     — no beams, particles or impacts, but never zero feedback: every
 *             hit still shows its floating damage number, coloured by the
 *             attacking element (emci, 2026-09-26).
 *
 * Device-local (AsyncStorage), read synchronously through a tiny external
 * store so the board never waits on it. Defaults to full.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export const FX_QUALITY_KEY = 'ato.play.fxQuality.v1';

export const FX_QUALITIES = ['full', 'minimal', 'off'] as const;
export type FxQuality = (typeof FX_QUALITIES)[number];

export const FX_QUALITY_LABEL: Record<FxQuality, string> = {
  full: 'Full',
  minimal: 'Minimal',
  off: 'Off',
};

/** Max effects on screen at once per tier (plan: 12 measured-safe on device). */
export const FX_CAP: Record<FxQuality, number> = { full: 12, minimal: 6, off: 0 };

let current: FxQuality = 'full';
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function isFxQuality(value: unknown): value is FxQuality {
  return typeof value === 'string' && (FX_QUALITIES as readonly string[]).includes(value);
}

export function getFxQuality(): FxQuality {
  return current;
}

export function setFxQuality(next: FxQuality): void {
  if (next === current) return;
  current = next;
  emit();
  AsyncStorage.setItem(FX_QUALITY_KEY, next).catch(() => {
    // Device preference only — a failed save just means next launch is Full.
  });
}

export function nextFxQuality(q: FxQuality): FxQuality {
  return FX_QUALITIES[(FX_QUALITIES.indexOf(q) + 1) % FX_QUALITIES.length];
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(FX_QUALITY_KEY);
    if (isFxQuality(raw) && raw !== current) {
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

/** The live setting; loads the saved value on first use. */
export function useFxQuality(): FxQuality {
  return useSyncExternalStore(subscribe, getFxQuality, getFxQuality);
}
