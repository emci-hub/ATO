import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { accentFromShowUp } from '@/lib/color';
import { supabase } from '@/lib/supabase';

export default function YouScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const { me } = useMe(session?.user.id);
  const accent = accentFromShowUp(me?.show_up);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log('[you] signOut error:', error.message);
    }
    setSigningOut(false);
    // The session guard in the root layout flips isAuthed to false on
    // SIGNOUT and declaratively routes back to /auth.
  }

  const initials = me?.name
    ? me.name
        .trim()
        .split(/\s+/)
        .map((part) => part[0]?.toUpperCase())
        .filter(Boolean)
        .slice(0, 2)
        .join('') || '?'
    : '?';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="subtitle">You</ThemedText>

          {me ? (
            <>
              <ThemedView type="backgroundElement" style={styles.profileCard}>
                <View style={[styles.avatar, { backgroundColor: accent.light }]}>
                  <ThemedText type="smallBold" style={styles.avatarText}>
                    {initials}
                  </ThemedText>
                </View>
                <View style={styles.profileInfo}>
                  <ThemedText type="smallBold" style={styles.nameText}>
                    {me.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    @{me.handle}
                  </ThemedText>
                </View>
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <DetailRow label="Show up" value={me.show_up} />
                <DetailRow label="Talk style" value={me.talk_style} />
                <DetailRow label="Knocks you off" value={me.knocks_you_off} />
                <DetailRow label="Morning cue" value={me.morning_cue} />
                <DetailRow label="Timezone" value={me.timezone} />
              </ThemedView>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">
              Your profile hasn&apos;t loaded yet.
            </ThemedText>
          )}

          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ pressed }) => [
              styles.signOutButton,
              { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
              signingOut && styles.disabled,
            ]}>
            <ThemedText type="smallBold" style={[styles.signOutText, { color: '#E5484D' }]}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small" style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
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
    paddingBottom: BottomTabInset + Spacing.four,
  },
  profileCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
  },
  profileInfo: {
    gap: Spacing.half,
    flex: 1,
  },
  nameText: {
    fontSize: 18,
  },
  detailCard: {
    borderRadius: Spacing.four,
    padding: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
  },
  signOutButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
