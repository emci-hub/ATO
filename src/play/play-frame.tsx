/**
 * PlayFrame — a Divecore card wrapped in the Kenney Fantasy UI Borders panel
 * (§19). The 48×48 source is pre-sliced into eight 16px pieces by
 * `scripts/play-art-prep.ts`; this composes them as a 9-slice around the card.
 *
 * The caller's `style` carries the layout/padding (existing `styles.card`
 * already pads by `Spacing.three` = 16px, matching the slice inset), so this
 * only adds the frame art.
 */
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { PLAY_ART } from '@/play/generated-play-assets';

const INSET = 16;

const piece = (name: string) => PLAY_ART[`kenney-ui/border/sliced/${name}`];

const CORNERS = [
  ['tl', { left: 0, top: 0 }],
  ['tr', { right: 0, top: 0 }],
  ['bl', { left: 0, bottom: 0 }],
  ['br', { right: 0, bottom: 0 }],
] as const;

export function PlayFrame({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ThemedView type="backgroundElement" style={[styles.frame, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {CORNERS.map(([name, position]) => (
          <Image
            key={name}
            source={piece(name)}
            contentFit="fill"
            style={[styles.corner, position]}
          />
        ))}
        <Image source={piece('top')} contentFit="fill" style={styles.top} />
        <Image source={piece('bottom')} contentFit="fill" style={styles.bottom} />
        <Image source={piece('left')} contentFit="fill" style={styles.left} />
        <Image source={piece('right')} contentFit="fill" style={styles.right} />
      </View>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: INSET,
    height: INSET,
  },
  top: {
    position: 'absolute',
    left: INSET,
    right: INSET,
    top: 0,
    height: INSET,
  },
  bottom: {
    position: 'absolute',
    left: INSET,
    right: INSET,
    bottom: 0,
    height: INSET,
  },
  left: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: 0,
    width: INSET,
  },
  right: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    right: 0,
    width: INSET,
  },
});
