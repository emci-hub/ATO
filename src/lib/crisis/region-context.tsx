import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCalendars, useLocales } from 'expo-localization';

import {
  detectCrisisRegion,
  resolveCrisisRegion,
  type CrisisRegion,
} from '@/lib/crisis/region';
import {
  loadCrisisRegionOverride,
  saveCrisisRegionAuto,
  saveCrisisRegionOverride,
} from '@/lib/crisis/region-storage';

type CrisisRegionContextValue = {
  /** Effective region for the resource card. */
  region: CrisisRegion;
  /** Last auto-detected region (locale/timezone), stored at launch. */
  autoRegion: CrisisRegion;
  /** Manual Settings override, or null when Auto is selected. */
  override: CrisisRegion | null;
  setOverride: (region: CrisisRegion | null) => Promise<void>;
};

const CrisisRegionContext = createContext<CrisisRegionContextValue | null>(null);

export function CrisisRegionProvider({ children }: { children: ReactNode }) {
  const locales = useLocales();
  const calendars = useCalendars();

  const autoRegion = useMemo(() => {
    const locale = locales[0];
    const calendar = calendars[0];
    return detectCrisisRegion({
      regionCode: locale?.regionCode ?? null,
      languageRegionCode: locale?.languageRegionCode ?? null,
      timeZone: calendar?.timeZone ?? null,
    });
  }, [locales, calendars]);

  const [override, setOverrideState] = useState<CrisisRegion | null>(null);

  useEffect(() => {
    saveCrisisRegionAuto(autoRegion).catch(() => {});
  }, [autoRegion]);

  useEffect(() => {
    let cancelled = false;
    loadCrisisRegionOverride()
      .then((stored) => {
        if (!cancelled) setOverrideState(stored);
      })
      .catch(() => {
        if (!cancelled) setOverrideState(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setOverride = useCallback(async (next: CrisisRegion | null) => {
    setOverrideState(next);
    await saveCrisisRegionOverride(next);
  }, []);

  const value = useMemo(
    () => ({
      region: resolveCrisisRegion(autoRegion, override),
      autoRegion,
      override,
      setOverride,
    }),
    [autoRegion, override, setOverride],
  );

  return (
    <CrisisRegionContext.Provider value={value}>{children}</CrisisRegionContext.Provider>
  );
}

export function useCrisisRegion(): CrisisRegionContextValue {
  const ctx = useContext(CrisisRegionContext);
  if (!ctx) {
    return {
      region: 'other',
      autoRegion: 'other',
      override: null,
      setOverride: async () => {},
    };
  }
  return ctx;
}
