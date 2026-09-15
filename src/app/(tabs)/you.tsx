import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiConsentCard, AI_USE_DISCLOSURE } from '@/components/ai-consent-card';
import { DeleteAccountSheet } from '@/components/delete-account-sheet';
import { RebuiltNotice } from '@/components/rebuilt-notice';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useMeContext } from '@/lib/me-context';
import { aiConsentFor, setAiConsent } from '@/lib/me';
import { clearLocalAccountData } from '@/lib/local-account-data';
import { supabase } from '@/lib/supabase';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * You — PARKED, with three things deliberately kept alive (emci 2026-09-15,
 * ISOLATION_PLAN §7 Card F / O-1).
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
 *
 * These three are the whole screen. The AI-use disclosure renders
 * unconditionally beside the consent control, exactly as on Home.
 */
export default function YouScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const { me, refresh } = useMeContext();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">You</ThemedText>
          </View>

          <RebuiltNotice
            title="You"
            note="Your account controls below still work: AI consent, sign out, and deleting your account."
          />

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
