import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtoTokenCard } from '@/components/ato-token-card';
import { IdentityCard } from '@/components/identity-card';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ProfileCharacter } from '@/components/profile-character';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { YourWeekCard } from '@/components/your-week-card';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { fetchHomeBootstrap } from '@/lib/home-bootstrap';
import { useMeContext } from '@/lib/me-context';
import { SETTINGS_TITLE } from '@/lib/polish-copy';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import type { TraitTrack } from '@/lib/trait-stability';

/**
 * You — who you are, your tokens, and your week. Every settings control (look,
 * city, birthday, notifications, AI consent, help, legal, sign out, delete
 * account, build info, developer rows) moved to the pushed `/settings` screen
 * (IA phase P1, docs/ato-ia-runner.md); this screen keeps one "Settings ›" row.
 *
 * "This is you so far" (`ProfileCharacter`) lives only here (IA phase P2): at
 * the top, whenever trait tracks exist — also after the profile is done. It
 * reads the same one-RPC `home_bootstrap` fetch Home uses, with the same guards.
 * A failed or empty load renders nothing.
 *
 * The saved-facts list ("Teach Sage") has been hidden since 2026-10-14; the
 * data stays until docs/sage-cleanup.md drops it.
 */
export default function YouScreen() {
  const router = useRouter();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh } = useMeContext();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  // Whose `tracks` these are. Tabs stay mounted, so for one render after an
  // account switch `tracks` still belongs to the previous account.
  const [tracksUserId, setTracksUserId] = useState<string | null>(null);

  const timeZone = me?.timezone || 'UTC';
  /**
   * Same guards as Home. `loadedOnceRef` — a failed refetch must not wipe tracks
   * already shown. `requestIdRef` — two quick focuses can resolve out of order, so
   * only the newest request may write.
   */
  const loadedOnceRef = useRef(false);
  const requestIdRef = useRef(0);
  const reloadTracks = useCallback(async () => {
    if (!userId || !me) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    try {
      const next = await fetchHomeBootstrap(timeZone);
      if (requestId !== requestIdRef.current) return;
      loadedOnceRef.current = true;
      setTracks(next.tracks);
      setTracksUserId(userId);
    } catch (err) {
      // Nothing to show on a failed load; keep whatever was already loaded.
      console.log('[you] bootstrap error:', err);
    }
  }, [userId, me, timeZone]);

  useEffect(() => {
    // A new account starts from nothing: the old account's tracks and any
    // in-flight request must not carry over.
    loadedOnceRef.current = false;
    requestIdRef.current += 1;
    setTracks([]);
    setTracksUserId(null);
  }, [userId]);

  // Refetch on FOCUS: tabs stay mounted, so answering questions elsewhere would
  // otherwise leave this card stale until the app restarted.
  useFocusEffect(
    useCallback(() => {
      void reloadTracks();
    }, [reloadTracks]),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          {...NO_PINCH_ZOOM}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">You</ThemedText>
          </View>

          {/* "This is you so far": shown whenever tracks exist, also after the profile is done. */}
          {userId && tracksUserId === userId && tracks.length > 0 ? (
            <ProfileCharacter tracks={tracks} />
          ) : null}

          {/* Who you are in two or three words, and the image to send a friend. */}
          {me ? <IdentityCard me={me} onUpdated={refresh} /> : null}

          {/* Tokens: the balance and the last few earns / spends. */}
          {me ? <AtoTokenCard me={me} /> : null}

          {/* The last seven days in three counts. Local + one read, no AI. */}
          {me ? <YourWeekCard me={me} /> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SETTINGS_TITLE}
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>
            <ThemedView type="backgroundElement" style={styles.settingsCard}>
              <ThemedText type="smallBold">{SETTINGS_TITLE}</ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </ThemedView>
          </Pressable>
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
  settingsRow: {
    minHeight: 44,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.four,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.8,
  },
});
