/**
 * Reduce motion inside Divecore (v24, 2026-09-30) — follows the phone by
 * default, with an in-game override. Device-only (AsyncStorage), Play-only:
 * the app-wide theme still follows the phone; Play passes the resolved value
 * down to every Play screen as it already did.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

export const PLAY_MOTION_KEY = 'ato.play.reduceMotion.v1';
export const PLAY_MOTION_MODES = ['phone', 'on', 'off'] as const;
export type PlayMotionMode = (typeof PLAY_MOTION_MODES)[number];
export const PLAY_MOTION_LABEL: Record<PlayMotionMode, string> = {
  phone: 'Follow phone',
  on: 'On',
  off: 'Off',
};

let current: PlayMotionMode = 'phone';
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
    // Device preference only — a failed save just means it follows the phone.
  });
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(PLAY_MOTION_KEY);
    if ((PLAY_MOTION_MODES as readonly string[]).includes(raw ?? '') && raw !== current) {
      current = raw as PlayMotionMode;
      emit();
    }
  } catch {
    // Keep following the phone.
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

/** The reduce-motion value Play uses, given the phone's own setting. */
export function resolveReduceMotion(mode: PlayMotionMode, phone: boolean): boolean {
  return mode === 'phone' ? phone : mode === 'on';
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

/** The phone's Reduce Motion flag, one listener for every Play control. */
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

/** Play's resolved Reduce Motion: the in-game override, else the phone. */
export function usePlayReduceMotion(): boolean {
  return resolveReduceMotion(usePlayMotionMode(), usePhoneReduceMotion());
}
