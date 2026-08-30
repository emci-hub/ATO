import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { QuestionsFold } from '@/components/questions-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { checksToHistory, fetchChecks, type Check } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';

export default function QuestionsScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh } = useMe(userId);
  const [checks, setChecks] = useState<Check[]>([]);
  const [checksReady, setChecksReady] = useState(false);
  const [crisisToday, setCrisisToday] = useState(false);
  const [flagsReady, setFlagsReady] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setChecks(await fetchChecks(userId));
    } catch (err) {
      console.log('[questions] fetchChecks error:', err);
    } finally {
      setChecksReady(true);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId || !me) return;
    let cancelled = false;
    crisisFlagsForWindow(userId, me.timezone)
      .then((flags) => {
        if (cancelled) return;
        setCrisisToday(flags.crisisToday);
        setFlagsReady(true);
      })
      .catch((err) => {
        console.log('[questions] crisis flags error:', err);
        if (!cancelled) setFlagsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me?.timezone]);

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

          <ThemedText type="subtitle">Tell Sage more</ThemedText>

          {me && checksReady && flagsReady ? (
            <QuestionsFold
              me={me}
              history={checksToHistory(checks)}
              crisisToday={crisisToday}
              onUpdated={refresh}
              alwaysOpen
            />
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
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingRight: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
});
