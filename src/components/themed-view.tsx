import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useAppearance } from '@/lib/theme/context';
import { surfaceChrome } from '@/lib/theme/chrome';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  children?: ReactNode;
};

export function ThemedView({ style, type, children, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const surface = type === 'backgroundElement';
  const chrome = surface ? surfaceChrome(theme, reduceMotion) : null;

  return (
    <View
      style={[{ backgroundColor: theme[type ?? 'background'] }, style, chrome]}
      {...otherProps}>
      {surface && theme.cardPadExtra > 0 ? (
        <View style={{ margin: theme.cardPadExtra }}>{children}</View>
      ) : (
        children
      )}
      {surface ? <SurfaceDecor reduceMotion={reduceMotion} /> : null}
    </View>
  );
}

function SurfaceDecor({ reduceMotion }: { reduceMotion: boolean }) {
  const theme = useTheme();
  const items: ReactNode[] = [];

  if (theme.hudFrames === 'ornament') {
    items.push(
      <View key="orn" pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.ornament, styles.ornTL, { borderColor: theme.accentSecondary }]} />
        <View style={[styles.ornament, styles.ornTR, { borderColor: theme.accentSecondary }]} />
        <View style={[styles.ornament, styles.ornBL, { borderColor: theme.accentSecondary }]} />
        <View style={[styles.ornament, styles.ornBR, { borderColor: theme.accentSecondary }]} />
      </View>,
    );
  }

  if (theme.hudFrames === 'bracket') {
    items.push(
      <View key="br" pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.bracket, styles.brTL, { borderColor: theme.accent }]} />
        <View style={[styles.bracket, styles.brTR, { borderColor: theme.accentSecondary }]} />
        <View style={[styles.bracket, styles.brBL, { borderColor: theme.accentSecondary }]} />
        <View style={[styles.bracket, styles.brBR, { borderColor: theme.accentTertiary }]} />
      </View>,
    );
  }

  if (theme.cutCorners) {
    items.push(
      <View key="cut" pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.cut, styles.cutTL, { backgroundColor: theme.background }]} />
        <View style={[styles.cut, styles.cutTR, { backgroundColor: theme.background }]} />
        <View style={[styles.cut, styles.cutBL, { backgroundColor: theme.background }]} />
        <View style={[styles.cut, styles.cutBR, { backgroundColor: theme.background }]} />
      </View>,
    );
  }

  if (theme.scanlines && !reduceMotion) {
    items.push(
      <View key="scan" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scanWrap]}>
        {Array.from({ length: 40 }, (_, i) => (
          <View key={i} style={styles.scanLine} />
        ))}
      </View>,
    );
  }

  if (items.length === 0) return null;
  return <>{items}</>;
}

const CUT = 10;
const ORN = 10;

const styles = StyleSheet.create({
  ornament: {
    position: 'absolute',
    width: ORN,
    height: ORN,
    borderColor: '#FBBF24',
  },
  ornTL: { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
  ornTR: { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
  ornBL: { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
  ornBR: { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
  bracket: {
    position: 'absolute',
    width: 14,
    height: 14,
  },
  brTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  brTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  brBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  brBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  cut: {
    position: 'absolute',
    width: CUT,
    height: CUT,
    transform: [{ rotate: '45deg' }],
  },
  cutTL: { top: -CUT / 2, left: -CUT / 2 },
  cutTR: { top: -CUT / 2, right: -CUT / 2 },
  cutBL: { bottom: -CUT / 2, left: -CUT / 2 },
  cutBR: { bottom: -CUT / 2, right: -CUT / 2 },
  scanWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.06,
  },
  scanLine: {
    width: 1,
    height: '100%',
    backgroundColor: '#E0E0FF',
  },
});
