/**
 * The mini-game result: the score counts up from 0, and a strong result
 * (new record, Silver or Gold) pops a short confetti burst. Reanimated is
 * already in the app, so the burst is a handful of animated Views — no new
 * dependency.
 *
 * Motion is honoured: with `animate` false (reduced motion, or Effects not on
 * Full) the final number shows at once and there is no confetti. A round that
 * has already celebrated (the sheet closed and reopened) shows its number
 * still too, so the burst never replays on reopen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { PIXEL } from '@/play/pixel-theme';
import { PixelBody, PixelLabel } from '@/play/pixel-ui';
import { CONFETTI_COUNT, confettiPieces, countUpValue, COUNT_UP_MS, type ConfettiPiece } from '@/play/score-burst-model';

const PALETTE = [PIXEL.amber, PIXEL.cyan, PIXEL.heart, PIXEL.cyanHi, PIXEL.amberHi] as const;

/** The last round that already played its celebration (module-level on purpose). */
let lastCelebrated = '';

function Piece({ piece }: { piece: ConfettiPiece }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing: Easing.out(Easing.quad) }));
  }, [p, piece.delay, piece.duration]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value * p.value,
    transform: [
      { translateX: Math.cos(piece.angle) * piece.dist * p.value },
      // A little gravity: it flies up, then drops.
      { translateY: Math.sin(piece.angle) * piece.dist * p.value + 46 * p.value * p.value },
      { rotate: `${piece.spin * p.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.size, height: piece.size * 0.6, backgroundColor: PALETTE[piece.color % PALETTE.length] },
        style,
      ]}
    />
  );
}

export function ScoreBurst({
  score,
  strong,
  runKey,
  animate,
}: {
  score: number;
  strong: boolean;
  /** Unique per finished round, so a new round re-celebrates. */
  runKey: string;
  animate: boolean;
}) {
  const fresh = useRef(runKey !== lastCelebrated).current;
  const play = animate && fresh;
  const [shown, setShown] = useState(play ? 0 : score);
  const pieces = useMemo(() => (play && strong ? confettiPieces(CONFETTI_COUNT, Math.random) : []), [play, strong]);

  useEffect(() => {
    lastCelebrated = runKey;
    if (!play) {
      setShown(score);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setShown(countUpValue(score, elapsed));
      if (elapsed < COUNT_UP_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, score, runKey]);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${score} points${strong ? ', a strong result' : ''}`}>
      <PixelLabel color={strong ? PIXEL.amber : PIXEL.cyan} style={styles.score} numberOfLines={1}>
        {shown}
      </PixelLabel>
      <PixelBody size="sm" color={PIXEL.text}>pts</PixelBody>
      {pieces.length > 0 ? (
        <View style={styles.burst} pointerEvents="none">
          {pieces.map((piece, i) => (
            <Piece key={`${runKey}:${i}`} piece={piece} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, minHeight: 56 },
  score: { fontSize: 34, lineHeight: 40, textAlign: 'center' },
  burst: { position: 'absolute', left: 0, right: 0, top: '50%', alignItems: 'center' },
  piece: { position: 'absolute' },
});
