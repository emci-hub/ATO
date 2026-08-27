import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteAccountSheet } from '@/components/delete-account-sheet';
import { ScanSheet } from '@/components/scan-sheet';
import { SharePoster } from '@/components/share-poster';
import { AppearancePicker } from '@/components/appearance-picker';
import { CityPicker } from '@/components/city-picker';
import { CrisisRegionPicker } from '@/components/crisis-region-picker';
import { KenneyCreditsCard } from '@/components/kenney-credits-card';
import { PushTestCard } from '@/components/push-test-card';
import { SentryTestCard } from '@/components/sentry-test-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useMe } from '@/hooks/use-me';
import { useMeContext } from '@/lib/me-context';
import { accentFromShowUp } from '@/lib/color';
import { addPeerByHandle } from '@/lib/circle';
import { useCircleContext } from '@/lib/circle-context';
import {
  fetchMyInviteCodes,
  fetchMyReferrals,
  type InviteCode,
  type Referral,
} from '@/lib/invite';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { copyLink, sharePoster } from '@/lib/share';
import { setCity, setVisible } from '@/lib/me';
import {
  CURRENT_FOCUS_CHIPS,
  ENERGY_PATTERN_CHIPS,
  EVENING_WIND_DOWN_CHIPS,
  MORNING_CUE_CHIPS,
  RECOVERY_STYLE_CHIPS,
  SUPPORT_STYLE_CHIPS,
  TALK_STYLE_CHIPS,
  chipLabel,
} from '@/lib/intake';
import { supabase } from '@/lib/supabase';

export default function YouScreen() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { session } = useSession();
  const { me, refresh } = useMe(session?.user.id);
  const { refresh: refreshMe } = useMeContext();
  const accent = accentFromShowUp(me?.show_up);
  const { refresh: refreshCircle } = useCircleContext();
  const [signingOut, setSigningOut] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const posterRef = useRef<View | null>(null);
  // Screen padding (2x24) + card padding (2x16) + margin for safety.
  const posterWidth = Math.min(320, windowWidth - 96);
  const hasAppleIdentity = !!session?.user.identities?.some(
    (identity) => identity.provider === 'apple',
  );

  useEffect(() => {
    if (!me) return;
    let active = true;
    Promise.all([fetchMyInviteCodes(), fetchMyReferrals()])
      .then(([codes, people]) => {
        if (!active) return;
        setInviteCodes(codes);
        setReferrals(people);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [me?.id]);

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

  async function handleCopyInvite(code: string) {
    await Clipboard.setStringAsync(code);
    setCopiedInvite(code);
    setTimeout(() => setCopiedInvite(null), 2000);
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
                      { backgroundColor: theme.accentFill },
                      pressed && styles.pressed,
                      sharing && styles.disabled,
                    ]}>
                    <MaterialCommunityIcons name="share-variant" size={18} color={theme.onAccent} />
                    <ThemedText type="smallBold" style={[styles.shareButtonText, { color: theme.onAccent }]}>
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
                <DetailRow label="Talk style" value={chipLabel(TALK_STYLE_CHIPS, me.talk_style)} />
                <DetailRow label="Knocks you off" value={me.knocks_you_off} />
                <DetailRow
                  label="Morning cue"
                  value={chipLabel(MORNING_CUE_CHIPS, me.morning_cue) || me.morning_cue}
                />
                {me.evening_wind_down ? (
                  <DetailRow
                    label="Evening wind-down"
                    value={chipLabel(EVENING_WIND_DOWN_CHIPS, me.evening_wind_down)}
                  />
                ) : null}
                {me.energy_pattern ? (
                  <DetailRow
                    label="Most energy"
                    value={chipLabel(ENERGY_PATTERN_CHIPS, me.energy_pattern)}
                  />
                ) : null}
                {me.recovery_style ? (
                  <DetailRow
                    label="What pulls me back"
                    value={chipLabel(RECOVERY_STYLE_CHIPS, me.recovery_style)}
                  />
                ) : null}
                {me.support_style ? (
                  <DetailRow
                    label="What helps"
                    value={chipLabel(SUPPORT_STYLE_CHIPS, me.support_style)}
                  />
                ) : null}
                {me.current_focus ? (
                  <DetailRow
                    label="Right now"
                    value={chipLabel(CURRENT_FOCUS_CHIPS, me.current_focus)}
                  />
                ) : null}
                <DetailRow label="Timezone" value={me.timezone} />
              </ThemedView>

              <AppearancePicker />

              <CityPicker
                value={me.city}
                onChange={(slug) => {
                  void setCity(me.id, slug).then(() => Promise.all([refresh(), refreshMe()]));
                }}
              />

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <ThemedText type="smallBold" style={styles.inviteHeading}>
                  Around
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.inviteHint}>
                  When you mark going, your face can show on that night. Colors still
                  count either way.
                </ThemedText>
                <Pressable
                  onPress={() => {
                    void setVisible(me.id, me.visible === false).then(() => Promise.all([refresh(), refreshMe()]));
                  }}
                  style={({ pressed }) => [styles.inviteRow, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">
                    {me.visible !== false ? 'Face is visible when I go' : 'Face is hidden when I go'}
                  </ThemedText>
                </Pressable>
              </ThemedView>

              <CrisisRegionPicker />

              <PushTestCard timeZone={me.timezone || 'UTC'} />
              <SentryTestCard />

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <ThemedText type="smallBold" style={styles.inviteHeading}>
                  Invite codes
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.inviteHint}>
                  Share a code to invite someone. Each code works once.
                </ThemedText>
                {inviteCodes.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No codes yet.
                  </ThemedText>
                ) : (
                  inviteCodes.map((invite) => {
                    const remaining = Math.max(0, invite.max_uses - invite.uses_count);
                    const usable = invite.status === 'active' && remaining > 0;
                    return (
                      <View key={invite.code} style={styles.inviteRow}>
                        <View style={styles.inviteInfo}>
                          <ThemedText type="smallBold">{invite.code}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {usable ? `${remaining} left` : 'used'}
                          </ThemedText>
                        </View>
                        {usable ? (
                          <Pressable
                            onPress={() => handleCopyInvite(invite.code)}
                            style={({ pressed }) => [pressed && styles.pressed]}>
                            <ThemedText type="link">
                              {copiedInvite === invite.code ? 'Copied' : 'Copy'}
                            </ThemedText>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <ThemedText type="smallBold" style={styles.inviteHeading}>
                  People you invited
                </ThemedText>
                {referrals.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Nobody yet. Only you can see this list.
                  </ThemedText>
                ) : (
                  referrals.map((person) => (
                    <DetailRow key={person.id} label={person.name} value={`@${person.handle}`} />
                  ))
                )}
              </ThemedView>

              <KenneyCreditsCard />
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
            <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </ThemedText>
          </Pressable>

          {/* Deletion lives below sign-out and opens a confirmation sheet — it
              never deletes on this tap. */}
          <Pressable
            onPress={() => setDeleting(true)}
            style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.deleteLinkText}>
              Delete account
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <DeleteAccountSheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        hasAppleIdentity={hasAppleIdentity}
      />

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
  inviteHeading: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  inviteHint: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  inviteInfo: {
    gap: Spacing.half,
    flex: 1,
  },
  signOutButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  deleteLinkText: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
