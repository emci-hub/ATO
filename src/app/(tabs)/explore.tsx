import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { CategoriesFold } from '@/components/categories-fold';
import { FullProfileFold } from '@/components/full-profile-fold';
import { IntakeSettings } from '@/components/intake-settings';
import { ProfileFillFold } from '@/components/profile-fill-fold';
import { SageInsightSpend } from '@/components/sage-insight-spend';
import { SageStoryFold } from '@/components/sage-story-fold';
import { SageTitleCard } from '@/components/sage-title-card';
import { SettingsFold } from '@/components/settings-fold';
import { TraitBandsFold } from '@/components/trait-bands-fold';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { checksToHistory, fetchChecks, type Check } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { recordOwnDevTrace } from '@/lib/dev-trace-server';
import {
  EXPLORE_EMPTY_CONSENT,
  EXPLORE_EMPTY_CRISIS,
  EXPLORE_EMPTY_DENIED,
  EXPLORE_EMPTY_QUOTA,
  EXPLORE_EMPTY_TRY,
  EXPLORE_LAND_NO,
  EXPLORE_LAND_Q,
  EXPLORE_LAND_YES,
  EXPLORE_NOTED,
  EXPLORE_REACTION_ERROR,
} from '@/lib/explore/copy';
import { generateExploreBody } from '@/lib/explore/generate';
import { EXPLORE_OBSERVATIONS_META } from '@/lib/ai/call-sites';
import { routeExplore } from '@/lib/explore/route';
import { withTimeout } from '@/lib/timeout';
import {
  fetchExploreMissNotes,
  fetchLatestExplorePack,
  recordExploreReaction,
  saveExplorePack,
} from '@/lib/explore/store';
import type { ExploreEntryRow, RouteExploreResult } from '@/lib/explore/types';
import { chipLabel, CURRENT_FOCUS_CHIPS, voiceMeFrom } from '@/lib/intake';
import { useMeContext } from '@/lib/me-context';
import { type Me } from '@/lib/me';
import { parseSageTitle, pinnedCategoryLines } from '@/lib/sage-title';
import {
  PROFILE_LOCKED_COPY,
  PROFILE_LOCKED_CTA,
  missingAxis,
  settledAxisLabel,
  settledCount,
  type TraitTrack,
} from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { traitStateFromRow } from '@/lib/traits';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { useAppearance } from '@/lib/theme/context';
import { shouldUseLocalAi } from '@/lib/ai/override';
import { claimAiCall, logJargonGuard, logPhraseGuard } from '@/lib/voice/quota-server';
import type { CheckHistory } from '@/lib/voice/types';

/**
 * Explore — a real tab holding Categories (full detail), The Story, Notes
 * insight spend, and the periodic observations. Sage stays clean chat.
 */
export default function ExploreScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe } = useMeContext();
  const [exploreChecks, setExploreChecks] = useState<Check[]>([]);
  const [crisisToday, setCrisisToday] = useState(false);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchChecks(userId)
      .then((rows) => {
        if (!cancelled) setExploreChecks(rows);
      })
      .catch((err) => {
        console.log('[explore] fetchChecks error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchTraitTracks(userId)
      .then((rows) => {
        if (!cancelled) setTracks(rows);
        if (!cancelled) setTracksReady(true);
      })
      .catch((err) => {
        console.log('[explore] tracks error:', err);
        if (!cancelled) setTracksReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me]);

  useEffect(() => {
    if (!userId || !me) return;
    let cancelled = false;
    crisisFlagsForWindow(userId, me.timezone)
      .then((flags) => {
        if (!cancelled) setCrisisToday(flags.crisisToday);
      })
      .catch((err) => {
        console.log('[explore] crisis flags error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me?.timezone]);

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
              <SettingsFold title="Today's Read">
                <SageTitleCard me={me} tracks={tracks} tracksReady={tracksReady} />
              </SettingsFold>
              <IntakeSettings me={me} onUpdated={() => refreshMe()} />
              <TraitBandsFold me={me} tracks={tracks} />
              <ProfileFillFold tracks={tracks} />
              <FullProfileFold me={me} onUpdated={() => refreshMe()} />
              <CategoriesFold me={me} onUpdated={() => refreshMe()} />
              <SageStoryFold
                me={me}
                tracks={tracks}
                tracksReady={tracksReady}
                crisisToday={crisisToday}
              />
              <SageInsightSpend
                me={me}
                settled={settledCount(tracks)}
                tracks={tracks}
                onUpdated={() => refreshMe()}
              />
              <SageExploreObservations
                me={me}
                history={checksToHistory(exploreChecks)}
                crisisToday={crisisToday}
                tracks={tracks}
              />
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

function emptyExploreCopy(kind: RouteExploreResult['kind']): string | null {
  switch (kind) {
    case 'consent-pending':
      return EXPLORE_EMPTY_CONSENT;
    case 'consent-denied':
      return EXPLORE_EMPTY_DENIED;
    case 'crisis':
      return EXPLORE_EMPTY_CRISIS;
    case 'locked':
      return PROFILE_LOCKED_COPY;
    case 'quota':
      return EXPLORE_EMPTY_QUOTA;
    case 'empty':
      return EXPLORE_EMPTY_TRY;
    default:
      return null;
  }
}

function NotedAck({
  bump,
  reduceMotion,
  onFill,
}: {
  bump: number;
  reduceMotion: boolean;
  onFill: boolean;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 1;
    if (reduceMotion) {
      const hide = setTimeout(() => {
        opacity.value = 0;
      }, 900);
      return () => clearTimeout(hide);
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 700 }),
    );
  }, [bump, reduceMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.noted, fade]}>
      <ThemedText
        type="small"
        themeColor={onFill ? undefined : 'textSecondary'}
        style={onFill ? { color: theme.onAccent } : undefined}>
        {EXPLORE_NOTED}
      </ThemedText>
    </Animated.View>
  );
}

function SageExploreObservations({
  me,
  history,
  crisisToday,
  tracks,
}: {
  me: Me;
  history: CheckHistory[];
  crisisToday: boolean;
  tracks: readonly TraitTrack[];
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [result, setResult] = useState<RouteExploreResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noted, setNoted] = useState<{
    entryId: string;
    landed: boolean;
    bump: number;
  } | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // No timeout here previously: a stalled AI call left "Loading…" forever.
    const next = await withTimeout(routeExplore(
      {
        me: {
          ...voiceMeFrom(me),
          timezone: me.timezone,
          traitTouchedAt: me.trait_touched_at,
        },
        history,
        aiConsent: me.ai_consent,
        crisisToday,
        tracks,
        pinnedLines: pinnedCategoryLines(parseSageTitle(me.sage_title)),
      },
      {
        loadLatestPack: fetchLatestExplorePack,
        savePack: saveExplorePack,
        loadMissNotes: fetchExploreMissNotes,
        claimAiCall: () => claimAiCall('explore'),
        logJargonHit: logJargonGuard,
        logPhraseHit: logPhraseGuard,
        generateBody: (prompt) => generateExploreBody(prompt, EXPLORE_OBSERVATIONS_META),
        useLocal: await shouldUseLocalAi(),
        recordTrace: recordOwnDevTrace,
      },
    ), 25_000, 'explore');
    setResult(next);
  }, [me, history, crisisToday, tracks]);

  useEffect(() => {
    let cancelled = false;
    void load().catch((err) => {
      console.log('[explore] route error:', err);
      if (!cancelled) setResult({ kind: 'empty', pack: null });
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function react(entry: ExploreEntryRow, landed: boolean) {
    if (busyId || entry.id.startsWith('local-')) return;
    setBusyId(entry.id);
    setReactionError(null);
    try {
      await recordExploreReaction(entry.id, landed);
      setNoted({ entryId: entry.id, landed, bump: Date.now() });
      setResult((current) => {
        if (!current?.pack) return current;
        return {
          ...current,
          pack: {
            ...current.pack,
            entries: current.pack.entries.map((row) =>
              row.id === entry.id ? { ...row, landed } : row,
            ),
          },
        };
      });
    } catch (err) {
      console.log('[explore] reaction error:', err);
      setNoted(null);
      setReactionError(entry.id);
    } finally {
      setBusyId(null);
    }
  }

  const message = result ? emptyExploreCopy(result.kind) : null;
  const entries = result?.pack?.entries ?? [];
  const locked = result?.kind === 'locked';
  if (!message && entries.length === 0) return null;

  return (
    <SettingsFold title="Observations">
      <View style={styles.exploreBlock}>
        {message ? (
          <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.bubbleText}>{message}</ThemedText>
          </View>
        ) : null}
        {locked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${PROFILE_LOCKED_COPY}. ${PROFILE_LOCKED_CTA}.`}
            onPress={() => {
              const axis = missingAxis(traitStateFromRow(me).values, tracks);
              router.push(
                axis
                  ? { pathname: '/intake-sweep', params: { axis } }
                  : { pathname: '/intake-sweep' },
              );
            }}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {PROFILE_LOCKED_CTA}
            </ThemedText>
          </Pressable>
        ) : null}
        {entries.map((entry) => (
          <View key={entry.id} style={styles.exploreEntry}>
            <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.bubbleText}>{entry.body}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {EXPLORE_LAND_Q}
            </ThemedText>
            <View style={styles.exploreActions}>
              <View style={styles.actionSlot}>
                <ThemedPressable
                  filled={entry.landed === true}
                  onPress={() => void react(entry, true)}
                  disabled={busyId !== null}
                  style={[styles.exploreYes, busyId !== null && styles.disabled]}>
                  <ThemedText
                    type="smallBold"
                    style={entry.landed === true ? { color: theme.onAccent } : undefined}
                    themeColor={entry.landed === true ? undefined : 'textSecondary'}>
                    {EXPLORE_LAND_YES}
                  </ThemedText>
                </ThemedPressable>
                {noted?.entryId === entry.id && noted.landed === true ? (
                  <NotedAck
                    bump={noted.bump}
                    reduceMotion={reduceMotion}
                    onFill={entry.landed === true}
                  />
                ) : null}
              </View>
              <View style={styles.actionSlot}>
                <ThemedPressable
                  onPress={() => void react(entry, false)}
                  disabled={busyId !== null}
                  style={[
                    styles.exploreNo,
                    { borderColor: controlBorderColor(theme) },
                    entry.landed === false && styles.missed,
                    busyId !== null && styles.disabled,
                  ]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {EXPLORE_LAND_NO}
                  </ThemedText>
                </ThemedPressable>
                {noted?.entryId === entry.id && noted.landed === false ? (
                  <NotedAck bump={noted.bump} reduceMotion={reduceMotion} onFill={false} />
                ) : null}
              </View>
            </View>
            {reactionError === entry.id ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                accessibilityLiveRegion="polite">
                {EXPLORE_REACTION_ERROR}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </SettingsFold>
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
  exploreBlock: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  exploreEntry: {
    gap: Spacing.two,
  },
  exploreActions: {
    gap: Spacing.two,
    maxWidth: '85%',
  },
  exploreYes: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  exploreNo: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  actionSlot: {
    position: 'relative',
  },
  noted: {
    position: 'absolute',
    right: Spacing.three,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  missed: {
    opacity: 0.85,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bubbleText: {
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});
