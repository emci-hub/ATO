import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { buildVoiceConfig } from '@/lib/voice/config';
import { routeVoiceCard } from '@/lib/voice/router';
import type { CheckHistory, VoiceCardResult, VoiceMe } from '@/lib/voice/types';

/**
 * Dev harness for the voice router. Not linked from the app in production:
 * open /voice-lab directly. Walks check_count 0→4 so you can see the bank
 * (check_count < 3, fromBankFile=true) flip over to generated content
 * (check_count >= 3), and that Day 4's card is not Day 3's copy.
 */

const CUE = 'make coffee';

const LAB_ME: VoiceMe = {
  name: 'Riley',
  show_up: 'finishing my resume',
  talk_style: 'even',
  knocks_you_off: 'bad sleep',
  morning_cue: CUE,
};

interface Scenario {
  checkCount: number;
  history: CheckHistory[];
  /** Consent value to route with; null = never asked. */
  aiConsent?: boolean | null;
  /** Crisis short-circuit flag. */
  crisisDetected?: boolean;
}

const SCENARIOS: Scenario[] = [
  // check_count < 3 → bank, no prompt needed yet.
  { checkCount: 0, history: [], aiConsent: null },
  { checkCount: 1, history: [{ day: 1, status: 'done' }], aiConsent: null },
  { checkCount: 2, history: [{ day: 1, status: 'done' }, { day: 2, status: 'done' }], aiConsent: null },
  // check_count >= 3 + consent granted → generated (Day 4 ≠ Day 3).
  {
    checkCount: 3,
    history: [
      { day: 1, status: 'done' },
      { day: 2, status: 'done' },
      { day: 3, status: 'done' },
    ],
    aiConsent: true,
  },
  {
    checkCount: 4,
    history: [
      { day: 1, status: 'done' },
      { day: 2, status: 'done' },
      { day: 3, status: 'done' },
      { day: 4, status: 'done' },
    ],
    aiConsent: true,
  },
  // Consent never asked at check_count >= 3 → 'pending', no model call.
  {
    checkCount: 3,
    history: [
      { day: 1, status: 'done' },
      { day: 2, status: 'done' },
      { day: 3, status: 'done' },
    ],
    aiConsent: null,
  },
  // Consent denied → bank only forever; day 4 has no bank card → nothing.
  {
    checkCount: 3,
    history: [
      { day: 1, status: 'done' },
      { day: 2, status: 'done' },
      { day: 3, status: 'done' },
    ],
    aiConsent: false,
  },
  // Crisis-flagged → static crisis result, no model call, even with consent.
  {
    checkCount: 3,
    history: [
      { day: 1, status: 'done' },
      { day: 2, status: 'done' },
      { day: 3, status: 'done' },
    ],
    aiConsent: true,
    crisisDetected: true,
  },
];

export default function VoiceLabScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <VoiceLab />;
}

function VoiceLab() {
  const [results, setResults] = useState<VoiceCardResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Local provider on purpose: deterministic, so day 4 vs day 3 is provable
    // without an API key. The router default stays gemini.
    const config = buildVoiceConfig({ MODEL_PROVIDER: 'local' });
    Promise.all(
      SCENARIOS.map((scenario) =>
        routeVoiceCard(
          {
            me: LAB_ME,
            checkCount: scenario.checkCount,
            history: scenario.history,
            aiConsent: scenario.aiConsent,
            crisisDetected: scenario.crisisDetected,
          },
          { config, isDev: true },
        ),
      ),
    )
      .then((next) => {
        if (!cancelled) setResults(next);
      })
      .catch((err) => {
        if (!cancelled) {
          console.log('[voice-lab] routeVoiceCard error:', err);
          setError('Router failed: ' + String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Voice router</ThemedText>
            <ThemedText themeColor="textSecondary">
              check_count 0→4 with the deterministic local provider. Bank content
              stops at Day 3; Day 4+ is generated once AI consent is granted. The
              last three rows show consent pending, consent denied, and the crisis
              short-circuit.
            </ThemedText>
          </View>

          {error ? (
            <ThemedText themeColor="textSecondary">{error}</ThemedText>
          ) : results === null ? (
            <ThemedText themeColor="textSecondary">Routing…</ThemedText>
          ) : (
            results.map((result, index) => (
              <ThemedView key={`${result.day}-${result.consent}-${index}`} type="backgroundElement" style={styles.cell}>
                <View style={styles.cellHeader}>
                  <ThemedText type="smallBold">Day {result.day}</ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {result.kind === 'crisis' ? 'crisis' : `${result.source} · ${result.tone} · ${result.consent}`}
                  </ThemedText>
                </View>
                {result.kind === 'crisis' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    static crisis card — no model call
                  </ThemedText>
                ) : result.card ? (
                  <>
                    <ThemedText style={styles.cardText}>{result.card.read}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.doText}>
                      {result.card.do}
                    </ThemedText>
                  </>
                ) : result.consent === 'pending' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    consent not asked — prompt required, no model call
                  </ThemedText>
                ) : result.consent === 'denied' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    consent denied — bank only, no card past Day 3
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    dropped ({result.dropped.join(', ')}) — nothing shown
                  </ThemedText>
                )}
                {result.dev ? (
                  <ThemedText type="code" themeColor="textSecondary" style={styles.devLine}>
                    dev · fromBankFile {String(result.dev.fromBankFile)} · fromModel{' '}
                    {String(result.dev.fromModel)} · check_count {result.dev.checkCount}
                  </ThemedText>
                ) : null}
              </ThemedView>
            ))
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
    paddingVertical: Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  cell: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardText: {
    lineHeight: 24,
  },
  doText: {
    lineHeight: 20,
  },
  devLine: {
    lineHeight: 16,
  },
});
