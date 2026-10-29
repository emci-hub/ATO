import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SeasonTheme } from '@/components/almanac/season-theme';
import { GlowPulse } from '@/components/glow-pulse';
import { Appear } from '@/components/motion';
import { QuestSkyBars } from '@/components/quest-growth-bars';
import { ThemedText } from '@/components/themed-text';
import { TraitConstellation } from '@/components/trait-constellation';
import { Spacing } from '@/constants/theme';
import type { AlmanacDay } from '@/hooks/use-almanac-day';
import { axisDiff, brightenedLine, type AxisValues } from '@/lib/home-path';
import { loadLastSeen, saveLastSeen } from '@/lib/home-path-store';
import { constellationModel } from '@/lib/trait-constellation';
import type { TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES } from '@/lib/traits';

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
export function HomeHero({
  userId,
  tracks,
  day = null,
}: {
  userId: string;
  tracks: readonly TraitTrack[];
  /** Today's Almanac day (PHASE-11h): tints the constellation and adds the decor. */
  day?: AlmanacDay | null;
}) {
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
  // Decorate only a real sky, and only with THIS account's day (no tracks = the small
  // "light your first stars" card, which keeps its own size).
  const sky = useMemo(() => {
    const stars = constellationModel(tracks, HOME_HERO_SIZE).stars;
    return { lit: stars.length, gold: stars.filter((s) => s.gold).length };
  }, [tracks]);
  const decorate = tracks.length > 0 && day?.ctx.userId === userId;

  return (
    <Appear breathe>
      <View style={styles.wrap}>
        <GlowPulse style={styles.glow}>
          <SeasonTheme day={decorate ? day : null} size={HOME_HERO_SIZE}>
            {(accent) => (
              <TraitConstellation tracks={tracks} size={HOME_HERO_SIZE} variant="hero" changedAxes={changed} accent={accent} />
            )}
          </SeasonTheme>
        </GlowPulse>
        {sky.lit > 0 ? <QuestSkyBars lit={sky.lit} gold={sky.gold} total={TRAIT_AXES.length} /> : null}
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
  glow: { borderRadius: HOME_HERO_SIZE / 2 },
  line: { textAlign: 'center' },
});
