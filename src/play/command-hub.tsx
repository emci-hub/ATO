/**
 * Command Hub — the Divecore Play entry (visual SoT: command-hub-target.png).
 *
 * Full-ink screen with the ATO mark + NEON VIPER / COMMAND HUB lockup, the
 * scrap/wave/lives HUD, a ghost ATO watermark, and the four destination tiles.
 * Pure view: tiles report their destination up; the route mode lives in
 * `src/app/play.tsx`. `children` renders below the tiles (dev kit only).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { Hud } from '@/play/hud';
import { HubIcon } from '@/play/icons';
import { HUB_TILES, NEON, type HubDestination } from '@/play/neon-viper';

const GAP = 16;
const CONTENT_WIDTH = 800;

export function CommandHub({
  scrap,
  wave,
  onTile,
  children,
}: {
  scrap: number | null;
  wave: number | null;
  onTile: (to: HubDestination) => void;
  children?: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const cols = width >= 850 ? 4 : 2;
  const available = Math.max(160, Math.min(width, CONTENT_WIDTH) - 32);
  const tileWidth = (available - GAP * (cols - 1)) / cols;
  const watermarkSize = Math.min(320, Math.round(available * 0.9));

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.lockup}>
          <View style={styles.brandMark}>
            <Text style={styles.brandText}>ATO</Text>
          </View>
          <View style={styles.lockupText}>
            <Text style={styles.eyebrow}>NEON VIPER</Text>
            <Text style={styles.title}>Command Hub</Text>
          </View>
        </View>
        <Hud scrap={scrap} wave={wave} />
      </View>

      <View style={[styles.body, { minHeight: Math.max(360, height * 0.62) }]}>
        <Text
          pointerEvents="none"
          style={[styles.watermark, { fontSize: watermarkSize, lineHeight: watermarkSize * 1.05 }]}>
          ATO
        </Text>
        <View style={[styles.tiles, { maxWidth: CONTENT_WIDTH }]}>
          {HUB_TILES.map((tile) => (
            <Pressable
              key={tile.id}
              onPress={() => onTile(tile.to)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tile.label}`}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth },
                pressed && styles.pressed,
              ]}>
              <View style={styles.tileIcon}>
                <HubIcon name={tile.icon} size={64} color={NEON.cyan} />
              </View>
              <Text style={styles.tileLabel}>{tile.label}</Text>
              <Text style={styles.tileSub}>{tile.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NEON.ink,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: NEON.cyanDim,
    backgroundColor: 'rgba(4, 8, 17, 0.85)',
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  lockupText: {
    flexShrink: 1,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: NEON.cyan,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NEON.cyanSoft,
  },
  brandText: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: NEON.cyan,
  },
  eyebrow: {
    fontFamily: Fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: NEON.cyan,
  },
  title: {
    fontFamily: Fonts.displayBold,
    fontSize: 24,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
    fontFamily: Fonts.displayBold,
    color: NEON.cyan,
    opacity: 0.06,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GAP,
    width: '100%',
    zIndex: 1,
  },
  tile: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 28,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    backgroundColor: 'rgba(9, 15, 28, 0.92)',
  },
  tileIcon: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 234, 255, 0.1)',
    backgroundColor: 'rgba(0, 234, 255, 0.03)',
  },
  tileLabel: {
    fontFamily: Fonts.displaySemiBold,
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
  },
  tileSub: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: NEON.textMuted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
