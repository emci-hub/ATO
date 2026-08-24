import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SharePoster } from '@/components/share-poster';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

interface PublicProfile {
  id: string;
  name: string;
  handle: string;
  show_up: string;
  talk_style: string;
  recipe: unknown;
}

/**
 * Public poster at /@handle — the link the QR and Share sheet point at.
 * Works signed in or out; only the poster fields are exposed (see the
 * public_profile function, which never returns knocks/morning fields).
 */
export default function PublicHandleScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<'loading' | 'found' | 'missing'>('loading');

  useEffect(() => {
    if (!handle) {
      setState('missing');
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.rpc('public_profile', { p_handle: String(handle) });
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setState('missing');
          return;
        }
        setProfile(data[0] as PublicProfile);
        setState('found');
      } catch {
        if (!cancelled) setState('missing');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {state === 'loading' ? (
          <ThemedText themeColor="textSecondary">Loading…</ThemedText>
        ) : state === 'found' && profile ? (
          <View style={styles.centerWrap}>
            <SharePoster me={profile} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {profile.name} on ATO
            </ThemedText>
          </View>
        ) : (
          <ThemedText themeColor="textSecondary">
            No ATO at that handle yet.
          </ThemedText>
        )}
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
    paddingVertical: Spacing.five,
  },
  centerWrap: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
});
