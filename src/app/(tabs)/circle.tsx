import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { fetchCircleFriends } from '@/play/circle-visits-store';
import type { CircleFriend } from '@/play/circle-visits';

type Load = { kind: 'loading' } | { kind: 'ok'; friends: CircleFriend[] } | { kind: 'error' };

/**
 * Circle — a plain friend list with Message (chat 1.1, emci 2026-10-21).
 *
 * Reads the same server list the Divecore Circle sheet reads (`circle_visit_friends`) and opens the
 * standalone `/chat` route. Visits and gifts stay in Divecore; nothing here imports game UI.
 */
export default function CircleScreen() {
  const theme = useTheme();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void fetchCircleFriends().then((res) => {
        if (cancelled) return;
        setLoad(res.kind === 'ok' ? { kind: 'ok', friends: res.value } : { kind: 'error' });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          contentContainerStyle={styles.scroll}
          contentInsetAdjustmentBehavior="never">
          <ThemedText type="subtitle">Circle</ThemedText>
          {load.kind === 'loading' ? (
            <ActivityIndicator />
          ) : load.kind === 'error' ? (
            <ThemedText themeColor="textSecondary">Could not load your Circle. Leave this tab and come back to try again.</ThemedText>
          ) : load.friends.length === 0 ? (
            <ThemedText themeColor="textSecondary">Scan a friend to add them to your Circle.</ThemedText>
          ) : (
            load.friends.map((f) => (
              <ThemedView
                key={f.peer}
                type="backgroundElement"
                style={[styles.row, { borderColor: controlBorderColor(theme) }]}>
                <ThemedText style={styles.handle}>{`@${f.handle}`}</ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Message @${f.handle}`}
                  onPress={() => router.push({ pathname: '/chat', params: { peer: f.peer, handle: f.handle } })}
                  style={[styles.button, { borderColor: controlBorderColor(theme) }]}>
                  <ThemedText>Message</ThemedText>
                </Pressable>
              </ThemedView>
            ))
          )}
          <View style={styles.note}>
            <ThemedText themeColor="textSecondary">Visits and gifts are in Divecore.</ThemedText>
          </View>
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
  scroll: {
    gap: Spacing.three,
    paddingTop: NAV_PIXEL_HEADER_INSET,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  handle: {
    flexShrink: 1,
  },
  button: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  note: {
    paddingTop: Spacing.two,
  },
});
