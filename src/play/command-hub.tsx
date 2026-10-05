/**
 * Command Hub — the Divecore Play entry (visual SoT: command-hub-target.png).
 *
 * Full-ink screen with the ATO mark + NEON VIPER / COMMAND HUB lockup, the
 * scrap/wave/lives HUD, a ghost ATO watermark, and the four destination tiles.
 * Pure view: tiles report their destination up; the route mode lives in
 * `src/app/play.tsx`. `children` renders below the tiles (dev kit only).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Hud } from '@/play/hud';
import { HubIcon } from '@/play/icons';
import { NEON, hubTilesFor, type HubDestination } from '@/play/neon-viper';
import { PLAY_HUD_FONT } from '@/play/play-fonts';

const GAP = 16;
const CONTENT_WIDTH = 800;

export function CommandHub({
  scrap,
  wave,
  diveActive = false,
  devUnlocked = false,
  pulse = null,
  reduceMotion = false,
  onTile,
  onSettings,
  children,
}: {
  scrap: number | null;
  /** A Dive run is saved mid-way — the Pet tile says so (it is never lost). */
  diveActive?: boolean;
  /** v27 — the Play dev unlock. Shop visibility is `PLAY_EVERYTHING_FREE`, not this flag. */
  devUnlocked?: boolean;
  /** Soft-pulse the outing they skipped (Pet stands in for Dive until that tile exists). */
  pulse?: HubDestination | null;
  reduceMotion?: boolean;
  wave: number | null;
  onTile: (to: HubDestination) => void;
  /** v24 — the ⚙ opens Divecore Settings. */
  onSettings?: () => void;
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
        <View style={styles.topRight}>
          <Hud scrap={scrap} wave={wave} />
          {onSettings ? (
            <Pressable
              onPress={onSettings}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Divecore settings"
              style={({ pressed }) => [styles.gear, pressed && styles.pressed]}>
              <Text style={styles.gearText}>⚙</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.body, { minHeight: Math.max(360, height * 0.62) }]}>
        <Text
          pointerEvents="none"
          style={[styles.watermark, { fontSize: watermarkSize, lineHeight: watermarkSize * 1.05 }]}>
          ATO
        </Text>
        <View style={[styles.tiles, { maxWidth: CONTENT_WIDTH }]}>
          {hubTilesFor(devUnlocked).map((tile) => (
            <HubTileButton
              key={tile.id}
              label={tile.label}
              subtitle={tile.to === 'pet' && diveActive ? '🤿 Dive in progress' : tile.subtitle}
              icon={tile.icon}
              width={tileWidth}
              pulsing={pulse === tile.to}
              reduceMotion={reduceMotion}
              badge={tile.to === 'pet' && diveActive}
              onPress={() => onTile(tile.to)}
            />
          ))}
        </View>
      </View>

      {children}
    </View>
  );
}

function HubTileButton({
  label,
  subtitle,
  icon,
  width,
  pulsing,
  reduceMotion,
  badge,
  onPress,
}: {
  label: string;
  subtitle: string;
  icon: 'divecore' | 'dive' | 'pet' | 'shop' | 'dress' | 'more';
  width: number;
  pulsing: boolean;
  reduceMotion: boolean;
  badge: boolean;
  onPress: () => void;
}) {
  const glow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulsing || reduceMotion) {
      glow.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.55, duration: 800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, pulsing, reduceMotion]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={pulsing ? `Open ${label}, suggested` : `Open ${label}`}
      style={({ pressed }) => [styles.tile, { width }, pulsing && styles.tilePulse, pressed && styles.pressed]}>
      <Animated.View style={[styles.tileIcon, pulsing && !reduceMotion ? { opacity: glow } : null]}>
        <HubIcon name={icon} size={64} color={NEON.cyan} />
      </Animated.View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileSub}>{subtitle}</Text>
      {badge ? <View style={styles.badge} accessibilityLabel="Dive in progress" /> : null}
    </Pressable>
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
    fontFamily: PLAY_HUD_FONT,
    fontSize: 15,
    color: NEON.cyan,
  },
  eyebrow: {
    fontFamily: PLAY_HUD_FONT,
    fontSize: 10,
    letterSpacing: 1.6,
    color: NEON.cyan,
  },
  title: {
    fontFamily: PLAY_HUD_FONT,
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
    fontFamily: PLAY_HUD_FONT,
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
  tilePulse: {
    borderColor: NEON.cyan,
    backgroundColor: 'rgba(0, 234, 255, 0.08)',
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
    fontFamily: PLAY_HUD_FONT,
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
  },
  tileSub: {
    fontFamily: PLAY_HUD_FONT,
    fontSize: 10,
    letterSpacing: 0.8,
    color: NEON.textMuted,
    textAlign: 'center',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gear: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 8,
  },
  gearText: { fontSize: 18, color: NEON.cyan },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: NEON.pink,
  },
  pressed: {
    opacity: 0.7,
  },
});
