import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoriesFold } from '@/components/categories-fold';
import { FullProfileFold } from '@/components/full-profile-fold';
import { ProfileFillFold } from '@/components/profile-fill-fold';
import { TraitBandsFold } from '@/components/trait-bands-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { useMeContext } from '@/lib/me-context';
import { settledAxisLabel, type TraitTrack } from '@/lib/trait-stability';
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
  const dataEpoch = useAccountDataEpoch();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTraitTracks(userId)
      .then((rows) => {
        if (cancelled) return;
        setTracks(rows);
        setTracksReady(true);
      })
      .catch((err) => {
        console.log('[explore] tracks error:', err);
        if (!cancelled) setTracksReady(true);
      });
    return () => {
      cancelled = true;
    };
    // dataEpoch: a dev jump or Start over rewrote the account under this tab.
  }, [userId, me, dataEpoch]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="subtitle">Explore</ThemedText>
            {me ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${settledAxisLabel(tracks)}. Tap to answer more.`}
                onPress={() => {
                  // Questions ignores an ?axis= (the per-axis feed was removed), so
                  // the link no longer pretends to target one.
                  router.push('/intake-sweep');
                }}>
                <ThemedText type="small" themeColor="textSecondary">
                  {settledAxisLabel(tracks)}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>

          {me ? (
            <>
              {/* Categories first and always open: the full fixed list is the
                  point of this tab (release pass, emci 2026-09-16). */}
              <CategoriesFold
                me={me}
                onUpdated={() => refreshMe()}
                unlocked={isFullProfileDone(tracks, tracksReady)}
              />
              <TraitBandsFold me={me} tracks={tracks} />
              <ProfileFillFold tracks={tracks} />
              <FullProfileFold me={me} onUpdated={() => refreshMe()} />
              {/* The five "being rebuilt" placeholders that sat here (Today's Read, How
                  you show up, Past reads, Insight spend, Observations) were removed
                  2026-10-01: a live screen shows only what works. */}
              <ThemedText type="small" themeColor="textSecondary" style={styles.moreSoon}>
                More is coming to this screen.
              </ThemedText>
            </>
          ) : (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText themeColor="textSecondary">Loading…</ThemedText>
            </ThemedView>
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
  moreSoon: { textAlign: 'center', paddingVertical: Spacing.two },
  emptyCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
