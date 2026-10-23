/**
 * "While you were away" card (2026-10-15, roadmap step 1). What changed while you were gone, worked
 * out in `away-summary.ts`: good news first (★), then what would help (•), at most 3 lines, never
 * blame. Floats over the Hideout's stage like the "?" help card (same look), so no region resizes.
 * "Got it", an outside tap or Android back closes it. Reduce Motion: a gentle fade, never a slide.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { awayLabel, type AwaySummary } from '@/play/away-summary';
import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { sheetCard } from '@/play/sheet-kit';
import { noticeReduceMotion } from '@/play/notify/notify';
import { STREET, STREET_FONT, useStreetFonts } from '@/play/street-ui';

export function AwayCard({ summary, top, onClose }: { summary: AwaySummary; top: number; onClose: () => void }) {
  useStreetFonts();
  const reduced = noticeReduceMotion();

  useEffect(() => {
    // Android back closes the card first (later listeners run first).
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Welcome back. ${summary.lines.map((l) => l.text).join(' ')}`);
  }, [summary]);

  const ms = reduced ? 260 : 200;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <Animated.View
        entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.Never)}
        exiting={FadeOut.duration(ms).reduceMotion(ReduceMotion.Never)}
        style={[styles.card, { top }]}>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            Welcome back
          </Text>
          <Text style={styles.sub} maxFontSizeMultiplier={1.2}>
            {awayLabel(summary.awayMs)}
          </Text>
        </View>
        {summary.lines.map((line) => (
          <View key={line.id} style={styles.row}>
            <Text style={[styles.mark, line.kind === 'good' ? styles.good : styles.help]}>{line.kind === 'good' ? '★' : '•'}</Text>
            <Text style={styles.text} maxFontSizeMultiplier={1.2}>
              {line.text}
            </Text>
          </View>
        ))}
        <NeonButton label="Got it" variant="secondary" onPress={onClose} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 12,
    left: 12,
    maxWidth: 360,
    alignSelf: 'center',
    gap: 8,
    padding: 16,
    ...sheetCard,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: STREET_FONT.bold, fontSize: 16, color: NEON.cyan, textTransform: 'uppercase', letterSpacing: 1 },
  sub: { fontFamily: STREET_FONT.regular, fontSize: 13, color: NEON.textMuted },
  row: { flexDirection: 'row', gap: 8 },
  mark: { fontFamily: STREET_FONT.bold, fontSize: 15, lineHeight: 20, width: 14, textAlign: 'center' },
  good: { color: STREET.mustard },
  help: { color: NEON.cyan },
  text: { flex: 1, fontFamily: STREET_FONT.regular, fontSize: 15, lineHeight: 20, color: NEON.textPrimary },
});
