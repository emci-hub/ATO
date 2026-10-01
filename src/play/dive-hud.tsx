/**
 * Dive HUD (overhaul, 2026-09-29) — the top bar over the scene (back, zone,
 * depth meter, charges, shells, Info, Gear) and the find icon the haul row
 * and the reveal both draw. Pure view; numbers come from the store view.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { itemArtSource } from '@/play/art';
import { findKind } from '@/play/dive-loot';
import { GLOW_COLOR, findGlow } from '@/play/dive-fx-model';
import { getItemDef, type ItemSlot } from '@/play/items';
import { ELEMENT_COLOR } from '@/play/kits';
import { NEON } from '@/play/neon-viper';
import { cosmeticById } from '@/play/pet-cosmetics';

const SLOT_ICONS: Record<ItemSlot, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  weapon: 'sword',
  armor: 'shield-outline',
  cloak: 'hanger',
  trinket: 'star-four-points',
};

/** One find as an icon with its rarity glow ring. */
export function FindIcon({ id, size = 34, dim = false }: { id: string; size?: number; dim?: boolean }) {
  const kind = findKind(id);
  const glow = GLOW_COLOR[findGlow(id)];
  const cos = kind === 'cosmetic' ? cosmeticById(id) : undefined;
  const def = kind === 'item' ? getItemDef(id) : undefined;
  const art = def
    ? itemArtSource(def.core.art)
    : cos?.itemId
      ? itemArtSource(getItemDef(cos.itemId)?.core.art ?? '')
      : undefined;
  const inner = Math.round(size * 0.66);
  const icon: ComponentProps<typeof MaterialCommunityIcons>['name'] =
    kind === 'food'
      ? 'fish'
      : kind === 'shells'
        ? 'circle-multiple'
        : kind === 'cosmetic'
          ? 'palette'
          : kind === 'stone'
            ? 'diamond-stone'
            : def
            ? SLOT_ICONS[def.core.slot]
            : 'help';
  return (
    <View
      style={[
        styles.findIcon,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: glow,
          shadowColor: glow,
          opacity: dim ? 0.45 : 1,
        },
      ]}>
      {art ? (
        <Image source={art} contentFit="contain" style={{ width: inner, height: inner }} />
      ) : (
        <MaterialCommunityIcons
          name={icon}
          size={inner}
          color={cos?.color ?? (cos?.element ? ELEMENT_COLOR[cos.element] : glow)}
        />
      )}
    </View>
  );
}

/** Pips for the depth: filled up to the Deepers survived, of the run's max. */
export function DepthMeter({ depth, max }: { depth: number; max: number }) {
  return (
    <View style={styles.meter} accessible accessibilityLabel={`Depth ${depth} of ${max}`}>
      {Array.from({ length: max + 1 }, (_, i) => (
        <View key={i} style={[styles.pip, i <= depth && styles.pipOn]} />
      ))}
    </View>
  );
}

export function DiveTopBar({
  zone,
  depth,
  maxDepth,
  charges,
  shells,
  onBack,
  onInfo,
  onGear,
}: {
  zone: string;
  depth: number;
  maxDepth: number;
  charges: string;
  shells: number;
  onBack: () => void;
  onInfo: () => void;
  onGear: () => void;
}) {
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.row}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to the Pet room">
          <Text style={styles.back}>‹ Pet</Text>
        </Pressable>
        <View style={styles.zoneBox}>
          <Text style={styles.zone}>{zone}</Text>
          <DepthMeter depth={depth} max={maxDepth} />
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onGear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dive gear" style={styles.chip}>
            <Text style={styles.chipText}>Gear</Text>
          </Pressable>
          <Pressable onPress={onInfo} hitSlop={8} accessibilityRole="button" accessibilityLabel="How Dive works" style={styles.chip}>
            <Text style={styles.chipText}>Info</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.row}>
        <Text style={styles.stat} accessibilityLabel={`Dive charges ${charges}`}>
          ⚡ {charges}
        </Text>
        <Text style={styles.shells} accessibilityLabel={`${shells} shells`}>
          🐚 {shells}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  findIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(5, 7, 13, 0.7)',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  meter: { flexDirection: 'row', gap: 4, marginTop: 3 },
  pip: { width: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(241, 251, 255, 0.25)' },
  pipOn: { backgroundColor: NEON.cyan },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 4,
    backgroundColor: 'rgba(3, 6, 13, 0.55)',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontFamily: Fonts.monoBold, fontSize: 13, color: '#FFFFFF' },
  zoneBox: { alignItems: 'center' },
  zone: {
    fontFamily: Fonts.monoBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  actions: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    backgroundColor: 'rgba(5, 7, 13, 0.6)',
  },
  chipText: { fontFamily: Fonts.monoBold, fontSize: 11, color: NEON.cyan },
  stat: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#FFFFFF' },
  shells: { fontFamily: Fonts.monoBold, fontSize: 12, color: '#FFE9A8' },
});
