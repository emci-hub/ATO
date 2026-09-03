import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IntakeSweep } from '@/components/intake-sweep';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { OptionalIntakeFill } from '@/components/optional-intake';
import { QuestionsFold } from '@/components/questions-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { checksToHistory, fetchChecks, type Check } from '@/lib/checks';
import { crisisFlagsForWindow } from '@/lib/crisis/days';
import { useMe } from '@/hooks/use-me';
import { useSession } from '@/hooks/use-session';

/**
 * Questions — every question surface that feeds the trait axes lives here:
 * the rotating Infinite Questions ("Tell Sage more"), the optional scenario
 * fill ("Want to add a bit more?"), and the full sweep ("A faster pass").
 */
export default function IntakeSweepTabScreen() {
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

  function done() {
    router.replace('/');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Questions</ThemedText>
          </View>

          {me && checksReady && flagsReady ? (
            <QuestionsFold
              me={me}
              history={checksToHistory(checks)}
              crisisToday={crisisToday}
              onUpdated={refresh}
            />
          ) : null}

          {me ? (
            <>
              <OptionalIntakeFill me={me} onUpdated={refresh} />
              <IntakeSweep me={me} onUpdated={refresh} onDone={done} />
            </>
          ) : (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
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
    paddingBottom: BottomTabInset + Spacing.five,
  },
  header: {
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
});
