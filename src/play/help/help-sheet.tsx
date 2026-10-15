/**
 * The "?" help button + its small context sheet (Divecore Phase 4, emci 2026-10-14).
 *
 * ONE "?" per game screen, drawn by `GameScreen` (stage-layout.tsx) at the right end of the NoticeLane
 * so it is placed by layout and never covers the stage. It opens a small card on the FloatLayer
 * (≤ 3 bullets, ≤ 10 words each — `help-content.ts`) with a "Full guide" link to Hideout → Info →
 * Guide. The card floats over the stage; it never resizes a region. Outside tap, the "?" again, or
 * Android back closes it.
 */
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';

import { NeonButton } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { FULL_GUIDE_PATH, HELP, helpGuideLinkAllowed, type HelpId } from '@/play/help/help-content';
import { noticeReduceMotion } from '@/play/notify/notify';
import { STREET_FONT, useStreetFonts } from '@/play/street-ui';

/** Width the NoticeLane gives up on the right for the "?" (a 44 pt tap column). */
export const HELP_COLUMN = 44;
const BUTTON = 28;

/* ------------------------------------------------- the Full guide link --- */

let guideOpener: (() => void) | null = null;

/** play.tsx registers how to reach Hideout → Info → Guide; the sheet's link calls it. */
export function setGuideOpener(fn: (() => void) | null): void {
  guideOpener = fn;
}

export function openFullGuide(): void {
  guideOpener?.();
}

/* ------------------------------------------------------------ button --- */

export function HelpButton({ laneHeight, open, onPress }: { laneHeight: number; open: boolean; onPress: () => void }) {
  useStreetFonts();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: Math.max(0, (44 - laneHeight) / 2), bottom: Math.max(0, (44 - laneHeight) / 2), left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Help"
      accessibilityHint="Opens a short tip for this screen"
      accessibilityState={{ expanded: open }}
      style={[styles.buttonSlot, { height: laneHeight }]}>
      <View style={[styles.button, open && styles.buttonOpen]}>
        <Text style={[styles.buttonText, open && styles.buttonTextOpen]} maxFontSizeMultiplier={1.2}>
          ?
        </Text>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------- sheet --- */

export function HelpSheet({ id, top, onClose }: { id: HelpId; top: number; onClose: () => void }) {
  useStreetFonts();
  const entry = HELP[id];
  const reduced = noticeReduceMotion();

  useEffect(() => {
    // Android back closes the card first (later listeners run first).
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const ms = reduced ? 200 : 160;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Outside tap closes. Transparent: the screen stays visible. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close help"
      />
      {
        <Animated.View
          entering={FadeIn.duration(ms).reduceMotion(ReduceMotion.Never)}
          exiting={FadeOut.duration(ms).reduceMotion(ReduceMotion.Never)}
          style={[styles.card, { top }]}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            {entry.title}
          </Text>
          {entry.bullets.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.bullet} maxFontSizeMultiplier={1.2}>
                {b}
              </Text>
            </View>
          ))}
          {helpGuideLinkAllowed(id) ? (
            <NeonButton
              label="Full guide"
              variant="secondary"
              accessibilityLabel={`Full guide: ${FULL_GUIDE_PATH}`}
              onPress={() => {
                onClose();
                openFullGuide();
              }}
            />
          ) : (
            <Text style={styles.path} maxFontSizeMultiplier={1.2}>
              Full guide: {FULL_GUIDE_PATH}
            </Text>
          )}
        </Animated.View>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  buttonSlot: { position: 'absolute', right: 0, top: 0, width: HELP_COLUMN, alignItems: 'center', justifyContent: 'center' },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderWidth: 2,
    borderColor: NEON.cyan,
    backgroundColor: NEON.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOpen: { backgroundColor: NEON.cyan },
  buttonText: { fontFamily: STREET_FONT.bold, fontSize: 16, lineHeight: 20, color: NEON.cyan },
  buttonTextOpen: { color: NEON.ink },
  card: {
    position: 'absolute',
    right: 12,
    left: 12,
    maxWidth: 360,
    alignSelf: 'flex-end',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    backgroundColor: NEON.panel,
  },
  title: { fontFamily: STREET_FONT.bold, fontSize: 16, color: NEON.cyan, textTransform: 'uppercase', letterSpacing: 1 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  dot: { fontFamily: STREET_FONT.bold, fontSize: 15, lineHeight: 20, color: NEON.cyan },
  bullet: { flex: 1, fontFamily: STREET_FONT.regular, fontSize: 15, lineHeight: 20, color: NEON.textPrimary },
  path: { fontFamily: STREET_FONT.regular, fontSize: 13, lineHeight: 18, color: NEON.textMuted, marginTop: 4 },
});
