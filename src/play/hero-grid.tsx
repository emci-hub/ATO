/**
 * Hero roster grid (Dress, 2026-09-28 redesign).
 *
 * Replaces the old single-column list of `name + raw skillId` with the standard
 * roster shape: portrait tiles in a 3-wide grid, a status badge per tile, and a
 * tap that EXPANDS the hero in place (same interaction the inline Merge rewrite
 * uses one panel below) with both honest role lines from `hero-copy.ts`.
 *
 * Red-team fixes baked in (2026-09-28):
 * - Setting a hero that is currently BOUND AS A TOWER takes two taps ("Tap
 *   again · unbinds") — `setAvatarHero` drops the bind silently otherwise.
 * - Locked heroes sit in their own collapsed section, so the owned roster is
 *   visible without scrolling past every locked entry.
 * - No internal ids ever render (the old rows printed `skill_archangel`).
 *
 * Portraits: every hero has a packed `rotations` sheet, so the east-facing
 * static frame draws through the same `ClipImage` the board uses — no new art
 * and no asset-count cost.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { NeonButton, NeonLabel, NeonPanel, NeonPill } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import {
  HERO_SHARED_NOTE,
  HERO_STATUS_LABEL,
  heroAvatarLine,
  heroDisplayName,
  heroStatusOf,
  heroTowerLine,
  heroUnlockLine,
  setAvatarUnbinds,
  type HeroStatus,
} from '@/play/hero-copy';
import { allHeroes, type HeroDef } from '@/play/heroes-data';
import { ELEMENT_COLOR } from '@/play/kits';
import { ClipImage } from '@/play/sheet-sprite';
import { heroAvatarRole, roleArtDrawable, roleFaceArtIndex } from '@/play/skin';

/** How long an armed "tap again" stays armed before it lapses. */
export const ARM_LAPSE_MS = 3500;

/** Tiles per row — the detail block opens under the row it belongs to, so the
 * grid has to be laid out row by row rather than as one wrapping list. */
export const TILES_PER_ROW = 3;

/** Split a roster into rows of `TILES_PER_ROW`. */
export function heroRows<T>(list: readonly T[], perRow = TILES_PER_ROW): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow));
  return rows;
}

const STATUS_TONE: Record<HeroStatus, 'emphasis' | 'muted'> = {
  active: 'emphasis',
  bound: 'emphasis',
  owned: 'muted',
  locked: 'muted',
};

function HeroPortrait({ hero, size, dim }: { hero: HeroDef; size: number; dim: boolean }) {
  const role = heroAvatarRole(hero.id);
  const drawable = roleArtDrawable(role, roleFaceArtIndex(role, 'e'));
  return (
    <View style={[styles.portrait, { width: size, height: size }, dim && styles.dim]}>
      {drawable ? (
        <ClipImage drawable={drawable} />
      ) : (
        <ThemedText type="code" themeColor="textSecondary">
          {hero.name.slice(0, 2).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}

function HeroTile({
  hero,
  status,
  selected,
  onPress,
}: {
  hero: HeroDef;
  status: HeroStatus;
  selected: boolean;
  onPress: () => void;
}) {
  const accent = ELEMENT_COLOR[hero.kit.element];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${hero.name}, ${HERO_STATUS_LABEL[status]}`}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: selected ? accent : NEON.cyanBorder },
        pressed && styles.pressed,
      ]}>
      <HeroPortrait hero={hero} size={54} dim={status === 'locked'} />
      <ThemedText
        type="code"
        themeColor={status === 'locked' ? 'textSecondary' : undefined}
        numberOfLines={1}
        style={styles.tileName}>
        {hero.name}
      </ThemedText>
      {status === 'owned' ? (
        <View style={[styles.statusDot, { backgroundColor: accent }]} />
      ) : (
        <NeonPill label={HERO_STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
      )}
    </Pressable>
  );
}

function HeroDetail({
  hero,
  status,
  armed,
  onSet,
}: {
  hero: HeroDef;
  status: HeroStatus;
  armed: boolean;
  onSet: () => void;
}) {
  const locked = status === 'locked';
  return (
    <View style={[styles.detail, { borderColor: ELEMENT_COLOR[hero.kit.element] }]}>
      <ThemedText type="smallBold">{hero.name}</ThemedText>
      {locked ? (
        <ThemedText type="code" themeColor="textSecondary">
          {`How to get: ${heroUnlockLine(hero)}`}
        </ThemedText>
      ) : null}
      <ThemedText type="code" themeColor="textSecondary">
        {`As Avatar · ${heroAvatarLine(hero)}`}
      </ThemedText>
      <ThemedText type="code" themeColor="textSecondary">
        {`As tower · ${heroTowerLine(hero)}`}
      </ThemedText>
      {status === 'active' ? (
        <ThemedText type="code" themeColor="emphasis">
          You are fighting as this hero.
        </ThemedText>
      ) : null}
      {locked || status === 'active' ? null : (
        <NeonButton
          label={
            armed
              ? 'Tap again · gives up its tower'
              : status === 'bound'
                ? 'Fight as this hero · gives up its tower'
                : 'Fight as this hero'
          }
          onPress={onSet}
          variant={armed ? 'primary' : 'secondary'}
          accessibilityLabel={
            armed
              ? `Confirm: fight as ${hero.name} and give up its tower`
              : status === 'bound'
                ? `Fight as ${hero.name}, giving up its bound tower`
                : `Fight as ${hero.name}`
          }
        />
      )}
    </View>
  );
}

export function HeroGrid({
  activeHeroId,
  ownedHeroIds,
  boundHeroIds,
  onSetAvatarHero,
}: {
  activeHeroId: string;
  ownedHeroIds: readonly string[];
  boundHeroIds: readonly string[];
  onSetAvatarHero: (heroId: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [showLocked, setShowLocked] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearArmTimer = () => {
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = null;
  };
  useEffect(() => clearArmTimer, []);

  const heroes = allHeroes();
  const statusOf = (id: string) =>
    heroStatusOf(id, { activeHeroId, ownedIds: ownedHeroIds, boundIds: boundHeroIds });
  const rank: Record<HeroStatus, number> = { active: 0, bound: 1, owned: 2, locked: 3 };
  const yours = heroes
    .filter((hero) => statusOf(hero.id) !== 'locked')
    .sort((a, b) => rank[statusOf(a.id)] - rank[statusOf(b.id)]);
  const locked = heroes.filter((hero) => statusOf(hero.id) === 'locked');

  const press = (hero: HeroDef) => {
    clearArmTimer();
    setArmedId(null);
    setOpenId((prev) => (prev === hero.id ? null : hero.id));
  };

  const set = (hero: HeroDef) => {
    // A hero bound as a tower needs a second tap: setting it as the Avatar
    // unbinds it, and the old screen did that silently.
    if (setAvatarUnbinds(hero.id, boundHeroIds) && armedId !== hero.id) {
      setArmedId(hero.id);
      clearArmTimer();
      armTimer.current = setTimeout(() => {
        armTimer.current = null;
        setArmedId((prev) => (prev === hero.id ? null : prev));
      }, ARM_LAPSE_MS);
      return;
    }
    clearArmTimer();
    setArmedId(null);
    setOpenId(null);
    onSetAvatarHero(hero.id);
  };

  const section = (list: readonly HeroDef[], key: string) => (
    <>
      {heroRows(list).map((row, index) => {
        const open = row.find((hero) => hero.id === openId);
        return (
          <View key={`${key}-row-${index}`} style={styles.rowGroup}>
            <View style={styles.grid}>
              {row.map((hero) => (
                <HeroTile
                  key={hero.id}
                  hero={hero}
                  status={statusOf(hero.id)}
                  selected={openId === hero.id}
                  onPress={() => press(hero)}
                />
              ))}
            </View>
            {open ? (
              <HeroDetail
                hero={open}
                status={statusOf(open.id)}
                armed={armedId === open.id}
                onSet={() => set(open)}
              />
            ) : null}
          </View>
        );
      })}
    </>
  );

  return (
    <NeonPanel>
      <View style={styles.headRow}>
        <NeonLabel>Heroes</NeonLabel>
        <ThemedText type="smallBold" themeColor="emphasis">
          {heroDisplayName(activeHeroId)}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {HERO_SHARED_NOTE}
      </ThemedText>
      {section(yours, 'yours')}
      {locked.length > 0 ? (
        <Pressable
          onPress={() => setShowLocked((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showLocked }}
          style={({ pressed }) => [styles.lockedToggle, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {`${showLocked ? 'Hide' : 'Show'} locked (${locked.length})`}
          </ThemedText>
        </Pressable>
      ) : null}
      {showLocked ? section(locked, 'locked') : null}
    </NeonPanel>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowGroup: { gap: 8 },
  tile: {
    // Fixed share of the row: no flexGrow, so a last row of 1 or 2 keeps
    // tile-sized cards instead of stretching one to full width.
    flexBasis: '31%',
    maxWidth: '33%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: NEON.panel,
  },
  pressed: { opacity: 0.7 },
  portrait: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.45 },
  tileName: { textAlign: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  detail: {
    gap: 4,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: NEON.panel,
  },
  lockedToggle: { paddingVertical: 8, alignItems: 'center' },
});
