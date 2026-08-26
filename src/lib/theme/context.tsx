import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AccessibilityInfo } from 'react-native';

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
  setAppearance: (id: AppearanceId) => Promise<void>;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<AppearanceId>(DEFAULT_APPEARANCE);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadAppearanceId().then((stored) => {
      if (!cancelled) setId(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setAppearance,
    }),
    [id, reduceMotion, setAppearance],
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
      setAppearance: async () => {},
    };
  }
  return ctx;
}
