import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { QT, QT_GRADIENT, QT_RADIUS, QT_SHADOW } from '@/lib/quests/theme';

/**
 * The Quests glass card (ATO-BUILD §1.8): a translucent dark fill, a 1 px
 * border and a thin top highlight. No blur library is installed, so the fill is
 * just a little more opaque than a real glass would be.
 */
export function Glass({
  children,
  style,
  radius = QT_RADIUS.card,
  ring,
  shadow = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** An amber ring (a second absolute View) for a committed card. */
  ring?: boolean;
  shadow?: boolean;
}) {
  return (
    <View style={[styles.card, { borderRadius: radius }, shadow && QT_SHADOW.card, ring && QT_SHADOW.commit, style]}>
      <View pointerEvents="none" style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
      {children}
      {ring ? <View pointerEvents="none" style={[styles.ring, { borderRadius: radius }]} /> : null}
    </View>
  );
}

let gradientSeq = 0;

/** The 135° primary gradient (or two stops) filling its parent; drawn with SVG. */
export function GradientFill({ stops, radius = 0 }: { stops?: readonly { offset: number; color: string }[]; radius?: number }) {
  const list = stops ?? QT_GRADIENT;
  const id = useMemo(() => `qg${(gradientSeq += 1)}`, []);
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {list.map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" rx={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: QT.glassFill,
    borderWidth: 1,
    borderColor: QT.glassBorder,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: QT.glassHighlight,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: QT.amber,
  },
});
