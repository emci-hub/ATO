import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { CategoriesFold } from '@/components/categories-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useMeContext } from '@/lib/me-context';

export default function CategoriesScreen() {
  const { me, refresh: refreshMe } = useMeContext();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
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

          <ThemedText type="subtitle">Categories</ThemedText>

          {me ? (
            <CategoriesFold me={me} onUpdated={() => refreshMe()} />
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
