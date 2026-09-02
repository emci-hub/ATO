import { Redirect } from 'expo-router';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { buildVoiceConfig } from '@/lib/voice/config';
import { routeTalkReply } from '@/lib/voice/talk';
import type { CheckHistory, VoiceMe } from '@/lib/voice/types';
import { useEffect, useState } from 'react';

/**
 * Dev harness for the Talk router. Not linked in production: open /talk-lab
 * directly. Shows: two users with different talk_style on the SAME prompt get
 * visibly different tone, and a crisis-flagged message returns the static card
 * via the keyword list with zero main-router calls.
 */

const CUE = 'make coffee';

function makeMe(style: VoiceMe['talk_style'], name: string): VoiceMe {
  return {
    name,
    show_up: 'finishing my resume',
    talk_style: style,
    knocks_you_off: 'bad sleep',
    morning_cue: CUE,
  };
}

const HISTORY: CheckHistory[] = [
  { day: 1, status: 'done' },
  { day: 2, status: 'done' },
  { day: 3, status: 'done' },
  { day: 4, status: 'done' },
];

interface Row {
  label: string;
  detail: string;
}

export default function TalkLabScreen() {
  if (!PRE_LAUNCH_DEV) {
    return <Redirect href="/" />;
  }
  return <TalkLab />;
}

function TalkLab() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const config = buildVoiceConfig({ MODEL_PROVIDER: 'local' });

    async function run() {
      const prompt = 'How\u2019s my week going?';
      const quiet = await routeTalkReply(
        { me: makeMe('quiet', 'Mia'), message: prompt, checkCount: 4, history: HISTORY, aiConsent: true },
        { config, isDev: true },
      );
      const loud = await routeTalkReply(
        { me: makeMe('loud', 'Leo'), message: prompt, checkCount: 4, history: HISTORY, aiConsent: true },
        { config, isDev: true },
      );
      const crisis = await routeTalkReply(
        { me: makeMe('even', 'Riley'), message: 'I\u2019ve been thinking about suicide all day.', checkCount: 4, history: HISTORY, aiConsent: true },
        { config, isDev: true },
      );
      return [
        { label: 'quiet → same prompt', detail: quiet.reply ?? '(no reply)' },
        { label: 'loud → same prompt', detail: loud.reply ?? '(no reply)' },
        {
          label: `crisis message → ${crisis.kind} (${crisis.crisis?.method ?? 'n/a'})`,
          detail: crisis.kind === 'crisis' ? 'static crisis card, zero main-router calls' : crisis.reply ?? '(unexpected)',
        },
      ];
    }

    run()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((err) => {
        if (!cancelled) {
          console.log('[talk-lab] error:', err);
          setError(String(err));
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
            <ThemedText type="subtitle">Talk router</ThemedText>
            <ThemedText themeColor="textSecondary">
              Local provider, deterministic. Same prompt → different talk_style =
              visibly different tone. Crisis message → static card, no main call.
            </ThemedText>
          </View>

          {error ? (
            <ThemedText themeColor="textSecondary">{error}</ThemedText>
          ) : rows === null ? (
            <ThemedText themeColor="textSecondary">Routing…</ThemedText>
          ) : (
            rows.map((row, index) => (
              <ThemedView key={index} type="backgroundElement" style={styles.cell}>
                <ThemedText type="smallBold">{row.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.detail}>
                  {row.detail}
                </ThemedText>
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
  detail: {
    lineHeight: 20,
  },
});
