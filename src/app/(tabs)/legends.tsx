import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  HALL_COLOR,
  HALL_ICON,
  LegendLabel,
  LegendShareSheet,
  LegendStoryCard,
} from '@/components/legend-figure-card';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { AI_TAP_TIMEOUT_MS } from '@/lib/ai/generate';
import { crisisNotedToday } from '@/lib/crisis/local-flag';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { FULL_PROFILE_LOCKED_COPY, fullProfileLockedLine, fullProfileProgress } from '@/lib/full-profile-gate';
import { fetchHomeBootstrap } from '@/lib/home-bootstrap';
import { writeLegendStory } from '@/lib/legend-figures/generate';
import {
  fetchAngleCounts,
  fetchCircleFriends,
  fetchServerMuseum,
  loadDevLegendDate,
  loadLocalState,
  mergeMuseum,
  saveLocalState,
  saveServerEntry,
  type LegendLocalState,
  type MuseumEntry,
} from '@/lib/legend-figures/museum-store';
import {
  chooseAngle,
  hasNewSettledLean,
  legendLocked,
  pickLegendSet,
  settledFingerprint,
  type LegendOffer,
} from '@/lib/legend-figures/pick';
import { LEGEND_ROSTER, legendById, legendsInHall } from '@/lib/legend-figures/roster';
import { fallbackLegendStory, legendPairs } from '@/lib/legend-figures/story';
import { HALL_LABEL, LEGEND_HALLS, type LegendFigure, type LegendHall } from '@/lib/legend-figures/types';
import { localYmd } from '@/lib/local-date';
import { aiConsentFor } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { legendsUnlocked } from '@/lib/questions/progressive-unlock';
import { rankStoryAxes } from '@/lib/story-thread';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';
import { withTimeout } from '@/lib/timeout';

export const LEGENDS_LEDE =
  'A museum of legends from history, science, art, sport, myth and stranger tales. Each day, three of them have something in common with you.';
export const LEGENDS_TOMORROW_COPY = 'Come back tomorrow for three new legends.';
export const LEGENDS_BONUS_COPY = 'Your answers changed who you’d meet. A new three is waiting.';

/**
 * Legends — the museum of legends (rebuilt 2026-10-08; it was parked since
 * 2026-09-15). Same gate as every other unlock: `legendsUnlocked(tracks)`
 * (the finished intake), plus at least two clear trait leans.
 *
 * Nothing here spends on its own: today's three are picked on the phone with
 * no AI (`pick.ts`), and the one model call runs only on "Meet them"
 * (`writeLegendStory`, claimed on the server first). Opening a met legend is
 * free — the story was saved.
 */
export default function LegendsScreen() {
  const theme = useTheme();
  const { me } = useMeContext();
  const [tracks, setTracks] = useState<readonly TraitTrack[]>([]);
  const [ready, setReady] = useState(false);
  const [crisisToday, setCrisisToday] = useState(false);
  const [local, setLocal] = useState<LegendLocalState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openHall, setOpenHall] = useState<LegendHall | null>(null);
  const [friends, setFriends] = useState<Record<string, string[]>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const requestRef = useRef(0);
  /** A story is being written: one at a time (a double tap must not pay twice)
   * and no reload may overwrite the state until it is saved. */
  const meetingRef = useRef(false);
  /** The newest state in memory, newer than storage while a write is pending. */
  const localRef = useRef<LegendLocalState | null>(null);

  const dataEpoch = useAccountDataEpoch();
  const userId = me?.id ?? null;
  const timeZone = me?.timezone || 'UTC';
  const consentGranted = me ? aiConsentFor(me) === 'granted' : false;

  const persist = useCallback((next: LegendLocalState) => {
    localRef.current = next;
    setLocal(next);
    void saveLocalState(next);
  }, []);

  /** Make (or keep) today's set. Counts are fetched once per label so the
   * teaser shown is the angle the story will use. */
  const ensureDay = useCallback(
    async (state: LegendLocalState, nextTracks: readonly TraitTrack[], today: string): Promise<LegendLocalState> => {
      if (state.day?.ymd === today) return state;
      // Locked (e.g. right after Change answers): keep whatever day exists, make nothing new.
      if (!legendsUnlocked(nextTracks) || legendLocked(nextTracks)) return state;
      const met = new Set(state.museum.map((row) => row.legendId));
      const visitedHalls = new Set(
        state.museum.map((row) => legendById(row.legendId)?.hall).filter((h): h is LegendHall => h != null),
      );
      const set = pickLegendSet({ tracks: nextTracks, userId: state.userId, ymd: today, setNo: 0, met, visitedHalls });
      if (!set) return { ...state, day: null };
      const angles: Record<string, { angleId: string; momentId: string }> = {};
      await Promise.all(
        set.offers.map(async (offer) => {
          const legend = legendById(offer.legendId);
          if (!legend) return;
          angles[legend.id] = chooseAngle(legend, state.userId, await fetchAngleCounts(legend.id));
        }),
      );
      return {
        ...state,
        day: { ymd: today, fingerprint: settledFingerprint(nextTracks), sets: [set], picked: {}, angles },
      };
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!userId || !me) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    // A wipe (new epoch) re-creates `reload`, so a focused tab loads fresh;
    // a load that started before the wipe never writes.
    const epoch = dataEpoch;
    try {
      const [boot, localState, server, crisisLocal, devDate] = await Promise.all([
        fetchHomeBootstrap(timeZone),
        loadLocalState(userId),
        fetchServerMuseum(),
        crisisNotedToday(),
        PRE_LAUNCH_DEV ? loadDevLegendDate() : Promise.resolve(null),
      ]);
      if (request !== requestRef.current) return;
      const today = devDate ?? localYmd(new Date(), timeZone);
      // Memory can be newer than storage (a pick saved a moment ago): keep its
      // day and museum rows, never roll them back.
      const memory = localRef.current?.userId === userId ? localRef.current : null;
      const base: LegendLocalState = {
        ...localState,
        day: memory?.day?.ymd === today ? memory.day : localState.day,
        museum: mergeMuseum(server ?? [], [...(memory?.museum ?? []), ...localState.museum]),
      };
      const withDay = await ensureDay(base, boot.tracks, today);
      if (request !== requestRef.current || epoch !== epochRef.current) return;
      setTracks(boot.tracks);
      setCrisisToday(boot.crisisToday || crisisLocal);
      // A story being written owns the state until it is saved.
      if (!meetingRef.current) persist(withDay);
    } catch (err) {
      console.log('[legends] load error:', err);
    } finally {
      if (request === requestRef.current) setReady(true);
    }
  }, [userId, me, timeZone, ensureDay, persist, dataEpoch]);

  // Reset account, Preview as new user, sign-out and the dev Legends tools
  // wipe phone storage and bump the account-data epoch: forget everything held
  // in memory too, so a wipe can never be written back from here.
  const epochRef = useRef(dataEpoch);
  useEffect(() => {
    if (epochRef.current === dataEpoch) return;
    epochRef.current = dataEpoch;
    localRef.current = null;
    requestRef.current += 1;
    setLocal(null);
    setOpenId(null);
    setFriends({});
  }, [dataEpoch]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const unlocked = legendsUnlocked(tracks) && !legendLocked(tracks);
  const day = local?.day ?? null;
  const currentSet = day ? day.sets[day.sets.length - 1] : null;
  const pickedToday = currentSet && day ? day.picked[currentSet.setNo] ?? null : null;
  const bonusReady =
    day != null &&
    day.sets.length === 1 &&
    day.picked[0] != null &&
    hasNewSettledLean(day.fingerprint, settledFingerprint(tracks));

  const museumById = useMemo(() => {
    const map = new Map<string, MuseumEntry>();
    for (const row of local?.museum ?? []) map.set(row.legendId, row);
    return map;
  }, [local]);

  const openBonus = useCallback(async () => {
    if (!local?.day || !userId) return;
    const met = new Set(local.museum.map((row) => row.legendId));
    const visitedHalls = new Set(
      local.museum.map((row) => legendById(row.legendId)?.hall).filter((h): h is LegendHall => h != null),
    );
    const set = pickLegendSet({ tracks, userId, ymd: local.day.ymd, setNo: 1, met, visitedHalls });
    if (!set) return;
    const angles = { ...local.day.angles };
    await Promise.all(
      set.offers.map(async (offer) => {
        const legend = legendById(offer.legendId);
        if (legend) angles[legend.id] = chooseAngle(legend, userId, await fetchAngleCounts(legend.id));
      }),
    );
    persist({ ...local, day: { ...local.day, sets: [...local.day.sets, set], angles } });
  }, [local, tracks, userId, persist]);

  const loadFriends = useCallback(async (legendId: string) => {
    const names = await fetchCircleFriends(legendId);
    setFriends((prev) => ({ ...prev, [legendId]: names }));
  }, []);

  const meet = useCallback(
    async (offer: LegendOffer) => {
      if (!local?.day || !currentSet || busyId || pickedToday || meetingRef.current) return;
      const legend = legendById(offer.legendId);
      if (!legend) return;
      meetingRef.current = true;
      setBusyId(legend.id);
      const epochAtStart = epochRef.current;
      try {
      const chosen = local.day.angles[legend.id] ?? chooseAngle(legend, local.userId, null);
      const angle = legend.angles.find((a) => a.id === chosen.angleId) ?? legend.angles[0]!;
      const pairs = legendPairs(
        legend,
        rankStoryAxes(tracks).map((row) => ({ axis: row.axis, lean: row.lean, strength: row.strength })),
      );
      const input = { legend, angle, momentId: chosen.momentId, pairs };
      let story;
      try {
        story = await withTimeout(writeLegendStory({ ...input, consentGranted }), AI_TAP_TIMEOUT_MS, 'legend-story');
      } catch {
        story = fallbackLegendStory(input);
      }
      const entry: MuseumEntry = { legendId: legend.id, story, metOn: local.day.ymd };
      const latest = localRef.current ?? local;
      const day = latest.day ?? local.day;
      const next: LegendLocalState = {
        ...latest,
        museum: mergeMuseum([], [entry, ...latest.museum.filter((row) => row.legendId !== legend.id)]),
        day: {
          ...day,
          picked: { ...day.picked, [currentSet.setNo]: legend.id },
          // The bonus set counts traits that settle AFTER this pick.
          fingerprint: currentSet.setNo === 0 ? settledFingerprint(tracks) : day.fingerprint,
        },
      };
      // A wipe while the story was being written wins: never write it back.
      if (epochRef.current !== epochAtStart) return;
      persist(next);
      setOpenId(legend.id);
      void saveServerEntry(entry);
      void loadFriends(legend.id);
      } finally {
        // Never leave "Meet them" dead after an unexpected error.
        meetingRef.current = false;
        setBusyId(null);
      }
    },
    [local, currentSet, busyId, pickedToday, tracks, consentGranted, persist, loadFriends],
  );

  const openLegend = useCallback(
    (legendId: string) => {
      setOpenId((cur) => (cur === legendId ? null : legendId));
      if (!friends[legendId]) void loadFriends(legendId);
    },
    [friends, loadFriends],
  );

  const openEntry = openId ? museumById.get(openId) ?? null : null;
  const openLegendDef = openId ? legendById(openId) : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="never">
          <ThemedText type="subtitle">Legends</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {LEGENDS_LEDE}
          </ThemedText>

          {!ready ? null : !unlocked ? (
            <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="smallBold">
                {tracks.length > 0 ? fullProfileLockedLine(fullProfileProgress(tracks)) : FULL_PROFILE_LOCKED_COPY}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your first three legends will be waiting once your answers show a clear side or two.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/intake-sweep')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <ThemedText type="linkPrimary">Go to Questions</ThemedText>
              </Pressable>
            </View>
          ) : crisisToday ? null : (
            <>
              <ThemedText type="heading" style={styles.heading}>
                {pickedToday ? 'Today’s legend' : 'Today’s three'}
              </ThemedText>
              {pickedToday && openId !== pickedToday ? (
                <Pressable onPress={() => openLegend(pickedToday)} accessibilityRole="button">
                  <ThemedText type="linkPrimary">Open {legendById(pickedToday)?.name ?? 'your legend'}</ThemedText>
                </Pressable>
              ) : null}
              {currentSet?.offers.map((offer) => {
                const legend = legendById(offer.legendId);
                if (!legend) return null;
                if (pickedToday === legend.id) return null;
                const chosen = day?.angles[legend.id];
                const teaser = legend.angles.find((a) => a.id === chosen?.angleId)?.teaser ?? legend.angles[0]!.teaser;
                return (
                  <LegendLabel
                    key={`${currentSet.setNo}-${legend.id}`}
                    legend={legend}
                    offer={offer}
                    teaser={teaser}
                    state={pickedToday ? 'done' : busyId === legend.id ? 'loading' : 'ready'}
                    onMeet={() => void meet(offer)}
                  />
                );
              })}
              {pickedToday ? (
                bonusReady ? (
                  <Pressable
                    onPress={() => void openBonus()}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.bonus, { borderColor: theme.accent }, pressed && styles.pressed]}>
                    <MaterialCommunityIcons name="star-four-points-outline" size={18} color={theme.accent} />
                    <ThemedText type="smallBold" style={styles.flex}>
                      {LEGENDS_BONUS_COPY}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {LEGENDS_TOMORROW_COPY}
                  </ThemedText>
                )
              ) : null}
            </>
          )}

          {openEntry && openLegendDef ? (
            <>
              <LegendStoryCard
                legend={openLegendDef}
                story={openEntry.story}
                friends={friends[openLegendDef.id] ?? []}
                aiOff={openEntry.story.source === 'fallback' && !consentGranted}
                onShare={() => setShareOpen(true)}
              />
              <LegendShareSheet legend={openLegendDef} visible={shareOpen} onClose={() => setShareOpen(false)} />
            </>
          ) : null}

          {ready && unlocked ? (
            <>
              <ThemedText type="heading" style={styles.heading}>
                Your museum
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {(local?.museum.length ?? 0)} of {LEGEND_ROSTER.length} legends met
              </ThemedText>
              {LEGEND_HALLS.map((hall) => (
                <HallRow
                  key={hall}
                  hall={hall}
                  open={openHall === hall}
                  onToggle={() => setOpenHall((cur) => (cur === hall ? null : hall))}
                  met={museumById}
                  onOpenLegend={openLegend}
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HallRow({
  hall,
  open,
  onToggle,
  met,
  onOpenLegend,
}: {
  hall: LegendHall;
  open: boolean;
  onToggle: () => void;
  met: ReadonlyMap<string, MuseumEntry>;
  onOpenLegend: (legendId: string) => void;
}) {
  const theme = useTheme();
  const all = legendsInHall(hall);
  const metHere = all.filter((legend) => met.has(legend.id));
  const hiddenLeft = all.filter((legend) => legend.hidden && !met.has(legend.id)).length;
  const plainLeft = all.length - metHere.length - hiddenLeft;
  const color = HALL_COLOR[hall];
  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.hallHead, pressed && styles.pressed]}>
        <MaterialCommunityIcons name={HALL_ICON[hall]} size={20} color={color} />
        <ThemedText type="smallBold" style={styles.flex}>
          {HALL_LABEL[hall]}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {metHere.length}/{all.length}
        </ThemedText>
      </Pressable>
      <View style={[styles.progress, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.progressFill, { backgroundColor: color, width: `${all.length ? (metHere.length / all.length) * 100 : 0}%` }]} />
      </View>
      {open ? (
        <View style={styles.frames}>
          {metHere.map((legend: LegendFigure) => (
            <Pressable
              key={legend.id}
              onPress={() => onOpenLegend(legend.id)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.frame, { borderColor: color }, pressed && styles.pressed]}>
              <ThemedText type="small">{legend.name}</ThemedText>
            </Pressable>
          ))}
          {Array.from({ length: plainLeft }, (_, i) => (
            <View key={`empty-${i}`} style={[styles.frame, styles.frameEmpty, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                Not met yet
              </ThemedText>
            </View>
          ))}
          {Array.from({ length: hiddenLeft }, (_, i) => (
            <View key={`hidden-${i}`} style={[styles.frame, styles.frameEmpty, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                ??? · hidden
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
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
    paddingTop: NAV_PIXEL_HEADER_INSET,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  heading: { marginTop: Spacing.two },
  panel: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: Spacing.two },
  link: { paddingVertical: 4 },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  bonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  hallHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  frames: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frame: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  frameEmpty: { borderStyle: 'dashed' },
});
