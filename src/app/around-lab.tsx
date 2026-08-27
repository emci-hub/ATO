import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { aroundEmptyCopy, fetchWeekendJson } from '@/lib/around/fetch';
import type { AroundLoad } from '@/lib/around/types';

/**
 * Dev harness: load a city's static weekend.json without a session.
 * Production: blocked.
 */
export default function AroundLabScreen() {
  const [city, setCity] = useState('calgary');
  const [load, setLoad] = useState<AroundLoad | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    fetchWeekendJson(city).then(setLoad);
  }, [city]);

  if (!__DEV__) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText>Dev only.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Around lab</ThemedText>
          <ThemedText themeColor="textSecondary">Static JSON only. No live Edmtrain from the phone.</ThemedText>
          <Pressable onPress={() => setCity('calgary')} style={styles.row}>
            <ThemedText type="smallBold">Calgary</ThemedText>
          </Pressable>
          <Pressable onPress={() => setCity('nowhere')} style={styles.row}>
            <ThemedText type="smallBold">nowhere (empty)</ThemedText>
          </Pressable>
          {load == null ? <ThemedText themeColor="textSecondary">Loading…</ThemedText> : null}
          {load?.status === 'empty' ? <ThemedText>{aroundEmptyCopy()}</ThemedText> : null}
          {load?.status === 'error' ? <ThemedText>{load.message}</ThemedText> : null}
          {load?.status === 'ok' ? (
            <ThemedText>
              {load.payload.shows.length} show{load.payload.shows.length === 1 ? '' : 's'} · {load.payload.weekendStart}–{load.payload.weekendEnd}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four },
  scroll: { gap: Spacing.three, paddingVertical: Spacing.four },
  row: { paddingVertical: Spacing.two },
});
