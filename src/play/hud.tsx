/**
 * Command Hub HUD — scrap / wave / lives readout (Space Mono).
 *
 * Live mapping from the play store (no invented numbers):
 * - scrap = soft tokens,
 * - wave  = the Defend campaign seat's next wave,
 * - lives = stub 3 until the board economy owns real lives.
 * A null value renders as `…` while the store hydrates.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { HeartIcon, ScrapIcon, WaveIcon } from '@/play/icons';
import { NEON } from '@/play/neon-viper';

const LIVES_STUB = 3;

export function Hud({
  scrap,
  wave,
  lives = LIVES_STUB,
  maxLives = LIVES_STUB,
}: {
  scrap: number | null;
  wave: number | null;
  lives?: number;
  maxLives?: number;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.cell}>
        <ScrapIcon size={12} color={NEON.cyan} />
        <Text style={styles.value}>{scrap ?? '…'}</Text>
        <Text style={styles.label}>SCRAP</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.cell}>
        <WaveIcon size={12} color={NEON.cyan} />
        <Text style={styles.value}>{wave ?? '…'}</Text>
        <Text style={styles.label}>WAVE</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.livesCell}>
        {Array.from({ length: maxLives }).map((_, index) => (
          <HeartIcon key={index} filled={index < lives} size={12} />
        ))}
        <Text style={[styles.label, styles.livesLabel]}>LIVES</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    backgroundColor: 'rgba(9, 15, 28, 0.92)',
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  value: {
    fontFamily: Fonts.monoBold,
    fontSize: 16,
    color: NEON.textPrimary,
    minWidth: 20,
    textAlign: 'right',
  },
  label: {
    fontFamily: Fonts.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    color: NEON.hudLabel,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: NEON.cyanDim,
  },
  livesCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  livesLabel: {
    marginLeft: 5,
  },
});
