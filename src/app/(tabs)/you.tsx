import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConsentCard, AI_USE_DISCLOSURE } from '@/components/ai-consent-card';
import { AppearancePicker } from '@/components/appearance-picker';
import { BirthdayRow } from '@/components/birthday-row';
import { CityPicker } from '@/components/city-picker';
import { NotificationPrefsFold } from '@/components/notification-prefs-fold';
import { DeleteAccountSheet } from '@/components/delete-account-sheet';
import { AtoTokenCard } from '@/components/ato-token-card';
import { IdentityCard } from '@/components/identity-card';
import { RunningUpdateLine } from '@/components/running-update-line';
import { SageFactsCard } from '@/components/sage-facts';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { DEV_PIN_AVAILABLE, useDevPinUnlocked } from '@/lib/dev-pin';
import { useMeContext } from '@/lib/me-context';
import { DevUnlockRow } from '@/play/dev-unlock-row';
import { aiConsentFor, setAiConsent, setCity } from '@/lib/me';
import { clearLocalAccountData } from '@/lib/local-account-data';
import { supabase } from '@/lib/supabase';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';

export const FEEDBACK_EMAIL = 'support@asstrollogs.com';
export const SEND_FEEDBACK_LABEL = 'Send feedback';

/**
 * You — no longer shown as parked (2026-10-01, emci): the full-screen "Rebuilt"
 * notice is gone because half the screen works. It now also shows the ATO token
 * balance + recent history, and what Sage has saved about you (see / delete).
 * The rest below is the history of what was kept alive while it was parked.
 *
 * Was: PARKED, with four things deliberately kept alive (emci 2026-09-15,
 * ISOLATION_PLAN §7 Card F / O-1; build/update info restored 2026-09-15).
 *
 * Everything this screen used to hold is gone pending rebuild: the profile
 * card and share poster, growth bars and milestone badges, invites and
 * referrals, the scan sheet, city / birthday / crisis-region / appearance /
 * voice / talk-style pickers, notification prefs, tokens, Sage usage, password
 * settings, facts, Kenney credits, and the dev-tools slot.
 *
 * What stays, and why it is not up for parking:
 * 1. **Delete account** — App Store review requires in-app account deletion
 *    (guideline 5.1.1(v)). Parking it would fail review outright.
 * 2. **Sign out** — without it there is no way off an account on a device.
 * 3. **Sage's AI consent** — Apple 5.1.2, and it is the switch the Home
 *    insight and Story generation read. It must be revocable somewhere other
 *    than the one-time ask on Home.
 * 4. **Build/update info** (`RunningUpdateLine`) — app version + build, the
 *    running OTA update's short id, when it was published (local time),
 *    channel/runtime, and an "Original build" vs "OTA update" label. Not a
 *    safety/App-Store invariant like 1-3, but load-bearing for support: it is
 *    how emci tells which OTA a bug report is actually running, and it is
 *    the only entrance to `/ai-lab` (5 taps, dev-gated).
 *
 * These four are the whole screen. The AI-use disclosure renders
 * unconditionally beside the consent control, exactly as on Home.
 */
export default function YouScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const { me, refresh } = useMeContext();
  const pinUnlocked = useDevPinUnlocked();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);

  const hasAppleIdentity = !!session?.user.identities?.some(
    (identity) => identity.provider === 'apple',
  );
  const consent = me ? aiConsentFor(me) : 'pending';

  async function handleSignOut() {
    setSigningOut(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.log('[you] signOut error:', signOutError.message);
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
      console.log('[you] feedback mail error:', err);
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
      console.log('[you] setCity error:', err);
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
      console.log('[you] setAiConsent error:', err);
      setError('Couldn’t save your choice. Try again.');
    } finally {
      setConsentBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* The dev PIN box is the last thing on this screen: lift it above the keyboard,
            and let Unlock take the first tap instead of only dismissing the keyboard. */}
        <ScrollView
          {...NO_PINCH_ZOOM}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">You</ThemedText>
          </View>

          {/* Who you are in two words, and the image to send a friend. */}
          {me ? <IdentityCard me={me} onUpdated={refresh} /> : null}

          {/* Tokens: the balance and the last few earns / spends. */}
          {me ? <AtoTokenCard me={me} /> : null}

          {/* What Sage has saved about you — the only place to see and delete it. */}
          {me ? <SageFactsCard me={me} onUpdated={refresh} /> : null}

          <RunningUpdateLine />

          {/* Restored 2026-10-04 (emci): themes, city, birthday, notifications.
              The share poster is not back — the identity card above already has
              "Share my card". */}
          <AppearancePicker />

          {me ? (
            <>
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

          <NotificationPrefsFold />

          <SettingsFold title="Sage's AI" defaultOpen>
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
                  accessibilityRole="button"
                  disabled={consentBusy || !me}
                  onPress={() => {
                    void saveAiConsent(consent !== 'granted');
                  }}
                  style={({ pressed }) => [styles.detailRow, pressed && styles.pressed]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Sage&apos;s AI
                  </ThemedText>
                  <ThemedText type="small">
                    {consentBusy ? 'Saving…' : consent === 'granted' ? 'On' : 'Off'}
                  </ThemedText>
                </Pressable>
              )}
              {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
            </View>
          </SettingsFold>

          <Pressable
            accessibilityRole="link"
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

          {/* The dev PIN box — the SAME component, PIN and lock as Divecore's hub.
              Entering it shows the DEV bubble on every screen (and unlocks Divecore's
              kit too). Gone once unlocked, and never shown outside pre-launch. */}
          {DEV_PIN_AVAILABLE && !pinUnlocked ? <DevUnlockRow /> : null}
          {pinUnlocked ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.deleteLinkText}>
              Dev tools unlocked — use the DEV button.
            </ThemedText>
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
    paddingRight: NAV_PIXEL_HEADER_INSET,
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
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
