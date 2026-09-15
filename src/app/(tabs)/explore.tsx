import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoriesFold } from '@/components/categories-fold';
import { FullProfileFold } from '@/components/full-profile-fold';
import { ProfileFillFold } from '@/components/profile-fill-fold';
import { RebuiltNotice } from '@/components/rebuilt-notice';
import { TraitBandsFold } from '@/components/trait-bands-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { chipLabel, CURRENT_FOCUS_CHIPS } from '@/lib/intake';
import { useMeContext } from '@/lib/me-context';
import {
  missingAxis,
  settledAxisLabel,
  type TraitTrack,
} from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { traitStateFromRow } from '@/lib/traits';
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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTraitTracks(userId)
      .then((rows) => {
        if (!cancelled) setTracks(rows);
      })
      .catch((err) => {
        console.log('[explore] tracks error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me]);

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
                  const axis = missingAxis(traitStateFromRow(me).values, tracks);
                  router.push(
                    axis
                      ? { pathname: '/intake-sweep', params: { axis } }
                      : { pathname: '/intake-sweep' },
                  );
                }}>
                <ThemedText type="small" themeColor="textSecondary">
                  {settledAxisLabel(tracks)}
                </ThemedText>
              </Pressable>
            ) : null}
            {me?.current_focus ? (
              <ThemedText type="small" themeColor="textSecondary">
                Right now: {chipLabel(CURRENT_FOCUS_CHIPS, me.current_focus).toLowerCase()}
              </ThemedText>
            ) : null}
          </View>

          {me ? (
            <>
              <RebuiltNotice title="Today's Read" />
              <RebuiltNotice title="How you show up" />
              <TraitBandsFold me={me} tracks={tracks} />
              <ProfileFillFold tracks={tracks} />
              <FullProfileFold me={me} onUpdated={() => refreshMe()} />
              <CategoriesFold me={me} onUpdated={() => refreshMe()} />
              <RebuiltNotice title="Past reads" />
              <RebuiltNotice title="Insight spend" />
              <RebuiltNotice title="Observations" />
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
  emptyCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
});
