import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { AiConsentCard } from '@/components/ai-consent-card';
import { DeleteAccountSheet } from '@/components/delete-account-sheet';
import { ScanSheet } from '@/components/scan-sheet';
import { SharePoster } from '@/components/share-poster';
import { AppearancePicker } from '@/components/appearance-picker';
import { BirthdayRow } from '@/components/birthday-row';
import { CityPicker } from '@/components/city-picker';
import { CrisisRegionPicker } from '@/components/crisis-region-picker';
import { MilestoneBadges } from '@/components/check-milestone-badge';
import { IntakeSettings, TalkStylePicker } from '@/components/intake-settings';
import { QuestGrowthBars } from '@/components/quest-growth-bars';
import { VoicePresetPicker } from '@/components/voice-preset-picker';
import { SageFactsCard } from '@/components/sage-facts';
import { RunningUpdateLine } from '@/components/running-update-line';
import { SettingsFold } from '@/components/settings-fold';
import { OptionalIntakeFill } from '@/components/optional-intake';
import { FullProfileFold } from '@/components/full-profile-fold';
import { TraitBandsFold } from '@/components/trait-bands-fold';
import { TOKEN_LABEL, TOKEN_LEDE, tokenBalanceOf } from '@/lib/tokens';
import { KenneyCreditsCard } from '@/components/kenney-credits-card';
import { PasswordSettingsFold } from '@/components/password-settings-fold';
import { SageUsageFold } from '@/components/sage-usage';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useGrowth } from '@/hooks/use-growth';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { fetchChecks, type Check } from '@/lib/checks';
import { onChecksChanged } from '@/lib/checks-events';
import { depthTier, presenceTier } from '@/lib/growth';
import { useMeContext } from '@/lib/me-context';
import { addPeerByHandle } from '@/lib/circle';
import { useCircleContext } from '@/lib/circle-context';
import {
  fetchMyInviteCodes,
  fetchMyReferrals,
  inviteRemaining,
  inviteUsable,
  type InviteCode,
  type Referral,
} from '@/lib/invite';
import { triggerGesture } from '@/lib/kenney/gesture-actions';
import { copyLink, sharePoster } from '@/lib/share';
import { aiConsentFor, setCity, setVisible, setAiConsent } from '@/lib/me';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { supabase } from '@/lib/supabase';

const GROWTH_PREVIEW_KEY = 'ato.dev.growth-preview.v1';

export type GrowthPreview = { checkCount: number; factCount: number };

export async function readGrowthPreview(): Promise<GrowthPreview | null> {
  if (!__DEV__) return null;
  const raw = await AsyncStorage.getItem(GROWTH_PREVIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GrowthPreview;
    if (typeof parsed.checkCount !== 'number' || typeof parsed.factCount !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeGrowthPreview(next: GrowthPreview): Promise<void> {
  if (!__DEV__) return;
  await AsyncStorage.setItem(GROWTH_PREVIEW_KEY, JSON.stringify(next));
}

export async function clearGrowthPreview(): Promise<void> {
  if (!__DEV__) return;
  await AsyncStorage.removeItem(GROWTH_PREVIEW_KEY);
}

export default function YouScreen() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { session } = useSession();
  const userId = session?.user.id;
  const { me, refresh } = useMeContext();
  const { state: growth } = useGrowth();
  const { refresh: refreshCircle } = useCircleContext();
  const [checks, setChecks] = useState<Check[]>([]);
  const [growthPreview, setGrowthPreview] = useState<GrowthPreview | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askingConsent, setAskingConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const posterRef = useRef<View | null>(null);
  // Screen padding (2x24) + card padding (2x16) + margin for safety.
  const posterWidth = Math.min(320, windowWidth - 96);
  const hasAppleIdentity = !!session?.user.identities?.some(
    (identity) => identity.provider === 'apple',
  );

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = () => {
      fetchChecks(userId)
        .then((rows) => {
          if (!cancelled) setChecks(rows);
        })
        .catch((err) => {
          console.log('[you] fetchChecks error:', err);
        });
    };
    load();
    const unsub = onChecksChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!__DEV__) return;
      let cancelled = false;
      void readGrowthPreview().then((next) => {
        if (!cancelled) setGrowthPreview(next);
      });
      return () => {
        cancelled = true;
      };
    }, []),
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

  const checkCount = growthPreview?.checkCount ?? growth.checkCount;
  const factCount = growthPreview?.factCount ?? growth.factCount;
  const presence = growthPreview ? presenceTier(growthPreview.checkCount) : growth.presence;
  const depth = growthPreview ? depthTier(growthPreview.factCount) : growth.depth;

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

  async function saveCity(slug: string | null) {
    if (!me) return;
    setError(null);
    try {
      await setCity(me.id, slug);
      await refresh();
    } catch (err) {
      console.log('[you] setCity error:', err);
      setError(err instanceof Error ? err.message : 'Couldn\u2019t save your city. Try again.');
    }
  }

  async function saveVisible() {
    if (!me) return;
    setError(null);
    try {
      await setVisible(me.id, me.visible === false);
      await refresh();
    } catch (err) {
      console.log('[you] setVisible error:', err);
      setError(err instanceof Error ? err.message : 'Couldn\u2019t save that. Try again.');
    }
  }

  async function saveAiConsent(value: boolean) {
    if (!me || consentBusy) return;
    setConsentBusy(true);
    setError(null);
    try {
      await setAiConsent(me.id, value);
      setAskingConsent(false);
      await refresh();
    } catch (err) {
      console.log('[you] setAiConsent error:', err);
      setError('Couldn\u2019t save your choice. Try again.');
    } finally {
      setConsentBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scrollContent}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" style={styles.title}>You</ThemedText>
            {me?.is_founder ? (
              <View style={[styles.founderBadge, { backgroundColor: theme.accentFill }]}>
                <ThemedText type="code" style={{ color: theme.onAccent }}>
                  Founder
                </ThemedText>
              </View>
            ) : null}
          </View>

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
                      { borderColor: controlBorderColor(theme) },
                      pressed && styles.pressed,
                    ]}>
                    <MaterialCommunityIcons name="link-variant" size={18} color={theme.text} />
                    <ThemedText type="smallBold">{copied ? 'Copied' : 'Copy link'}</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => setScanning(true)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      { borderColor: controlBorderColor(theme) },
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

              <MilestoneBadges
                checkCount={checkCount}
                factCount={factCount}
                checks={checks}
                timeZone={me.timezone || 'UTC'}
                defaultOpen={false}
              />

              <QuestGrowthBars presence={presence} depth={depth} />

              <IntakeSettings
                me={me}
                onUpdated={() => refresh()}
              />

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <ThemedText type="smallBold" style={styles.inviteHeading}>
                  How Sage sounds
                </ThemedText>
                <TalkStylePicker me={me} onUpdated={() => refresh()} />
                <VoicePresetPicker me={me} onUpdated={() => refresh()} />
              </ThemedView>

              <SageFactsCard me={me} onUpdated={() => refresh()} />

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <Pressable
                  onPress={() => router.push('/questions')}
                  style={({ pressed }) => [styles.inviteRow, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">Tell Sage more</ThemedText>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/intake-sweep')}
                  style={({ pressed }) => [styles.inviteRow, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">A faster pass</ThemedText>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              </ThemedView>

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <Pressable
                  onPress={() => router.push('/week')}
                  style={({ pressed }) => [styles.inviteRow, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">Weeks</ThemedText>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              </ThemedView>

              <CrisisRegionPicker />

              <TraitBandsFold me={me} />

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <ThemedText type="smallBold">{TOKEN_LABEL}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {tokenBalanceOf(me)} · {TOKEN_LEDE}
                </ThemedText>
              </ThemedView>

              <FullProfileFold me={me} onUpdated={() => refresh()} />

              <OptionalIntakeFill me={me} onUpdated={() => refresh()} />

              <RunningUpdateLine />

              <AppearancePicker />

              <CityPicker
                value={me.city}
                onChange={(slug) => {
                  void saveCity(slug);
                }}
              />
              {error ? (
                <ThemedText themeColor="textSecondary">{error}</ThemedText>
              ) : null}

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <ThemedText type="smallBold" style={styles.inviteHeading}>
                  Around
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.inviteHint}>
                  When you mark yourself as going to a show, people there can see your
                  face. Your color still counts either way, whether or not you show your
                  face.
                </ThemedText>
                <Pressable
                  onPress={() => {
                    void saveVisible();
                  }}
                  style={({ pressed }) => [styles.inviteRow, pressed && styles.pressed]}>
                  <ThemedText type="smallBold">
                    {me.visible !== false
                      ? "Show my face on nights I'm going"
                      : "Don't show my face on nights I'm going"}
                  </ThemedText>
                </Pressable>
                {error ? (
                  <ThemedText themeColor="textSecondary" style={styles.inviteHint}>
                    {error}
                  </ThemedText>
                ) : null}
              </ThemedView>

              <YouDevToolsSlot timeZone={me.timezone || 'UTC'} />

              <ThemedView type="backgroundElement" style={styles.detailCard}>
                <ThemedText type="smallBold" style={styles.inviteHeading}>
                  Invite codes
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.inviteHint}>
                  Share a code to invite someone.
                </ThemedText>
                {inviteCodes.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No codes yet.
                  </ThemedText>
                ) : (
                  inviteCodes.map((invite) => {
                    const remaining = inviteRemaining(invite);
                    const usable = inviteUsable(invite);
                    const leftover =
                      remaining == null ? 'unlimited' : remaining > 0 ? `${remaining} left` : 'used';
                    return (
                      <View key={invite.code} style={styles.inviteRow}>
                        <View style={styles.inviteInfo}>
                          <ThemedText type="smallBold">{invite.code}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {usable ? leftover : 'used'}
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

              <SageUsageFold />
              <PasswordSettingsFold />
              <KenneyCreditsCard />

              <SettingsFold title="Account">
                <DetailRow label="Timezone" value={me.timezone} />
                <BirthdayRow me={me} onUpdated={() => refresh()} />
                <Pressable
                  onPress={() => {
                    if (aiConsentFor(me) === 'pending') {
                      setError(null);
                      setAskingConsent(true);
                      return;
                    }
                    void saveAiConsent(!me.ai_consent);
                  }}
                  style={({ pressed }) => [
                    styles.detailRow,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Sage's AI
                  </ThemedText>
                  <ThemedText type="small" style={styles.detailValue}>
                    {me.ai_consent === true ? 'On' : me.ai_consent === false ? 'Off' : 'Not set yet'}
                  </ThemedText>
                </Pressable>
                {error ? (
                  <ThemedText themeColor="textSecondary" style={styles.inviteHint}>
                    {error}
                  </ThemedText>
                ) : null}
              </SettingsFold>
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
              { backgroundColor: theme.backgroundElement, borderColor: controlBorderColor(theme) },
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

      <Modal
        visible={askingConsent}
        transparent
        animationType="fade"
        onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <AiConsentCard
              context="dawn"
              busy={consentBusy}
              onGrant={() => saveAiConsent(true)}
              onDeny={() => saveAiConsent(false)}
            />
            {error ? (
              <ThemedText themeColor="textSecondary">{error}</ThemedText>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

/**
 * Crash/push probes live behind the same compile-time `__DEV__` cut as
 * Stack.Protected labs. Production Metro also resolves the probe modules
 * to a null stub, so TestFlight never even contains the controls.
 */
function YouDevToolsSlot({ timeZone }: { timeZone: string }) {
  if (__DEV__) {
    const { YouDevTools } = require('@/components/you-dev-tools') as typeof import('@/components/you-dev-tools');
    return <YouDevTools timeZone={timeZone} />;
  }
  return null;
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  title: {
    flexShrink: 1,
  },
  founderBadge: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalContent: {
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth - Spacing.five,
    gap: Spacing.three,
  },
});
