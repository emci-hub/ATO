/**
 * Reveal (2026-09-30) — the gacha-style moment, played once per event.
 *
 *   Hatch: the egg wobbles more and more, cracks with light pouring out, then
 *     a flash and the Baby's card flips in. (The grade isn't decided until
 *     Child, so the hatch light is the egg's own colour — never a hint.)
 *   Child: the Baby glows in its GRADE colour (a gold glow = Legendary), then
 *     a flash and the hero card flips in.
 *
 * Tap skips to the card; tap the card to close. Reduced motion: a simple
 * fade in the reveal colour, then the card. Plays on the next Pet screen view
 * when it happened while the app was closed (the reveals queue in aging).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { EggShape } from '@/play/pet-figure';

const BUILD_MS = 1900;
const FLASH_MS = 260;

export function PetReveal({
  kind,
  lightColor,
  eggColor,
  subject,
  card,
  caption,
  reduceMotion,
  onDone,
  skip = false,
}: {
  kind: 'hatch' | 'child';
  /** Hatch: the egg's colour. Child: the grade colour. */
  lightColor: string;
  eggColor: string;
  /** Child: the Baby sprite that glows before the flip. */
  subject?: ReactNode;
  /** The card that flips in. */
  card: ReactNode;
  caption: string;
  reduceMotion: boolean;
  onDone: () => void;
  /** Settings → Skip reveal animations: the final card straight away. */
  skip?: boolean;
}) {
  const instant = reduceMotion || skip;
  const [phase, setPhase] = useState<'build' | 'card'>(instant ? 'card' : 'build');
  const wobble = useSharedValue(0);
  const glow = useSharedValue(0);
  const flash = useSharedValue(0);
  const flip = useSharedValue(instant ? 1 : 0);
  const fade = useSharedValue(0);
  const done = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const buildTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fade.value = withTiming(1, { duration: skip ? 120 : reduceMotion ? 400 : 200 });
    if (instant) {
      // A simple fade in the reveal colour.
      glow.value = withTiming(1, { duration: 400 });
      return;
    }
    wobble.value = withSequence(
      ...[4, -4, 6, -6, 9, -9, 12, -12, 14, -14, 0].map((deg, i) =>
        withTiming(deg, { duration: Math.max(60, 190 - i * 12), easing: Easing.inOut(Easing.sin) }),
      ),
    );
    glow.value = withTiming(1, { duration: BUILD_MS, easing: Easing.in(Easing.quad) });
    buildTimer.current = setTimeout(() => showCard(), BUILD_MS);
    return () => {
      if (buildTimer.current) clearTimeout(buildTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showCard = () => {
    if (buildTimer.current) {
      clearTimeout(buildTimer.current);
      buildTimer.current = null;
    }
    if (phaseRef.current === 'card') return;
    phaseRef.current = 'card';
    setPhase('card');
    flash.value = withSequence(withTiming(1, { duration: FLASH_MS / 2 }), withTiming(0, { duration: FLASH_MS }));
    flip.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.4)) });
  };

  const tap = () => {
    if (phase === 'build') {
      showCard();
      return;
    }
    if (done.current) return;
    done.current = true;
    onDone();
  };

  const wobbleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.6 + glow.value * 0.9 }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: flip.value > 0.05 ? 1 : 0,
    transform: [{ perspective: 800 }, { rotateY: `${(1 - flip.value) * 90}deg` }, { scale: 0.85 + flip.value * 0.15 }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, fadeStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={tap} accessibilityRole="button" accessibilityLabel={phase === 'build' ? 'Skip the reveal' : 'Close'}>
        <View style={styles.center}>
          {/* The light (egg colour on a hatch, grade colour on the reveal). */}
          <Animated.View style={[styles.light, glowStyle]} pointerEvents="none">
            <Svg width={280} height={280}>
              <Defs>
                <RadialGradient id="revealLight" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={lightColor} stopOpacity={0.9} />
                  <Stop offset="0.5" stopColor={lightColor} stopOpacity={0.35} />
                  <Stop offset="1" stopColor={lightColor} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={140} cy={140} r={140} fill="url(#revealLight)" />
            </Svg>
          </Animated.View>

          {phase === 'build' ? (
            <Animated.View style={wobbleStyle}>
              {kind === 'hatch' ? (
                <View>
                  <EggShape size={140} color={eggColor} />
                  <Svg width={140} height={140} style={StyleSheet.absoluteFill}>
                    <Path d="M52 46 L62 58 L56 66 L70 78 L64 88" stroke={lightColor} strokeWidth={3} fill="none" />
                  </Svg>
                </View>
              ) : (
                <View style={styles.subject}>{subject}</View>
              )}
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.cardWrap, cardStyle]} pointerEvents="none">
            {phase === 'card' ? card : null}
          </Animated.View>
        </View>
        <Text style={styles.caption}>{phase === 'card' ? caption : kind === 'hatch' ? 'Something’s hatching…' : 'Your Baby is changing…'}</Text>
        <Text style={styles.hint}>{phase === 'card' ? 'Tap to close' : 'Tap to skip'}</Text>
      </Pressable>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(3, 5, 12, 0.94)', zIndex: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  light: { position: 'absolute' },
  subject: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  cardWrap: { position: 'absolute' },
  flash: { backgroundColor: '#FFFFFF' },
  caption: {
    position: 'absolute',
    bottom: 70,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontFamily: Fonts.displayBold,
    fontSize: 18,
    letterSpacing: 1,
    color: '#F1FBFF',
  },
  hint: { position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center', fontFamily: Fonts.mono, fontSize: 12, color: '#8FA3BF' },
});
