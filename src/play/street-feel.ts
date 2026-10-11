/**
 * Street shell feel (emci 2026-10-11): haptic ticks + shared motion timings.
 *
 * Haptics use `expo-haptics`. Its native module is optional: on a binary built
 * before the package was added, every call rejects and is swallowed here, so an
 * OTA never crashes; the ticks start working with the next native build.
 * `PlaySettings.haptics` turns them off (set by the Play store on load/commit).
 */
import * as Haptics from 'expo-haptics';

let hapticsOn = true;

export function setStreetHaptics(on: boolean): void {
  hapticsOn = on;
}

function run(fire: () => Promise<void>): void {
  if (!hapticsOn) return;
  try {
    fire().catch(() => {});
  } catch {
    // Native module missing on this build — silent.
  }
}

/** A light tick on a button press or tab change. */
export function tapHaptic(): void {
  run(() => Haptics.selectionAsync());
}

/** A firm thud: boss wave, leak, something that needs attention. */
export function alertHaptic(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** A reward pop: drop, merge, egg, level. */
export function rewardHaptic(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Motion timings (ms) — the plan's numbers, one place. */
export const STREET_MOTION = {
  press: 80,
  tab: 180,
  push: 220,
  sheet: 260,
  countUp: 400,
  pop: 420,
  stagger: 40,
} as const;

/** Sizes (pt) — the plan's sizing system, one place. */
export const STREET_SIZE = {
  tap: 48,
  resourceBar: 44,
  tabBar: 60,
  gutter: 16,
  gap: 8,
  type: { title: 26, heading: 18, label: 15, body: 15, small: 13 },
  menuMaxWidth: 560,
  /** Under this width the tab bar shows icons only. */
  compactWidth: 380,
} as const;
