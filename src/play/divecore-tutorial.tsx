/**
 * First-time Divecore tutorial (v24, 2026-09-30) — five short, skippable
 * cards, shown once (a save with progress counts as seen), replayable from
 * Divecore Settings.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';

export const TUTORIAL_STEPS: readonly { emoji: string; title: string; body: string }[] = [
  {
    emoji: '🥚',
    title: 'Pick an egg',
    body: 'Open Pet and choose a Knight, Wizard or Village egg. Each egg has its own heroes — every hero is an even chance.',
  },
  {
    emoji: '🔥',
    title: 'Keep it warm',
    body: 'Tap the egg to warm it. It hatches in 5 minutes; care for the Baby and its hero is revealed at 15 — better care, better grade odds.',
  },
  {
    emoji: '🏠',
    title: 'The pet room',
    body: 'Feed, Play, Dive, Expedition and Info are along the bottom. The line above them says what your pet needs — the glowing icon does it.',
  },
  {
    emoji: '🤿',
    title: 'Dive together',
    body: 'Dive for finds with your pet. Surface keeps the haul; Deeper adds a find and shows the exact chance to lose it.',
  },
  {
    emoji: '🛡',
    title: 'Divecore',
    body: 'Clearing waves in Divecore feeds your pet, and from Child it pounces once a wave. That’s it — have fun!',
  },
];

export function DivecoreTutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = TUTORIAL_STEPS[i];
  const last = i === TUTORIAL_STEPS.length - 1;
  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop]} accessibilityViewIsModal>
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.count}>
            {i + 1} / {TUTORIAL_STEPS.length}
          </Text>
          <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip the tutorial">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>
        <Text style={styles.emoji}>{step.emoji}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={styles.dots}>
          {TUTORIAL_STEPS.map((s, n) => (
            <View key={s.title} style={[styles.dot, n === i && styles.dotOn]} />
          ))}
        </View>
        <View style={styles.buttons}>
          {i > 0 ? <NeonButton label="Back" variant="secondary" onPress={() => setI(i - 1)} style={styles.flex} /> : null}
          <NeonButton label={last ? 'Let’s go' : 'Next'} onPress={() => (last ? onDone() : setI(i + 1))} style={styles.flex} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(3, 5, 12, 0.88)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 30 },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    backgroundColor: NEON.panel,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  count: { fontFamily: Fonts.mono, fontSize: 12, color: NEON.textMuted },
  skip: { fontFamily: Fonts.monoBold, fontSize: 13, color: NEON.cyan },
  emoji: { fontSize: 44, textAlign: 'center' },
  title: { fontFamily: Fonts.displayBold, fontSize: 20, letterSpacing: 1, textTransform: 'uppercase', color: NEON.textPrimary, textAlign: 'center' },
  body: { fontFamily: Fonts.mono, fontSize: 13, lineHeight: 20, color: NEON.textMuted, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NEON.cyanDim },
  dotOn: { backgroundColor: NEON.cyan },
  buttons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
