import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchChecks, type Check } from '@/lib/checks';
import { recapFromReads } from '@/lib/push-copy';
import { checksInRecapWeek } from '@/lib/week-window';

export default function WeekScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me } = useMe(userId);
  const [checks, setChecks] = useState<Check[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setChecks(await fetchChecks(userId));
    } catch (err) {
      console.log('[week] fetchChecks error:', err);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const timeZone = me?.timezone || 'UTC';
  const week = checksInRecapWeek(checks, new Date(), timeZone);
  const showedUp = week.length;
  const recap = recapFromReads(week.map((check) => check.read_text));

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable
            onPress={close}
            hitSlop={12}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ‹ Back
            </ThemedText>
          </Pressable>

          <ThemedText type="subtitle">This week</ThemedText>
          <ThemedText themeColor="textSecondary">
            {showedUp === 1 ? 'You showed up 1.' : `You showed up ${showedUp}.`}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
              recap
            </ThemedText>
            <ThemedText style={styles.body}>{recap}</ThemedText>
          </ThemedView>

          {week.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Nothing logged this week. That&apos;s fine — the week is still yours.
            </ThemedText>
          ) : (
            week.map((check) => (
              <ThemedView key={check.id} type="backgroundElement" style={styles.card}>
                <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
                  {check.status === 'done' ? 'did' : 'skip'} · day {check.day}
                </ThemedText>
                {check.read_text ? (
                  <ThemedText style={styles.body}>{check.read_text}</ThemedText>
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.body}>
                    Outcome kept. Read rolled out of this week.
                  </ThemedText>
                )}
                {check.do_text ? (
                  <ThemedText themeColor="textSecondary" style={styles.body}>
                    {check.do_text}
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
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingRight: Spacing.three,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  body: {
    lineHeight: 26,
  },
  pressed: {
    opacity: 0.8,
  },
});
