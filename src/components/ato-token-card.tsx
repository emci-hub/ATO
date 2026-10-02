/**
 * ATO token balance + the last few earns and spends. The economy is: +21 for
 * finishing the 50 questions, +21 per finished 25-question round; rerolls cost
 * 10 (Legend), 1 (category), 1 (question). Read-only — nothing here spends.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ATO_TOKEN_HOW_LINES, ATO_TOKEN_LABEL, ATO_TOKEN_LEDE, atoTokenBalanceOf } from '@/lib/ato-tokens';
import { fetchAtoTokenEvents, type AtoTokenEvent } from '@/lib/ato-tokens-server';

/** Plain words for each ledger reason. An unknown reason shows as "Tokens". */
export const ATO_TOKEN_REASON_LABEL: Record<string, string> = {
  full_profile_complete: 'Finished the 50 questions',
  ongoing_round_complete: 'Finished a round of 25',
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

  return (
    <ThemedView type="backgroundElement" style={styles.card} testID="ato-token-card">
      <View style={styles.row}>
        <ThemedText type="smallBold">{ATO_TOKEN_LABEL}</ThemedText>
        <ThemedText type="subtitle" accessibilityLabel={`${balance} ${ATO_TOKEN_LABEL}`}>
          {balance}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {ATO_TOKEN_LEDE}
      </ThemedText>
      <View style={styles.events}>
        {ATO_TOKEN_HOW_LINES.map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </View>
      {events && events.length > 0 ? (
        <View style={styles.events}>
          {events.map((event) => (
            <ThemedText key={event.id} type="small" themeColor="textSecondary">
              {atoTokenEventLine(event)}
            </ThemedText>
          ))}
        </View>
      ) : events ? (
        <ThemedText type="small" themeColor="textSecondary">
          Nothing earned yet. Finish the 50 questions for your first 21.
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  events: { gap: Spacing.half, marginTop: Spacing.one },
});
