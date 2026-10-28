import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { almanac } from '@/lib/almanac';
import { teaserWindow } from '@/lib/almanac/community';
import type { AlmanacDay } from '@/hooks/use-almanac-day';

/**
 * Home, under the hero: one line from the Almanac, only while an event is
 * approaching or fading (intensity 0.1 to 0.4). Nothing else renders, no empty
 * state: no card, no line.
 */
export function TeaserLine({ day }: { day: AlmanacDay }) {
  const [text, setText] = useState<string | null>(null);
  const show = teaserWindow(day.theme);
  const { ctx } = day;

  useEffect(() => {
    setText(null);
    if (!show) return;
    let live = true;
    void almanac
      .loadToday('home.line', ctx, AsyncStorage)
      .then((result) => {
        if (live && result?.source === 'card') setText(result.text);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [show, ctx]);

  if (!text) return null;
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.line}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  line: { textAlign: 'center' },
});
