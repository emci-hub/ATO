import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoriesFold } from '@/components/categories-fold';
import { CategoryDeepDiveCard } from '@/components/category-deep-dive-card';
import { FullProfileFold } from '@/components/full-profile-fold';
import { SkeletonCard } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { useMeContext } from '@/lib/me-context';
import { aiConsentFor } from '@/lib/me';
import { atoTokenBalanceOf } from '@/lib/ato-tokens';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * Explore — a real tab holding Categories (full detail) and the full trait
 * profile. Today's Read, intake settings, roll history, insight spend, and
 * the periodic observations are parked pending rebuild
 * (docs/ISOLATION_PLAN.md Card 5, 2026-09-15).
 */
export default function ExploreScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe } = useMeContext();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);
  const [, setTracksOwner] = useState<string | null>(null);
  const dataEpoch = useAccountDataEpoch();

  /**
   * Refetch on FOCUS, the same fix Home has (`(tabs)/index.tsx` reloadHome).
   * Tab screens stay mounted, so answering on Questions never remounted
   * Explore: the counts here stayed old ("12 of 16 filled" while Questions said
   * done). Only the newest request may write (`requestIdRef`), and a failed
   * refetch keeps the tracks already on screen. One read, no model call.
   */
  const requestIdRef = useRef(0);
  const reloadTracks = useCallback(async () => {
    if (!userId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const rows = await fetchTraitTracks(userId);
      if (requestId !== requestIdRef.current) return;
      setTracks(rows);
      setTracksOwner(userId);
    } catch (err) {
      console.log('[explore] tracks error:', err);
    } finally {
      if (requestId === requestIdRef.current) setTracksReady(true);
    }
    // me / dataEpoch: a save, a dev jump or Start over rewrote the account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, me, dataEpoch]);

  useEffect(() => {
    // A new account starts from nothing.
    requestIdRef.current += 1;
    setTracks([]);
    setTracksOwner(null);
    setTracksReady(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void reloadTracks();
    }, [reloadTracks]),
  );

  // 🎯 Try this today, ⚡/🪫 and 🗣️ moved to Insights (emci 2026-10-14).

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle">Explore</ThemedText>
          </View>

          {me ? (
            <>
              {/* "Your shape" and "Your traits" moved to You (IA phase P4). */}
              {/* Categories stay open as tiles: the full fixed list is the point
                  of this tab (release pass, emci 2026-09-16). */}
              <CategoriesFold
                me={me}
                tracks={tracksReady ? tracks : undefined}
                onUpdated={() => refreshMe()}
                unlocked={isFullProfileDone(tracks, tracksReady)}
              />
              {/* Category deep dive (moved from Home, emci 2026-10-09): one AI card
                  a day, only on its button. After Questions are finished. */}
              {isFullProfileDone(tracks, tracksReady) ? (
                <CategoryDeepDiveCard
                  userId={me.id}
                  tracks={tracks}
                  consentGranted={aiConsentFor(me) === 'granted'}
                  tokens={atoTokenBalanceOf(me)}
                  onSpent={() => void refreshMe()}
                />
              ) : null}
              <FullProfileFold me={me} onUpdated={() => refreshMe()} />
              {/* The five "being rebuilt" placeholders (2026-10-01) and the
                  "more is coming" line (2026-10-05) are gone: a live screen
                  shows only what works. */}
            </>
          ) : (
            <>
              <SkeletonCard lines={4} />
              <SkeletonCard />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
  },
  header: {
    gap: Spacing.half,
  },
});
