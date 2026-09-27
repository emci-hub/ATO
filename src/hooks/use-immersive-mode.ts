/**
 * `useImmersiveMode(enabled)` — hide the OS system bars while a screen wants
 * the whole display (first user: the Divecore Defend board), and restore them
 * when it stops wanting it, unmounts, or the app returns from the background.
 *
 * Any screen opts in with one line; the platform differences live here:
 *
 * - **Status bar (iOS + Android):** hidden with `expo-status-bar`
 *   (`setStatusBarHidden`, which keeps React Native's `<StatusBar>` stack in
 *   sync, so screens that render `<StatusBar style=…>` don't fight it).
 *   Do NOT render `<StatusBar hidden={…}>` anywhere: an explicit `hidden`
 *   prop wins over this hook while that component is mounted.
 * - **iOS notch / Dynamic Island / home indicator:** iOS keeps those safe-area
 *   insets even with the status bar hidden, and the home indicator cannot be
 *   hidden from Expo JS — so keep laying out with `react-native-safe-area-
 *   context` (or wrap in `ImmersiveScreen` with `edges`). The gain on iPhone is
 *   a clean top edge, not extra layout space.
 * - **Android navigation bar:** NOT hidden yet. That needs `expo-navigation-bar`
 *   (a native module → a new app build, not an OTA). When it lands, hide it in
 *   `applyBars` below; the reference count, restore paths and the `hideNavigationBar`
 *   option already exist for it. On edge-to-edge Android (SDK 54 default) hidden
 *   bars slide back over the app on an edge swipe, and may re-show after the app
 *   resumes — hence `reapply` on foreground.
 *
 * Several holders at once are reference-counted (`src/lib/immersive.ts`), so a
 * nested screen closing never brings the bars back under another one.
 */
import { setStatusBarHidden } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { createImmersiveCounter } from '@/lib/immersive';

export type ImmersiveOptions = {
  /** Android: also hide the bottom navigation bar. Reserved — a no-op until
   * `expo-navigation-bar` is added in a native build. */
  hideNavigationBar?: boolean;
};

function applyBars(hidden: boolean): void {
  setStatusBarHidden(hidden, 'fade');
}

const counter = createImmersiveCounter(applyBars);

let appStateHooked = false;
function hookAppState(): void {
  if (appStateHooked) return;
  appStateHooked = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && counter.count() > 0) counter.reapply();
  });
}

export function useImmersiveMode(enabled: boolean, _options: ImmersiveOptions = {}): void {
  useEffect(() => {
    if (!enabled) return;
    hookAppState();
    const release = counter.acquire();
    return release;
  }, [enabled]);
}
