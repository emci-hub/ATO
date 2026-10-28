import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConsentCard, AI_USE_DISCLOSURE } from '@/components/ai-consent-card';
import { AppearancePicker } from '@/components/appearance-picker';
import { BirthdayRow } from '@/components/birthday-row';
import { CityPicker } from '@/components/city-picker';
import { DeleteAccountSheet } from '@/components/delete-account-sheet';
import { HelplineRow } from '@/components/helpline-row';
import { LegalLinks } from '@/components/legal-links';
import { NotificationPrefsFold } from '@/components/notification-prefs-fold';
import { RunningUpdateLine } from '@/components/running-update-line';
import { SeasonalPrefsFold } from '@/components/seasonal-prefs-fold';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { hubAccess } from '@/lib/dev-access';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { DEV_PIN_AVAILABLE, useDevPinUnlocked } from '@/lib/dev-pin';
import { DEV_TOOLS_AVAILABLE } from '@/lib/dev-mode';
import { clearLocalAccountData } from '@/lib/local-account-data';
import { aiConsentFor, setAiConsent, setCity } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { SETTINGS_TITLE } from '@/lib/polish-copy';
import { supabase } from '@/lib/supabase';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import { DevUnlockRow } from '@/play/dev-unlock-row';

export const FEEDBACK_EMAIL = 'support@emgens.com';
export const SEND_FEEDBACK_LABEL = 'Send feedback';

/**
 * Settings — one pushed screen that holds every settings control (IA phase P1,
 * docs/ato-ia-runner.md). It opens from the gear on Home and the "Settings ›"
 * row on You. Everything here moved verbatim from You (and the dev rows from
 * Home); the invariants that kept those controls alive still hold:
 *
 * - **Delete account** — App Store 5.1.1(v): in-app account deletion. It opens
 *   a confirmation sheet and never deletes on the tap itself.
 * - **Sign out** — clears every `ato.*` key this account wrote on the device.
 * - **AI consent** — Apple 5.1.2: the disclosure renders unconditionally beside
 *   the consent control, and consent stays revocable here.
 * - **Build/update info** (`RunningUpdateLine`) — which OTA a bug report runs,
 *   and a 5-tap shortcut to `/dev-lab` (dev-gated).
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const { me, refresh, devAccess } = useMeContext();
  const pinUnlocked = useDevPinUnlocked();
  const devUnlocked = useDevAccessUnlocked();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);

  const hasAppleIdentity = !!session?.user.identities?.some(
    (identity) => identity.provider === 'apple',
  );
  const consent = me ? aiConsentFor(me) : 'pending';

  // 'admin' (a release build, root only) still gets the link: Admin lives in the Hub.
  const canSeeHub =
    hubAccess({
      toolsAvailable: DEV_TOOLS_AVAILABLE,
      isDev: __DEV__ || devUnlocked,
      isRoot: devAccess.isRoot,
      capabilities: devAccess.capabilities,
    }) !== 'none';
  const showDeveloper = canSeeHub || __DEV__ || DEV_PIN_AVAILABLE || pinUnlocked;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  async function handleSignOut() {
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.log('[settings] signOut error:', signOutError.message);
    }
    // Not just the session: every `ato.*` key this account wrote stays on the
    // device otherwise, and the next account signed in here reads it back.
    await clearLocalAccountData();
    setSigningOut(false);
    // The session guard in the root layout flips isAuthed to false on
    // SIGNOUT and declaratively routes back to /auth.
  }

  /** Opens a pre-addressed email. The running update id rides along so a report maps to its OTA. */
  async function sendFeedback() {
    setFeedbackNote(null);
    const subject = encodeURIComponent('ATO feedback');
    const body = encodeURIComponent(`

—
Update: ${Updates.updateId ?? 'original build'}`);
    try {
      await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
    } catch (err) {
      console.log('[settings] feedback mail error:', err);
      setFeedbackNote(`No mail app found. Email ${FEEDBACK_EMAIL}`);
    }
  }

  async function saveCity(slug: string | null) {
    if (!me) return;
    setError(null);
    try {
      await setCity(me.id, slug);
      await refresh();
    } catch (err) {
      console.log('[settings] setCity error:', err);
      setError(err instanceof Error ? err.message : 'Couldn’t save your city. Try again.');
    }
  }

  async function saveAiConsent(value: boolean) {
    if (!me || consentBusy) return;
    setConsentBusy(true);
    setError(null);
    try {
      await setAiConsent(me.id, value);
      await refresh();
    } catch (err) {
      console.log('[settings] setAiConsent error:', err);
      setError('Couldn’t save your choice. Try again.');
    } finally {
      setConsentBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* The dev PIN box sits at the bottom: lift it above the keyboard, and let
            Unlock take the first tap instead of only dismissing the keyboard. */}
        <ScrollView
          {...NO_PINCH_ZOOM}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              onPress={goBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <ThemedText type="link">‹ Back</ThemedText>
            </Pressable>
            <ThemedText type="subtitle">{SETTINGS_TITLE}</ThemedText>
          </View>

          <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
            Appearance
          </ThemedText>
          <AppearancePicker />

          {me ? (
            <>
              <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
                Profile details
              </ThemedText>
              <CityPicker
                value={me.city}
                onChange={(slug) => {
                  void saveCity(slug);
                }}
              />
              <SettingsFold title="Account">
                <BirthdayRow me={me} onUpdated={() => refresh()} />
              </SettingsFold>
            </>
          ) : null}

          <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
            Notifications
          </ThemedText>
          <NotificationPrefsFold />
          <SeasonalPrefsFold />

          <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
            Privacy &amp; AI
          </ThemedText>
          <SettingsFold title="ATO's AI" defaultOpen>
            <View style={styles.body}>
              <ThemedText type="small" themeColor="textSecondary">
                {AI_USE_DISCLOSURE}
              </ThemedText>
              {consent === 'pending' ? (
                <AiConsentCard
                  context="home"
                  busy={consentBusy}
                  onGrant={() => saveAiConsent(true)}
                  onDeny={() => saveAiConsent(false)}
                />
              ) : (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="ATO's AI"
                  accessibilityState={{ checked: consent === 'granted', busy: consentBusy }}
                  disabled={consentBusy || !me}
                  onPress={() => {
                    void saveAiConsent(consent !== 'granted');
                  }}
                  style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    ATO&apos;s AI
                  </ThemedText>
                  <ThemedText type="small">
                    {consentBusy ? 'Saving…' : consent === 'granted' ? 'On' : 'Off'}
                  </ThemedText>
                </Pressable>
              )}
              {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
            </View>
          </SettingsFold>

          <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
            Help &amp; legal
          </ThemedText>
          {/* One static helpline row (emci 2026-10-14). Never generated. */}
          <HelplineRow />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={SEND_FEEDBACK_LABEL}
            onPress={() => {
              void sendFeedback();
            }}
            style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
            <ThemedText type="link">{SEND_FEEDBACK_LABEL}</ThemedText>
          </Pressable>
          {feedbackNote ? (
            <ThemedText type="small" themeColor="textSecondary" selectable>
              {feedbackNote}
            </ThemedText>
          ) : null}
          <LegalLinks />

          <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
            Account
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ disabled: signingOut, busy: signingOut }}
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
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            onPress={() => setDeleting(true)}
            style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.deleteLinkText}>
              Delete account
            </ThemedText>
          </Pressable>

          <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
            About
          </ThemedText>
          <RunningUpdateLine />

          {showDeveloper ? (
            <>
              <ThemedText type="code" themeColor="textSecondary" style={styles.sectionHead}>
                Developer
              </ThemedText>
              {canSeeHub ? (
                <ThemedView type="backgroundElement" style={styles.boxCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dev Tools Hub"
                    onPress={() => router.push('/dev-lab')}
                    style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                    <View style={styles.boxRowText}>
                      <ThemedText type="smallBold">Dev Tools Hub</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Where this account is, jump, tests, admin
                      </ThemedText>
                    </View>
                    <ThemedText themeColor="textSecondary">›</ThemedText>
                  </Pressable>
                </ThemedView>
              ) : null}
              {__DEV__ ? (
                <ThemedView type="backgroundElement" style={styles.boxCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Pixel lab"
                    onPress={() => router.push('/pixel-lab')}
                    style={({ pressed }) => [styles.boxRow, pressed && styles.pressed]}>
                    <View style={styles.boxRowText}>
                      <ThemedText type="smallBold">Pixel lab</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Dev: faces + growth tiers
                      </ThemedText>
                    </View>
                    <ThemedText themeColor="textSecondary">›</ThemedText>
                  </Pressable>
                </ThemedView>
              ) : null}
              {/* The dev PIN box — the SAME component, PIN and lock as Divecore's hub.
                  Entering it shows the DEV bubble on every screen (and unlocks Divecore's
                  kit too). Gone once unlocked, and never shown outside pre-launch. */}
              {DEV_PIN_AVAILABLE && !pinUnlocked ? <DevUnlockRow /> : null}
              {pinUnlocked ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.deleteLinkText}>
                  Dev tools unlocked — use the DEV button.
                </ThemedText>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <DeleteAccountSheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        hasAppleIdentity={hasAppleIdentity}
      />
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
    gap: Spacing.one,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  sectionHead: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
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
  boxCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
  },
  boxRowText: {
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
