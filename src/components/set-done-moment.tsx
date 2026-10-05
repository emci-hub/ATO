import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PixelFace } from '@/components/pixel-face';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { TraitShape } from '@/components/trait-shape';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ATO_TOKEN_EARN } from '@/lib/ato-tokens';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { recipeForAccount } from '@/lib/kenney/registry';
import { TAP_MOODS, type TapMood } from '@/lib/kenney/tap-moods';
import type { Me } from '@/lib/me';
import { POLISH_COPY_REVIEWED, SET_DONE_COPY, SET_DONE_LATER, SET_DONE_NEXT } from '@/lib/polish-copy';
import { useAppearance } from '@/lib/theme/context';
import { traitShapePoints } from '@/lib/trait-shape';
import type { TraitTrack } from '@/lib/trait-stability';

export type SetDoneKind = keyof typeof SET_DONE_COPY;

export interface SetDoneMomentState {
  kind: SetDoneKind;
  /** True only when this finish really paid the +21 (sets 1 and 2 pay nothing). */
  coin: boolean;
  /** e.g. the daily-cap line when a round past the cap paid nothing. */
  note?: string;
}

const CONFETTI = 18;

/**
 * The payoff after a set or a round (polish pass, emci 2026-10-05): the shape
 * draws in, the mini guy hops, pixel confetti falls and — only when the server
 * actually paid it — the +21 coin pops. No sound, no model call. Under Reduce
 * Motion everything simply appears.
 */
export function SetDoneMoment({
  moment,
  me,
  tracks,
  onClose,
}: {
  moment: SetDoneMomentState | null;
  me: Me;
  tracks: readonly TraitTrack[];
  onClose: () => void;
}) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const recipe = useMemo(() => recipeForAccount(me.id, me.recipe), [me]);
  const tapMoodRef = useRef<((mood: TapMood) => void) | null>(null);
  const copy = moment ? SET_DONE_COPY[moment.kind] : null;

  useEffect(() => {
    if (!moment || reduceMotion) return;
    const t = setTimeout(() => tapMoodRef.current?.(TAP_MOODS.happyBounce), 350);
    return () => clearTimeout(t);
  }, [moment, reduceMotion]);

  if (!moment || !copy) return null;

  return (
    <Modal visible transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={[styles.scrim, { backgroundColor: theme.background }]}>
        {reduceMotion ? null : <Confetti />}
        <View style={styles.content}>
          <TraitShape points={traitShapePoints(me, tracks)} size={170} />
          <PixelFace
            recipe={recipe}
            size={52}
            showUp={me.show_up}
            animated={!reduceMotion}
            tapMoodRef={tapMoodRef}
            pressable={false}
          />
          <ThemedText type="heading" style={styles.center}>
            {copy.title}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={[styles.center, styles.line]}>
            {copy.line}
          </ThemedText>
          {moment.coin ? (
            <CoinPop
              amount={
                moment.kind === 'all' ? ATO_TOKEN_EARN.full_profile_complete : ATO_TOKEN_EARN.ongoing_round_complete
              }
            />
          ) : null}
          {moment.note ? (
            <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.line]}>
              {moment.note}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            <ThemedPressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                router.push('/');
              }}
              style={[styles.button, styles.ghost, { borderColor: theme.border, borderRadius: theme.cutCorners ? 0 : 999 }]}>
              <ThemedText type="smallBold">{SET_DONE_LATER}</ThemedText>
            </ThemedPressable>
            <ThemedPressable
              filled
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.button, { borderRadius: theme.cutCorners ? 0 : 999 }]}>
              <ThemedText type="smallBold" themeColor="onAccent">
                {SET_DONE_NEXT}
              </ThemedText>
            </ThemedPressable>
          </View>
          {!POLISH_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
            <ThemedText type="code" themeColor="textSecondary">
              Draft copy — waiting on emci review.
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** The +21: a gold coin that springs in. Only shown when the server paid it. */
function CoinPop({ amount }: { amount: number }) {
  const { reduceMotion } = useAppearance();
  const scale = useSharedValue(reduceMotion ? 1 : 0.3);
  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withDelay(500, withSpring(1, { damping: 7, stiffness: 160 }));
  }, [reduceMotion, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.coinRow, pop]} accessible accessibilityLabel={`Plus ${amount} ATO tokens`}>
      <Coin />
      <ThemedText type="heading">+{amount}</ThemedText>
    </Animated.View>
  );
}

/**
 * The ATO token coin. A fixed gold in every theme on purpose: it is an object,
 * like the share card, not chrome.
 */
export function Coin({ size = 36 }: { size?: number }) {
  const k = size / 36;
  return (
    <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1, 2 * k) }]}>
      <View
        style={[
          styles.coinShine,
          { top: 3 * k, left: 6 * k, width: 12 * k, height: 8 * k, borderRadius: 6 * k },
        ]}
      />
      <ThemedText type="codeBold" style={[styles.coinGlyph, { fontSize: 14 * k, lineHeight: 18 * k }]}>
        A
      </ThemedText>
    </View>
  );
}

/** Square "pixels" falling once through the screen, in the theme's accents. */
function Confetti() {
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  const colors = [theme.accent, theme.accentSecondary, theme.accentTertiary, theme.emphasis];
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        left: ((i * 53) % 97) / 100,
        delay: (i * 137) % 900,
        size: 6 + (i % 3) * 2,
      })),
    [],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <Piece
          key={i}
          x={piece.left * width}
          height={height}
          delay={piece.delay}
          size={piece.size}
          color={colors[i % colors.length]!}
        />
      ))}
    </View>
  );
}

function Piece({ x, height, delay, size, color }: { x: number; height: number; delay: number; size: number; color: string }) {
  const y = useSharedValue(-20);
  const spin = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withTiming(height + 20, { duration: 2200, easing: Easing.in(Easing.quad) }));
    spin.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 400 })), 3));
  }, [delay, height, y, spin]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${spin.value * 90}deg` }],
  }));
  return <Animated.View style={[styles.piece, { left: x, width: size, height: size, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 360,
  },
  center: {
    textAlign: 'center',
  },
  line: {
    maxWidth: 280,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  button: {
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  ghost: {
    borderWidth: 1,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  coin: {
    backgroundColor: '#F5B300',
    borderColor: '#B97F00',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coinShine: {
    position: 'absolute',
    backgroundColor: '#FFE08A',
  },
  coinGlyph: {
    color: '#5A3E00',
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});
