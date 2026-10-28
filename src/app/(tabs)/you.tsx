import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthShift } from '@/components/almanac/month-shift';
import { SeasonalBadges } from '@/components/almanac/seasonal-badges';
import { WeekRecap } from '@/components/almanac/week-recap';
import { YearRecap } from '@/components/almanac/year-recap';
import { AtoTokenCard } from '@/components/ato-token-card';
import { CategoriesFold } from '@/components/categories-fold';
import { CategoryDeepDiveCard } from '@/components/category-deep-dive-card';
import { ChangeCard } from '@/components/change-card';
import { FullProfileFold } from '@/components/full-profile-fold';
import { IdentityCard } from '@/components/identity-card';
import { Appear, SkeletonCard } from '@/components/motion';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ProfileCharacter } from '@/components/profile-character';
import { ProfileFillFold } from '@/components/profile-fill-fold';
import { ShapeCard } from '@/components/shape-card';
import { TraitBandsFold } from '@/components/trait-bands-fold';
import { TraitConstellation } from '@/components/trait-constellation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { YourWeekCard } from '@/components/your-week-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { almanacYmd } from '@/lib/almanac';
import { useAlmanacDay } from '@/hooks/use-almanac-day';
import { useCircleContext } from '@/lib/circle-context';
import { loadDailyLineState } from '@/lib/daily-line/state';
import { atoTokenBalanceOf } from '@/lib/ato-tokens';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import { fetchHomeBootstrap } from '@/lib/home-bootstrap';
import { aiConsentFor } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { isTabUnlocked } from '@/lib/nav/nav-order';
import { SETTINGS_TITLE } from '@/lib/polish-copy';
import { parseSection, type SectionKey } from '@/lib/you-sections';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { settledAxisLabel, type TraitTrack } from '@/lib/trait-stability';

/** Side of the square constellation header at the top of You. */
const CONSTELLATION_SIZE = 220;

/**
 * You — who you are, your tokens, and your week. Every settings control (look,
 * city, birthday, notifications, AI consent, help, legal, sign out, delete
 * account, build info, developer rows) moved to the pushed `/settings` screen
 * (IA phase P1, docs/ato-ia-runner.md); this screen keeps one "Settings ›" row.
 *
 * "This is you so far" (`ProfileCharacter`) lives only here (IA phase P2): at
 * the top, whenever trait tracks exist — also after the profile is done. It
 * reads the same one-RPC `home_bootstrap` fetch Home uses, with the same guards.
 * A failed or empty load renders nothing.
 *
 * "Your shape" and "Your traits" (shape card, trait bands, profile fill, what moved
 * lately) moved here from Explore (IA phase P4), reusing those same tracks. A
 * `?section=shape|traits` link scrolls to them.
 *
 * Explore is gone (IA phase P5): "Your categories" (the tiles + the deep dive card)
 * and "Full profile" live here too, with `Legends ›` / `Circle ›` rows. The
 * `section` param also accepts `categories`, `profile` and `tokens`; `/explore`
 * redirects to `/you?section=categories`.
 *
 * The saved-facts list ("Teach Sage") has been hidden since 2026-10-14; the
 * data stays until docs/sage-cleanup.md drops it.
 */
export default function YouScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh } = useMeContext();
  const { hasCircle } = useCircleContext();
  const params = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  // Whose `tracks` these are. Tabs stay mounted, so for one render after an
  // account switch `tracks` still belongs to the previous account.
  const [tracksUserId, setTracksUserId] = useState<string | null>(null);
  // True once the first fetch for this account settled (success or failure), so
  // the shape card shows a skeleton instead of flashing blank.
  const [tracksReady, setTracksReady] = useState(false);

  const timeZone = me?.timezone || 'UTC';
  /**
   * Same guards as Home. `loadedOnceRef` — a failed refetch must not wipe tracks
   * already shown. `requestIdRef` — two quick focuses can resolve out of order, so
   * only the newest request may write.
   */
  const loadedOnceRef = useRef(false);
  const requestIdRef = useRef(0);
  const reloadTracks = useCallback(async () => {
    if (!userId || !me) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const next = await fetchHomeBootstrap(timeZone);
      if (requestId !== requestIdRef.current) return;
      loadedOnceRef.current = true;
      setTracks(next.tracks);
      setTracksUserId(userId);
    } catch (err) {
      // Nothing to show on a failed load; keep whatever was already loaded.
      console.log('[you] bootstrap error:', err);
    } finally {
      if (requestId === requestIdRef.current) setTracksReady(true);
    }
  }, [userId, me, timeZone]);

  useEffect(() => {
    // A new account starts from nothing: the old account's tracks and any
    // in-flight request must not carry over.
    loadedOnceRef.current = false;
    requestIdRef.current += 1;
    setTracks([]);
    setTracksUserId(null);
    setTracksReady(false);
  }, [userId]);

  // `?section=` (see lib/you-sections) scrolls to that block once the tracks have
  // landed (the blocks lay out after the skeleton is replaced). Unknown: ignored.
  const wantedSection = parseSection(params.section);
  const scrollToSection = useCallback(() => {
    if (!wantedSection || !tracksReady) return;
    const y = sectionY.current[wantedSection];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.three), animated: true });
  }, [wantedSection, tracksReady]);
  useEffect(() => {
    scrollToSection();
  }, [scrollToSection]);
  const markSection = (key: SectionKey) => (event: { nativeEvent: { layout: { y: number } } }) => {
    sectionY.current[key] = event.nativeEvent.layout.y;
    scrollToSection();
  };
  const tracksOwned = !!userId && tracksUserId === userId;

  // The Almanac's day (PHASE-11e): the Sunday recap, the monthly shift, the year recap.
  const [lineDays, setLineDays] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let live = true;
      void loadDailyLineState(userId)
        .then((state) => live && setLineDays(state.days.length))
        .catch(() => undefined);
      return () => {
        live = false;
      };
    }, [userId]),
  );
  const almanacDay = useAlmanacDay({
    userId,
    me,
    ymd: me ? almanacYmd(new Date(), timeZone) : undefined,
    tracks: tracksOwned ? tracks : [],
    dataDays: lineDays,
  });

  // Refetch on FOCUS: tabs stay mounted, so answering questions elsewhere would
  // otherwise leave this card stale until the app restarted.
  useFocusEffect(
    useCallback(() => {
      void reloadTracks();
    }, [reloadTracks]),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">You</ThemedText>
          </View>

          {/* Constellation header (PHASE-05): the same tracks as a field of stars. Its own
              empty state ("light your first stars") shows when there are none; a skeleton
              until the first load lands. */}
          {me ? (
            tracksReady && tracksOwned ? (
              <Appear breathe>
                <View style={styles.constellation}>
                  <TraitConstellation tracks={tracks} size={CONSTELLATION_SIZE} variant="header" />
                </View>
              </Appear>
            ) : (
              <View style={styles.constellationLoading}>
                <SkeletonCard lines={2} />
              </View>
            )
          ) : null}

          {/* "This is you so far": shown whenever tracks exist, also after the profile is done. */}
          {tracksOwned && tracks.length > 0 ? <ProfileCharacter tracks={tracks} /> : null}

          {/* Who you are in two or three words, and the image to send a friend. */}
          {me ? <IdentityCard me={me} onUpdated={refresh} /> : null}

          {/* "Your shape": the profile as one figure, tap a point for the trait. A
              skeleton until the tracks land, so a finished profile never flashes blank. */}
          {me ? (
            <View onLayout={markSection('shape')}>
              {tracksReady && tracksOwned ? (
                <Appear>
                  <ShapeCard
                    me={me}
                    tracks={tracks}
                    settledLabel={settledAxisLabel(tracks)}
                    onPressSettled={() => {
                      // Questions ignores an ?axis= (the per-axis feed was removed).
                      router.push('/intake-sweep');
                    }}
                  />
                </Appear>
              ) : (
                <SkeletonCard lines={4} />
              )}
            </View>
          ) : null}

          {/* "Your traits": the bands, what is still to fill, and what moved lately. No model call. */}
          {me ? (
            <View style={styles.traitsBlock} onLayout={markSection('traits')}>
              <TraitBandsFold me={me} tracks={tracks} />
              <ProfileFillFold tracks={tracks} />
              <ChangeCard userId={me.id} />
            </View>
          ) : null}

          {/* "Your categories": the fixed tiles (the point of the old Explore tab) and, once the
              profile is done, the one-a-day deep dive card. Same props and gates as before. */}
          {me ? (
            <View style={styles.traitsBlock} onLayout={markSection('categories')}>
              <CategoriesFold
                me={me}
                tracks={tracksReady ? tracks : undefined}
                onUpdated={() => refresh()}
                unlocked={isFullProfileDone(tracks, tracksReady)}
              />
              {isFullProfileDone(tracks, tracksReady) ? (
                <CategoryDeepDiveCard
                  userId={me.id}
                  tracks={tracks}
                  consentGranted={aiConsentFor(me) === 'granted'}
                  tokens={atoTokenBalanceOf(me)}
                  onSpent={() => void refresh()}
                />
              ) : null}
            </View>
          ) : null}

          {/* "Full profile": every trait band in full. */}
          {me ? (
            <View onLayout={markSection('profile')}>
              <FullProfileFold me={me} onUpdated={() => refresh()} />
            </View>
          ) : null}

          {/* Tokens: the balance and the last few earns / spends. */}
          {me ? (
            <View onLayout={markSection('tokens')}>
              <AtoTokenCard me={me} />
            </View>
          ) : null}

          {/* Almanac recaps: Sundays, monthly, and from December 1 the year. Each hides when it has nothing. */}
          {me && tracksOwned ? (
            <>
              <WeekRecap day={almanacDay} me={me} />
              <MonthShift day={almanacDay} me={me} />
              <YearRecap day={almanacDay} me={me} />
              <SeasonalBadges userId={me.id} />
            </>
          ) : null}

          {/* The last seven days in three counts. Local + one read, no AI. */}
          {me ? <YourWeekCard me={me} /> : null}

          <NavRow label="Legends" onPress={() => router.push('/legends')} />
          {isTabUnlocked('circle', { hasCircle }) ? (
            <NavRow label="Circle" onPress={() => router.push('/circle')} />
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SETTINGS_TITLE}
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.settingsCard}>
              <ThemedText type="smallBold">{SETTINGS_TITLE}</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** A one-line "Label ›" row to another screen (same look as the Settings row). */
function NavRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.settingsCard}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </ThemedView>
    </Pressable>
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  constellation: {
    alignItems: 'center',
  },
  // Loading keeps the final size, so nothing below jumps when the stars land.
  constellationLoading: {
    height: CONSTELLATION_SIZE,
    justifyContent: 'center',
  },
  traitsBlock: {
    gap: Spacing.three,
  },
  settingsRow: {
    minHeight: 44,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.four,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.8,
  },
});
