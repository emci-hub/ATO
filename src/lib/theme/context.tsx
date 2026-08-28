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

type AppearanceContextValue = {
  id: AppearanceId;
  tokens: AppearanceTokens;
  reduceMotion: boolean;
  /** False until the on-device mode is read. Tabs must not mount as Soft first. */
  ready: boolean;
  setAppearance: (id: AppearanceId) => Promise<void>;
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

  useEffect(() => {
    let cancelled = false;
    loadAppearanceId().then((stored) => {
      if (cancelled) return;
      setId(stored);
      applyNativeChrome(stored);
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

  const setAppearance = useCallback(async (next: AppearanceId) => {
    setId(next);
    await saveAppearanceId(next);
  }, []);

  const value = useMemo(
    () => ({
      id,
      tokens: APPEARANCES[id],
      reduceMotion,
      ready,
      setAppearance,
    }),
    [id, reduceMotion, ready, setAppearance],
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
      setAppearance: async () => {},
    };
  }
  return ctx;
}
