import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  HALL_COLOR,
  HALL_ICON,
  LegendAiPlaceholder,
  LegendFrame,
  LegendShareSheet,
  LegendStoryCard,
  legendTitle,
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
import { revealLegendStory } from '@/lib/legend-figures/generate';
import {
  fetchAngleCounts,
  fetchCircleFriends,
  fetchServerMuseum,
  loadDevLegendDate,
  loadLocalState,
  mergeMuseum,
  resendMissingEntries,
  saveLocalState,
  saveServerEntry,
  toldAngles,
  usedFrameKeys,
  type LegendLocalState,
  type MuseumEntry,
} from '@/lib/legend-figures/museum-store';
import {
  chapterOrder,
  chooseAngle,
  hallComplete,
  hallFrames,
  hallOrder,
  hasNewSettledLean,
  legendLocked,
  matchedOnLine,
  parseFrameKey,
  revealsLeft,
  settledFingerprint,
} from '@/lib/legend-figures/pick';
import { LEGEND_ROSTER, legendById, legendsInHall } from '@/lib/legend-figures/roster';
import {
  didYouKnowFact,
  fallbackLegendStory,
  legendDiffer,
  legendPairs,
  nextChapterTeaser,
} from '@/lib/legend-figures/story';
import { HALL_LABEL, LEGEND_HALLS, type LegendHall } from '@/lib/legend-figures/types';
import { localYmd } from '@/lib/local-date';
import { AI_TOKEN_PRICE, AI_TOKENS_NEEDED, atoTokenBalanceOf } from '@/lib/ato-tokens';
import { refundAiTokens } from '@/lib/ato-tokens-server';
import { cardJokeStyle } from '@/lib/voice/card-joke';
import { aiConsentFor } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { legendsUnlocked } from '@/lib/questions/progressive-unlock';
import { rankStoryAxes } from '@/lib/story-thread';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';
import { withTimeout } from '@/lib/timeout';

export const LEGENDS_LEDE =
  'A museum of legends: inventors, artists, healers, explorers, myths, ghosts and famous animals. Pick a hall. Behind each ??? is someone who has something in common with you.';
export const LEGENDS_TOMORROW_COPY = 'That’s today’s legend. Come back tomorrow to reveal the next one.';
export const LEGENDS_BONUS_COPY = 'Your answers changed who you’d meet. One more reveal is open today.';
export const LEGENDS_ONE_TODAY_COPY = 'One free reveal a day. Pick a frame.';
/** Tokens (wave92, emci 2026-10-09): the free reveal gets the AI card when the
 * balance covers it; more reveals cost one AI view each. */
export const legendsAiLine = (tokens: number) =>
  `With ${AI_TOKEN_PRICE} tokens it comes with your AI card (you have ${tokens}); without them you get the museum’s own words.`;
export const LEGENDS_PAID_FAILED =
  'The AI card didn’t come through, so this reveal didn’t happen. Your tokens come back (once a day). Try again in a bit.';
export const legendsPaidLine = (tokens: number) =>
  `Want another? Reveal one more for ${AI_TOKEN_PRICE} tokens (you have ${tokens}).`;
export const HALL_CHAPTERS_COPY = 'You’ve met every legend here. The frames now hide new chapters about them.';
export const HALL_EMPTY_COPY = 'Nothing left to reveal in this hall today. Try another hall.';
export const HALL_ALL_TOLD_COPY = 'You’ve heard every story in this hall.';
export const AI_PLACEHOLDER_NOTE = 'Opens after you’ve met every legend in a hall.';

/** Counts fetch is a nice-to-have: never hold a reveal on it. */
const COUNTS_TIMEOUT_MS = 4000;

function chapterLabel(chapter: number): string {
  return chapter === 0 ? 'First meeting' : `Chapter ${chapter + 1}`;
}

/** Make sure a hall has today's order (and its chapters once it is finished). */
function ensureHall(
  state: LegendLocalState,
  hall: LegendHall,
  tracks: readonly TraitTrack[],
  today: string,
): LegendLocalState {
  if (!legendsUnlocked(tracks) || legendLocked(tracks)) return state;
  const day =
    state.day?.ymd === today ? state.day : { ymd: today, fingerprint: '', halls: {}, revealed: [] };
  const met = new Set(state.museum.map((row) => row.legendId));
  const used = usedFrameKeys(state.museum);
  let hallDay = day.halls[hall];
  if (!hallDay) {
    const order = hallOrder({ tracks, userId: state.userId, ymd: today, hall, met });
    if (!order) return state;
    hallDay = { order };
  }
  const legendsLeft = hallFrames(hallDay.order, used, `${state.userId}|${today}|${hall}`, day.revealed).some(
    (key) => key != null,
  );
  if (!legendsLeft && !hallDay.chapters && hallComplete(hall, tracks, met)) {
    hallDay = {
      ...hallDay,
      chapters: chapterOrder({ tracks, userId: state.userId, ymd: today, hall, told: toldAngles(state.museum) }),
    };
  }
  if (state.day === day && day.halls[hall] === hallDay) return state;
  return { ...state, day: { ...day, halls: { ...day.halls, [hall]: hallDay } } };
}

/**
 * Legends — the museum of legends (rebuilt 2026-10-08). Same gate as every
 * other unlock: `legendsUnlocked(tracks)` (the finished intake), plus at least
 * two clear trait leans.
 *
 * Pick a hall → three "???" frames (no clue) → reveal one a day (plus one bonus
 * when a new trait side settles). Nothing here spends on its own: the frames
 * are picked on the phone with no AI (`pick.ts`), and the one model call runs
 * only on a reveal tap (`writeLegendStory`, claimed on the server first).
 * Opening a met legend is free — the story was saved.
 */
export default function LegendsScreen() {
  const theme = useTheme();
  const { me, refresh: refreshMe } = useMeContext();
  const [tokenNote, setTokenNote] = useState<string | null>(null);
  const [tracks, setTracks] = useState<readonly TraitTrack[]>([]);
  const [ready, setReady] = useState(false);
  const [crisisToday, setCrisisToday] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [local, setLocal] = useState<LegendLocalState | null>(null);
  const [hall, setHall] = useState<LegendHall | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openChapter, setOpenChapter] = useState(0);
  /** Notes shown on a card right after its reveal ("Born on this day", …). */
  const [revealNotes, setRevealNotes] = useState<Record<string, string[]>>({});
  const [friends, setFriends] = useState<Record<string, string[]>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const requestRef = useRef(0);
  /** A story is being written: one at a time (a double tap must not pay twice)
   * and no reload may overwrite the state until it is saved. */
  const meetingRef = useRef(false);
  /** The newest state in memory, newer than storage while a write is pending. */
  const localRef = useRef<LegendLocalState | null>(null);
  const hallRef = useRef<LegendHall | null>(null);

  const dataEpoch = useAccountDataEpoch();
  const userId = me?.id ?? null;
  const timeZone = me?.timezone || 'UTC';
  const consentGranted = me ? aiConsentFor(me) === 'granted' : false;

  const persist = useCallback((next: LegendLocalState) => {
    localRef.current = next;
    setLocal(next);
    void saveLocalState(next);
  }, []);

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
      if (request !== requestRef.current || epoch !== epochRef.current) return;
      const day = devDate ?? localYmd(new Date(), timeZone);
      // Memory can be newer than storage (a reveal saved a moment ago): keep
      // its day and museum rows, never roll them back.
      const memory = localRef.current?.userId === userId ? localRef.current : null;
      let next: LegendLocalState = {
        ...localState,
        day: memory?.day?.ymd === day ? memory.day : localState.day?.ymd === day ? localState.day : null,
        museum: mergeMuseum(server ?? [], [...(memory?.museum ?? []), ...localState.museum]),
      };
      if (hallRef.current) next = ensureHall(next, hallRef.current, boot.tracks, day);
      // A save that failed (offline, wave89 not applied yet) is retried here.
      if (server) {
        const yesterday = localYmd(new Date(Date.now() - 86_400_000), timeZone);
        void resendMissingEntries(server, next.museum, day, yesterday, () => epoch === epochRef.current);
      }
      setTracks(boot.tracks);
      setToday(day);
      setCrisisToday(boot.crisisToday || crisisLocal);
      // A story being written owns the state until it is saved.
      if (!meetingRef.current) persist(next);
    } catch (err) {
      console.log('[legends] load error:', err);
    } finally {
      if (request === requestRef.current) setReady(true);
    }
  }, [userId, me, timeZone, persist, dataEpoch]);

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
    setRevealNotes({});
    setFriends({});
  }, [dataEpoch]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const unlocked = legendsUnlocked(tracks) && !legendLocked(tracks);
  const museum = useMemo(() => local?.museum ?? [], [local]);
  const metIds = useMemo(() => new Set(museum.map((row) => row.legendId)), [museum]);
  const used = useMemo(() => usedFrameKeys(museum), [museum]);
  const day = local?.day?.ymd === today ? local?.day ?? null : null;
  const revealedToday = day?.revealed.length ?? 0;
  const bonusUnlocked = revealedToday >= 1 && day != null && hasNewSettledLean(day.fingerprint, settledFingerprint(tracks));
  const left = revealsLeft(revealedToday, bonusUnlocked);
  const tokens = me ? atoTokenBalanceOf(me) : 0;
  /** Past the free reveal(s), one more costs one AI view. */
  const canPay = consentGranted && tokens >= AI_TOKEN_PRICE;
  const canReveal = left > 0 || canPay;

  const chooseHall = useCallback(
    (next: LegendHall) => {
      // Stay in the hall while its story is being written.
      if (meetingRef.current) return;
      const current = localRef.current;
      hallRef.current = next;
      setHall(next);
      setOpenId(null);
      if (!current || !today) return;
      const withHall = ensureHall(current, next, tracks, today);
      if (withHall !== current) persist(withHall);
    },
    [today, tracks, persist],
  );

  const loadFriends = useCallback(async (legendId: string) => {
    const names = await fetchCircleFriends(legendId);
    setFriends((prev) => ({ ...prev, [legendId]: names }));
  }, []);

  const reveal = useCallback(
    async (key: string) => {
      const start = localRef.current;
      if (!start || !hall || !today || busyKey || meetingRef.current) return;
      const startDay = start.day?.ymd === today ? start.day : null;
      const revealedBefore = startDay?.revealed.length ?? 0;
      const bonus = revealedBefore >= 1 && startDay != null && hasNewSettledLean(startDay.fingerprint, settledFingerprint(tracks));
      const free = revealsLeft(revealedBefore, bonus) > 0;
      if (!free && !(consentGranted && (me ? atoTokenBalanceOf(me) : 0) >= AI_TOKEN_PRICE)) return;
      setTokenNote(null);
      const { legendId, angleId } = parseFrameKey(key);
      const legend = legendById(legendId);
      if (!legend) return;
      meetingRef.current = true;
      setBusyKey(key);
      const epochAtStart = epochRef.current;
      try {
        const chapter = start.museum.filter((row) => row.legendId === legend.id).length;
        const told = toldAngles(start.museum).get(legend.id);
        const counts = await withTimeout(fetchAngleCounts(legend.id), COUNTS_TIMEOUT_MS, 'legend-counts').catch(() => null);
        const chosen = chooseAngle(legend, start.userId, counts, { onlyAngle: angleId, skipAngles: told });
        const angle = legend.angles.find((a) => a.id === chosen.angleId) ?? legend.angles[0]!;
        const leans = rankStoryAxes(tracks).map((row) => ({ axis: row.axis, lean: row.lean, strength: row.strength }));
        const pairs = legendPairs(legend, leans);
        const differ = legendDiffer(legend, leans, new Set(pairs.map((p) => p.axis)));
        // The joke style is picked here, never by the model: seeded per card so neighbours differ.
        const jokeStyle = cardJokeStyle(`${start.userId}|${legend.id}|${chapter}`);
        const input = { legend, angle, momentId: chosen.momentId, pairs, differ, jokeStyle };
        let story;
        try {
          story = await withTimeout(revealLegendStory({ ...input, consentGranted, free }), AI_TAP_TIMEOUT_MS, 'legend-story');
        } catch {
          story = fallbackLegendStory(input);
          // The outer wait ran out: a paid reveal must not keep the charge.
          if (!free) await refundAiTokens('legend');
        }
        // A wipe while the story was being written wins: never write it back.
        if (epochRef.current !== epochAtStart) return;
        // A paid reveal is an AI view: no AI card (no tokens, or it failed and was refunded) = no reveal.
        if (!free && story.source !== 'ai') {
          setTokenNote(LEGENDS_PAID_FAILED);
          void refreshMe();
          return;
        }
        void refreshMe();
        const entry: MuseumEntry = { legendId: legend.id, chapter, story, metOn: today };
        const latest = localRef.current ?? start;
        const latestDay =
          latest.day?.ymd === today ? latest.day : { ymd: today, fingerprint: '', halls: {}, revealed: [] };
        let next: LegendLocalState = {
          ...latest,
          museum: mergeMuseum([], [entry, ...latest.museum]),
          day: {
            ...latestDay,
            revealed: [...latestDay.revealed, key],
            // The bonus counts trait sides that settle AFTER the first reveal.
            fingerprint: latestDay.revealed.length === 0 ? settledFingerprint(tracks) : latestDay.fingerprint,
          },
        };
        next = ensureHall(next, hall, tracks, today);
        const notes: string[] = [];
        if (chapter > 0) notes.push(`${chapterLabel(chapter)} · a new story`);
        if (chapter === 0 && legend.birthday?.md === today.slice(5, 10)) notes.push('Born on this day');
        if (chapter === 0 && legend.hidden) notes.push('Hidden legend found');
        if (
          chapter === 0 &&
          legend.roleOf &&
          start.museum.some((row) => row.legendId !== legend.id && legendById(row.legendId)?.roleOf === legend.roleOf)
        ) {
          notes.push(`Another side of ${legend.roleOf}`);
        }
        persist(next);
        setRevealNotes((prev) => ({ ...prev, [legend.id]: notes }));
        setOpenId(legend.id);
        setOpenChapter(chapter);
        void saveServerEntry(entry);
        void loadFriends(legend.id);
      } finally {
        // Never leave the frames dead after an unexpected error.
        meetingRef.current = false;
        setBusyKey(null);
      }
    },
    [hall, today, busyKey, tracks, consentGranted, persist, loadFriends, me, refreshMe],
  );

  const openLegend = useCallback(
    (legendId: string) => {
      setOpenId((cur) => (cur === legendId ? null : legendId));
      setOpenChapter(0);
      if (!friends[legendId]) void loadFriends(legendId);
    },
    [friends, loadFriends],
  );

  const openEntries = useMemo(
    () => (openId ? museum.filter((row) => row.legendId === openId).sort((a, b) => a.chapter - b.chapter) : []),
    [museum, openId],
  );
  const openLegendDef = openId ? legendById(openId) : null;
  const openEntry = openEntries.find((row) => row.chapter === openChapter) ?? openEntries[0] ?? null;

  const hallDay = hall && day ? day.halls[hall] ?? null : null;
  const seed = `${local?.userId ?? ''}|${today ?? ''}|${hall ?? ''}`;
  const revealedSeq = day?.revealed ?? [];
  const legendFrames = hallDay ? hallFrames(hallDay.order, used, seed, revealedSeq) : [];
  const showingChapters = legendFrames.every((key) => key == null) && hallDay?.chapters != null;
  const frames = showingChapters
    ? hallFrames(hallDay!.chapters!, used, `${seed}|chapters`, revealedSeq)
    : legendFrames;
  const framesLeft = frames.filter((key) => key != null).length;
  const hallMet = hall ? legendsInHall(hall).filter((legend) => metIds.has(legend.id)) : [];

  const card =
    openEntry && openLegendDef ? (
      <>
        <LegendStoryCard
          legend={openLegendDef}
          story={openEntry.story}
          friends={friends[openLegendDef.id] ?? []}
          aiOff={openEntry.story.source === 'fallback' && !consentGranted}
          onShare={() => setShareOpen(true)}
          notes={revealNotes[openLegendDef.id] ?? []}
          matchedOn={matchedOnLine(openLegendDef, tracks)}
          didYouKnow={didYouKnowFact(openLegendDef, openEntry.story, local?.userId ?? '')}
          nextTeaser={nextChapterTeaser(openLegendDef, toldAngles(museum).get(openLegendDef.id))}
          nextNote={
            hallComplete(openLegendDef.hall, tracks, metIds)
              ? 'It can turn up behind this hall’s frames.'
              : 'Chapters open once you’ve met every legend in this hall.'
          }
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
                The museum opens once your answers show a clear side or two.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/intake-sweep')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
                <ThemedText type="linkPrimary">Go to Questions</ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {metIds.size} of {LEGEND_ROSTER.length} legends met
              </ThemedText>
              <View style={styles.tiles}>
                {LEGEND_HALLS.map((h) => (
                  <HallTile
                    key={h}
                    hall={h}
                    selected={hall === h}
                    met={metIds}
                    disabled={busyKey != null}
                    onPress={() => chooseHall(h)}
                  />
                ))}
              </View>

              {hall ? (
                <>
                  <View style={styles.hallHead}>
                    <MaterialCommunityIcons name={HALL_ICON[hall]} size={22} color={HALL_COLOR[hall]} />
                    <ThemedText type="heading" style={styles.flex}>
                      {HALL_LABEL[hall]}
                    </ThemedText>
                  </View>

                  {crisisToday ? null : (
                    <>
                      {showingChapters && framesLeft > 0 ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {HALL_CHAPTERS_COPY}
                        </ThemedText>
                      ) : null}
                      {framesLeft > 0 ? (
                        <View style={styles.frames}>
                          {frames.map((key, index) =>
                            key == null ? (
                              <View key={`empty-${index}`} style={styles.flex} />
                            ) : (
                              <LegendFrame
                                key={key}
                                hall={hall}
                                index={index}
                                total={frames.length}
                                chapter={showingChapters}
                                state={busyKey === key ? 'loading' : canReveal && !busyKey ? 'ready' : 'spent'}
                                onReveal={() => void reveal(key)}
                              />
                            ),
                          )}
                        </View>
                      ) : (
                        <ThemedText type="small" themeColor="textSecondary">
                          {hallDay?.chapters != null ? HALL_ALL_TOLD_COPY : HALL_EMPTY_COPY}
                        </ThemedText>
                      )}
                      {tokenNote ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {tokenNote}
                        </ThemedText>
                      ) : null}
                      {framesLeft > 0 ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {left > 0
                            ? `${revealedToday >= 1 ? LEGENDS_BONUS_COPY : LEGENDS_ONE_TODAY_COPY}${consentGranted ? ` ${legendsAiLine(tokens)}` : ''}`
                            : canPay
                              ? legendsPaidLine(tokens)
                              : `${LEGENDS_TOMORROW_COPY} ${AI_TOKENS_NEEDED}`}
                        </ThemedText>
                      ) : null}
                    </>
                  )}

                  {/* A legend met in this hall opens under its own name, below. */}
                  {openId && !hallMet.some((legend) => legend.id === openId) ? card : null}

                  {hallMet.length > 0 ? (
                    <>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.heading}>
                        Met in this hall · {hallMet.length}/{legendsInHall(hall).length}
                      </ThemedText>
                      {/* Names up to the open one, its card, then the rest: the card sits
                          right under its name but OUTSIDE the wrapping row (text inside a
                          wrap row is measured too wide on iOS and gets clipped). */}
                      {(() => {
                        const split = hallMet.findIndex((legend) => legend.id === openId) + 1;
                        const groups = split > 0 ? [hallMet.slice(0, split), hallMet.slice(split)] : [hallMet];
                        const chip = (legend: (typeof hallMet)[number]) => (
                          <Pressable
                            key={legend.id}
                            onPress={() => openLegend(legend.id)}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: openId === legend.id }}
                            style={({ pressed }) => [
                              styles.metChip,
                              { borderColor: HALL_COLOR[hall] },
                              pressed && styles.pressed,
                            ]}>
                            <ThemedText type="small">{legendTitle(legend)}</ThemedText>
                          </Pressable>
                        );
                        return groups.map((group, index) => (
                          <Fragment key={`group-${index}`}>
                            {group.length > 0 ? <View style={styles.metList}>{group.map(chip)}</View> : null}
                            {index === 0 && split > 0 ? card : null}
                          </Fragment>
                        ));
                      })()}
                    </>
                  ) : null}

                  {PRE_LAUNCH_DEV ? (
                    <View style={styles.placeholder}>
                      <LegendAiPlaceholder />
                      <ThemedText type="small" themeColor="textSecondary">
                        {AI_PLACEHOLDER_NOTE}
                      </ThemedText>
                    </View>
                  ) : null}
                </>
              ) : (
                card
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HallTile({
  hall,
  selected,
  met,
  disabled,
  onPress,
}: {
  hall: LegendHall;
  selected: boolean;
  met: ReadonlySet<string>;
  /** A story is being written: stay in this hall until it is saved. */
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const all = legendsInHall(hall);
  const metHere = all.filter((legend) => met.has(legend.id)).length;
  const color = HALL_COLOR[hall];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${HALL_LABEL[hall]}, ${metHere} of ${all.length} met`}
      disabled={disabled}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: selected ? `${color}22` : theme.backgroundElement,
          borderColor: selected ? color : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      <MaterialCommunityIcons name={HALL_ICON[hall]} size={22} color={color} />
      <ThemedText type="small" style={styles.tileLabel} numberOfLines={2}>
        {HALL_LABEL[hall]}
      </ThemedText>
      <View style={[styles.progress, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: color, width: `${all.length ? (metHere / all.length) * 100 : 0}%` },
          ]}
        />
      </View>
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
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31.5%',
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 4,
    justifyContent: 'space-between',
  },
  tileLabel: { lineHeight: 16 },
  hallHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.two },
  frames: { flexDirection: 'row', gap: 8 },
  progress: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  metList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  placeholder: { gap: 4, marginTop: Spacing.two },
});
