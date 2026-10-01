import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { claimFullProfileComplete } from '@/lib/ato-tokens-server';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { persistCelebratedMilestones } from '@/lib/me';
import { MILESTONE_DEFS } from '@/lib/milestones';
import {
  COMING_LATER_HEADING,
  COMING_LATER_LINE,
  INTAKE_REVEAL_MILESTONE_ID,
  INTAKE_REVEAL_SEEN_ID,
  INTAKE_TOKENS_PAID_LINE,
  INTAKE_UNLOCKED,
  INTAKE_UNLOCKED_HEADING,
  NEXT_ROUND_HEADING,
  NEXT_ROUND_UNLOCKS,
  SETTLED_EXPLAINER,
  UNLOCK_COPY_REVIEWED,
} from '@/lib/questions/progressive-unlock';
import { controlBorderColor } from '@/lib/theme/chrome';
import { isProfileSettled, settledAxisLabel, type TraitTrack } from '@/lib/trait-stability';

/**
 * Questions' one-time "you finished the 50" reveal: what just opened, and what
 * the next 25 are for.
 *
 * Grew out of the 2026-09-15 one-line banner (2026-10-01, emci): that banner
 * promised Story, which is not ready at 50, and said nothing about categories,
 * the next round or tokens. The lists now come from the one unlock table
 * (`lib/questions/progressive-unlock.ts`); the title and body are the
 * `profile_fully_unlocked` milestone def.
 *
 * Rules it exists to hold:
 *
 * 1. It is driven by `done`, which callers must pass straight from
 *    `isFullProfileDone` (`lib/full-profile-gate.ts`) — the SAME signal Home's
 *    unlocked state reads. The reveal and the Home unlock can therefore never
 *    disagree.
 * 2. It never calls a model. Finishing the bank must not spend a call nobody
 *    asked for (ISOLATION_PLAN Card B). Its one request is the token claim,
 *    which the server pays once ever, so asking again is a no-op.
 * 3. The +21 is only named when that claim says it is in the balance.
 *
 * Once per ACCOUNT, not per device: remembered as `INTAKE_REVEAL_SEEN_ID` in
 * `me.celebrated_milestone_ids` (wave43, already there — no schema change), so a reinstall or a second phone
 * does not replay it. It is marked seen on "Got it", not on render, so a reveal
 * nobody got to read comes back; a failed write means it shows once more.
 * `celebratedIds` is `undefined` until `me` has loaded and renders nothing —
 * showing first and hiding after would flash it at everyone who has seen it.
 */
const REVEAL_DEF = MILESTONE_DEFS.find((def) => def.id === INTAKE_REVEAL_MILESTONE_ID);

export function FullProfileBanner({
  userId,
  done,
  celebratedIds,
  tracks,
  onSeen,
}: {
  /** Account the "already seen" id is written to. */
  userId: string | undefined;
  /** `isFullProfileDone(tracks, tracksReady)` — never a locally re-derived count. */
  done: boolean;
  /** `me.celebrated_milestone_ids`; `undefined` while `me` is still loading. */
  celebratedIds: readonly string[] | undefined;
  tracks: readonly TraitTrack[];
  /** Refreshes `me` (the seen id, and the balance once the claim pays). */
  onSeen?: () => void | Promise<void>;
}) {
  const theme = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [paid, setPaid] = useState(false);

  const show =
    !!userId &&
    done &&
    !dismissed &&
    !!REVEAL_DEF &&
    celebratedIds !== undefined &&
    !celebratedIds.includes(INTAKE_REVEAL_SEEN_ID);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    claimFullProfileComplete()
      .then((result) => {
        if (cancelled || !result.ok) return;
        setPaid(true);
        if (!result.already) void onSeen?.();
      })
      .catch((err) => {
        console.log('[full-profile-reveal] token claim error:', err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one claim per showing; onSeen's identity must not re-fire it
  }, [show]);

  if (!show || !userId || !REVEAL_DEF) return null;

  function dismiss() {
    if (!userId) return;
    setDismissed(true);
    persistCelebratedMilestones(userId, [INTAKE_REVEAL_SEEN_ID])
      .then(() => onSeen?.())
      .catch((err) => {
        console.log('[full-profile-reveal] seen write error:', err);
      });
  }

  const unlocked = paid ? [...INTAKE_UNLOCKED, INTAKE_TOKENS_PAID_LINE] : INTAKE_UNLOCKED;

  return (
    <Modal visible animationType="fade" onRequestClose={dismiss}>
      <SafeAreaProvider style={[styles.provider, { backgroundColor: theme.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="subtitle" accessibilityRole="header">
              {REVEAL_DEF.title}
            </ThemedText>
            <ThemedText themeColor="textSecondary">{REVEAL_DEF.body}</ThemedText>
            {!UNLOCK_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
              <ThemedText type="code" themeColor="textSecondary">
                Draft copy — waiting on emci review.
              </ThemedText>
            ) : null}

            <RevealList heading={INTAKE_UNLOCKED_HEADING} lines={unlocked} />
            <RevealList heading={NEXT_ROUND_HEADING} lines={NEXT_ROUND_UNLOCKS} />

            <View style={styles.section}>
              <ThemedText type="smallBold">{settledAxisLabel(tracks)}</ThemedText>
              {isProfileSettled(tracks) ? null : (
                <ThemedText type="small" themeColor="textSecondary">
                  {SETTLED_EXPLAINER}
                </ThemedText>
              )}
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {COMING_LATER_HEADING}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {COMING_LATER_LINE}
              </ThemedText>
            </View>

            <ThemedPressable
              accessibilityRole="button"
              onPress={dismiss}
              style={[styles.button, { borderColor: controlBorderColor(theme) }]}>
              <ThemedText type="smallBold">Got it</ThemedText>
            </ThemedPressable>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function RevealList({ heading, lines }: { heading: string; lines: readonly string[] }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{heading}</ThemedText>
      {lines.map((line) => (
        <ThemedText key={line} type="small">
          • {line}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
  section: {
    gap: Spacing.one,
  },
  button: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
  },
});
