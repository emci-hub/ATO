import * as Linking from 'expo-linking';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeleteAccountSheet } from '@/components/delete-account-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import {
  accessDateFor,
  formatDateForLocale,
  isReadableBornOn,
  localAgeEntryFor,
  resolveAgeGate,
  UNDER_18_MESSAGE,
} from '@/lib/age';
import { useMeContext } from '@/lib/me-context';
import { cancelAllScheduledPush } from '@/lib/push';
import { clearLocalSession } from '@/lib/supabase';
import { controlBorderColor } from '@/lib/theme/chrome';

/** Same address as You's "Send feedback" and the legal pages (check:age pins the match). */
export const SUPPORT_EMAIL = 'support@emgens.com';

export const DELETE_NOTE =
  'Deleting your account is permanent. If you leave it, we keep your account and everything in it just as it is.';

/**
 * Under-18 access block (emci 2026-10-20, docs/under18-access.md).
 *
 * The root layout routes here instead of the app when the signed-in account's
 * born_on (or, with no birthday on file, the date they just typed on
 * /confirm-age) says they are under 18 today. Nothing here writes by itself: no
 * tabs, AI, push, Circle or Divecore are mounted, and this phone's scheduled
 * reminders are cancelled (OS only). The actions are Email support, Sign out,
 * and the existing "Delete account" sheet (typed DELETE, Apple revoke) — the
 * only way anything changes on the server is if they choose to delete. On the
 * 18th birthday the layout stops routing here by itself.
 */
export default function Under18Screen() {
  const { me } = useMeContext();

  // No push while blocked: drop this phone's local reminder schedules (OS only;
  // nothing on the server changes). PushRuntime re-schedules them once they are 18.
  useEffect(() => {
    void cancelAllScheduledPush();
  }, []);

  const gate = resolveAgeGate(me?.born_on, localAgeEntryFor(me?.id));
  return <Under18View bornOn={gate.bornOn} />;
}

/** The block screen itself. `preview` (dev age-gate preview only) turns every action into a no-op note. */
export function Under18View({ bornOn, preview = false }: { bornOn: string | null; preview?: boolean }) {
  const backOn = isReadableBornOn(bornOn) ? formatDateForLocale(accessDateFor(bornOn)) : null;

  return (
    <AgeGateFrame>
      <ThemedText type="subtitle">{UNDER_18_MESSAGE}</ThemedText>

      <ThemedText>
        Your account and everything in it are safe. Nothing has been deleted or changed.
      </ThemedText>

      <ThemedText>
        {backOn
          ? `You'll get back in on your 18th birthday, ${backOn}. Just open the app that day. There's nothing you need to do.`
          : "You'll get back in on your 18th birthday. Just open the app that day. There's nothing you need to do."}
      </ThemedText>

      <AgeGateActions preview={preview} mailSubject="ATO account (under 18)" />
    </AgeGateFrame>
  );
}

/** Full-screen frame shared by the block and confirm-age screens. */
export function AgeGateFrame({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Email support, Sign out, and Delete account — for the block and confirm-age
 * screens, which sit outside the tabs shell. Delete opens the same
 * DeleteAccountSheet the You tab uses (typed DELETE, Apple revoke line); it
 * needs only the theme, the session and Supabase, all mounted at the root.
 */
export function AgeGateActions({ preview, mailSubject }: { preview: boolean; mailSubject: string }) {
  const theme = useTheme();
  const { session } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const hasAppleIdentity = !!session?.user.identities?.some(
    (identity) => identity.provider === 'apple',
  );

  async function handleSignOut() {
    if (signingOut) return;
    if (preview) {
      setNote('Preview: Sign out would end the session on this phone. Nothing happened.');
      return;
    }
    setSigningOut(true);
    await clearLocalSession();
    setSigningOut(false);
    // The root layout sees the session go and routes back to /auth.
  }

  async function emailSupport() {
    setNote(null);
    if (preview) {
      setNote(`Preview: this opens a mail to ${SUPPORT_EMAIL}.`);
      return;
    }
    const subject = encodeURIComponent(mailSubject);
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
    } catch {
      setNote(`No mail app found. Email ${SUPPORT_EMAIL}`);
    }
  }

  return (
    <>
      <ThemedText themeColor="textSecondary">
        {"Questions? Email us and we'll help."}
      </ThemedText>

      <Pressable
        accessibilityRole="link"
        onPress={() => void emailSupport()}
        style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
        <ThemedText type="link">Email support</ThemedText>
      </Pressable>
      {note ? (
        <ThemedText type="small" themeColor="textSecondary" selectable>
          {note}
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => void handleSignOut()}
        disabled={signingOut}
        style={({ pressed }) => [
          styles.signOutButton,
          { backgroundColor: theme.backgroundElement, borderColor: controlBorderColor(theme) },
          pressed && styles.pressed,
          signingOut && styles.disabled,
        ]}>
        <ThemedText type="smallBold">{signingOut ? 'Signing out…' : 'Sign out'}</ThemedText>
      </Pressable>

      <ThemedText type="small" themeColor="textSecondary" style={styles.deleteNote}>
        {DELETE_NOTE}
      </ThemedText>
      {/* Opens the confirmation sheet; it never deletes on this tap. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setDeleting(true)}
        style={({ pressed }) => [styles.deleteLink, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.deleteLinkText}>
          Delete my account
        </ThemedText>
      </Pressable>

      <DeleteAccountSheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        hasAppleIdentity={hasAppleIdentity}
        preview={preview}
      />
    </>
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
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
  },
  linkRow: {
    alignItems: 'flex-start',
    paddingVertical: Spacing.two,
  },
  signOutButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  deleteNote: {
    paddingTop: Spacing.three,
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
