/**
 * Home — the daily check-in (wave92, emci 2026-10-09).
 *
 * One tap a day: +5 ATO tokens, every 7th check-in +10. A missed day never
 * resets the count. Tokens pay for AI views (a new Story, a Legends AI card,
 * a deep dive), so this card also says where tokens come from and what they
 * buy. No model call here: it only writes the ledger through the server.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { AI_TOKEN_PRICE, ATO_TOKEN_EARN } from '@/lib/ato-tokens';
import { claimDailyCheckin, fetchCheckinStatus } from '@/lib/ato-tokens-server';

export const CHECKIN_KICKER = 'Daily check-in';
export const CHECKIN_BUTTON = `Check in · +${ATO_TOKEN_EARN.daily_checkin} tokens`;
export const CHECKIN_DONE = 'Checked in today. A new check-in opens at midnight.';
export const checkinWeekLine = (count: number) =>
  `${count} of 7 this week · the 7th check-in pays +${ATO_TOKEN_EARN.checkin_week_bonus}.`;
export const checkinBalanceLine = (tokens: number) =>
  `You have ${tokens} tokens. Each AI view costs ${AI_TOKEN_PRICE}: a new Story, a Legends AI card, or a deep dive on Explore.`;

export function DailyCheckinCard({
  todayYmd,
  tokens,
  onEarned,
}: {
  /** The person's local YYYY-MM-DD (the server checks its own clock too). */
  todayYmd: string;
  tokens: number;
  /** Refresh the balance after a check-in. */
  onEarned: () => void;
}) {
  const theme = useTheme();
  const epoch = useAccountDataEpoch();
  const [checkedIn, setCheckedIn] = useState<boolean | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchCheckinStatus(todayYmd).then((status) => {
      if (!live || !status) return;
      setCheckedIn(status.checkedIn);
      setTotal(status.total);
    });
    return () => {
      live = false;
    };
  }, [todayYmd, epoch]);

  const checkIn = useCallback(async () => {
    if (busy || checkedIn) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await claimDailyCheckin();
      setCheckedIn(true);
      if (result.ok) {
        setTotal((n) => n + 1);
        setNote(`+${result.delta} tokens.`);
        onEarned();
      } else {
        // Already checked in (another phone): read the real count.
        const status = await fetchCheckinStatus(todayYmd);
        if (status) setTotal(status.total);
      }
    } catch {
      setNote('Couldn’t check in just now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }, [busy, checkedIn, onEarned, todayYmd]);

  // This week's check-ins so far (a missed day never resets the count).
  const weekCount = checkedIn ? ((total - 1) % 7) + 1 : total % 7;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {CHECKIN_KICKER}
      </ThemedText>
      {checkedIn ? (
        <ThemedText type="smallBold">{CHECKIN_DONE}</ThemedText>
      ) : (
        <Pressable
          onPress={() => void checkIn()}
          disabled={busy || checkedIn == null}
          accessibilityRole="button"
          accessibilityLabel={CHECKIN_BUTTON}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accentFill }, (pressed || busy) && styles.pressed]}>
          <ThemedText type="smallBold" style={[styles.buttonText, { color: theme.onAccent }]}>
            {busy ? 'Checking in…' : CHECKIN_BUTTON}
          </ThemedText>
        </Pressable>
      )}
      <View style={styles.lines}>
        {note ? <ThemedText type="small">{note}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {checkinWeekLine(Math.max(weekCount, 0))}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {checkinBalanceLine(tokens)}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  kicker: { textTransform: 'uppercase' },
  button: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonText: { flexShrink: 1, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  lines: { gap: 2 },
});
