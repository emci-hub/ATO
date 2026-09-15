import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { MissedCheckCard } from '@/components/missed-check-card';
import AskSheet from '@/components/ask-sheet';
import { CrisisCard } from '@/components/crisis-card';
import { CategoryTeaser } from '@/components/category-teaser';
import { RevealCard, isRevealOpenedToday } from '@/components/reveal-card';
import { RollHistoryFold } from '@/components/roll-history-fold';
import { SageStoryFold } from '@/components/sage-story-fold';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { useTheme } from '@/hooks/use-theme';
import { useGrowth } from '@/hooks/use-growth';
import { useDailyInsight } from '@/hooks/use-daily-insight';
import { checkWindowFor } from '@/lib/check-window';
import { checksToHistory, recordCheck, type Check } from '@/lib/checks';
import { emitChecksChanged, onChecksChanged } from '@/lib/checks-events';
import { fetchHomeBootstrap } from '@/lib/home-bootstrap';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { aiConsentFor, setAiConsent } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { resolveAsk, type AskPick } from '@/lib/ask';
import { readAskOverride, readSlotOverride } from '@/lib/dev-overrides';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { weekdayInZone } from '@/lib/local-date';
import { homeSageLabel, homeSageLede, SAGE_COACH_LABEL } from '@/lib/sage-copy';
import { AiConsentCard, AI_USE_DISCLOSURE } from '@/components/ai-consent-card';
import { generateDailyInsight } from '@/lib/insight/generate-insight';
import { fetchTodayInsight, saveInsight } from '@/lib/insight/store';
import { fullProfileProgress, isFullProfileDone } from '@/lib/full-profile-gate';
import { cachedFromInsight, saveCachedInsight } from '@/lib/insight/today-insight';
import { resolveReveal } from '@/lib/reveal';
import { RANKING_ROUNDS } from '@/lib/ranking';
import { composeSageKnowsLine, parseSageKnowsState } from '@/lib/sage-knows';
import { SCENARIO_DECK } from '@/lib/scenario';
import { resolveTodaySlot, canShowCategoryTeaser, type TodaySlot } from '@/lib/today-slot';
import { traitStateFromRow, TRAIT_POLE_LINES } from '@/lib/traits';
import type { TraitTrack } from '@/lib/trait-stability';
import { canSeeDevLab } from '@/lib/dev-access';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { useSession } from '@/hooks/use-session';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';

export const INSIGHT_LOAD_LABEL = 'Load insight';
export const INSIGHT_UNAVAILABLE_COPY = 'Couldn’t write one just now. Try again later.';

function fixtureAskPick(kind: AskPick['kind']): AskPick {
  if (kind === 'sage_knows') {
    return {
      kind: 'sage_knows',
      prompt: {
        axis: 'extraversion',
        ...composeSageKnowsLine(TRAIT_POLE_LINES.extraversion.high, null),
      },
    };
  }
  if (kind === 'ranking') {
    return {
      kind: 'ranking',
      prompt: {
        axis: 'extraversion',
        items: RANKING_ROUNDS.extraversion,
        order: RANKING_ROUNDS.extraversion.map((item) => item.id),
        weekKey: 'dev',
      },
    };
  }
  return {
    kind: 'scenario',
    prompt: {
      axis: 'locus_of_control',
      def: SCENARIO_DECK.locus_of_control,
      weekKey: 'dev',
    },
  };
}

export default function HomeScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe, devAccess } = useMeContext();
  const devUnlocked = useDevAccessUnlocked();
  const { insight, reload: reloadInsight } = useDailyInsight(userId);
  const { state: growth } = useGrowth();
  const params = useLocalSearchParams<{ focus?: string }>();
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState<'log' | 'skip' | 'consent' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crisisToday, setCrisisToday] = useState(false);
  const [crisisYesterday, setCrisisYesterday] = useState(false);
  const [askOverride, setAskOverride] = useState<AskPick['kind'] | null>(null);
  const [slotOverride, setSlotOverride] = useState<TodaySlot['kind'] | null>(null);
  const [noteOpenedToday, setNoteOpenedToday] = useState(false);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  // Set once the first home_bootstrap fetch settles, success or failure — the
  // Story fold's own tracksReady prop needs this to avoid flashing its
  // locked state before tracks have actually loaded (same class of flash
  // bug fixed on Legends/Roll).
  const [bootstrapReady, setBootstrapReady] = useState(false);

  /**
   * One round trip for checks + trait tracks + crisis flags (wave35
   * `home_bootstrap`). These were three separate queries on every mount, so a
   * cold Home waited on three sequential requests before it settled.
   */
  const timeZone = me?.timezone || 'UTC';
  const reloadHome = useCallback(async () => {
    if (!userId || !me) return;
    try {
      const next = await fetchHomeBootstrap(timeZone);
      setChecks(next.checks);
      setTracks(next.tracks);
      setCrisisToday(next.crisisToday);
      setCrisisYesterday(next.crisisYesterday);
    } catch (err) {
      console.log('[home] bootstrap error:', err);
    } finally {
      setBootstrapReady(true);
    }
  }, [userId, me, timeZone]);

  // Reset (not just set) on a user change specifically — reloadHome also
  // re-runs on every logged check via onChecksChanged below, and resetting
  // there too would flash the Story lock on every ordinary check-in.
  useEffect(() => {
    setBootstrapReady(false);
  }, [userId]);

  useEffect(() => {
    void reloadHome();
    // A logged check changes counts, tracks and (rarely) crisis state, so the
    // same payload is what a refresh needs.
    return onChecksChanged(() => {
      void reloadHome();
    });
  }, [reloadHome]);

  const window = me
    ? checkWindowFor(
        me,
        checks.map((check) => check.day),
      )
    : null;
  const todayOpen = window?.open.find((slot) => slot.offset === 0) ?? null;
  const missedOpen = window?.open.filter((slot) => slot.offset > 0) ?? [];
  const oldestMissed = missedOpen[0] ?? null;
  const alreadyLogged =
    window != null && checks.some((check) => check.day === window.todayDay);

  // The 50-question bank is local and needs no AI/consent. Both values come
  // from `lib/full-profile-gate` — the ONE completeness signal every unlock in
  // the app reads (ISOLATION_PLAN §7.1 decision 8). Do not re-derive it here.
  const profileProgress = useMemo(() => fullProfileProgress(tracks), [tracks]);
  const fullProfileDone = isFullProfileDone(tracks, bootstrapReady);

  /**
   * AI consent gates GENERATION, not the screen (2026-09-15, emci correction).
   *
   * With no dedicated Sage-talk screen built yet, the daily insight is one of
   * the app's three real AI touchpoints, so it needs consent before it calls a
   * model. Nothing else on Home is gated: the Check logs, the question bank
   * opens, and every route stays reachable whatever the answer is.
   *
   * Declined and not-yet-asked stay DIFFERENT states. Collapsing them is what
   * once left a fresh account (ai_consent null) with no insight and no prompt.
   */
  const consent = me ? aiConsentFor(me) : 'pending';
  const consentGranted = consent === 'granted';
  const consentOffEmpty = consent === 'denied';

  /**
   * Timing (emci, 2026-09-15): ask at the moment the 50-question intake
   * finishes, which is the first point an AI feature has a full profile to
   * generate from. Deliberately NOT an early blocking modal — it is an inline
   * card below the day's content, and it blocks nothing while unanswered.
   */
  const offerConsent = me != null && consent === 'pending' && fullProfileDone;

  const reveal = useMemo(() => {
    if (!me) return null;
    return resolveReveal({
      checks,
      facts: me.facts ?? [],
      checkCount: growth.checkCount,
      factCount: growth.factCount,
      timeZone: me.timezone || 'UTC',
      crisisToday,
      crisisYesterday,
    });
  }, [me, checks, crisisToday, crisisYesterday, growth.checkCount, growth.factCount]);

  useEffect(() => {
    if (!PRE_LAUNCH_DEV) return;
    let cancelled = false;
    void Promise.all([readAskOverride(), readSlotOverride()]).then(([askKind, nextSlot]) => {
      if (cancelled) return;
      setAskOverride(askKind);
      setSlotOverride(nextSlot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !me) {
        setNoteOpenedToday(false);
        return;
      }
      let cancelled = false;
      void isRevealOpenedToday(userId, me.timezone || 'UTC').then((opened) => {
        if (!cancelled) setNoteOpenedToday(opened);
      });
      return () => {
        cancelled = true;
      };
    }, [userId, me]),
  );

  const liveAsk = useMemo(() => {
    if (!me) return null;
    const traits = traitStateFromRow(me);
    return resolveAsk({
      values: traits.values,
      touched: traits.touched,
      knows: parseSageKnowsState(me.sage_knows),
      knocksYouOff: me.knocks_you_off ?? '',
      facts: me.facts ?? [],
      history: checksToHistory(checks),
      now: new Date(),
      timeZone: me.timezone || 'UTC',
    });
  }, [me, checks]);

  const askPick = askOverride ? fixtureAskPick(askOverride) : liveAsk;

  const slotKind = useMemo(() => {
    const resolved = resolveTodaySlot({
      crisisActive: crisisToday,
      missedCheck: missedOpen.length > 0,
      noteAvailable: reveal !== null,
      noteOpenedToday,
      askPending: liveAsk !== null,
      isSunday: weekdayInZone(new Date(), me?.timezone || 'UTC') === 0,
    }).kind;
    if (PRE_LAUNCH_DEV && slotOverride) return slotOverride;
    return resolved;
  }, [
    crisisToday,
    missedOpen.length,
    reveal,
    noteOpenedToday,
    liveAsk,
    me?.timezone,
    slotOverride,
  ]);

  /**
   * Today's insight: read the stored one first, generate only if there is none.
   *
   * The cached copy has already painted by now (useDailyInsight is a plain
   * AsyncStorage read), so this never causes a flash of empty state — it just
   * reconciles against the server and fills the gap on a day with no insight.
   *
   * Keyed on `window.todayDay`/`todayYmd`, NOT `todayOpen`: `todayOpen` comes
   * from openLogDays, which drops days that are already logged, so keying on it
   * meant an insight could never load for the rest of the day once the Check
   * was in — a cleared cache would leave Home permanently empty until midnight.
   *
   * Nothing here runs without consent: `consentGranted` short-circuits before
   * any fetch, generation, cache write or widget write.
   */
  // Revoking consent has to reach the widget too: the cached insight is what
  // the shipped widget renders, so leaving it would keep AI-written text on
  // someone's lock screen after they turned AI off.
  useEffect(() => {
    // `me` null means a failed profile refresh, not a revoked consent --
    // `consent` falls back to 'pending' in that case, and wiping on it would
    // blank a granted user's widget on a transient network failure.
    if (!me || consentGranted || !insight) return;
    void saveCachedInsight(null).then(() => reloadInsight());
  }, [me, consentGranted, insight, reloadInsight]);

  /**
   * "Load insight" — a TAP, never an effect (ISOLATION_PLAN §7 Card B, emci
   * 2026-09-15). This used to be a `useEffect` that generated as soon as
   * consent was granted and no insight existed for today, so simply opening
   * Home could spend a model call. Nothing here runs on mount any more: the
   * cached insight still paints from `useDailyInsight` (a local AsyncStorage
   * read), and the server is only touched when the button is pressed.
   *
   * The stored-first order is kept: an insight already written for today is
   * fetched and shown WITHOUT generating a second one, so a tap after a
   * reinstall or on a second device costs nothing.
   */
  const generatingForYmd = useRef<string | null>(null);
  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'unavailable'>('idle');

  const loadInsight = useCallback(async () => {
    if (!me || !userId || !window) return;
    // The one gate: no consent, no model call. Placed above every fetch,
    // generation, cache write and widget write, not below them.
    if (!consentGranted) return;
    const { todayDay, todayYmd } = window;
    if (insight?.ymd === todayYmd) return;
    // Re-entrancy guard: a double tap must not pay for two generations.
    if (generatingForYmd.current === todayYmd) return;
    generatingForYmd.current = todayYmd;
    setInsightState('loading');

    try {
      const existing = await fetchTodayInsight(userId, todayYmd);
      if (existing) {
        await saveCachedInsight(cachedFromInsight(existing, userId));
        await reloadInsight();
        setInsightState('idle');
        return;
      }

      const draft = await generateDailyInsight({
        tracks,
        currentFocus: me.current_focus ?? null,
        recentTone: checks
          .slice(0, 7)
          .map((check) => (check.status === 'done' ? 'did' : 'skip')),
      });
      if (!draft) {
        setInsightState('unavailable');
        return;
      }

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
  }, [me, userId, window, consentGranted, insight?.ymd, tracks, checks, reloadInsight]);

  async function logToday(status: 'done' | 'skipped') {
    if (!userId || !me || !todayOpen || busy || alreadyLogged) return;
    await commitLog(status, todayOpen.day, todayOpen.ymd);
  }

  async function logMissed(slotDay: number, slotYmd: string, status: 'done' | 'skipped') {
    if (!userId || !me || busy) return;
    await commitLog(status, slotDay, slotYmd);
  }

  /**
   * A Check is now an outcome and nothing else. `record_check` is still the
   * only write path for one (hard invariant), but it always takes the no-text
   * branch: the insight lives in `daily_insights` on its own lifecycle, and
   * copying it onto the Check row would duplicate state that can be superseded
   * independently. read_text/do_text stay populated only on Checks logged
   * before this change.
   */
  async function commitLog(status: 'done' | 'skipped', day: number, loggedOn: string) {
    if (!userId || !me || busy) return;
    setBusy(status === 'done' ? 'log' : 'skip');
    setError(null);
    try {
      await recordCheck(userId, {
        day,
        loggedOn,
        status,
      });
      // Home listens to this and reloads via home_bootstrap — no second fetch.
      emitChecksChanged();
      if (status === 'done') triggerGesture('checkDone');
    } catch (err) {
      console.log('[home] recordCheck error:', err);
      setError(err instanceof Error ? err.message : 'Couldn\u2019t save your check. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function saveConsent(value: boolean) {
    if (!userId || !me || busy) return;
    setBusy('consent');
    setError(null);
    try {
      await setAiConsent(userId, value);
      await refreshMe();
    } catch (err) {
      console.log('[home] setAiConsent error:', err);
      setError('Couldn\u2019t save your choice. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never">
          {/* No "Home" title: the tab bar already says it, and a 32px label
              above the fold pushed the card the user came for off-screen. */}
          <View style={styles.header}>
            <ThemedText type="subheading" themeColor="textSecondary">
              {params.focus === 'check' ? 'Check today.' : homeSageLede(theme.id)}
            </ThemedText>
          </View>

          {consentOffEmpty ? (
            /*
             * Declined: no daily content at all. The card had a starter bank
             * for its first three days; the insight has no offline lane, so
             * this is the honest empty state rather than a stale or made-up
             * one. Everything below this card still works.
             */
            <ThemedView type="backgroundElement" style={styles.todayCard}>
              <ThemedText themeColor="textSecondary">
                No insight today. Sage only writes these with your say-so — you can turn that on any time in You.
              </ThemedText>
            </ThemedView>
          ) : insight ? (
            /*
             * One card, one hierarchy. The title is the hero — it is the thing
             * the app promises, and the line a person actually carries with
             * them. Reflection sits under it as context, then Try / Watch for
             * are the two quieter instructions under a hairline. Five equal
             * boxes would give the day's line no more weight than a footnote.
             */
            <ThemedView type="backgroundElement" style={styles.heroCard}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.sageKicker}>
                {homeSageLabel(theme.id)} · {insight.theme}
              </ThemedText>
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
          ) : !consentGranted ? (
            /*
             * Not asked yet. "Sage is writing today's" would be a lie here —
             * nothing has been requested and nothing will be until the
             * question below is answered. Which sentence depends on whether
             * the ask is even on screen yet.
             */
            <ThemedView type="backgroundElement" style={styles.todayCard}>
              <ThemedText type="smallBold">No insight yet</ThemedText>
              <ThemedText themeColor="textSecondary">
                {fullProfileDone
                  ? 'Say yes below and Sage will write today’s.'
                  : 'Finish the questions below first — then Sage can start writing these.'}
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView type="backgroundElement" style={styles.todayCard}>
              <ThemedText type="smallBold">No insight yet</ThemedText>
              <ThemedText themeColor="textSecondary">
                Sage is writing today&apos;s. Nothing is made up in the meantime.
              </ThemedText>
            </ThemedView>
          )}

          {/*
            "Load insight" — the ONLY thing that can spend a model call for
            the daily insight (ISOLATION_PLAN §7 Card B). Shown only when there
            is something to load: consent given, bank finished, and today's
            insight not already on screen.
          */}
          {consentGranted && fullProfileDone && insight?.ymd !== window?.todayYmd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={INSIGHT_LOAD_LABEL}
              disabled={insightState === 'loading'}
              onPress={() => {
                void loadInsight();
              }}
              style={({ pressed }) => [
                styles.answerQuestionsRow,
                { borderColor: controlBorderColor(theme) },
                pressed && styles.pressed,
              ]}>
              <View style={styles.boxRowText}>
                <ThemedText type="smallBold">
                  {insightState === 'loading' ? 'Writing…' : INSIGHT_LOAD_LABEL}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {insightState === 'unavailable'
                    ? INSIGHT_UNAVAILABLE_COPY
                    : 'Nothing is generated until you tap.'}
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          {/*
            Apple 5.1.2: the AI-use disclosure is UNCONDITIONAL. It renders
            before the question is asked, after a yes, and after a no alike —
            only generation depends on the answer, never disclosure. This sits
            outside AiConsentCard on purpose, because that card disappears the
            moment the question is answered.
          */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.aiDisclosure}>
            {AI_USE_DISCLOSURE}
          </ThemedText>

          {/*
            The AI-consent ask (Apple 5.1.2), inline and non-blocking, surfaced
            only once the 50-question intake is finished (emci, 2026-09-15) —
            the first moment an AI feature has a full profile to generate from.
            Deliberately not an early blocking modal: it sits below the day's
            content, and while it is unanswered the Check still logs, the
            question bank still opens and every route stays reachable. The one
            thing it governs is whether a model is called at all.
          */}
          {offerConsent ? (
            <AiConsentCard
              context="home"
              busy={busy === 'consent'}
              onGrant={() => saveConsent(true)}
              onDeny={() => saveConsent(false)}
            />
          ) : null}

          {/*
            The 50-question bank needs no AI and no consent — it's local,
            answer-anytime. So this shows regardless of the consent state
            above, as long as the bank itself isn't finished yet.
          */}
          {!fullProfileDone ? (
            <Pressable
              onPress={() => router.push('/intake-sweep')}
              style={({ pressed }) => [
                styles.answerQuestionsRow,
                { borderColor: controlBorderColor(theme) },
                pressed && styles.pressed,
              ]}>
              <View style={styles.boxRowText}>
                <ThemedText type="smallBold">Answer a few questions</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {profileProgress.answered} of {profileProgress.total} — helps Sage know you faster
                </ThemedText>
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          ) : null}

          {/*
            The Check is an outcome and is deliberately NOT gated on the
            insight. Under the old card lane a bank fallback guaranteed a card
            existed, so gating here was safe; the insight has no fallback, so a
            failed or quota-blocked generation would otherwise leave someone
            unable to log at all — an AI failure blocking the core loop.
          */}
          {me && window ? (
            <>
              {error ? (
                <ThemedText themeColor="textSecondary">{error}</ThemedText>
              ) : null}
              {alreadyLogged ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Logged for day {window?.todayDay ?? insight?.day}.
                </ThemedText>
              ) : !todayOpen ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Today&apos;s Check is closed.
                </ThemedText>
              ) : (
                <View style={styles.checkRow}>
                  <ThemedPressable
                    onPress={() => logToday('done')}
                    disabled={busy !== null}
                    filled
                    style={[
                      styles.primaryButton,
                      busy !== null && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                      {busy === 'log' ? 'Saving\u2026' : 'Logged it'}
                    </ThemedText>
                  </ThemedPressable>
                  <ThemedPressable
                    onPress={() => logToday('skipped')}
                    disabled={busy !== null}
                    style={[
                      styles.secondaryButton,
                      { borderColor: controlBorderColor(theme) },
                      busy !== null && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      {busy === 'skip' ? 'Saving\u2026' : 'Skip today'}
                    </ThemedText>
                  </ThemedPressable>
                </View>
              )}
            </>
          ) : null}

          {slotKind === 'crisis' ? (
            <CrisisCard />
          ) : slotKind === 'missed_check' && me && oldestMissed ? (
            <>
              {error && !insight ? (
                <ThemedText themeColor="textSecondary">{error}</ThemedText>
              ) : null}
              <MissedCheckCard
                key={oldestMissed.ymd}
                slot={oldestMissed}
                busy={busy !== null}
                onLog={(status) => {
                  void logMissed(oldestMissed.day, oldestMissed.ymd, status);
                }}
              />
            </>
          ) : slotKind === 'note' && me ? (
            <RevealCard pick={reveal} userId={userId} timeZone={me.timezone} />
          ) : slotKind === 'ask' && me && askPick ? (
            <AskSheet pick={askPick} me={me} onUpdated={() => { void refreshMe(); }} />
          ) : null}

          {me ? (
            <>
              <SageStoryFold
                me={me}
                tracks={tracks}
                tracksReady={bootstrapReady}
                crisisToday={crisisToday}
                unlocked={fullProfileDone}
              />
              <RollHistoryFold
                userId={me.id}
                types={['story']}
                title="Past Story reveals"
                emptyCopy="Nothing revealed yet — reveal your Story from Roll to see it here."
              />
            </>
          ) : null}

          <Pressable
            onPress={() => router.push('/week')}
            style={({ pressed }) => [styles.weekRow, pressed && styles.pressed]}>
            <ThemedText type="smallBold">This week</ThemedText>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>

          {me && canShowCategoryTeaser(slotKind) ? <CategoryTeaser me={me} /> : null}

          {(canSeeDevLab({
            isDev: __DEV__ || devUnlocked,
            isRoot: devAccess.isRoot,
            capabilities: devAccess.capabilities,
          }) ||
            __DEV__) ? (
            <ThemedView type="backgroundElement" style={styles.boxCard}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.boxKicker}>
                dev
              </ThemedText>
              {canSeeDevLab({
                isDev: __DEV__ || devUnlocked,
                isRoot: devAccess.isRoot,
                capabilities: devAccess.capabilities,
              }) ? (
              <Pressable
                onPress={() => router.push('/dev-lab')}
                style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Dev Tools Hub</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Cards, traits, quota, fence, trace
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
  checkRow: {
    gap: Spacing.two,
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondaryButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
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
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
  },
  boxRowText: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
