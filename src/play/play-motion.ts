/**
 * Play motion policy v2 (2026-10-12) — BEAST sign-off pending.
 *
 * Modes: Full (default) | Reduced | Off.
 *   - vestibularSafe = OS Reduce Motion OR mode !== 'full'
 *     Only swaps the REPLACE list (shake, zoom, big slides, parallax, tilt).
 *   - cosmeticsStill = mode === 'off'
 *     Freezes cosmetics to a still frame. Walk / auras / room life KEEP
 *     running unless this is on.
 *   - Under vestibularSafe, KEEP loops stay alive but gentler (≤24pt travel,
 *     scale pulse ≤1.04). Never a static screen.
 *
 * Stored values migrate: phone→full, off→full, on→reduced.
 * Effects Quality stays a separate performance switch.
 *
 * Fence: "OS RM or Reduced swaps vestibular triggers; cosmetics freeze only
 * on Off." Do not claim App Store "Supports Reduced Motion" yet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

export const PLAY_MOTION_KEY = 'ato.play.reduceMotion.v1';
export const PLAY_MOTION_MODES = ['full', 'reduced', 'off'] as const;
export type PlayMotionMode = (typeof PLAY_MOTION_MODES)[number];
export const PLAY_MOTION_LABEL: Record<PlayMotionMode, string> = {
  full: 'Full',
  reduced: 'Reduced',
  off: 'Off',
};

const LEGACY: Record<string, PlayMotionMode> = {
  phone: 'full',
  off: 'full',
  on: 'reduced',
  full: 'full',
  reduced: 'reduced',
};

export type PlayMotionFlags = {
  mode: PlayMotionMode;
  osReduce: boolean;
  /** OS RM or in-game mode is not Full — REPLACE list only. */
  vestibularSafe: boolean;
  /** In-game Motion is Off — freeze cosmetics to a still frame. */
  cosmeticsStill: boolean;
  /** In-game mode is Reduced (gentler KEEP loops). */
  reduced: boolean;
};

let current: PlayMotionMode = 'full';
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getPlayMotionMode(): PlayMotionMode {
  return current;
}

export function setPlayMotionMode(next: PlayMotionMode): void {
  if (next === current) return;
  current = next;
  emit();
  AsyncStorage.setItem(PLAY_MOTION_KEY, next).catch(() => {
    // Device preference only — a failed save just means it stays in memory.
  });
}

function migrate(raw: string | null): PlayMotionMode | null {
  if (!raw) return null;
  return LEGACY[raw] ?? null;
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(PLAY_MOTION_KEY);
    const next = migrate(raw);
    if (next && next !== current) {
      current = next;
      emit();
    }
    if (raw && raw !== current && next) {
      AsyncStorage.setItem(PLAY_MOTION_KEY, next).catch(() => {});
    }
  } catch {
    // Keep Full.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadOnce();
  return () => {
    listeners.delete(listener);
  };
}

export function usePlayMotionMode(): PlayMotionMode {
  return useSyncExternalStore(subscribe, getPlayMotionMode, getPlayMotionMode);
}

export function resolvePlayMotion(mode: PlayMotionMode, osReduce: boolean): PlayMotionFlags {
  return {
    mode,
    osReduce,
    vestibularSafe: osReduce || mode !== 'full',
    cosmeticsStill: mode === 'off',
    reduced: mode === 'reduced',
  };
}

/** @deprecated v1 name — equals vestibularSafe. Prefer usePlayMotion(). */
export function resolveReduceMotion(mode: PlayMotionMode, phone: boolean): boolean {
  return resolvePlayMotion(mode, phone).vestibularSafe;
}

let phoneReduce = false;
const phoneListeners = new Set<() => void>();
let phoneWatching = false;

function watchPhoneReduceMotion(): void {
  if (phoneWatching) return;
  phoneWatching = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((value) => {
      if (value === phoneReduce) return;
      phoneReduce = value;
      for (const listener of phoneListeners) listener();
    })
    .catch(() => {
      // Keep the last known phone setting.
    });
  AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
    if (value === phoneReduce) return;
    phoneReduce = value;
    for (const listener of phoneListeners) listener();
  });
}

export function usePhoneReduceMotion(): boolean {
  return useSyncExternalStore(
    (listener) => {
      phoneListeners.add(listener);
      watchPhoneReduceMotion();
      return () => {
        phoneListeners.delete(listener);
      };
    },
    () => phoneReduce,
    () => false,
  );
}

export function usePlayMotion(): PlayMotionFlags {
  return resolvePlayMotion(usePlayMotionMode(), usePhoneReduceMotion());
}

/** Vestibular REPLACE flag (OS RM or mode ≠ Full). */
export function usePlayReduceMotion(): boolean {
  return usePlayMotion().vestibularSafe;
}

/** Scale a KEEP pop: Full can burst, vestibularSafe caps at 1.04. */
export function keepPopScale(vestibularSafe: boolean, fullPeak = 1.08): number {
  return vestibularSafe ? 1.04 : fullPeak;
}

/** Travel cap for KEEP loops under vestibularSafe (art/screen pt). */
export const KEEP_TRAVEL_PT = 24;
