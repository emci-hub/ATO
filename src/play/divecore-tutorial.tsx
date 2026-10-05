/**
 * First-time Divecore tips — three skippable cards (Meet → Tend → Dive or
 * Defend). Replay from More → Guide, or Settings → Replay tips.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { PLAY_BODY_FONT, PLAY_HUD_FONT } from '@/play/play-fonts';

export const TUTORIAL_STEPS: readonly { mark: string; title: string; body: string }[] = [
  {
    mark: '🐾',
    title: 'Meet',
    body: 'Open Pet. Pick an egg.',
  },
  {
    mark: '💛',
    title: 'Tend',
    body: 'Warm it once. Feed or play after it hatches.',
  },
  {
    mark: '🧭',
    title: 'Dive or Defend',
    body: 'Dive and Defend are on the Hub. Pick either.',
  },
];

export function DivecoreTutorial({ onDone, onGuide }: { onDone: () => void; onGuide?: () => void }) {
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
        <View style={styles.mark}>
          <Text style={styles.markText}>{step.mark}</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={styles.body}>{step.body}</Text>
        {last ? (
          <View style={styles.pair}>
            <View style={styles.choice}>
              <Text style={styles.choiceMark}>🤿</Text>
              <Text style={styles.choiceTitle}>Dive</Text>
              <Text style={styles.choiceSub}>Underwater</Text>
            </View>
            <View style={styles.choice}>
              <Text style={styles.choiceMark}>🛡</Text>
              <Text style={styles.choiceTitle}>Defend</Text>
              <Text style={styles.choiceSub}>Tower map</Text>
            </View>
          </View>
        ) : null}
        {last && onGuide ? <NeonButton label="Open the Guide" variant="secondary" onPress={onGuide} /> : null}
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
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontFamily: PLAY_HUD_FONT, fontSize: 12, color: NEON.textMuted },
  skip: { fontFamily: PLAY_HUD_FONT, fontSize: 13, color: NEON.cyan, minHeight: 44, textAlignVertical: 'center' },
  mark: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    backgroundColor: NEON.cyanSoft,
  },
  markText: { fontSize: 36 },
  title: {
    fontFamily: PLAY_HUD_FONT,
    fontSize: 22,
    letterSpacing: 0.8,
    color: NEON.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: PLAY_BODY_FONT,
    fontSize: 16,
    lineHeight: 22,
    color: NEON.textMuted,
    textAlign: 'center',
  },
  pair: { flexDirection: 'row', gap: 10 },
  choice: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    backgroundColor: NEON.cyanSoft,
  },
  choiceMark: { fontSize: 28 },
  choiceTitle: { fontFamily: PLAY_HUD_FONT, fontSize: 14, color: NEON.cyan },
  choiceSub: { fontFamily: PLAY_BODY_FONT, fontSize: 13, color: NEON.textMuted },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NEON.cyanDim },
  dotOn: { backgroundColor: NEON.cyan },
  buttons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
