import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { MilestoneBadges } from '@/components/check-milestone-badge';
import { ExplorePanel } from '@/components/explore-panel';
import { HomeInnerTabs, type HomeInnerTab } from '@/components/home-inner-tabs';
import { MissedCheckCard } from '@/components/missed-check-card';
import AskSheet from '@/components/ask-sheet';
import { QuestGrowthBars } from '@/components/quest-growth-bars';
import { RevealCard } from '@/components/reveal-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { useTheme } from '@/hooks/use-theme';
import { useGrowth } from '@/hooks/use-growth';
import { useTodayCard } from '@/hooks/use-today-card';
import { checkWindowFor } from '@/lib/check-window';
import { checksToHistory, fetchChecks, recordCheck, type Check } from '@/lib/checks';
import { emitChecksChanged, onChecksChanged } from '@/lib/checks-events';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { aiConsentFor } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { voiceMeFrom } from '@/lib/intake';
import { resolveAsk, type AskPick } from '@/lib/ask';
import { readAskOverride } from '@/lib/dev-overrides';
import { homeSageLabel, homeSageLede, NUDGE_LABEL, SAGE_COACH_LABEL } from '@/lib/sage-copy';
import { persistRoutedCard, saveTodayCard, todayCardFromCheck } from '@/lib/today-card';
import { resolveReveal } from '@/lib/reveal';
import { RANKING_ROUNDS } from '@/lib/ranking';
import { composeSageKnowsLine, parseSageKnowsState } from '@/lib/sage-knows';
import { SCENARIO_DECK } from '@/lib/scenario';
import { EXPLORE_LEDE } from '@/lib/explore/copy';
import { traitStateFromRow, TRAIT_POLE_LINES } from '@/lib/traits';
import { routeVoiceCard } from '@/lib/voice/router';
import { logJargonGuard } from '@/lib/voice/quota-server';
import { canSeeDevLab } from '@/lib/dev-access';
import { recordOwnDevTrace } from '@/lib/dev-trace-server';
import type { VoiceCard, VoiceSource } from '@/lib/voice/types';
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
  const { card, reload: reloadCard } = useTodayCard();
  const { state: growth } = useGrowth();
  const params = useLocalSearchParams<{ focus?: string }>();
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState<'log' | 'skip' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [crisisToday, setCrisisToday] = useState(false);
  const [crisisYesterday, setCrisisYesterday] = useState(false);
  const [homeTab, setHomeTab] = useState<HomeInnerTab>('today');
  const [askOverride, setAskOverride] = useState<AskPick['kind'] | null>(null);

  const reloadChecks = useCallback(async () => {
    if (!userId) return;
    try {
      setChecks(await fetchChecks(userId));
    } catch (err) {
      console.log('[home] fetchChecks error:', err);
    }
  }, [userId]);

  useEffect(() => {
    reloadChecks();
    return onChecksChanged(() => {
      reloadChecks();
    });
  }, [reloadChecks]);

  useEffect(() => {
    if (!userId || !me) return;
    let cancelled = false;
    crisisFlagsForWindow(userId, me.timezone)
      .then((flags) => {
        if (cancelled) return;
        setCrisisToday(flags.crisisToday);
        setCrisisYesterday(flags.crisisYesterday);
      })
      .catch((err) => {
        console.log('[home] crisis flags error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me?.timezone]);

  const window = me
    ? checkWindowFor(
        me,
        checks.map((check) => check.day),
      )
    : null;
  const todayOpen = window?.open.find((slot) => slot.offset === 0) ?? null;
  const missedOpen = window?.open.filter((slot) => slot.offset > 0) ?? [];
  const alreadyLogged =
    window != null && checks.some((check) => check.day === window.todayDay);

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
    if (!__DEV__) return;
    let cancelled = false;
    void readAskOverride().then((kind) => {
      if (!cancelled) setAskOverride(kind);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const askPick = useMemo(() => {
    if (askOverride) return fixtureAskPick(askOverride);
    if (!me) return null;
    const traits = traitStateFromRow(me);
    return resolveAsk({
      values: traits.values,
      touched: traits.touched,
      knows: parseSageKnowsState(me.sage_knows),
      knocksYouOff: me.knocks_you_off,
      facts: me.facts ?? [],
      history: checksToHistory(checks),
      now: new Date(),
      timeZone: me.timezone || 'UTC',
    });
  }, [askOverride, me, checks]);

  useEffect(() => {
    if (card || !window) return;
    const todayCheck = checks.find((row) => row.day === window.todayDay);
    const hydrated = todayCheck ? todayCardFromCheck(todayCheck) : null;
    if (!hydrated) return;
    let cancelled = false;
    void saveTodayCard(hydrated).then(() => {
      if (!cancelled) return reloadCard();
    });
    return () => {
      cancelled = true;
    };
  }, [card, window?.todayDay, checks, reloadCard]);

  useEffect(() => {
    if (!me || !todayOpen) return;
    if (card?.day === todayOpen.day && card.nudge !== undefined) return;
    let cancelled = false;
    routeVoiceCard({
      me: voiceMeFrom(me),
      checkCount: checks.length,
      history: checksToHistory(checks),
      crisisToday,
      crisisYesterday,
      aiConsent: me.ai_consent,
      day: todayOpen.day,
    }, { logJargonHit: logJargonGuard, recordTrace: recordOwnDevTrace, traceSurface: 'dawn' })
      .then(async (next) => {
        if (cancelled || !next.card) return;
        await persistRoutedCard(next);
        await reloadCard();
      })
      .catch((err) => {
        console.log('[home] route today card error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [me, todayOpen?.day, card?.day, checks, reloadCard, crisisToday, crisisYesterday]);

  async function logToday(status: 'done' | 'skipped') {
    if (!userId || !me || !card || !todayOpen || busy || alreadyLogged) return;
    await commitLog(status, todayOpen.day, todayOpen.ymd, {
      read: card.read,
      do: card.do,
      nudge: card.nudge ?? null,
    }, card.source);
  }

  async function logMissed(
    slotDay: number,
    slotYmd: string,
    status: 'done' | 'skipped',
    voice: VoiceCard,
    source: VoiceSource,
  ) {
    if (!userId || !me || busy) return;
    await commitLog(status, slotDay, slotYmd, { read: voice.read, do: voice.do }, source);
  }

  async function commitLog(
    status: 'done' | 'skipped',
    day: number,
    loggedOn: string,
    voice: VoiceCard,
    source: VoiceSource,
  ) {
    if (!userId || !me || busy) return;
    setBusy(status === 'done' ? 'log' : 'skip');
    setError(null);
    try {
      await recordCheck(userId, {
        day,
        loggedOn,
        card: voice,
        source,
        status,
      });
      const nextChecks = await fetchChecks(userId);
      setChecks(nextChecks);
      emitChecksChanged();
      if (status === 'done') triggerGesture('checkDone');
      await reloadCard();
    } catch (err) {
      console.log('[home] recordCheck error:', err);
      setError(err instanceof Error ? err.message : 'Couldn\u2019t save your check. Try again.');
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
          <View style={styles.header}>
            <ThemedText type="subtitle">Home</ThemedText>
            <ThemedText themeColor="textSecondary">
              {homeTab === 'explore'
                ? EXPLORE_LEDE
                : params.focus === 'check'
                  ? 'Check today.'
                  : homeSageLede(theme.id)}
            </ThemedText>
            <MilestoneBadges
              checkCount={growth.checkCount}
              factCount={growth.factCount}
              checks={checks}
              timeZone={me?.timezone ?? 'UTC'}
            />
            <HomeInnerTabs value={homeTab} onChange={setHomeTab} />
          </View>

          {homeTab === 'explore' && me ? (
            <ExplorePanel
              me={me}
              history={checksToHistory(checks)}
              crisisToday={crisisToday}
            />
          ) : null}

          {homeTab === 'today' ? (
            <>
          {card ? (
            <>
              <ThemedView type="backgroundElement" style={styles.todayCard}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.sageKicker}>
                  {homeSageLabel(theme.id)} · read
                </ThemedText>
                <ThemedText style={styles.cardText}>{card.read}</ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={styles.todayCard}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                  do
                </ThemedText>
                <ThemedText style={styles.cardText}>{card.do}</ThemedText>
              </ThemedView>
              {card.nudge && card.do.trim().length > 0 ? (
                <ThemedView type="backgroundElement" style={styles.todayCard}>
                  <ThemedText type="code" themeColor="textSecondary" style={styles.sageKicker}>
                    {NUDGE_LABEL}
                  </ThemedText>
                  <ThemedText style={styles.cardText}>{card.nudge}</ThemedText>
                </ThemedView>
              ) : null}
              {error ? (
                <ThemedText themeColor="textSecondary">{error}</ThemedText>
              ) : null}
              {alreadyLogged ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Logged for day {window?.todayDay ?? card.day}.
                </ThemedText>
              ) : !todayOpen ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Today&apos;s Check is closed.
                </ThemedText>
              ) : me && aiConsentFor(me) === 'pending' && checks.length >= 3 ? (
                <Pressable
                  onPress={() => router.push('/dawn')}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Open Dawn to continue.
                  </ThemedText>
                </Pressable>
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
          ) : (
            <Pressable onPress={() => router.push('/dawn')} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.todayCard}>
                <ThemedText type="smallBold">No card yet</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Open Dawn when you&apos;re ready. Nothing is made up in the meantime.
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}

          {me ? (
            <RevealCard pick={reveal} userId={userId} timeZone={me.timezone} />
          ) : null}

          {me && askPick ? (
            <AskSheet pick={askPick} me={me} onUpdated={() => { void refreshMe(); }} />
          ) : null}

          {me && missedOpen.length > 0 ? (
            <>
              {error && !card ? (
                <ThemedText themeColor="textSecondary">{error}</ThemedText>
              ) : null}
              {missedOpen.map((slot) => (
                <MissedCheckCard
                  key={slot.ymd}
                  slot={slot}
                  routeInput={{
                    me: voiceMeFrom(me),
                    checkCount: checks.length,
                    history: checksToHistory(checks),
                    crisisToday,
                    crisisYesterday,
                    aiConsent: me.ai_consent,
                  }}
                  busy={busy !== null}
                  onLog={(status, voice, source) => {
                    void logMissed(slot.day, slot.ymd, status, voice, source);
                  }}
                />
              ))}
            </>
          ) : null}

          <QuestGrowthBars presence={growth.presence} depth={growth.depth} />

          <Pressable
            onPress={() => router.push('/week')}
            style={({ pressed }) => [styles.weekRow, pressed && styles.pressed]}>
            <View>
              <ThemedText type="smallBold">This week</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Recap + you showed up
              </ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>

          {(canSeeDevLab({
            isDev: __DEV__,
            isRoot: devAccess.isRoot,
            capabilities: devAccess.capabilities,
          }) ||
            __DEV__) ? (
            <ThemedView type="backgroundElement" style={styles.boxCard}>
              <ThemedText type="code" themeColor="textSecondary" style={styles.boxKicker}>
                dev
              </ThemedText>
              {canSeeDevLab({
                isDev: __DEV__,
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
                onPress={() => router.push('/voice-lab')}
                style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Voice router</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dev: bank vs generated
                  </ThemedText>
                </View>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
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
                onPress={() => router.push('/talk-lab')}
                style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                <View style={styles.boxRowText}>
                  <ThemedText type="smallBold">Talk router</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dev: tones + crisis gate
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
  kicker: {
    textTransform: 'uppercase',
  },
  sageKicker: {
    textTransform: 'none',
  },
  cardText: {
    lineHeight: 26,
  },
  checkRow: {
    gap: Spacing.two,
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryText: {
    color: '#ffffff',
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
