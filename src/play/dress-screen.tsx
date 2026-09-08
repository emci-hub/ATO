/**
 * Dress — 4 slots + bag (Play step 4, GAME_SPEC §9 inventory / §9c / §11
 * screen 4; GAME_DATA item + equipped shape).
 *
 * Pure read/view of `view`: four Worn slots (weapon, armor, cloak, trinket),
 * the equipped-stat bonus card (raw same-stat sums from equipped items — the
 * "bucket numbers"), and the Bag (whole owned collection minus what is worn).
 *
 * Interactions delegate up through `play.tsx` to the shared playStore:
 * - tap a slot → unequip (item stays in the collection);
 * - tap a bag row → equip into its slot (Power equips are refused by the store
 *   when the bag is over the 80-row soft cap — sell a Look first);
 * - Looks carry an inline "Sell · +3" → tokens, frees a row.
 * No Defend. No Supabase.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatMult,
  getItemDef,
  type ItemDef,
  type ItemSlot,
  type ItemStat,
} from '@/play/items';
import { INVENTORY_SOFT_CAP, LOOK_SELL_TOKENS, type PlayView } from '@/play/playStore';

const SLOT_ORDER: ItemSlot[] = ['weapon', 'armor', 'cloak', 'trinket'];
const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  cloak: 'Cloak',
  trinket: 'Trinket',
};
const SLOT_ICONS: Record<ItemSlot, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  weapon: 'sword',
  armor: 'shield-outline',
  cloak: 'hanger',
  trinket: 'star-four-points',
};
const STAT_ORDER: ItemStat[] = [
  'wave_power',
  'tower_speed',
  'token_earn',
  'dive_luck',
  'research_yield',
];

export function DressScreen({
  view,
  onEquip,
  onSell,
  onUnequip,
  onBackToGrove,
}: {
  view: PlayView;
  onEquip: (itemId: string) => void;
  onSell: (itemId: string) => void;
  onUnequip: (slot: ItemSlot) => void;
  onBackToGrove: () => void;
}) {
  const theme = useTheme();
  const wornIds = new Set(Object.values(view.equipped).filter((id): id is string => id != null));
  // The bag is everything owned that is not currently worn.
  const bagIds = view.inventory.filter((id) => !wornIds.has(id));
  const overCap = view.inventory.length >= INVENTORY_SOFT_CAP;
  const activeBonuses = STAT_ORDER.filter((stat) => view.statSums[stat] > 0);

  return (
    <>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBackToGrove}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ‹ Grove
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText type="subtitle">Dress</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        Four slots. Equip Powers to shape your Grove — Looks are for the eye.
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Worn</ThemedText>
        {SLOT_ORDER.map((slot) => (
          <SlotRow
            key={slot}
            slot={slot}
            itemId={view.equipped[slot] ?? null}
            onUnequip={onUnequip}
          />
        ))}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Equipped bonuses</ThemedText>
        {activeBonuses.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No bonuses yet — find and equip a Power item.
          </ThemedText>
        ) : (
          activeBonuses.map((stat) => (
            <View key={stat} style={styles.bonusRow}>
              <MaterialCommunityIcons
                name={stat === 'wave_power' ? 'lightning-bolt' : 'trending-up'}
                size={16}
                color={theme.accent}
              />
              <ThemedText type="smallBold">
                {formatMult({ stat, value: view.statSums[stat] })}
              </ThemedText>
            </View>
          ))
        )}
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.statRow}>
          <ThemedText type="smallBold">Bag</ThemedText>
          <ThemedText type="code" themeColor="textSecondary">
            {view.inventory.length}/{INVENTORY_SOFT_CAP}
          </ThemedText>
        </View>
        {overCap ? (
          <ThemedText type="small" themeColor="textSecondary">
            Bag is full — sell a Look to make room for a new Power.
          </ThemedText>
        ) : null}
        {bagIds.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing to wear yet. Claim or Dive to find items.
          </ThemedText>
        ) : (
          bagIds.map((id, index) => (
            <BagRow
              key={`${id}-${index}`}
              id={id}
              onEquip={onEquip}
              onSell={onSell}
            />
          ))
        )}
      </ThemedView>
    </>
  );
}

/** One Worn slot: label + equipped item (tap the row to take it off). */
function SlotRow({
  slot,
  itemId,
  onUnequip,
}: {
  slot: ItemSlot;
  itemId: string | null;
  onUnequip: (slot: ItemSlot) => void;
}) {
  const theme = useTheme();
  const def = itemId ? getItemDef(itemId) : undefined;
  return (
    <Pressable
      disabled={!def}
      onPress={() => def && onUnequip(slot)}
      accessibilityRole="button"
      accessibilityState={{ disabled: !def }}
      style={({ pressed }) => [
        styles.slotRow,
        pressed && def && styles.pressed,
      ]}>
      <View style={[styles.slotIcon, { backgroundColor: theme.backgroundSelected }]}>
        <MaterialCommunityIcons name={SLOT_ICONS[slot]} size={18} color={theme.accent} />
      </View>
      <View style={styles.slotText}>
        <ThemedText type="small" themeColor="textSecondary">
          {SLOT_LABELS[slot]}
        </ThemedText>
        {def ? (
          <ThemedText type="smallBold">{def.core.name}</ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Empty
          </ThemedText>
        )}
      </View>
      {def ? (
        <ThemedText type="small" themeColor="textSecondary">
          Take off
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

/** One bag item: tap to equip; Looks also carry an inline "Sell · +3". */
function BagRow({
  id,
  onEquip,
  onSell,
}: {
  id: string;
  onEquip: (itemId: string) => void;
  onSell: (itemId: string) => void;
}) {
  const theme = useTheme();
  const def = getItemDef(id);
  if (!def) {
    return (
      <View style={styles.bagRow}>
        <ThemedText type="smallBold">Unknown item</ThemedText>
      </View>
    );
  }
  const mults = [def.mult_a, def.mult_b].filter(
    (mult): mult is NonNullable<ItemDef['mult_a']> => mult != null,
  );
  const sellable = def.core.kind === 'look';
  return (
    <View style={styles.bagRow}>
      <Pressable
        onPress={() => onEquip(id)}
        accessibilityRole="button"
        accessibilityLabel={`Equip ${def.core.name}`}
        style={({ pressed }) => [styles.bagMain, pressed && styles.pressed]}>
        <View style={[styles.bagIcon, { backgroundColor: theme.backgroundSelected }]}>
          <MaterialCommunityIcons name={SLOT_ICONS[def.core.slot]} size={18} color={theme.accent} />
        </View>
        <View style={styles.bagText}>
          <ThemedText type="smallBold">{def.core.name}</ThemedText>
          <ThemedText type="code" themeColor="textSecondary">
            {capitalize(def.core.rarity)} {capitalize(def.core.kind)}
            {mults.length > 0 ? ` · ${mults.map(formatMult).join(' · ')}` : ''}
          </ThemedText>
        </View>
      </Pressable>
      {sellable ? (
        <Pressable
          onPress={() => onSell(id)}
          accessibilityRole="button"
          accessibilityLabel={`Sell ${def.core.name}`}
          style={({ pressed }) => [
            styles.sellPill,
            { backgroundColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="code" themeColor="textSecondary">
            Sell +{LOOK_SELL_TOKENS}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lede: {
    marginTop: -Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  slotIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    flex: 1,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  bagMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bagIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagText: {
    flex: 1,
  },
  sellPill: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  pressed: {
    opacity: 0.8,
  },
});
