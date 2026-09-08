/**
 * Dress — 4 slots + bag (Play step 4 + bag polish, GAME_SPEC §9 inventory /
 * §9c / §11 screen 4; GAME_DATA item + equipped shape).
 *
 * Pure read/view of `view`. The bag is stacks (`{ id, count }` — each row one
 * distinct item id); the Worn card shows the four slots. Interactions delegate
 * up through `play.tsx` to the shared playStore:
 * - tap a Worn slot → unequip (the copy returns to its bag stack);
 * - tap a bag row → equip one copy into its slot (Power equips into an empty
 *   slot are refused over the 80-item soft cap — sell a Look first);
 * - Looks carry an inline "Sell · +3" that sells ONE copy from the stack.
 *
 * The bag section filters by tab (All / Weapon / Armor / Cloak / Trinket /
 * Junk) and sorts within each tab by rarity (best first), then by name.
 * Junk = Looks, whatever slot they belong to. No Defend. No Supabase.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatMult,
  getItemDef,
  rarityRank,
  type ItemDef,
  type ItemSlot,
  type ItemStat,
} from '@/play/items';
import {
  INVENTORY_SOFT_CAP,
  LOOK_SELL_TOKENS,
  totalOwnedCount,
  type ItemStack,
  type PlayView,
} from '@/play/playStore';

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

/** Bag filter tabs: a slot, "all", or "junk" (= every Look, any slot). */
type BagFilter = 'all' | ItemSlot | 'junk';

const FILTER_TABS: { key: BagFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'weapon', label: 'Weapon' },
  { key: 'armor', label: 'Armor' },
  { key: 'cloak', label: 'Cloak' },
  { key: 'trinket', label: 'Trinket' },
  { key: 'junk', label: 'Junk' },
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
  const [filter, setFilter] = useState<BagFilter>('all');
  const totalOwned = totalOwnedCount(view.inventory, view.equipped);
  const overCap = totalOwned >= INVENTORY_SOFT_CAP;
  const activeBonuses = STAT_ORDER.filter((stat) => view.statSums[stat] > 0);

  const stacks = visibleStacks(view.inventory, filter);

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
            {totalOwned}/{INVENTORY_SOFT_CAP} held
          </ThemedText>
        </View>
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}>
            {FILTER_TABS.map((tab) => {
              const selected = filter === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.filterChip,
                    { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="code"
                    themeColor={selected ? undefined : 'textSecondary'}
                    style={selected && { color: theme.accent }}>
                    {tab.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        {overCap ? (
          <ThemedText type="small" themeColor="textSecondary">
            Bag is full — sell a Look to make room for a new Power.
          </ThemedText>
        ) : null}
        {stacks.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {emptyCopy(filter)}
          </ThemedText>
        ) : (
          stacks.map((stack) => (
            <StackRow
              key={stack.id}
              stack={stack}
              alreadyWorn={view.equipped[getItemDef(stack.id)?.core.slot ?? 'weapon'] === stack.id}
              onEquip={onEquip}
              onSell={onSell}
            />
          ))
        )}
      </ThemedView>
    </>
  );
}

/** Bag rows for the active filter, sorted best-rarity-first then by name. */
function visibleStacks(inventory: readonly ItemStack[], filter: BagFilter): ItemStack[] {
  const rows = inventory.filter((stack) => {
    const def = getItemDef(stack.id);
    if (!def) return filter === 'all'; // dangling rows only under All
    if (filter === 'junk') return def.core.kind === 'look';
    if (filter === 'all') return true;
    return def.core.slot === filter;
  });
  return rows.sort((a, b) => {
    const aDef = getItemDef(a.id);
    const bDef = getItemDef(b.id);
    if (!aDef || !bDef) return a.id.localeCompare(b.id);
    const byRarity = rarityRank(aDef.core.rarity) - rarityRank(bDef.core.rarity);
    if (byRarity !== 0) return byRarity;
    return aDef.core.name.localeCompare(bDef.core.name);
  });
}

function emptyCopy(filter: BagFilter): string {
  if (filter === 'all') return 'Nothing in the bag yet. Claim or Dive to find items.';
  const label = filter === 'junk' ? 'junk Looks' : `${SLOT_LABELS[filter]}s`;
  return `No ${label} in the bag.`;
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
      style={({ pressed }) => [styles.slotRow, pressed && def && styles.pressed]}>
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

/**
 * One bag stack. Tap the row to equip one copy into its slot — unless a copy
 * of that id is ALREADY worn (one per slot), in which case these are spares:
 * the row is inert (Sell still works for Looks). Looks sell one at a time.
 */
function StackRow({
  stack,
  alreadyWorn,
  onEquip,
  onSell,
}: {
  stack: ItemStack;
  alreadyWorn: boolean;
  onEquip: (itemId: string) => void;
  onSell: (itemId: string) => void;
}) {
  const theme = useTheme();
  const def = getItemDef(stack.id);
  if (!def) {
    return (
      <View style={styles.stackRow}>
        <ThemedText type="smallBold">Unknown item ×{stack.count}</ThemedText>
      </View>
    );
  }
  const mults = [def.mult_a, def.mult_b].filter(
    (mult): mult is NonNullable<ItemDef['mult_a']> => mult != null,
  );
  const sellable = def.core.kind === 'look';
  const icon = (
    <View style={[styles.stackIcon, { backgroundColor: theme.backgroundSelected }]}>
      <MaterialCommunityIcons name={SLOT_ICONS[def.core.slot]} size={18} color={theme.accent} />
    </View>
  );
  const body = (
    <View style={styles.stackText}>
      <View style={styles.stackTitleLine}>
        <ThemedText type="smallBold">{def.core.name}</ThemedText>
        {stack.count > 1 ? (
          <View style={[styles.countBadge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="code" themeColor="emphasis">
              ×{stack.count}
            </ThemedText>
          </View>
        ) : null}
        {alreadyWorn ? (
          <View style={[styles.spareBadge, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="code" themeColor="textSecondary">
              Spare
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="code" themeColor="textSecondary">
        {capitalize(def.core.rarity)} {capitalize(def.core.kind)}
        {mults.length > 0 ? ` · ${mults.map(formatMult).join(' · ')}` : ''}
      </ThemedText>
    </View>
  );
  return (
    <View style={styles.stackRow}>
      {alreadyWorn ? (
        <View style={styles.stackMainGroup}>
          {icon}
          {body}
        </View>
      ) : (
        <Pressable
          onPress={() => onEquip(stack.id)}
          accessibilityRole="button"
          accessibilityLabel={`Equip ${def.core.name}`}
          style={({ pressed }) => [styles.stackMainGroup, pressed && styles.pressed]}>
          {icon}
          {body}
        </Pressable>
      )}
      {sellable ? (
        <Pressable
          onPress={() => onSell(stack.id)}
          accessibilityRole="button"
          accessibilityLabel={`Sell one ${def.core.name}`}
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
  filterRow: {
    marginHorizontal: -Spacing.three, // bleed to the card edge like a chip bar
  },
  filterContent: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  filterChip: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
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
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  stackMainGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stackIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackText: {
    flex: 1,
    gap: Spacing.half,
  },
  stackTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  countBadge: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
  },
  spareBadge: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
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
