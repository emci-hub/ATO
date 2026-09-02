import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AccessibilityInfo, Appearance, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import {
  APPEARANCES,
  DEFAULT_APPEARANCE,
  type AppearanceId,
  type AppearanceTokens,
} from '@/constants/appearance';
import { loadAppearanceId, saveAppearanceId } from '@/lib/theme/storage';
import {
  isAppearanceUnlocked,
  resolveAllowedAppearance,
  useSubscription,
} from '@/lib/subscription';

type AppearanceContextValue = {
  id: AppearanceId;
  tokens: AppearanceTokens;
  reduceMotion: boolean;
  /** False until the on-device mode is read. Tabs must not mount as Soft first. */
  ready: boolean;
  /** True when the viewer may use subscriber-only modes. */
  subscriptionActive: boolean;
  /** Refuses a locked mode; returns false when the change was not applied. */
  setAppearance: (id: AppearanceId) => Promise<boolean>;
};

function applyNativeChrome(id: AppearanceId) {
  const tokens = APPEARANCES[id];
  if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
    Appearance.setColorScheme(tokens.scheme);
  }
  void SystemUI.setBackgroundColorAsync(tokens.background);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.style.backgroundColor = tokens.background;
    document.documentElement.style.colorScheme = tokens.scheme;
    document.body.style.backgroundColor = tokens.background;
  }
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<AppearanceId>(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { active: subscriptionActive } = useSubscription();

  useEffect(() => {
    let cancelled = false;
    loadAppearanceId().then((stored) => {
      if (cancelled) return;
      // A stored subscriber mode is not honoured without the entitlement — a
      // lapsed subscriber lands back on the default, not a locked screen.
      const allowed = resolveAllowedAppearance(stored, subscriptionActive);
      setId(allowed);
      applyNativeChrome(allowed);
      setReady(true);
    });
    return () => {
      cancelled = true;
      if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
        Appearance.setColorScheme(null);
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyNativeChrome(id);
  }, [id, ready]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const setAppearance = useCallback(
    async (next: AppearanceId) => {
      if (!isAppearanceUnlocked(next, subscriptionActive)) return false;
      setId(next);
      await saveAppearanceId(next);
      return true;
    },
    [subscriptionActive],
  );

  const value = useMemo(
    () => ({
      id,
      tokens: APPEARANCES[id],
      reduceMotion,
      ready,
      subscriptionActive,
      setAppearance,
    }),
    [id, reduceMotion, ready, subscriptionActive, setAppearance],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    return {
      id: DEFAULT_APPEARANCE,
      tokens: APPEARANCES[DEFAULT_APPEARANCE],
      reduceMotion: false,
      ready: true,
      subscriptionActive: false,
      setAppearance: async () => false,
    };
  }
  return ctx;
}
