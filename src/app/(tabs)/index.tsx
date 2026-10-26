import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Appear } from '@/components/motion';
import { ProgressRing, useRoundProgress } from '@/components/progress-ring';
import { ShapeEmptyCard } from '@/components/shape-card';
import { TraitShape } from '@/components/trait-shape';
import { TodayPickCard } from '@/components/today-pick-card';
import { WeekStrip } from '@/components/week-strip';
import { IdentityTitleChip } from '@/components/identity-title-chip';
import { DailyCheckinCard } from '@/components/daily-checkin-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { useTheme } from '@/hooks/use-theme';
import { useBuddyStreak } from '@/hooks/use-buddy-milestones';
import { useTryToday } from '@/hooks/use-try-today';
import { useTodayLine } from '@/hooks/use-today-line';
import { lockScreenText } from '@/lib/daily-line/pick';
import { pickForYmd } from '@/lib/daily-pick/bank';
import { checkWindowFor } from '@/lib/check-window';
import { fetchHomeBootstrap } from '@/lib/home-bootstrap';
import { aiConsentFor, setAiConsent } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { homeSageLede } from '@/lib/sage-copy';
import { AiConsentCard, AI_USE_DISCLOSURE } from '@/components/ai-consent-card';
import { dailyInsightsVisible } from '@/lib/daily-insights';
import { fullProfileProgress, isFullProfileDone } from '@/lib/full-profile-gate';
import { writeWidgetLine } from '@/lib/insight/today-insight';
import type { TraitTrack } from '@/lib/trait-stability';
import { ATO_TOKEN_EARN, atoTokenBalanceOf } from '@/lib/ato-tokens';
import { recipeForAccount } from '@/lib/kenney/registry';
import { ROUND_RING_TITLE, roundRingLine } from '@/lib/polish-copy';
import { traitShapePoints } from '@/lib/trait-shape';
import { useSession } from '@/hooks/use-session';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { nextRoundLabel } from '@/lib/questions/staged-intake-copy';
import { ONGOING_ROUND_SIZE } from '@/lib/questions/tiered-axis-plan';

/** The tab's title, the same style as Explore and You. */
export const HOME_TITLE = 'Home';
export const ANSWER_QUESTIONS_LABEL = 'Answer the questions';
/** Home's one way into Insights (emci 2026-10-14). */
export const SEE_INSIGHTS_LABEL = 'See today’s Insights →';
export const SEE_INSIGHTS_COPY = 'Try this today, your focus, the Story and more.';
/** Home's one next step once the profile is done and there is nothing to load. */
export const NEXT_ROUND_ROW_LABEL = nextRoundLabel(ONGOING_ROUND_SIZE);
export const NEXT_ROUND_ROW_COPY = `Each finished round sharpens your profile and earns ${ATO_TOKEN_EARN.ongoing_round_complete} ATO tokens.`;

/**
 * Home — two states and nothing else (ISOLATION_PLAN §7 Card C, emci 2026-09-15).
 *
 * BEFORE the full profile is done: the AI-use disclosure, the consent ask, and
 * one button into Questions. That is the whole screen.
 *
 * AFTER it is done (emci 2026-10-14): Today's Pick, the week, the daily
 * check-in, the next round and one "See today's Insights →" link. Today's
 * focus and the Story moved to Insights. No model call fires on mount anywhere
 * on this screen (`check:no-auto-ai` enforces it).
 *
 * PARKED in this pass, per the clean-slate rebuild: the daily Check log/skip
 * row, the missed-Check card, Reveal, Ask and the Category teaser (its slot is
 * kept: `today-slot.ts`). The crisis card was removed with the crisis system
 * (2026-10-14); the helpline lives as a static row on You.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe } = useMeContext();
  const params = useLocalSearchParams<{ focus?: string }>();
  const [busy, setBusy] = useState<'consent' | null>(null);
  const [error, setError] = useState<string | null>(null);
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
   * One round trip for trait tracks (wave35 `home_bootstrap`).
   *
   * NARROWED (§2.1): the RPC still returns `checks` (and, until wave103, an
   * ignored leftover field), but Home reads only `tracks` (the unlock gate and the
   * 🎯 pick behind the widget).
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
      setBootstrapFailed(false);
    } catch (err) {
      console.log('[home] bootstrap error:', err);
      if (requestId !== requestIdRef.current) return;
      if (!loadedOnceRef.current) setBootstrapFailed(true);
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
   * `[]` for logged days, deliberately: only `todayYmd` is used from here, and
   * it comes from the profile timezone, not from any Check. The `open` slots
   * this would otherwise compute belonged to the parked Check row.
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
   * AI consent gates GENERATION, not the screen. Nothing on Home or Insights
   * is AI-written; the answer matters for Legends cards and category deep
   * dives only. Declined and not-yet-asked stay DIFFERENT states.
   */
  const consent = me ? aiConsentFor(me) : 'pending';

  /**
   * TIMING, changed by emci 2026-09-15: the ask is now part of the FIRST thing
   * on Home, not something surfaced once the intake finishes. Under the new
   * flow the pre-profile screen is the consent approvals plus a button, so
   * waiting for `fullProfileDone` would leave a new account looking at an
   * empty Home. It is still inline, and it still blocks nothing.
   */
  const offerConsent = me != null && consent === 'pending';

  /**
   * 🎯 Try this today, run here too (not shown) so the home-screen widget gets
   * today's line even when Insights is never opened. Same stored day and keys
   * as Insights (`lib/daily-insights/store.ts`), so both agree.
   */
  const tryToday = useTryToday({
    userId: userId ?? '',
    timeZone: me?.timezone,
    tracks,
    tracksReady: bootstrapReady && !bootstrapFailed && tracksUserId === userId,
    touched: me?.trait_touched_at,
    enabled: !!userId && fullProfileDone && dailyInsightsVisible({ slotKind: 'none' }),
  });

  // The widget leads with 🎯 Try this today (`useTryToday` writes it). Until a
  // try line exists for today (an unfinished profile), it shows the written
  // line, so it is never blank on a day the app was opened.
  useEffect(() => {
    if (!todayLineLockScreen || !todayYmd) return;
    if (tryToday.pick?.dateKey === todayYmd) return;
    writeWidgetLine(todayLineLockScreen, todayYmd);
  }, [todayLineLockScreen, todayYmd, tryToday.pick?.dateKey]);

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

  /*
    The dev rows (Dev Tools Hub, Pixel lab) moved to /settings under Developer
    (IA phase P1); they keep the same hubAccess / __DEV__ gates there.
  */

  /*
    Apple 5.1.2: the AI-use disclosure is UNCONDITIONAL. It renders before the
    question is asked, after a yes, and after a no alike — only generation
    depends on the answer, never disclosure. It sits outside AiConsentCard on
    purpose, because that card disappears the moment the question is answered.

    The first-time ask stays here. The on/off switch that used to sit under it
    after an answer is gone from Home (emci, 2026-10-04: it now lives in
    Settings > Privacy & AI): the server refuses every AI call while consent is off,
    and Settings is where it is turned back on or off.
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
          {/* The "Home" title, like Explore and You (emci, 2026-10-07), with one
              small line under it. */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <ThemedText type="subtitle">{HOME_TITLE}</ThemedText>
              {/* Settings live on their own screen (IA phase P1). */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={8}
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.gearButton, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="cog-outline" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
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
                    {profileProgress.total} to unlock Insights, the next{' '}
                    {ONGOING_ROUND_SIZE} questions and Explore categories.
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            </>
          ) : (
            /*
             * STATE 2 — unlocked (emci 2026-10-14): the check-in, the way into
             * Insights, Today's Pick, then the next round. Today's focus and the
             * Story live on Insights now.
             */
            <>
              {/* Daily check-in (wave92): +5 ATO tokens a day, which pay for AI views. */}
              {me && todayYmd ? (
                <DailyCheckinCard todayYmd={todayYmd} tokens={atoTokenBalanceOf(me)} onEarned={() => void refreshMe()} />
              ) : null}
              {/* One way into Insights (emci 2026-10-14): Try this today, the
                  focus, the Story, Superpower / Kryptonite, How you argue. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={SEE_INSIGHTS_LABEL}
                testID="home-see-insights"
                onPress={() => router.push('/insights')}
                style={({ pressed }) => [
                  styles.answerQuestionsRow,
                  { borderColor: controlBorderColor(theme) },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.boxRowText, styles.flexText]}>
                  <ThemedText type="smallBold">{SEE_INSIGHTS_LABEL}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {SEE_INSIGHTS_COPY}
                  </ThemedText>
                </View>
              </Pressable>

              {pickBlock}

              {/* The next step: the round ring. No model call: it only opens
                  Questions. The ring is how far into the current round (one read). */}
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
                    {roundAnswered ? roundRingLine(ONGOING_ROUND_SIZE - roundAnswered) : NEXT_ROUND_ROW_COPY}
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>

              {consentBlock}
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  gearButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  pressed: {
    opacity: 0.7,
  },
});
