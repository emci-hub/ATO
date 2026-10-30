import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { cardIsShareable } from '@/components/almanac/use-almanac-card';
import { ShareCardSheet, type SharePerson } from '@/components/share-card';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AlmanacDay } from '@/hooks/use-almanac-day';
import { yearDeck, yearRecapOpen } from '@/lib/almanac/year';
import { controlBorderColor } from '@/lib/theme/chrome';

export const YEAR_RECAP_TITLE = 'Your year in you';

/**
 * You, from December 1: eight cards to swipe through. `preview` opens it on any
 * date (the dev Hub only). Pages change by swipe; there is no animation to turn
 * off, so Reduce Motion needs nothing. Nothing renders when the Almanac has no
 * year card.
 */
export function YearRecap({ day, me, preview = false }: { day: AlmanacDay | null; me: SharePerson; preview?: boolean }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [sharing, setSharing] = useState(false);
  const ctx = day?.ctx;
  const open = !!ctx && (preview || yearRecapOpen(ctx.ymd));
  const cards = useMemo(() => (open && ctx ? yearDeck(ctx) : []), [open, ctx]);

  if (!open || cards.length === 0) return null;
  const current = cards[Math.min(page, cards.length - 1)]!;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{YEAR_RECAP_TITLE}</ThemedText>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            accessibilityLabel={`${YEAR_RECAP_TITLE}, card ${page + 1} of ${cards.length}`}>
            {cards.map((c) => (
              <View key={c.card.id} style={[styles.page, { width, backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={styles.text}>{c.text}</ThemedText>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View style={styles.dots}>
        {cards.map((c, i) => (
          <View
            key={c.card.id}
            style={[styles.dot, { backgroundColor: i === page ? theme.accent : theme.backgroundSelected }]}
          />
        ))}
      </View>
      {cardIsShareable(current.card, ctx?.leans) ? (
        <>
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="Share this card"
            onPress={() => setSharing(true)}
            style={[styles.chip, { borderColor: controlBorderColor(theme), borderRadius: theme.cutCorners ? 0 : 999 }]}>
            <ThemedText type="smallBold">Share</ThemedText>
          </ThemedPressable>
          <ShareCardSheet visible={sharing} onClose={() => setSharing(false)} me={me} content={{ kind: 'line', text: current.text }} />
        </>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.two },
  page: { minHeight: 120, padding: Spacing.three, justifyContent: 'center' },
  text: { fontSize: 18, lineHeight: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.one },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chip: { alignSelf: 'flex-end', borderWidth: 1, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
});
