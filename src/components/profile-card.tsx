import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import {
  cardBars,
  cardName,
  cardStrengthWeakness,
  heroForCode,
  PROFILE_CARD_COPY_REVIEWED,
  SNAPSHOT_REASON_LABEL,
  type CardHero,
  type CompareArrow,
  type ProfileSnapshot,
} from '@/lib/profile-history';
import { PixelFrame } from '@/play/pixel-ui';
import { PIXEL, PIXEL_FONT, pixelRenderStyle } from '@/play/pixel-theme';
import { usePlayReduceMotion } from '@/play/play-motion';

/**
 * The Divecore heroes already in assets/play (dungeon-legends, south-facing
 * rotation, 252px). Reused as-is — no new art.
 */
const HERO_ART: Readonly<Record<CardHero, number>> = {
  arcane_engineer: require('@/assets/play/avatars/dungeon-legends/05_ARCANE_ENGINEER/rotations/south.png'),
  dragonblood_champion: require('@/assets/play/avatars/dungeon-legends/04_DRAGONBLOOD_CHAMPION/rotations/south.png'),
  dungeon_witch: require('@/assets/play/avatars/dungeon-legends/06_DUNGEON_WITCH/rotations/south.png'),
  death_knight: require('@/assets/play/avatars/dungeon-legends/09_DEATH_KNIGHT/rotations/south.png'),
  ratkin_treasure_hunter: require('@/assets/play/avatars/dungeon-legends/07_RATKIN_TREASURE_HUNTER/rotations/south.png'),
  crystal_berserker: require('@/assets/play/avatars/dungeon-legends/08_CRYSTAL_BERSERKER/rotations/south.png'),
  dungeon_druid: require('@/assets/play/avatars/dungeon-legends/03_DUNGEON_DRUID/rotations/south.png'),
  abyssal_assassin: require('@/assets/play/avatars/dungeon-legends/02_ABYSSAL_ASSASSIN/rotations/south.png'),
};

const HERO_SIZE = 96;

function cardDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

const ARROW: Readonly<Record<CompareArrow, string>> = { up: '▲', down: '▼', same: '' };

/**
 * One profile as a collectible card (emci 2026-10-06): type name and date, the
 * Divecore hero for its type, 16 condensed trait bars, a Strength / Weakness
 * line. Pixel frame, Departure Mono, cyan neon — the Play look. No AI. With
 * `arrows`, each bar shows how that trait moved against the other card.
 * The frame's entrance is skipped under Reduce Motion.
 */
export function ProfileCard({
  card,
  selected = false,
  onPress,
  arrows,
}: {
  card: ProfileSnapshot;
  selected?: boolean;
  onPress?: () => void;
  arrows?: Partial<Record<string, CompareArrow>>;
}) {
  const reduceMotion = usePlayReduceMotion();
  const lines = cardStrengthWeakness(card.values);
  const name = cardName(card.code);
  const hero = heroForCode(card.code);
  const body = (
    <PixelFrame
      enter={!reduceMotion}
      border={selected ? PIXEL.amber : PIXEL.cyan}
      align="stretch"
      style={styles.frame}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.meta}>
            {SNAPSHOT_REASON_LABEL[card.reason].toUpperCase()} · {cardDate(card.createdAt)}
          </Text>
        </View>
        <Image
          source={HERO_ART[hero]}
          contentFit="contain"
          transition={0}
          style={{ width: HERO_SIZE, height: HERO_SIZE, ...pixelRenderStyle }}
          accessibilityLabel={`${hero.replace(/_/g, ' ')} sprite`}
        />
      </View>
      <View style={styles.bars}>
        {cardBars(card.values).map((bar) => (
          <View key={bar.axis} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {bar.label}
            </Text>
            <View style={styles.barTrack}>
              {bar.value != null ? (
                <View style={[styles.barFill, { width: `${Math.round(bar.value * 100)}%` }]} />
              ) : null}
            </View>
            <Text style={[styles.arrow, arrows?.[bar.axis] === 'down' && styles.arrowDown]}>
              {arrows ? ARROW[arrows[bar.axis] ?? 'same'] : ''}
            </Text>
          </View>
        ))}
      </View>
      {lines ? (
        <View style={styles.lines}>
          <Text style={styles.line}>
            <Text style={styles.lineKey}>STRENGTH </Text>
            {lines.strength}
          </Text>
          <Text style={styles.line}>
            <Text style={styles.lineKey}>WEAKNESS </Text>
            {lines.weakness}
          </Text>
        </View>
      ) : null}
      {!PROFILE_CARD_COPY_REVIEWED && PRE_LAUNCH_DEV ? <Text style={styles.draft}>Draft copy — waiting on emci review.</Text> : null}
    </PixelFrame>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${SNAPSHOT_REASON_LABEL[card.reason]}, ${cardDate(card.createdAt)}`}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headText: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 16,
    color: PIXEL.text,
  },
  meta: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 10,
    color: PIXEL.cyanHi,
    letterSpacing: 1,
  },
  hero: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 4,
  },
  barRow: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  barLabel: {
    width: 86,
    fontFamily: PIXEL_FONT.label,
    fontSize: 9,
    color: PIXEL.body,
  },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: PIXEL.slot,
  },
  barFill: {
    height: 6,
    backgroundColor: PIXEL.cyan,
  },
  arrow: {
    width: 10,
    fontFamily: PIXEL_FONT.label,
    fontSize: 9,
    color: PIXEL.amber,
    textAlign: 'center',
  },
  arrowDown: {
    color: PIXEL.cyanHi,
  },
  lines: {
    gap: 4,
  },
  line: {
    fontFamily: PIXEL_FONT.body,
    fontSize: 13,
    color: PIXEL.body,
  },
  lineKey: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 10,
    color: PIXEL.amber,
  },
  draft: {
    fontFamily: PIXEL_FONT.label,
    fontSize: 9,
    color: PIXEL.muted,
  },
});
