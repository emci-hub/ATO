import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { TraitConstellation } from '@/components/trait-constellation';
import { Spacing } from '@/constants/theme';
import { axisDiff, brightenedLine, type AxisValues } from '@/lib/home-path';
import { loadLastSeen, saveLastSeen } from '@/lib/home-path-store';
import type { TraitTrack } from '@/lib/trait-stability';

/** The hero's size. A full 16-star sky is 35 animated nodes (of the 60 cap). */
export const HOME_HERO_SIZE = 260;

/**
 * Home's hero (PHASE-08): the constellation, and "★ X brightened" when a trait
 * moved since the last visit. "Last visit" = the values saved when Home last
 * lost focus (a first visit saves at once and shows nothing). Render it only
 * once THIS account's tracks have loaded, as You does. No tracks = the
 * constellation's own "light your first stars" card. Reads and writes only
 * the phone's storage; no model call.
 */
export function HomeHero({ userId, tracks }: { userId: string; tracks: readonly TraitTrack[] }) {
  // undefined = still loading, null = no previous visit.
  const [baseline, setBaseline] = useState<AxisValues | null | undefined>(undefined);
  const latest = useRef(tracks);
  useEffect(() => {
    latest.current = tracks;
  }, [tracks]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void loadLastSeen(userId).then((values) => {
        if (!live) return;
        setBaseline(values);
        if (!values && latest.current.length > 0) void saveLastSeen(userId, latest.current);
      });
      return () => {
        live = false;
        if (latest.current.length > 0) void saveLastSeen(userId, latest.current);
      };
    }, [userId]),
  );

  const changed = useMemo(() => (baseline ? axisDiff(baseline, tracks) : []), [baseline, tracks]);
  const line = brightenedLine(changed);

  return (
    <Appear breathe>
      <View style={styles.wrap}>
        <TraitConstellation tracks={tracks} size={HOME_HERO_SIZE} variant="hero" changedAxes={changed} />
        {line ? (
          <ThemedText type="smallBold" accessibilityLiveRegion="polite" style={styles.line}>
            {line}
          </ThemedText>
        ) : null}
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two },
  line: { textAlign: 'center' },
});
