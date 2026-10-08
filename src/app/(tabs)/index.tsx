import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { CrisisCard } from '@/components/crisis-card';
import { Appear, SkeletonBar } from '@/components/motion';
import { ProgressRing, useRoundProgress } from '@/components/progress-ring';
import { ShapeEmptyCard } from '@/components/shape-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { TraitShape } from '@/components/trait-shape';
import { TodayPickCard } from '@/components/today-pick-card';
import { WeekStrip } from '@/components/week-strip';
import { IdentityTitleChip } from '@/components/identity-title-chip';
import { crisisNotedToday } from '@/lib/crisis/local-flag';
import { SageStoryFold } from '@/components/sage-story-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { useTheme } from '@/hooks/use-theme';
import { useDailyInsight } from '@/hooks/use-daily-insight';
import { useBuddyStreak } from '@/hooks/use-buddy-milestones';
import { useTodayLine } from '@/hooks/use-today-line';
import { clearLeans, lockScreenText } from '@/lib/daily-line/pick';
import { pickForYmd } from '@/lib/daily-pick/bank';
import { checkWindowFor } from '@/lib/check-window';
import { fetchHomeBootstrap } from '@/lib/home-bootstrap';
import { aiConsentFor, setAiConsent } from '@/lib/me';
import { AI_TAP_TIMEOUT_MS } from '@/lib/ai/generate';
import { withTimeout } from '@/lib/timeout';
import { useMeContext } from '@/lib/me-context';
import { homeSageLabel, homeSageLede } from '@/lib/sage-copy';
import { AiConsentCard, AI_USE_DISCLOSURE } from '@/components/ai-consent-card';
import { ideaForTitle, isBankInsightTitle, themeTags } from '@/lib/insight-bank';
import { draftFromPick, pickIdea, type IdeaDay } from '@/lib/insight-bank/pick';
import { TraitTagRow } from '@/components/trait-tag-row';
import { fetchInsightHistory, fetchTodayInsight, saveInsight } from '@/lib/insight/store';
import { fullProfileProgress, isFullProfileDone } from '@/lib/full-profile-gate';
import { cachedFromInsight, saveCachedInsight, writeWidgetLine } from '@/lib/insight/today-insight';
import type { TraitTrack } from '@/lib/trait-stability';
import { ATO_TOKEN_EARN } from '@/lib/ato-tokens';
import { hubAccess } from '@/lib/dev-access';
import { DEV_TOOLS_AVAILABLE, PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { recipeForAccount } from '@/lib/kenney/registry';
import {
  POLISH_COPY_REVIEWED,
  ROUND_RING_TITLE,
  roundRingLine,
  SEALED_READ_KICKER,
  SEALED_READ_LINE,
} from '@/lib/polish-copy';
import { traitShapePoints } from '@/lib/trait-shape';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { useSession } from '@/hooks/use-session';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { nextRoundLabel } from '@/lib/questions/staged-intake-copy';
import { ONGOING_ROUND_SIZE } from '@/lib/questions/tiered-axis-plan';

/** The tab's title, the same style as Explore and You. */
export const HOME_TITLE = 'Home';
export const INSIGHT_LOAD_LABEL = 'Load insight';
/** The history read is a nice-to-have: it must never hold up the insight. */
const INSIGHT_HISTORY_TIMEOUT_MS = 5000;
/** How many past rows (superseded ones included) the picker reads to keep its no-repeat window. */
const INSIGHT_HISTORY_ROWS = 90;
/** Under the sealed card: where today's focus comes from. */
export const INSIGHT_STORED_NOTE = 'Picked from your answers. Not written by AI.';
export const INSIGHT_UNAVAILABLE_COPY = 'Couldn’t load it just now — tap to try again.';
export const ANSWER_QUESTIONS_LABEL = 'Answer the questions';
/** Shown on an insight that is not today's (it stays up until today's is loaded). */
export const INSIGHT_EARLIER_DAY_COPY = 'From an earlier day. Load insight picks today’s.';
/** Home's one next step once the profile is done and there is nothing to load. */
export const NEXT_ROUND_ROW_LABEL = nextRoundLabel(ONGOING_ROUND_SIZE);
export const NEXT_ROUND_ROW_COPY = `Each finished round sharpens your profile and earns ${ATO_TOKEN_EARN.ongoing_round_complete} ATO tokens.`;

/**
 * Home — two states and nothing else (ISOLATION_PLAN §7 Card C, emci 2026-09-15).
 *
 * BEFORE the full profile is done: the AI-use disclosure, the consent ask, and
 * one button into Questions. That is the whole screen. A brand-new account
 * lands here straight from register with an empty profile, so anything that
 * needs trait data would only render an empty state it cannot fix from here.
 *
 * AFTER it is done: the same disclosure and consent, plus the two things the
 * profile unlocks — "Load insight" and the Story fold. Both are taps. No model
 * call fires on mount anywhere on this screen (`check:no-auto-ai` enforces it).
 *
 * PARKED in this pass, per the clean-slate rebuild: the daily Check log/skip
 * row, the missed-Check card, Reveal, Ask, past Story reveals (RollHistoryFold),
 * the "This week" row and the Category teaser. `record_check` now has no client
 * caller at all — knowingly (§0 decision 1); the Check loop returns when it is
 * rebuilt. `CrisisCard` is NOT parked (§0 decision 3) and renders in both
 * states: it is a static safety surface with no model call behind it.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe, devAccess } = useMeContext();
  const devUnlocked = useDevAccessUnlocked();
  const { insight: cachedInsight, reload: reloadInsight } = useDailyInsight(userId);
  // Old AI-written insights are hidden everywhere (emci, 2026-10-07): only a
  // row whose focus is in the stored bank is shown. Nothing is deleted.
  const insight = cachedInsight && isBankInsightTitle(cachedInsight.title) ? cachedInsight : null;
  const params = useLocalSearchParams<{ focus?: string }>();
  const [busy, setBusy] = useState<'consent' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crisisToday, setCrisisToday] = useState(false);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  // Whose `tracks` these are. Tabs stay mounted, so for one render after an
  // account switch `tracks` still belongs to the previous account.
  const [tracksUserId, setTracksUserId] = useState<string | null>(null);
  // Set once the first home_bootstrap fetch settles, success or failure. It
  // stops the gate judging completeness off an empty `tracks`; it does NOT by
  // itself distinguish "not finished" from "not loaded" — `bootstrapFailed`
  // below is what does that.
  const [bootstrapReady, setBootstrapReady] = useState(false);
  // A FAILED bootstrap is not an unfinished profile. Without this, a cold open
  // with no network settled `bootstrapReady` on an empty `tracks`, and Home
  // told someone who had answered all 50 questions "0 of 50" for the rest of
  // the session — hiding their cached insight behind the locked state while
  // the home-screen widget still showed it (found in review).
  const [bootstrapFailed, setBootstrapFailed] = useState(false);

  /**
   * One round trip for trait tracks + crisis flags (wave35 `home_bootstrap`).
   *
   * NARROWED (§2.1): the RPC still returns `checks` and its shape is untouched,
   * but Home no longer reads that field — the Check row it fed is parked. What
   * is still consumed is `tracks` (the unlock gate, Insight, Story) and the
   * crisis flag (CrisisCard).
   */
  const timeZone = me?.timezone || 'UTC';
  /**
   * Both refs exist because this now runs on every focus rather than once on
   * mount, which turns two harmless cold-open behaviours into mid-session bugs.
   *
   * `loadedOnceRef` — a failed refetch must not throw a user who already has
   * good `tracks` into the "couldn't load" state. At cold open that state is the
   * honest answer; on a refocus blip it would replace a working screen.
   *
   * `requestIdRef` — two quick focuses can resolve out of order and let an older
   * response overwrite a newer one, which is the same stale-tracks class of bug
   * this whole change is fixing. Only the newest request may write.
   */
  const loadedOnceRef = useRef(false);
  const requestIdRef = useRef(0);
  const reloadHome = useCallback(async () => {
    if (!userId || !me) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const next = await fetchHomeBootstrap(timeZone);
      if (requestId !== requestIdRef.current) return;
      loadedOnceRef.current = true;
      setTracks(next.tracks);
      setTracksUserId(userId);
      // Server flag OR the on-device one (crisis/local-flag.ts): the server table
      // has no writer since Talk was removed, so the local signal is what can
      // actually raise the card today.
      const crisisLocal = await crisisNotedToday();
      if (requestId !== requestIdRef.current) return;
      setCrisisToday(next.crisisToday || crisisLocal);
      setBootstrapFailed(false);
    } catch (err) {
      console.log('[home] bootstrap error:', err);
      if (requestId !== requestIdRef.current) return;
      if (!loadedOnceRef.current) setBootstrapFailed(true);
      // Safety does not wait for the network.
      if (await crisisNotedToday()) setCrisisToday(true);
    } finally {
      if (requestId === requestIdRef.current) setBootstrapReady(true);
    }
  }, [userId, me, timeZone]);

  useEffect(() => {
    // A new account starts from nothing: the old account's "we have data"
    // and in-flight request must not carry over.
    loadedOnceRef.current = false;
    requestIdRef.current += 1;
    setBootstrapReady(false);
    setBootstrapFailed(false);
  }, [userId]);

  /**
   * Refetch on FOCUS, not on mount.
   *
   * Questions (`(tabs)/intake-sweep.tsx`) is a sibling tab route, and expo-router
   * keeps tab screens mounted — so answering the last bank question there never
   * remounted Home, Home never refetched `tracks`, and `fullProfileDone` stayed
   * stuck on the stale locked value until the app was restarted. That is the
   * whole bug: the gate was right, the data behind it was old.
   *
   * `useFocusEffect` covers the mount case too (Home is the first tab, so first
   * focus is mount) and re-runs when `reloadHome`'s identity changes while
   * focused, exactly as the mount effect did — so this replaces it rather than
   * adding a second fetch. `fetchHomeBootstrap` is one RPC read; it spends no
   * model call, so a refetch per focus stays free (Card B).
   *
   * Deliberately does NOT reset `bootstrapReady`: flipping it false on focus
   * would make `isFullProfileDone` return false for the length of the fetch and
   * flash the locked state at a finished user every time they came back.
   */
  useFocusEffect(
    useCallback(() => {
      void reloadHome();
    }, [reloadHome]),
  );

  /**
   * `[]` for logged days, deliberately: only `todayYmd`/`todayDay` are used
   * from here (the insight is keyed by both), and those come from the signup
   * date and the timezone, not from any Check. The `open` slots this would
   * otherwise compute belonged to the parked Check row.
   */
  const window = me ? checkWindowFor(me, []) : null;

  // The ONE completeness signal every unlock in the app reads
  // (`lib/full-profile-gate.ts`, §7.1 decision 8). Do not re-derive it here.
  const profileProgress = useMemo(() => fullProfileProgress(tracks), [tracks]);
  const fullProfileDone = isFullProfileDone(tracks, bootstrapReady);

  /**
   * Today's written line (lib/daily-line). Picked on the device from the bank —
   * no model call, no consent needed — so it shows in every state below. A
   * failed profile load still shows a line, but does not store it as today's.
   */
  const todayYmd = window?.todayYmd;
  const { today: todayLine } = useTodayLine({
    userId,
    ymd: todayYmd,
    tracks,
    ready: bootstrapReady,
    // Only a pick made from THIS account's loaded profile becomes the day's line.
    persist: !bootstrapFailed && tracksUserId === userId,
  });
  // Today's pick replaced the line on Home; the line still runs underneath
  // (week, streak) and stays the insight's thread, so the prompt is unchanged.
  const todayPick = todayYmd ? pickForYmd(todayYmd) : null;
  // The mini guy who says the line (same recipe as the nav companion).
  const faceRecipe = useMemo(() => (me ? recipeForAccount(me.id, me.recipe) : undefined), [me]);
  // How far into the current round (one read, refreshed with the tracks).
  const roundAnswered = useRoundProgress(fullProfileDone ? userId : undefined, tracks);
  // 3 / 7 / 21 days in a row: the mini guy says it, once each.
  useBuddyStreak({ me, streak: todayLine?.streak, onPersisted: refreshMe });
  // Picks are written to be read by anyone, so the widget can show today's.
  const todayLineLockScreen = todayPick?.prompt ?? (todayLine ? lockScreenText(todayLine.line) : null);

  /**
   * AI consent gates GENERATION, not the screen. The daily insight is stored
   * copy now (emci, 2026-10-07), so it does not depend on the answer; Story
   * still does. Declined and not-yet-asked stay DIFFERENT states.
   */
  const consent = me ? aiConsentFor(me) : 'pending';
  const consentGranted = consent === 'granted';

  /**
   * TIMING, changed by emci 2026-09-15: the ask is now part of the FIRST thing
   * on Home, not something surfaced once the intake finishes. Under the new
   * flow the pre-profile screen is the consent approvals plus a button, so
   * waiting for `fullProfileDone` would leave a new account looking at an
   * empty Home. It is still inline, and it still blocks nothing.
   */
  const offerConsent = me != null && consent === 'pending';

  /**
   * "Load insight" — a TAP, never an effect (§7 Card B). Since 2026-10-07 the
   * insight is STORED copy (lib/insight-bank): the tap picks one Focus · try ·
   * watch idea on the device from this account's clear leans and saves it
   * through `insert_daily_insight`. No model call, no quota, no AI consent gate.
   *
   * The stored-first order is kept: today's row, if one exists and came from
   * the bank, is shown without picking again, so a second device agrees.
   */
  const generatingForYmd = useRef<string | null>(null);
  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'unavailable'>('idle');

  const loadInsight = useCallback(async () => {
    if (!me || !userId || !window) return;
    const { todayDay, todayYmd } = window;
    if (insight?.ymd === todayYmd) return;
    // Re-entrancy: a double tap must not save two rows.
    if (generatingForYmd.current === todayYmd) return;
    generatingForYmd.current = todayYmd;
    setInsightState('loading');

    try {
      const existing = await withTimeout(fetchTodayInsight(userId, todayYmd), AI_TAP_TIMEOUT_MS, 'insight-fetch');
      // An old AI-written row for today is not shown; a fresh pick supersedes it.
      if (existing && isBankInsightTitle(existing.title)) {
        await saveCachedInsight(cachedFromInsight(existing, userId));
        await reloadInsight();
        setInsightState('idle');
        return;
      }

      // Which ideas this account has already had. Best effort: without it the
      // pick still works, it just cannot keep its no-repeat window. Titles that
      // are not in the bank (old AI rows) are dropped here.
      const history: IdeaDay[] = await withTimeout(
        fetchInsightHistory(userId, INSIGHT_HISTORY_ROWS),
        INSIGHT_HISTORY_TIMEOUT_MS,
        'insight-history',
      )
        .then((rows) =>
          rows.flatMap((row) => {
            const match = ideaForTitle(row.title);
            return match ? [{ ymd: row.ymd, ideaId: match.idea.id }] : [];
          }),
        )
        .catch(() => [] as IdeaDay[]);

      const draft = draftFromPick(pickIdea({ userId, ymd: todayYmd, leans: clearLeans(tracks), history }));
      await saveInsight(draft, todayDay, todayYmd);
      await saveCachedInsight({
        userId,
        day: todayDay,
        ymd: todayYmd,
        theme: draft.theme,
        title: draft.title,
        reflection: draft.reflection,
        tryToday: draft.tryToday,
        watchFor: draft.watchFor,
      });
      await reloadInsight();
      setInsightState('idle');
    } catch (err) {
      console.log('[home] today insight error:', err);
      setInsightState('unavailable');
    } finally {
      // Cleared either way so a later tap can retry; a success has already set
      // `insight.ymd`, which short-circuits above.
      if (generatingForYmd.current === todayYmd) generatingForYmd.current = null;
    }
  }, [me, userId, window, insight?.ymd, tracks, reloadInsight]);

  // The widget shows today's insight once one is loaded; until then it shows
  // the written line, so it is never blank on a day the app was opened.
  useEffect(() => {
    if (!todayLineLockScreen || !todayYmd) return;
    if (insight?.ymd === todayYmd) return;
    writeWidgetLine(todayLineLockScreen);
  }, [todayLineLockScreen, insight?.ymd, todayYmd]);

  async function saveConsent(value: boolean) {
    if (!userId || !me || busy) return;
    setBusy('consent');
    setError(null);
    try {
      await setAiConsent(userId, value);
      await refreshMe();
    } catch (err) {
      console.log('[home] setAiConsent error:', err);
      setError('Couldn’t save your choice. Try again.');
    } finally {
      setBusy(null);
    }
  }

  // 'admin' (a release build, root only) still gets the link: Admin lives in the Hub.
  const canSeeHub =
    hubAccess({
      toolsAvailable: DEV_TOOLS_AVAILABLE,
      isDev: __DEV__ || devUnlocked,
      isRoot: devAccess.isRoot,
      capabilities: devAccess.capabilities,
    }) !== 'none';

  /*
    Kept in BOTH states, unlike everything else pre-profile: dev-lab is how the
    dev-test user's persona presets get applied, which is the only way to reach
    a finished profile without answering 50 questions by hand. Gated on dev
    access / __DEV__ exactly as before, so a real account never sees it.
  */
  const devBox =
    canSeeHub || __DEV__ ? (
      <ThemedView type="backgroundElement" style={styles.boxCard}>
        <ThemedText type="code" themeColor="textSecondary" style={styles.boxKicker}>
          dev
        </ThemedText>
        {canSeeHub ? (
          <Pressable
            onPress={() => router.push('/dev-lab')}
            style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
            <View style={styles.boxRowText}>
              <ThemedText type="smallBold">Dev Tools Hub</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Where this account is, jump, tests, admin
              </ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>
        ) : null}
        {__DEV__ ? (
          <>
            <Pressable
              onPress={() => router.push('/crisis-lab')}
              style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
              <View style={styles.boxRowText}>
                <ThemedText type="smallBold">Crisis card</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Dev: static, no model call
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => router.push('/pixel-lab')}
              style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
              <View style={styles.boxRowText}>
                <ThemedText type="smallBold">Pixel lab</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Dev: faces + growth tiers
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          </>
        ) : null}
      </ThemedView>
    ) : null;

  /*
    Apple 5.1.2: the AI-use disclosure is UNCONDITIONAL. It renders before the
    question is asked, after a yes, and after a no alike — only generation
    depends on the answer, never disclosure. It sits outside AiConsentCard on
    purpose, because that card disappears the moment the question is answered.

    The first-time ask stays here. The on/off switch that used to sit under it
    after an answer is gone from Home (emci, 2026-10-04: it is already on You,
    under "Sage's AI"): the server refuses every AI call while consent is off
    (ai-generate), and You is where it is turned back on or off.
  */
  /*
    Today's Pick (emci, 2026-10-05) replaces the daily line card: one
    either/or question a day, the same for everyone, one tap. The week strip
    moved to the very top of Home (emci, 2026-10-07).
  */
  const pickBlock =
    me && todayYmd && userId ? (
      <>
        <Appear>
          <TodayPickCard
            userId={userId}
            ymd={todayYmd}
            me={me}
            face={faceRecipe}
            onAnswered={() => {
              void reloadHome();
            }}
          />
        </Appear>
      </>
    ) : null;

  const consentBlock = (
    <>
      <ThemedText type="small" themeColor="textSecondary" style={styles.aiDisclosure}>
        {AI_USE_DISCLOSURE}
      </ThemedText>
      {offerConsent ? (
        <AiConsentCard
          context="home"
          busy={busy === 'consent'}
          onGrant={() => saveConsent(true)}
          onDeny={() => saveConsent(false)}
        />
      ) : null}
      {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never">
          {/* The "Home" title, like Explore and You (emci, 2026-10-07), with the
              coach disclosure as one small line under it: the Story on Home is
              Sage, so Home still says Sage is a coach. */}
          <View style={styles.header}>
            <ThemedText type="subtitle">{HOME_TITLE}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {params.focus === 'check' ? 'Check today.' : homeSageLede(theme.id)}
            </ThemedText>
          </View>

          {/* "This week" right under the title, above every card (emci, 2026-10-07). */}
          {me && todayYmd && todayLine ? (
            <Appear>
              <WeekStrip userId={me.id} todayYmd={todayYmd} refreshKey={todayLine} />
            </Appear>
          ) : null}

          {/* Safety first, in both states, and never generated. */}
          {crisisToday ? <CrisisCard /> : null}

          {/* The name you've earned — tap for the card and the styles on You. */}
          {me && tracksUserId === me.id ? <IdentityTitleChip userId={me.id} tracks={tracks} /> : null}

          {/* Before the profile is done (or if it failed to load) there is no
              Story or insight yet, so Today's Pick comes right after the name. */}
          {bootstrapFailed || !fullProfileDone ? pickBlock : null}

          {bootstrapFailed ? (
            /*
              The honest third state. Not State 1: we do not know whether the
              profile is finished, so claiming it is not would be a lie, and
              the retry has to be reachable.
            */
            <>
              {/* The disclosure and the consent ask are unconditional (Apple
                  5.1.2) — a failed fetch is not a reason to drop them. */}
              {consentBlock}
              <ThemedView type="backgroundElement" style={styles.todayCard}>
                <ThemedText type="smallBold">Couldn&apos;t load your profile</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Nothing is lost — this is just a connection problem.
                </ThemedText>
              </ThemedView>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={() => {
                  void reloadHome();
                }}
                style={({ pressed }) => [
                  styles.answerQuestionsRow,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Try again</ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            </>
          ) : !fullProfileDone ? (
            /*
              STATE 1 — before the profile is done. Consent, and one way
              forward. Nothing here reads trait data, because there isn't any
              yet, and nothing here can spend a model call.
            */
            <>
              {consentBlock}
              {/* Nothing answered yet: the blank shape and one way in. */}
              {bootstrapReady && profileProgress.answered === 0 ? <ShapeEmptyCard /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ANSWER_QUESTIONS_LABEL}
                onPress={() => router.push('/intake-sweep')}
                style={({ pressed }) => [
                  styles.answerQuestionsRow,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                {me && profileProgress.answered > 0 ? (
                  <TraitShape points={traitShapePoints(me, tracks)} size={52} />
                ) : null}
                <View style={[styles.boxRowText, styles.flexText]}>
                  <ThemedText type="smallBold">{ANSWER_QUESTIONS_LABEL}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {profileProgress.answered} of {profileProgress.total} done. Finish all{' '}
                    {profileProgress.total} to unlock Load insight, Load story, the next{' '}
                    {ONGOING_ROUND_SIZE} questions and Explore categories.
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            </>
          ) : (
            /*
             * STATE 2 — unlocked. emci's order (2026-10-05): Story, then the
             * insight (or its sealed card), then Today's Pick and the week, then
             * the next round.
             */
            <>
              {me ? (
                <SageStoryFold
                  me={me}
                  tracks={tracks}
                  tracksReady={bootstrapReady}
                  crisisToday={crisisToday}
                  unlocked={fullProfileDone}
                  consentGranted={consentGranted}
                />
              ) : null}

              {insight ? (
                /*
                 * One card, one hierarchy. The focus is the hero — the line a
                 * person actually carries with them. Why sits under it as
                 * context, then Try / Watch are the two quieter lines under a
                 * hairline. Stored copy (lib/insight-bank), so no AI badge.
                 *
                 * The kicker, then ONE chip row built from the stored theme:
                 * that row is the trait tag. Never a second tag or label.
                 */
                <ThemedView type="backgroundElement" style={styles.heroCard}>
                  <ThemedText type="code" themeColor="textSecondary" style={styles.sageKicker}>
                    {homeSageLabel(theme.id)}
                  </ThemedText>
                  <TraitTagRow tags={themeTags(insight.theme)} />
                  {/* An earlier day's insight stays up until today's is loaded, so Home is
                      never an empty card — and says plainly that it is not today's. */}
                  {insight.ymd !== window?.todayYmd ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {INSIGHT_EARLIER_DAY_COPY}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.heroRead}>{insight.title}</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.reflectionText}>
                    {insight.reflection}
                  </ThemedText>

                  <View
                    style={[styles.heroDivider, { backgroundColor: controlBorderColor(theme) }]}
                  />

                  <View style={styles.doBlock}>
                    <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                      try today
                    </ThemedText>
                    <ThemedText style={styles.doText}>{insight.tryToday}</ThemedText>
                  </View>

                  <View style={styles.doBlock}>
                    <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                      watch for
                    </ThemedText>
                    <ThemedText style={styles.doText}>{insight.watchFor}</ThemedText>
                  </View>
                </ThemedView>
              ) : null}

              {/*
                Shown when today's insight is not on screen yet. The tap picks
                from the stored bank: no model call, so no consent needed.
              */}
              {insight?.ymd !== window?.todayYmd ? (
                /*
                 * Today's read, sealed (polish pass, 2026-10-05). While the
                 * pick is saved, the card shows a skeleton.
                 */
                <ThemedView type="backgroundElement" style={styles.sealedCard}>
                  <View
                    pointerEvents="none"
                    style={[styles.sealedCorner, { borderTopColor: theme.backgroundSelected }]}
                  />
                  <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                    {SEALED_READ_KICKER}
                  </ThemedText>
                  {insightState === 'loading' ? (
                    <View style={styles.sealedSkeleton} accessibilityLabel="Loading">
                      <SkeletonBar width="90%" />
                      <SkeletonBar width="70%" />
                      <SkeletonBar width="45%" />
                    </View>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.sealedLine}>
                      {insightState === 'unavailable' ? INSIGHT_UNAVAILABLE_COPY : SEALED_READ_LINE}
                    </ThemedText>
                  )}
                  <ThemedPressable
                    filled
                    accessibilityRole="button"
                    accessibilityLabel={INSIGHT_LOAD_LABEL}
                    disabled={insightState === 'loading'}
                    onPress={() => {
                      void loadInsight();
                    }}
                    style={[
                      styles.sealedButton,
                      { borderRadius: theme.cutCorners ? 0 : 999 },
                      insightState === 'loading' && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" themeColor="onAccent">
                      {insightState === 'loading'
                        ? 'Loading…'
                        : insightState === 'unavailable'
                          ? 'Try again'
                          : INSIGHT_LOAD_LABEL}
                    </ThemedText>
                  </ThemedPressable>
                  <ThemedText type="small" themeColor="textSecondary">
                    {INSIGHT_STORED_NOTE}
                  </ThemedText>
                  {!POLISH_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
                    <ThemedText type="code" themeColor="textSecondary">
                      Draft copy — waiting on emci review.
                    </ThemedText>
                  ) : null}
                </ThemedView>
              ) : null}

              {pickBlock}

              {/* The next step when there is nothing to load: the round ring. */}
              {insight?.ymd === window?.todayYmd ? (
                /*
                   * ONE next step. When there is nothing to load (today's insight is
                   * up, or AI is off), the step is the next round of questions —
                   * never both rows at once. No model call: it only opens Questions.
                   * The ring is how far into the current round of 16 (one read).
                   */
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={NEXT_ROUND_ROW_LABEL}
                    onPress={() => router.push('/intake-sweep')}
                    style={({ pressed }) => [
                      styles.answerQuestionsRow,
                      { borderColor: controlBorderColor(theme) },
                      pressed && styles.pressed,
                    ]}>
                    <ProgressRing value={roundAnswered ?? 0} total={ONGOING_ROUND_SIZE} />
                    <View style={[styles.boxRowText, styles.flexText]}>
                      <ThemedText type="smallBold">
                        {roundAnswered ? ROUND_RING_TITLE : NEXT_ROUND_ROW_LABEL}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {roundAnswered
                          ? roundRingLine(ONGOING_ROUND_SIZE - roundAnswered)
                          : NEXT_ROUND_ROW_COPY}
                      </ThemedText>
                    </View>
                    <ThemedText themeColor="textSecondary">›</ThemedText>
                  </Pressable>
              ) : null}

              {consentBlock}
            </>
          )}

          {devBox}
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  todayCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  heroCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  heroRead: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '500',
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.three,
    opacity: 0.7,
  },
  doBlock: {
    gap: Spacing.half,
  },
  doText: {
    lineHeight: 24,
  },
  reflectionText: {
    lineHeight: 24,
    paddingTop: Spacing.one,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  sageKicker: {
    textTransform: 'none',
  },
  boxCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  boxKicker: {
    textTransform: 'uppercase',
    paddingBottom: Spacing.one,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
  },
  aiDisclosure: {
    textAlign: 'center',
    opacity: 0.85,
  },
  answerQuestionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
  },
  boxRowText: {
    gap: Spacing.half,
  },
  flexText: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  sealedCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  sealedCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 36,
    borderLeftWidth: 36,
    borderLeftColor: 'transparent',
  },
  sealedLine: {
    lineHeight: 24,
    paddingRight: Spacing.five,
  },
  sealedSkeleton: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  sealedButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
