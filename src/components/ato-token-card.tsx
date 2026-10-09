/**
 * ATO token balance + the last few earns and spends. The economy is: +21 for
 * finishing the 48 intake questions, +21 per finished 16-question round; rerolls cost
 * 10 (Legend), 1 (category), 1 (question). Read-only — nothing here spends.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InfoReveal } from '@/components/info-reveal';
import { useRoundProgress } from '@/components/progress-ring';
import { Coin } from '@/components/set-done-moment';
import { TickBar } from '@/components/set-progress';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { fullProfileProgress, isFullProfileDone } from '@/lib/full-profile-gate';
import { TOKEN_NEXT_LABEL, TOKEN_RULES_LABEL } from '@/lib/polish-copy';
import { ONGOING_ROUND_SIZE } from '@/lib/questions/tiered-axis-plan';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { ATO_TOKEN_HOW_LINES, ATO_TOKEN_LABEL, ATO_TOKEN_LEDE, atoTokenBalanceOf } from '@/lib/ato-tokens';
import { fetchAtoTokenEvents, type AtoTokenEvent } from '@/lib/ato-tokens-server';
import { INTAKE_TOTAL } from '@/lib/questions/intake-stage';

/** Plain words for each ledger reason. An unknown reason shows as "Tokens". */
export const ATO_TOKEN_REASON_LABEL: Record<string, string> = {
  full_profile_complete: 'Finished the intake questions',
  ongoing_round_complete: 'Finished a set of 16',
  // wave92: the daily check-in (every 7th pays the week bonus) and AI views.
  daily_checkin: 'Daily check-in',
  checkin_week_bonus: '7th check-in bonus',
  ai_spend: 'AI view',
  ai_refund: 'AI view refunded',
  // The 10-token spend now unlocks a name style on the identity card (You).
  legend_reroll: 'Name style unlocked',
  category_reroll: 'Category reroll',
  question_reroll: 'Question reroll',
};

export function atoTokenEventLine(event: { delta: number; reason: string }): string {
  const label = ATO_TOKEN_REASON_LABEL[event.reason] ?? 'Tokens';
  return `${event.delta > 0 ? '+' : ''}${event.delta} · ${label}`;
}

export function AtoTokenCard({ me }: { me: { id: string; ato_tokens?: number | null } }) {
  const theme = useTheme();
  const balance = atoTokenBalanceOf(me);
  const [events, setEvents] = useState<AtoTokenEvent[] | null>(null);

  // Re-read the short history whenever the balance moves.
  useEffect(() => {
    let cancelled = false;
    fetchAtoTokenEvents(5)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((err) => {
        console.log('[ato-tokens] events error:', err);
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [me.id, balance]);

  // Where the next +21 comes from: the 48 while the intake is open, then the
  // current round of 16. Two plain reads, no model call.
  // You stays mounted, so re-read on every focus (and after a dev jump).
  const [tracks, setTracks] = useState<TraitTrack[] | null>(null);
  const dataEpoch = useAccountDataEpoch();
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchTraitTracks(me.id)
        .then((rows) => {
          if (!cancelled) setTracks(rows);
        })
        .catch((err) => console.log('[ato-tokens] tracks error:', err));
      return () => {
        cancelled = true;
      };
      // balance / dataEpoch: a payout, a dev jump or Start over moved the answers.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me.id, balance, dataEpoch]),
  );
  const intakeDone = tracks ? isFullProfileDone(tracks, true) : null;
  const roundAnswered = useRoundProgress(intakeDone ? me.id : undefined, tracks);
  const next =
    intakeDone == null
      ? null
      : intakeDone
        ? roundAnswered == null
          ? null
          : { done: roundAnswered, total: ONGOING_ROUND_SIZE }
        : { done: fullProfileProgress(tracks ?? []).answered, total: INTAKE_TOTAL };

  return (
    <ThemedView type="backgroundElement" style={styles.card} testID="ato-token-card">
      <View style={styles.row}>
        <View style={styles.labelRow}>
          <Coin size={28} />
          <ThemedText type="smallBold">{ATO_TOKEN_LABEL}</ThemedText>
        </View>
        <ThemedText type="subtitle" accessibilityLabel={`${balance} ${ATO_TOKEN_LABEL}`}>
          {balance}
        </ThemedText>
      </View>
      {next ? (
        <View style={styles.next}>
          <View style={styles.row}>
            <ThemedText type="code" themeColor="textSecondary">
              {TOKEN_NEXT_LABEL}
            </ThemedText>
            <ThemedText type="code" themeColor="textSecondary">
              {next.done} of {next.total}
            </ThemedText>
          </View>
          {next.total <= ONGOING_ROUND_SIZE ? (
            <TickBar filled={next.done} total={next.total} />
          ) : (
            <TickBar filled={Math.round((next.done / next.total) * ONGOING_ROUND_SIZE)} total={ONGOING_ROUND_SIZE} />
          )}
        </View>
      ) : null}
      {events && events.length > 0 ? (
        <View style={styles.events}>
          {events.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.backgroundSelected, borderRadius: theme.cutCorners ? 0 : 6 },
                ]}>
                <ThemedText
                  type="codeBold"
                  style={{ color: event.delta > 0 ? theme.accentTertiary : theme.accentSecondary }}>
                  {event.delta > 0 ? '+' : ''}
                  {event.delta}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={atoTokenEventLine(event)}>
                {ATO_TOKEN_REASON_LABEL[event.reason] ?? 'Tokens'}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : events ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing earned yet. Finish the {INTAKE_TOTAL} questions for your first 21.
        </ThemedText>
      ) : null}
      {/* The rules, one tap away instead of a paragraph on the card. */}
      <InfoReveal label={TOKEN_RULES_LABEL}>
        <ThemedText type="small" themeColor="textSecondary">
          {ATO_TOKEN_LEDE}
        </ThemedText>
        {ATO_TOKEN_HOW_LINES.map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </InfoReveal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  next: { gap: Spacing.one },
  events: { gap: Spacing.one, marginTop: Spacing.one },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { minWidth: 40, alignItems: 'center', paddingVertical: 2, paddingHorizontal: Spacing.one },
});
