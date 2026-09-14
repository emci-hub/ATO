import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Pressable, View } from 'react-native';
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
import { AiConsentCard } from '@/components/ai-consent-card';
import { generateDailyInsight } from '@/lib/insight/generate-insight';
import { fetchTodayInsight, saveInsight } from '@/lib/insight/store';
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
  const { insight, reload: reloadInsight } = useDailyInsight();
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

  /**
   * Consent off means no insight at all — not "no insight after day 3" as it
   * did for the card. The card had a starter bank to fall back on for the
   * first three days; the insight has no offline lane, so a user who declines
   * AI simply has no daily content. Nothing is generated and nothing is
   * written to the widget on this branch.
   */
  const consentOffEmpty = Boolean(me && me.ai_consent !== true);

  // Consent gate (Apple 5.1.2): ask exactly once, before the first moment a
  // model call could happen (check_count >= 3). Moved here from Dawn, which
  // owned this prompt until the insight replaced the card.
  const consent = me ? aiConsentFor(me) : 'pending';
  const needsConsentPrompt = me != null && consent === 'pending' && checks.length >= 3;

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
   * The cached copy has already painted by now (useDailyInsight is a synchronous
   * AsyncStorage read), so this never causes a flash of empty state — it just
   * reconciles against the server and fills the gap on a day with no insight yet.
   *
   * Nothing here runs without consent: `consentOffEmpty` short-circuits before
   * any fetch or generation, and the consent prompt blocks the first model call
   * until the user has answered.
   */
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
   * Nothing here runs without consent: `consentOffEmpty` and an unanswered
   * consent prompt both short-circuit before any fetch or generation.
   */
  // Revoking consent has to reach the widget too: the cached insight is what
  // the shipped widget renders, so leaving it would keep AI-written text on
  // someone's lock screen after they turned AI off.
  useEffect(() => {
    if (!consentOffEmpty || !insight) return;
    void saveCachedInsight(null).then(() => reloadInsight());
  }, [consentOffEmpty, insight, reloadInsight]);

  const generatingForYmd = useRef<string | null>(null);
  useEffect(() => {
    if (!me || !userId || !window) return;
    if (consentOffEmpty || needsConsentPrompt) return;
    const { todayDay, todayYmd } = window;
    if (insight?.ymd === todayYmd) return;
    // A home_bootstrap reload gives `checks`/`tracks` fresh identities, which
    // re-runs this effect. Without this guard the cleanup would cancel a run
    // that had already paid for a generation and start a second one.
    if (generatingForYmd.current === todayYmd) return;
    generatingForYmd.current = todayYmd;

    let cancelled = false;
    void (async () => {
      try {
        const existing = await fetchTodayInsight(userId, todayYmd);
        if (cancelled) return;
        if (existing) {
          await saveCachedInsight(cachedFromInsight(existing));
          if (!cancelled) await reloadInsight();
          return;
        }

        const draft = await generateDailyInsight({
          tracks,
          currentFocus: me.current_focus ?? null,
          recentTone: checks
            .slice(0, 7)
            .map((check) => (check.status === 'done' ? 'did' : 'skip')),
        });
        if (cancelled || !draft) return;

        await saveInsight(draft, todayDay, todayYmd);
        await saveCachedInsight({
          day: todayDay,
          ymd: todayYmd,
          theme: draft.theme,
          title: draft.title,
          reflection: draft.reflection,
          tryToday: draft.tryToday,
          watchFor: draft.watchFor,
        });
        if (!cancelled) await reloadInsight();
      } catch (err) {
        console.log('[home] today insight error:', err);
      } finally {
        // Cleared on failure so a later mount can retry; a success has already
        // set `insight.ymd`, which short-circuits above.
        if (generatingForYmd.current === todayYmd) generatingForYmd.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    me,
    userId,
    window?.todayYmd,
    window?.todayDay,
    insight?.ymd,
    consentOffEmpty,
    needsConsentPrompt,
    tracks,
    checks,
    reloadInsight,
  ]);

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
            <ThemedView type="backgroundElement" style={styles.todayCard}>
              <ThemedText themeColor="textSecondary">
                {consent === 'denied'
                  ? 'No insight today. Sage only writes these with your say-so — you can turn that on any time in You.'
                  : 'No insight yet. Sage will ask before writing anything.'}
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
          ) : (
            <ThemedView type="backgroundElement" style={styles.todayCard}>
              <ThemedText type="smallBold">No insight yet</ThemedText>
              <ThemedText themeColor="textSecondary">
                Sage is writing today&apos;s. Nothing is made up in the meantime.
              </ThemedText>
            </ThemedView>
          )}

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
              ) : needsConsentPrompt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Answer the question above to continue.
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
              <SageStoryFold me={me} tracks={tracks} tracksReady={bootstrapReady} crisisToday={crisisToday} />
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

      {/*
        AI-consent gate (Apple 5.1.2), moved here from Dawn. A Modal, not a
        conditionally-mounted card: it has to be unmissable and cannot be
        scrolled past, because the first model call for the insight happens
        immediately after the user answers.
      */}
      <Modal
        visible={needsConsentPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <AiConsentCard
              context="home"
              busy={busy === 'consent'}
              onGrant={() => saveConsent(true)}
              onDeny={() => saveConsent(false)}
            />
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth - Spacing.five,
    gap: Spacing.three,
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
  boxRowText: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
