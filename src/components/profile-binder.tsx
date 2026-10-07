import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProfileCard } from '@/components/profile-card';
import { ThemedText } from '@/components/themed-text';
import { compareProfiles, orderForCompare, type ProfileSnapshot } from '@/lib/profile-history';
import { usePixelFonts } from '@/play/pixel-ui';

function pct(v: number | null): string {
  return v == null ? '—' : String(Math.round(v * 100));
}

/**
 * The card binder (emci 2026-10-06): the live profile first, then every saved
 * card newest first. Tap two cards to compare them — the newer one shows an
 * arrow on every trait that moved, with a short "was → now" list underneath.
 * Tap a picked card again to put it back.
 */
export function ProfileBinder({ cards }: { cards: readonly ProfileSnapshot[] }) {
  usePixelFonts();
  const [picked, setPicked] = useState<string[]>([]);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(-2)));
  }

  const pair = picked.length === 2 ? picked.map((id) => cards.find((c) => c.id === id)).filter(Boolean) : [];
  const compare =
    pair.length === 2 ? (() => {
      const [older, newer] = orderForCompare(pair[0]!, pair[1]!);
      return { older, newer, rows: compareProfiles(older, newer) };
    })() : null;

  return (
    <View style={styles.body}>
      <ThemedText type="small" themeColor="textSecondary">
        {cards.length < 2
          ? 'Your cards collect here: one when your profile really changes in a month, and one before changes or a fresh start.'
          : compare
            ? 'Comparing two cards. Tap one to put it back.'
            : 'Tap two cards to compare them.'}
      </ThemedText>
      {compare ? (
        <View style={styles.compare}>
          <ProfileCard
            card={compare.newer}
            selected
            onPress={() => toggle(compare.newer.id)}
            arrows={Object.fromEntries(compare.rows.map((r) => [r.axis, r.arrow]))}
          />
          <View style={styles.moves}>
            {compare.rows.filter((r) => r.arrow !== 'same').length === 0 ? (
              <ThemedText type="small">Nothing moved much between these two.</ThemedText>
            ) : (
              compare.rows
                .filter((r) => r.arrow !== 'same')
                .map((r) => (
                  <ThemedText key={r.axis} type="small">
                    {r.arrow === 'up' ? '▲' : '▼'} {r.label}: {pct(r.before)} → {pct(r.after)}
                  </ThemedText>
                ))
            )}
          </View>
          <ProfileCard card={compare.older} selected onPress={() => toggle(compare.older.id)} />
        </View>
      ) : null}
      {cards
        .filter((c) => !compare || (c.id !== compare.older.id && c.id !== compare.newer.id))
        .map((card) => (
          <ProfileCard key={card.id} card={card} selected={picked.includes(card.id)} onPress={() => toggle(card.id)} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
  },
  compare: {
    gap: 10,
  },
  moves: {
    gap: 2,
    paddingHorizontal: 4,
  },
});
