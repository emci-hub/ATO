import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AiConsentCard } from '@/components/ai-consent-card';
import { CrisisCard } from '@/components/crisis-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { checksToHistory, fetchChecks, recordCheck, type Check } from '@/lib/checks';
import { emitChecksChanged } from '@/lib/checks-events';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { aiConsentFor, setAiConsent } from '@/lib/me';
import { persistRoutedCard } from '@/lib/today-card';
import { routeVoiceCard } from '@/lib/voice/router';
import type { VoiceCardResult } from '@/lib/voice/types';
import { DAWN_SAGE_LEDE } from '@/lib/sage-copy';

const TONE_LABEL: Record<string, string> = {
  lift: 'lift',
  even: 'even',
  cut: 'cut',
};

export default function DawnScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh: refreshMe } = useMe(userId);

  const [checks, setChecks] = useState<Check[]>([]);
  const [result, setResult] = useState<VoiceCardResult | null>(null);
  const [routing, setRouting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'log' | 'skip' | 'consent' | null>(null);

  const reloadChecks = useCallback(async () => {
    if (!userId) return;
    try {
      setChecks(await fetchChecks(userId));
    } catch (err) {
      console.log('[dawn] fetchChecks error:', err);
    }
  }, [userId]);

  useEffect(() => {
    reloadChecks();
  }, [reloadChecks]);

  const checkCount = checks.length;

  // Consent gate (Apple 5.1.2): ask exactly once, before the first moment a
  // model call could happen (check_count >= 3). Until the user answers, Dawn
  // shows the prompt instead of a card.
  const consent = me ? aiConsentFor(me) : 'pending';
  const needsConsentPrompt = me != null && consent === 'pending' && checkCount >= 3;

  // Route the card for today (day = checkCount + 1). Re-runs whenever checks
  // change, so logging a check advances to the next day's card.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    if (needsConsentPrompt) {
      setRouting(false);
      setResult(null);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setRouting(true);
    setError(null);

    routeVoiceCard({
      me: {
        name: me.name,
        show_up: me.show_up,
        talk_style: me.talk_style,
        knocks_you_off: me.knocks_you_off,
        morning_cue: me.morning_cue,
      },
      checkCount: checks.length,
      history: checksToHistory(checks),
      crisisToday: false,
      aiConsent: me.ai_consent,
    })
      .then((next) => {
        if (cancelled) return;
        setResult(next);
        persistRoutedCard(next).catch((err) => {
          console.log('[dawn] persistRoutedCard error:', err);
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.log('[dawn] routeVoiceCard error:', err);
          setError('Sage couldn\u2019t write today\u2019s card. Try again.');
          setResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRouting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [me, checks]);

  async function log(status: 'done' | 'skipped') {
    if (!userId || !me || !result?.card || busy) return;
    setBusy(status === 'done' ? 'log' : 'skip');
    setError(null);
    try {
      await recordCheck(userId, {
        day: result.day,
        card: result.card,
        source: result.source,
        status,
      });
      await reloadChecks();
      // Notify the growth system (Home face tiers + milestone check).
      emitChecksChanged();
      // Check marked "did" → thumb gesture. "Skip" deliberately stays silent
      // (hands stay hidden) — skipping isn't celebrated.
      if (status === 'done') {
        triggerGesture('checkDone');
      }
    } catch (err) {
      console.log('[dawn] recordCheck error:', err);
      setError('Couldn\u2019t save your check. Try again.');
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
      console.log('[dawn] setAiConsent error:', err);
      setError('Couldn\u2019t save your choice. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const card = result?.card ?? null;

  function closeDawn() {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Deep link / web entry with no history: land back on the Home tab.
      router.replace('/');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topRow}>
            <Pressable
              onPress={closeDawn}
              disabled={busy !== null}
              hitSlop={12}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
                busy !== null && styles.disabled,
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ‹ Back
              </ThemedText>
            </Pressable>
            <ThemedText type="code" themeColor="textSecondary">
              {busy !== null ? 'saving…' : 'no pressure'}
            </ThemedText>
          </View>

          <ThemedText type="subtitle">Dawn</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
            {DAWN_SAGE_LEDE}
          </ThemedText>

          {needsConsentPrompt ? (
            <AiConsentCard
              context="dawn"
              busy={busy === 'consent'}
              onGrant={() => saveConsent(true)}
              onDeny={() => saveConsent(false)}
            />
          ) : routing || !me ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText themeColor="textSecondary">Writing today&apos;s card…</ThemedText>
            </ThemedView>
          ) : error ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {error}
              </ThemedText>
              <Pressable
                onPress={() => reloadChecks()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">Try again</ThemedText>
              </Pressable>
            </ThemedView>
          ) : result?.kind === 'crisis' ? (
            <CrisisCard onDismiss={closeDawn} />
          ) : card === null ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              {result?.consent === 'denied' ? (
                <>
                  <ThemedText type="smallBold">Keeping it simple</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    You chose to keep Sage off AI, so there&apos;s no new card today — the
                    starter cards only cover the first three days. Talk stays off too.
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="smallBold">Nothing worth showing today</ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.centerText}>
                    Sage tried three times and every draft was a repeat, a vague do, or a
                    cut that shouldn&apos;t be said. Nothing is better than bad.
                  </ThemedText>
                  <Pressable
                    onPress={() => reloadChecks()}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">Try again</ThemedText>
                  </Pressable>
                </>
              )}
            </ThemedView>
          ) : result ? (
            <>
              <View style={styles.dayRow}>
                <ThemedText type="smallBold">Day {result.day}</ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {TONE_LABEL[result.tone]}
                </ThemedText>
              </View>

              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                  read
                </ThemedText>
                <ThemedText style={styles.cardText}>{card.read}</ThemedText>
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                  do
                </ThemedText>
                <ThemedText style={styles.cardText}>{card.do}</ThemedText>
              </ThemedView>

              {__DEV__ && result.dev ? (
                <ThemedText type="code" themeColor="textSecondary" style={styles.devTrace}>
                  dev · source {result.source} · {result.dev.providerLabel} · check_count{' '}
                  {result.dev.checkCount} · consent {result.consent} · fromBankFile{' '}
                  {String(result.dev.fromBankFile)} · fromModel {String(result.dev.fromModel)}
                </ThemedText>
              ) : null}

              <Pressable
                onPress={() => log('done')}
                disabled={busy !== null}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: '#3c87f7' },
                  pressed && styles.pressed,
                  busy !== null && styles.disabled,
                ]}>
                <ThemedText type="smallBold" style={styles.primaryText}>
                  {busy === 'log' ? 'Saving…' : 'Logged it'}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => log('skipped')}
                disabled={busy !== null}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                  busy !== null && styles.disabled,
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {busy === 'skip' ? 'Saving…' : 'Skip today'}
                </ThemedText>
              </Pressable>
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
    paddingBottom: Spacing.five,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingRight: Spacing.three,
  },
  lede: {
    paddingBottom: Spacing.two,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  kicker: {
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  cardText: {
    alignSelf: 'flex-start',
    lineHeight: 26,
  },
  centerText: {
    textAlign: 'center',
  },
  devTrace: {
    lineHeight: 16,
    textAlign: 'center',
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
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
