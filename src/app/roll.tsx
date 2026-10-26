import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LEGENDS_BONUS_COPY,
  LEGENDS_ONE_TODAY_COPY,
  LEGENDS_TOMORROW_COPY,
  legendsPaidLine,
} from '@/app/(tabs)/legends';
import { HALL_COLOR, HALL_ICON, LegendShareSheet, LegendStoryCard, legendTitle } from '@/components/legend-figure-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { AI_TOKEN_PRICE, AI_TOKENS_NEEDED, atoTokenBalanceOf } from '@/lib/ato-tokens';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { FULL_PROFILE_LOCKED_COPY, fullProfileLockedLine, fullProfileProgress } from '@/lib/full-profile-gate';
import { fetchHomeBootstrap } from '@/lib/home-bootstrap';
import {
  fetchServerMuseum,
  loadDevLegendDate,
  loadLocalState,
  mergeMuseum,
  toldAngles,
  type LegendLocalState,
} from '@/lib/legend-figures/museum-store';
import { hasNewSettledLean, legendLocked, matchedOnLine, revealsLeft, settledFingerprint } from '@/lib/legend-figures/pick';
import { LEGEND_ROSTER, legendById, legendsInHall } from '@/lib/legend-figures/roster';
import { didYouKnowFact, nextChapterTeaser } from '@/lib/legend-figures/story';
import { HALL_LABEL, LEGEND_HALLS, type LegendHall } from '@/lib/legend-figures/types';
import { localYmd } from '@/lib/local-date';
import { useMeContext } from '@/lib/me-context';
import { legendsUnlocked } from '@/lib/questions/progressive-unlock';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';

export const YOUR_REVEALS_TITLE = 'Your reveals';
export const REVEALS_EMPTY_COPY = 'No legends met yet. Your first reveal is free, in Legends.';
export const REVEALS_LOCKED_COPY = 'Legends opens once your answers show a clear side or two.';

function chapterLabel(chapter: number): string {
  return chapter === 0 ? 'First meeting' : `Chapter ${chapter + 1}`;
}

/**
 * Your reveals (IA phase P6, docs/ato-ia-runner.md) — a pushed screen from
 * Legends. Display only: every legend met (their saved stories open for free),
 * today's reveal state read from the same sources Legends uses, and a row per
 * hall that opens it in Legends. Paid reveals happen ONLY in Legends: nothing on
 * this screen claims, spends, refunds or writes — it never saves the museum
 * state either, so it can never race a reveal being written on Legends.
 */
export default function YourRevealsScreen() {
  const theme = useTheme();
  const { me } = useMeContext();
  const dataEpoch = useAccountDataEpoch();
  const [tracks, setTracks] = useState<readonly TraitTrack[]>([]);
  const [local, setLocal] = useState<LegendLocalState | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const requestRef = useRef(0);

  const userId = me?.id ?? null;
  const timeZone = me?.timezone || 'UTC';

  // A wipe (reset, preview, sign-out) forgets what this screen holds.
  useEffect(() => {
    requestRef.current += 1;
    setLocal(null);
    setOpenId(null);
  }, [dataEpoch]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    try {
      const [boot, localState, server, devDate] = await Promise.all([
        fetchHomeBootstrap(timeZone),
        loadLocalState(userId),
        fetchServerMuseum(),
        PRE_LAUNCH_DEV ? loadDevLegendDate() : Promise.resolve(null),
      ]);
      if (request !== requestRef.current) return;
      setTracks(boot.tracks);
      setToday(devDate ?? localYmd(new Date(), timeZone));
      setLocal({ ...localState, museum: mergeMuseum(server ?? [], localState.museum) });
    } catch (err) {
      console.log('[your-reveals] load error:', err);
    } finally {
      if (request === requestRef.current) setReady(true);
    }
  }, [userId, timeZone]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const unlocked = legendsUnlocked(tracks) && !legendLocked(tracks);
  const museum = useMemo(() => local?.museum ?? [], [local]);
  const metIds = useMemo(() => new Set(museum.map((row) => row.legendId)), [museum]);

  // Today's state, read exactly as Legends reads it (display only).
  const day = local?.day?.ymd === today ? local?.day ?? null : null;
  const revealedToday = day?.revealed.length ?? 0;
  const bonusUnlocked = revealedToday >= 1 && day != null && hasNewSettledLean(day.fingerprint, settledFingerprint(tracks));
  const left = revealsLeft(revealedToday, bonusUnlocked);
  const tokens = me ? atoTokenBalanceOf(me) : 0;
  const canPay = tokens >= AI_TOKEN_PRICE;
  const todayLine =
    left > 0
      ? revealedToday >= 1
        ? LEGENDS_BONUS_COPY
        : LEGENDS_ONE_TODAY_COPY
      : canPay
        ? legendsPaidLine(tokens)
        : `${LEGENDS_TOMORROW_COPY} ${AI_TOKENS_NEEDED}`;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/legends'));
  const openHall = (hall: LegendHall) => router.push({ pathname: '/legends', params: { hall } });

  const toggleLegend = (legendId: string) => {
    setOpenId((cur) => (cur === legendId ? null : legendId));
    setOpenChapter(0);
  };

  const openEntries = useMemo(
    () => (openId ? museum.filter((row) => row.legendId === openId).sort((a, b) => a.chapter - b.chapter) : []),
    [museum, openId],
  );
  const openLegendDef = openId ? legendById(openId) : null;
  const openEntry = openEntries.find((row) => row.chapter === openChapter) ?? openEntries[0] ?? null;

  const card =
    openEntry && openLegendDef ? (
      <>
        <LegendStoryCard
          legend={openLegendDef}
          story={openEntry.story}
          friends={[]}
          aiOff={false}
          onShare={() => setShareOpen(true)}
          matchedOn={matchedOnLine(openLegendDef, tracks)}
          didYouKnow={didYouKnowFact(openLegendDef, openEntry.story, local?.userId ?? '')}
          nextTeaser={nextChapterTeaser(openLegendDef, toldAngles(museum).get(openLegendDef.id))}
          chapters={{
            labels: openEntries.map((row) => chapterLabel(row.chapter)),
            selected: openEntries.indexOf(openEntry),
            onSelect: (index) => setOpenChapter(openEntries[index]?.chapter ?? 0),
          }}
        />
        <LegendShareSheet
          legend={openLegendDef}
          title={openEntry.story.title ?? null}
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      </>
    ) : null;

  const panel = [styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="never">
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              onPress={goBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText type="link">‹ Back</ThemedText>
            </Pressable>
            <ThemedText type="subtitle">{YOUR_REVEALS_TITLE}</ThemedText>
          </View>

          {!ready ? null : !unlocked ? (
            <View style={panel}>
              <ThemedText type="smallBold">
                {tracks.length > 0 ? fullProfileLockedLine(fullProfileProgress(tracks)) : FULL_PROFILE_LOCKED_COPY}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {REVEALS_LOCKED_COPY}
              </ThemedText>
              <Pressable
                onPress={() => router.push('/legends')}
                accessibilityRole="button"
                accessibilityLabel="Open Legends"
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <ThemedText type="linkPrimary">Open Legends ›</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Today: the same numbers Legends shows. Paying happens there, never here. */}
              <View style={panel}>
                <ThemedText type="smallBold">Today</ThemedText>
                <ThemedText type="small">
                  Free reveal: {revealedToday >= 1 ? 'used' : 'open'}
                  {revealedToday >= 1 ? ` · Bonus reveal: ${bonusUnlocked && left > 0 ? 'open' : bonusUnlocked ? 'used' : 'not open'}` : ''}
                </ThemedText>
                <ThemedText type="small">
                  Extra reveal: {AI_TOKEN_PRICE} tokens · you have {tokens}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {todayLine}
                </ThemedText>
              </View>

              <ThemedText type="small" themeColor="textSecondary" style={styles.heading}>
                Reveal in Legends
              </ThemedText>
              <View style={styles.rows}>
                {LEGEND_HALLS.map((hall) => {
                  const all = legendsInHall(hall);
                  const metHere = all.filter((legend) => metIds.has(legend.id)).length;
                  return (
                    <Pressable
                      key={hall}
                      onPress={() => openHall(hall)}
                      accessibilityRole="button"
                      accessibilityLabel={`Reveal in Legends: ${HALL_LABEL[hall]}, ${metHere} of ${all.length} met`}
                      style={({ pressed }) => [
                        styles.row,
                        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                        pressed && styles.pressed,
                      ]}>
                      <MaterialCommunityIcons name={HALL_ICON[hall]} size={20} color={HALL_COLOR[hall]} />
                      <ThemedText type="small" style={styles.flex}>
                        {HALL_LABEL[hall]} · {metHere}/{all.length}
                      </ThemedText>
                      <ThemedText type="linkPrimary">Reveal in Legends ›</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {ready ? (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.heading}>
                Legends met · {metIds.size} of {LEGEND_ROSTER.length}
              </ThemedText>
              {metIds.size === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {REVEALS_EMPTY_COPY}
                </ThemedText>
              ) : (
                LEGEND_HALLS.map((hall) => {
                  const hallMet = legendsInHall(hall).filter((legend) => metIds.has(legend.id));
                  if (hallMet.length === 0) return null;
                  const openHere = hallMet.some((legend) => legend.id === openId);
                  return (
                    <View key={hall} style={styles.hallGroup}>
                      <View style={styles.hallHead}>
                        <MaterialCommunityIcons name={HALL_ICON[hall]} size={18} color={HALL_COLOR[hall]} />
                        <ThemedText type="smallBold">{HALL_LABEL[hall]}</ThemedText>
                      </View>
                      <View style={styles.metList}>
                        {hallMet.map((legend) => (
                          <Pressable
                            key={legend.id}
                            onPress={() => toggleLegend(legend.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${legendTitle(legend)}, open the saved story`}
                            accessibilityState={{ expanded: openId === legend.id }}
                            style={({ pressed }) => [
                              styles.metChip,
                              { borderColor: HALL_COLOR[hall] },
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText type="small">{legendTitle(legend)}</ThemedText>
                          </Pressable>
                        ))}
                      </View>
                      {/* The card sits OUTSIDE the wrapping row (text in a wrap row is
                          measured too wide on iOS and gets clipped). */}
                      {openHere ? card : null}
                    </View>
                  );
                })
              )}
            </>
          ) : null}
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
  scroll: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: { gap: Spacing.one },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  heading: { marginTop: Spacing.two },
  panel: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  link: { paddingVertical: 4 },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  rows: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hallGroup: { gap: Spacing.two },
  hallHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
});
