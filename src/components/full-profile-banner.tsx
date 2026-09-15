import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  hasSeenFullProfileUnlock,
  markFullProfileUnlockSeen,
} from '@/lib/full-profile-unlock';

/**
 * Questions' one-time "the profile is finished" announcement.
 *
 * Restored 2026-09-15 (emci): the celebration that used to live inside
 * `check-milestone-badge.tsx` as `FullProfileUnlockAck` went with the parked
 * milestone strip, so finishing the bank became a silent event — the screen
 * looked identical before and after the fiftieth answer.
 *
 * Two rules it exists to hold:
 *
 * 1. It is driven by `done`, which callers must pass straight from
 *    `isFullProfileDone` (`lib/full-profile-gate.ts`) — the SAME signal Home's
 *    unlocked state reads. The banner and the Home unlock can therefore never
 *    disagree; if this shows, "Load insight" / "Load story" are live.
 * 2. It never calls a model. It is copy and a coloured box. Finishing the bank
 *    must not spend a call nobody asked for (ISOLATION_PLAN Card B).
 *
 * Once per user, not once per mount: persisted through
 * `lib/full-profile-unlock.ts` (AsyncStorage, scoped by account id — no schema
 * change, which would need emci's sign-off). It marks itself seen as soon as it
 * renders, so a second visit to Questions is quiet.
 *
 * Unlike the ack it replaces, this does not fade out. It is an announcement the
 * user gets exactly one chance to read, so it holds for the visit rather than
 * disappearing after two seconds.
 */
export const FULL_PROFILE_ENABLED_COPY = 'Full profile enabled';
export const FULL_PROFILE_ENABLED_BODY =
  'Every question answered. Insight and Story are unlocked on Home.';

export function FullProfileBanner({
  userId,
  done,
}: {
  /** Account id the "already seen" flag is scoped to. */
  userId: string | undefined;
  /** `isFullProfileDone(tracks, tracksReady)` — never a locally re-derived count. */
  done: boolean;
}) {
  const theme = useTheme();
  // `null` is "we have not read storage yet" and must render nothing: showing
  // first and hiding after the read would flash the banner at every user who
  // has already seen it.
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId || !done) {
      setShow(false);
      return;
    }
    let cancelled = false;
    hasSeenFullProfileUnlock(userId)
      .then((seen) => {
        if (cancelled) return;
        setShow(!seen);
        if (!seen) void markFullProfileUnlockSeen(userId);
      })
      .catch(() => {
        // Storage is best-effort; a failed read must not swallow the one
        // announcement. Worst case it replays on the next visit.
        if (!cancelled) setShow(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, done]);

  if (show !== true) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: theme.accent }]}>
      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
        {FULL_PROFILE_ENABLED_COPY}
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.onAccent }}>
        {FULL_PROFILE_ENABLED_BODY}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },
});
