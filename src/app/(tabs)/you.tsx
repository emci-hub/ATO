import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScanSheet } from '@/components/scan-sheet';
import { SharePoster } from '@/components/share-poster';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { accentFromShowUp } from '@/lib/color';
import { addPeerByHandle } from '@/lib/circle';
import { useCircleContext } from '@/lib/circle-context';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { copyLink, sharePoster } from '@/lib/share';
import { supabase } from '@/lib/supabase';

export default function YouScreen() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { session } = useSession();
  const { me } = useMe(session?.user.id);
  const accent = accentFromShowUp(me?.show_up);
  const { refresh: refreshCircle } = useCircleContext();
  const [signingOut, setSigningOut] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<View | null>(null);
  // Screen padding (2x24) + card padding (2x16) + margin for safety.
  const posterWidth = Math.min(320, windowWidth - 96);

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

  async function handleShare() {
    if (!me || sharing) return;
    setSharing(true);
    try {
      const outcome = await sharePoster(posterRef, me.handle);
      if (outcome.fellBackToCopy) setCopied(true);
      if (outcome.shared) triggerGesture('posterShared');
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyLink() {
    if (!me) return;
    await copyLink(me.handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              <ThemedView type="backgroundElement" style={styles.shareCard}>
                <View style={styles.posterRow}>
                  <SharePoster ref={posterRef} me={me} width={posterWidth} />
                </View>

                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Hold the poster or tap Share to send your ATO.
                </ThemedText>

                <View style={styles.actionRow}>
                  <Pressable
                    disabled={sharing}
                    onPress={handleShare}
                    onLongPress={handleShare}
                    style={({ pressed }) => [
                      styles.shareButton,
                      { backgroundColor: '#3c87f7' },
                      pressed && styles.pressed,
                      sharing && styles.disabled,
                    ]}>
                    <MaterialCommunityIcons name="share-variant" size={18} color="#ffffff" />
                    <ThemedText type="smallBold" style={styles.shareButtonText}>
                      {sharing ? 'Sharing…' : 'Share'}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={handleCopyLink}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <MaterialCommunityIcons name="link-variant" size={18} color={theme.text} />
                    <ThemedText type="smallBold">{copied ? 'Copied' : 'Copy link'}</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => setScanning(true)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <MaterialCommunityIcons name="qrcode-scan" size={18} color={theme.text} />
                    <ThemedText type="smallBold">Scan a QR</ThemedText>
                  </Pressable>
                </View>

                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  @{me.handle} is your public link. Scanning yours adds you to their Circle.
                </ThemedText>
              </ThemedView>

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

      <ScanSheet
        visible={scanning}
        onClose={() => setScanning(false)}
        onAdd={addPeerByHandle}
        onConnected={() => {
          triggerGesture('circleConnected');
          // Don't rely only on the realtime INSERT landing (it can be missed
          // during a navigator remount); refresh the shared circle truth so
          // the scanner's own Circle tab appears immediately.
          refreshCircle().catch(() => {});
        }}
      />
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
  shareCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'center',
  },
  posterRow: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  shareButtonText: {
    color: '#ffffff',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
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
