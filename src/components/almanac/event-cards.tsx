import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ALMANAC_BANK, almanac, type AlmanacCard } from '@/lib/almanac';
import type { AlmanacDay } from '@/hooks/use-almanac-day';
import { eventYear } from '@/lib/almanac/community';
import { deckKey } from '@/lib/insight-collection';
import { recordDeckCardSeen } from '@/lib/insight-collection-store';
import { controlBorderColor } from '@/lib/theme/chrome';

/** Deck cards (fact / contrast) written for one event: the "3 / 5" total. */
export function deckTotalFor(eventId: string, bank: readonly AlmanacCard[] = ALMANAC_BANK): number {
  return bank.filter((c) => c.event === eventId && (c.kind === 'fact' || c.kind === 'contrast')).length;
}

/** The name of the event the card belongs to (not necessarily today's winner). */
export function eventNameFor(day: AlmanacDay, eventId: string): string {
  return day.theme.active.find((e) => e.id === eventId)?.name ?? (day.theme.winner?.id === eventId ? day.theme.winner.name : 'Today');
}

export const deckLabel = (name: string, seen: number, total: number) => `${name} ${seen}/${total}`;

/**
 * Insights, back of the flip card (PHASE-11e): on an event day the Almanac's
 * "try" card stands in for the daily one. Returns null on every other day, so
 * the existing Try this today card (with its Did it streak) keeps the slot.
 */
export function useAlmanacTry(day: AlmanacDay | null): { text: string; event: string } | null {
  const [found, setFound] = useState<{ text: string; event: string } | null>(null);
  const ctx = day?.ctx;
  useEffect(() => {
    setFound(null);
    if (!ctx) return;
    let live = true;
    void almanac
      .loadToday('insights.try', ctx, AsyncStorage)
      .then((result) => {
        if (live && result?.source === 'card' && result.card.event) {
          setFound({ text: result.text, event: result.card.event });
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ctx]);
  return found;
}

/** The back of the flip card on an event day. Plain text; no streak, no write. */
export function AlmanacTryCard({ text, eventName }: { text: string; eventName: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: controlBorderColor(theme) }]}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {`Try this today · ${eventName}`}
      </ThemedText>
      <ThemedText>{text}</ThemedText>
    </ThemedView>
  );
}

/**
 * Insights, below the argue card: today's Almanac deck card. On an event day it
 * is counted in that event's deck for the year ("Halloween 3/5"); a card missed
 * this year is back next year (a new year starts a new deck). Nothing renders
 * when the Almanac has no deck card today.
 */
export function AlmanacDeckCard({ userId, day }: { userId: string; day: AlmanacDay }) {
  const theme = useTheme();
  const { ctx } = day;
  const [shown, setShown] = useState<{ text: string; progress: string | null } | null>(null);

  useEffect(() => {
    setShown(null);
    let live = true;
    void (async () => {
      const result = await almanac.loadToday('insights.deck', ctx, AsyncStorage);
      if (!live || result?.source !== 'card') return;
      const eventId = result.card.event;
      if (!eventId) {
        setShown({ text: result.text, progress: null });
        return;
      }
      const key = deckKey(eventId, eventYear(eventId, ctx.ymd));
      const { decks } = await recordDeckCardSeen(userId, key, result.card.id);
      const total = deckTotalFor(eventId);
      const seen = Math.min(decks[key]?.length ?? 0, total);
      if (live) setShown({ text: result.text, progress: total > 0 ? deckLabel(eventNameFor(day, eventId), seen, total) : null });
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ctx, userId, day]);

  if (!shown) return null;
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: controlBorderColor(theme) }]}>
      {shown.progress ? (
        <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
          {shown.progress}
        </ThemedText>
      ) : null}
      <ThemedText>{shown.text}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  kicker: { textTransform: 'uppercase' },
});
