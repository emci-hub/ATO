/**
 * Dress — 4 slots + bag + risky Merge (Play step 4 + merge polish, GAME_SPEC
 * §9 inventory / §9c / §11 screen 4; GAME_DATA item + equipped shape).
 *
 * Pure read/view of `view`. The bag is stacks (`{ id, count, star }` — each
 * row one distinct id+star tier). Interactions delegate up through `play.tsx`
 * to the shared playStore:
 * - tap a Worn slot → unequip (the copy returns to its matching-tier stack);
 * - tap a bag row → equip one copy of that tier into its slot (Power equips
 *   into an empty slot are refused over the 80-item soft cap);
 * - Looks carry an inline "Sell · +3" that sells ONE copy from the stack.
 *
 * Risky Merge: Power rows that can merge (a Worn power with a bagged spare of
 * the same tier, or a bag stack holding ≥ 2 of its tier) offer a "Merge" chip.
 * Tapping it opens a paced confirm panel showing the honest success % for
 * ★n → ★n+1 (70/55/40/28/18) with the same searching-beat + cooldown rhythm
 * Dive uses (`usePacedAction`, "Skip Dive delays" respected). Fail spends the
 * fuel only — the main is never destroyed. No Defend. No Supabase.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePacedAction } from '@/play/action-pacing';
import { itemArtSource } from '@/play/art';
import { allAvatarDefs, avatarDef } from '@/play/avatars';
import {
  NEON_ROW_LINE,
  NeonBackLink,
  NeonButton,
  NeonChip,
  NeonHeader,
  NeonIconFrame,
  NeonLabel,
  NeonPanel,
  NeonPill,
} from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import {
  formatItemStats,
  formatMult,
  getItemDef,
  rarityRank,
  type ItemDef,
  type ItemSlot,
  type ItemStat,
} from '@/play/items';
import {
  AVATAR_STAR_MAX,
  INVENTORY_SOFT_CAP,
  LOOK_SELL_TOKENS,
  mergeSuccessPct,
  type ItemRef,
  type ItemStack,
  type MergeOutcome,
  type MergeTarget,
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

/** Item art from the Kenney pack, falling back to a slot glyph (§19). */
function ItemIcon({
  art,
  slot,
  style,
}: {
  art?: string;
  slot: ItemSlot;
  style?: StyleProp<ViewStyle>;
}) {
  const source = art ? itemArtSource(art) : undefined;
  return (
    <NeonIconFrame size={34} style={style}>
      {source ? (
        <Image source={source} contentFit="contain" style={styles.itemIconArt} />
      ) : (
        <MaterialCommunityIcons name={SLOT_ICONS[slot]} size={18} color={NEON.cyan} />
      )}
    </NeonIconFrame>
  );
}
const STAT_ORDER: ItemStat[] = [
  'wave_power',
  'tower_speed',
  'token_earn',
  'dive_luck',
  'research_yield',
];

/** §9c grouping for the Equipped bonuses card (display only — no math). */
const BONUS_CATEGORIES: {
  title: 'Combat' | 'Economy' | 'Dive';
  stats: ItemStat[];
}[] = [
  { title: 'Combat', stats: ['wave_power', 'tower_speed'] },
  { title: 'Economy', stats: ['token_earn', 'research_yield'] },
  { title: 'Dive', stats: ['dive_luck'] },
];

/** One small icon per stat so a category never feels like a wall of text. */
const BONUS_ICONS: Record<ItemStat, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  wave_power: 'lightning-bolt',
  tower_speed: 'speedometer',
  token_earn: 'cash',
  research_yield: 'flask',
  dive_luck: 'waves',
};

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
  skipDelays,
  reduceMotion,
  onEquip,
  onSell,
  onUnequip,
  onMerge,
  onActivateAvatar,
  onUnlockAvatar,
  onBackToGrove,
}: {
  view: PlayView;
  skipDelays: boolean;
  reduceMotion: boolean;
  onEquip: (itemId: string, star: number) => void;
  onSell: (itemId: string, star: number) => void;
  onUnequip: (slot: ItemSlot) => void;
  onMerge: (target: MergeTarget) => Promise<MergeOutcome | null>;
  /** Avatar swap — make another owned Avatar active (its own level/stars/gear/
   * park become the ones Dress + Defend use; the bag is shared). */
  onActivateAvatar: (id: string) => void;
  /** Avatar swap — unlock a def (stub, no IAP yet). */
  onUnlockAvatar: (id: string) => void;
  onBackToGrove: () => void;
}) {
  const theme = useTheme();
  const [filter, setFilter] = useState<BagFilter>('all');
  const [mergeTarget, setMergeTarget] = useState<MergeTarget | null>(null);
  const { act, busy, showSplash } = usePacedAction(skipDelays);

  const totalOwned = view.totalOwned;
  const overCap = totalOwned >= INVENTORY_SOFT_CAP;
  const activeBonuses = STAT_ORDER.filter((stat) => view.statSums[stat] > 0);
  const anyBonuses = activeBonuses.length > 0;
  const stacks = visibleStacks(view.inventory, filter);

  const handleMergePress = (target: MergeTarget) => {
    if (busy) return;
    setMergeTarget(target);
  };

  return (
    <>
      <NeonBackLink onPress={onBackToGrove} />

      <NeonHeader
        title="Dress"
        lede="Four slots. Equip Powers to shape your Basecore — Looks are for the eye."
      />

      {/* Active Avatar picker (v16): per-Avatar level/stars/equip/park; the
       * bag, tokens and campaign are shared. Behind Avatars show a ×2.5 EXP
       * badge — Trial fights on them catch up until one below the top. */}
      <AvatarPicker
        view={view}
        onActivateAvatar={onActivateAvatar}
        onUnlockAvatar={onUnlockAvatar}
      />

      <NeonPanel>
        <NeonLabel>Worn</NeonLabel>
        {SLOT_ORDER.map((slot) => {
          const ref = view.equipped[slot] ?? null;
          return (
            <SlotRow
              key={slot}
              slot={slot}
              ref={ref}
              fuelInBag={ref ? hasFuel(view, ref) : false}
              onUnequip={onUnequip}
              onMerge={handleMergePress}
            />
          );
        })}
      </NeonPanel>

      <NeonPanel>
        <NeonLabel>Equipped bonuses</NeonLabel>
        {!anyBonuses ? (
          <ThemedText type="small" themeColor="textSecondary">
            No bonuses yet — find and equip a Power item.
          </ThemedText>
        ) : (
          BONUS_CATEGORIES.map((category) => {
            const stats = category.stats.filter((stat) => view.statSums[stat] > 0);
            return (
              <View key={category.title} style={styles.bonusCategory}>
                <ThemedText type="code" themeColor="textSecondary">
                  {category.title}
                </ThemedText>
                {stats.length > 0 ? (
                  stats.map((stat) => (
                    <View key={stat} style={styles.bonusRow}>
                      <MaterialCommunityIcons
                        name={BONUS_ICONS[stat]}
                        size={16}
                        color={theme.accent}
                      />
                      <ThemedText type="smallBold">
                        {formatMult({ stat, value: view.statSums[stat] })}
                      </ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    none yet
                  </ThemedText>
                )}
              </View>
            );
          })
        )}
      </NeonPanel>

      {/* Merge confirm block sits DIRECTLY above the Bag — the fuel it
       * consumes comes from bag spares, so the panel anchors to that card. */}
      {mergeTarget ? (
        <MergePanel
          target={mergeTarget}
          busy={busy}
          showSplash={showSplash}
          reduceMotion={reduceMotion}
          onMerge={() =>
            act('Merging…', async () => {
              const outcome = await onMerge(mergeTarget);
              if (outcome) setMergeTarget(null); // resolved → back to the list
              return outcome != null;
            })
          }
          onDone={() => {
            if (!busy) setMergeTarget(null);
          }}
        />
      ) : null}

      <NeonPanel>
        <View style={styles.statRow}>
          <NeonLabel>Bag</NeonLabel>
          <ThemedText type="code" themeColor="textSecondary">
            {totalOwned}/{INVENTORY_SOFT_CAP} held
          </ThemedText>
        </View>
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}>
            {FILTER_TABS.map((tab) => (
              <NeonChip
                key={tab.key}
                label={tab.label}
                selected={filter === tab.key}
                onPress={() => setFilter(tab.key)}
              />
            ))}
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
          stacks.map((stack) => {
            const def = getItemDef(stack.id);
            const wornRef = def ? view.equipped[def.core.slot] : undefined;
            const sameTierWorn =
              wornRef != null && wornRef.id === stack.id && wornRef.star === stack.star;
            return (
              <StackRow
                key={`${stack.id}@${stack.star}`}
                stack={stack}
                sameTierWorn={sameTierWorn}
                onEquip={onEquip}
                onSell={onSell}
                onMerge={handleMergePress}
              />
            );
          })
        )}
      </NeonPanel>
    </>
  );
}

/** Does the bag hold ≥1 spare of the exact tier this worn ref is on? */
function hasFuel(view: PlayView, ref: ItemRef): boolean {
  return view.inventory.some(
    (stack) => stack.id === ref.id && stack.star === ref.star && stack.count >= 1,
  );
}

/**
 * Merge confirm panel — Dive feel: shows the main, its honest success % for
 * ★n → ★n+1, and a paced Merge button (beat → resolve → cooldown). On resolve
 * the caller (play.tsx) toasts the result and this panel clears via `onDone`.
 */
function MergePanel({
  target,
  busy,
  showSplash,
  reduceMotion,
  onMerge,
  onDone,
}: {
  target: MergeTarget;
  busy: boolean;
  showSplash: boolean;
  reduceMotion: boolean;
  onMerge: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const def = getItemDef(target.id);
  const pct = mergeSuccessPct(target.star);
  const fromLabel = starLabel(target.star);
  const toLabel = starLabel(target.star + 1);
  if (!def || pct == null) return null; // nothing mergeable anymore
  return (
    <NeonPanel>
      {showSplash ? (
        <View style={styles.splashRow}>
          {!reduceMotion ? <ActivityIndicator size="small" color={theme.accent} /> : null}
          <ThemedText type="smallBold">Merging…</ThemedText>
        </View>
      ) : (
        <>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">
              Merge {def.core.name} {fromLabel} → {toLabel}
            </ThemedText>
            <ThemedText type="subheading" themeColor="emphasis">
              {pct}%
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            One {def.core.name} {fromLabel || 'spare'} is spent as fuel — a higher
            star scales its bonuses. A miss keeps your {target.main === 'worn' ? 'worn' : ''}{' '}
            {def.core.name} and only costs the fuel.
          </ThemedText>
          <View style={styles.buttonRow}>
            <NeonButton
              label="Cancel"
              onPress={onDone}
              disabled={busy}
              variant="secondary"
              style={styles.mergeButtonCancel}
            />
            <NeonButton
              label={`Merge · ${pct}%`}
              onPress={onMerge}
              disabled={busy}
              style={styles.mergeButtonConfirm}
            />
          </View>
        </>
      )}
    </NeonPanel>
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
    const byName = aDef.core.name.localeCompare(bDef.core.name);
    if (byName !== 0) return byName;
    return b.star - a.star; // same item: higher star first
  });
}

function emptyCopy(filter: BagFilter): string {
  if (filter === 'all') return 'Nothing in the bag yet. Claim or Dive to find items.';
  const label = filter === 'junk' ? 'junk Looks' : `${SLOT_LABELS[filter]}s`;
  return `No ${label} in the bag.`;
}

/** "★2" for star > 0, "" for a base copy. */
function starLabel(star: number): string {
  return star > 0 ? `★${star}` : '';
}

/** One Worn slot: label + equipped item. Tap to take off; Merge when fuel. */
function SlotRow({
  slot,
  ref,
  fuelInBag,
  onUnequip,
  onMerge,
}: {
  slot: ItemSlot;
  ref: ItemRef | null;
  fuelInBag: boolean;
  onUnequip: (slot: ItemSlot) => void;
  onMerge: (target: MergeTarget) => void;
}) {
  const def = ref ? getItemDef(ref.id) : undefined;
  const canMerge =
    !!ref &&
    !!def &&
    def.core.kind === 'power' &&
    fuelInBag &&
    mergeSuccessPct(ref.star) != null;
  return (
    <View style={styles.slotRow}>
      <Pressable
        disabled={!def}
        onPress={() => def && onUnequip(slot)}
        accessibilityRole="button"
        accessibilityState={{ disabled: !def }}
        style={({ pressed }) => [styles.slotMain, pressed && def && styles.pressed]}>
        <ItemIcon art={def?.core.art} slot={slot} />
        <View style={styles.slotText}>
          <ThemedText type="small" themeColor="textSecondary">
            {SLOT_LABELS[slot]}
          </ThemedText>
          {def && ref ? (
            <View style={styles.titleLine}>
              <ThemedText type="smallBold">
                {def.core.name}
                {starLabel(ref.star) ? ` ${starLabel(ref.star)}` : ''}
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Empty
            </ThemedText>
          )}
          {def ? (
            <ThemedText type="code" themeColor="textSecondary">
              {describeItem(def, ref?.star ?? 0)}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      {canMerge && ref && def ? (
        <NeonButton
          label={`Merge · ${mergeSuccessPct(ref.star)}%`}
          onPress={() => onMerge({ id: ref.id, star: ref.star, main: 'worn' })}
          variant="danger"
          accessibilityLabel={`Merge ${def.core.name}`}
          style={styles.rowAction}
        />
      ) : null}
      {def && ref ? (
        <NeonButton
          label="Take off"
          onPress={() => onUnequip(slot)}
          variant="secondary"
          accessibilityLabel={`Take off ${def.core.name}`}
          style={styles.rowAction}
        />
      ) : null}
    </View>
  );
}

/** One bag stack. Tap the row to equip one copy of its tier — unless that
 * exact tier is ALREADY worn (spare / merge fuel). Looks sell one at a time. */
function StackRow({
  stack,
  sameTierWorn,
  onEquip,
  onSell,
  onMerge,
}: {
  stack: ItemStack;
  sameTierWorn: boolean;
  onEquip: (itemId: string, star: number) => void;
  onSell: (itemId: string, star: number) => void;
  onMerge: (target: MergeTarget) => void;
}) {
  const def = getItemDef(stack.id);
  if (!def) {
    return (
      <View style={styles.stackRow}>
        <ThemedText type="smallBold">
          Unknown item ×{stack.count}
          {starLabel(stack.star)}
        </ThemedText>
      </View>
    );
  }
  const sellable = def.core.kind === 'look';
  const isPower = def.core.kind === 'power';
  // A power stack with ≥ 2 of its tier can merge (one main + one fuel).
  const canMergeAsBagMain = isPower && stack.count >= 2 && mergeSuccessPct(stack.star) != null;
  const mergePct = mergeSuccessPct(stack.star);
  const star = starLabel(stack.star);

  const icon = <ItemIcon art={def.core.art} slot={def.core.slot} />;
  const body = (
    <View style={styles.stackText}>
      <View style={styles.stackTitleLine}>
        <ThemedText type="smallBold">
          {def.core.name}
          {star ? ` ${star}` : ''}
        </ThemedText>
        {stack.count > 1 ? <NeonPill label={`×${stack.count}`} tone="emphasis" /> : null}
        {sameTierWorn ? <NeonPill label="Spare" /> : null}
      </View>
      <ThemedText type="code" themeColor="textSecondary">
        {describeItem(def, stack.star)}
      </ThemedText>
    </View>
  );

  return (
    <View style={styles.stackRow}>
      {sameTierWorn ? (
        <View style={styles.stackMain}>{icon}{body}</View>
      ) : (
        <Pressable
          onPress={() => onEquip(stack.id, stack.star)}
          accessibilityRole="button"
          accessibilityLabel={`Equip ${def.core.name}${star ? ` ${star}` : ''}`}
          style={({ pressed }) => [styles.stackMain, pressed && styles.pressed]}>
          {icon}{body}
        </Pressable>
      )}
      {canMergeAsBagMain ? (
        <NeonButton
          label={mergePct != null ? `Merge · ${mergePct}%` : 'Merge'}
          onPress={() => onMerge({ id: stack.id, star: stack.star, main: 'bag' })}
          variant="danger"
          accessibilityLabel={`Merge ${def.core.name}`}
          style={styles.rowAction}
        />
      ) : null}
      {sellable ? (
        <NeonButton
          label={`Sell +${LOOK_SELL_TOKENS}`}
          onPress={() => onSell(stack.id, stack.star)}
          variant="secondary"
          accessibilityLabel={`Sell one ${def.core.name}`}
          style={styles.rowAction}
        />
      ) : null}
    </View>
  );
}

/** "Rare Power · +8% wave power · +3% dive luck" — rarity + kind + the
 * item's effects scaled to the COPY's star (`formatItemStats`, StarTable
 * ×(1 + 10% per star)), so a worn/bagged ★2 copy reads stronger than its ★0
 * twin. Looks keep just their rarity + kind (no effect line). */
function describeItem(def: ItemDef, star: number): string {
  const head = `${capitalize(def.core.rarity)} ${capitalize(def.core.kind)}`;
  const stats = formatItemStats(def, star);
  return stats ? `${head} · ${stats}` : head;
}

/**
 * Dress's Active Avatar picker (v16 — Avatar swap). One row per known def:
 * owned rows show Lv / ★ / worn slots and the ACTIVE state; rows one or more
 * levels behind the highest owned Avatar carry the ×2.5 EXP catch-up badge.
 * Locked defs show the free stub Unlock (Hero/IAP later).
 */
function AvatarPicker({
  view,
  onActivateAvatar,
  onUnlockAvatar,
}: {
  view: PlayView;
  onActivateAvatar: (id: string) => void;
  onUnlockAvatar: (id: string) => void;
}) {
  const owned = new Map(view.avatars.map((avatar) => [avatar.id, avatar]));
  const activeDef = avatarDef(view.activeAvatarId);
  return (
    <NeonPanel>
      <View style={styles.statRow}>
        <NeonLabel>Active Avatar</NeonLabel>
        <ThemedText type="smallBold" themeColor="emphasis">
          {activeDef?.name ?? view.activeAvatarId}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Each Avatar levels, stars and equips on its own. The bag, tokens, campaign
        and Bound Bosses are shared — swap freely.
      </ThemedText>
      {allAvatarDefs().map((def) => {
        const record = owned.get(def.id);
        if (!record) {
          return (
            <View key={def.id} style={styles.avatarRow}>
              <NeonIconFrame size={34}>
                <MaterialCommunityIcons name={def.icon} size={18} color={NEON.textMuted} />
              </NeonIconFrame>
              <View style={styles.avatarText}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {def.name}
                </ThemedText>
                <ThemedText type="code" themeColor="textSecondary">
                  {def.blurb}
                </ThemedText>
              </View>
              <NeonButton
                label="Unlock"
                onPress={() => onUnlockAvatar(def.id)}
                variant="secondary"
                accessibilityLabel={`Unlock ${def.name}`}
                style={styles.rowAction}
              />
            </View>
          );
        }
        const defColor = def.color;
        return (
          <View
            key={record.id}
            style={[styles.avatarRow, record.active && { borderColor: defColor }]}>
            <NeonIconFrame
              size={34}
              style={record.active ? { backgroundColor: defColor, borderColor: defColor } : undefined}>
              <MaterialCommunityIcons
                name={def.icon}
                size={18}
                color={record.active ? '#FFFFFF' : NEON.textMuted}
              />
            </NeonIconFrame>
            <View style={styles.avatarText}>
              <View style={styles.avatarTitleLine}>
                <ThemedText type="smallBold">{def.name}</ThemedText>
                {record.catchup ? <NeonPill label="×2.5 EXP" tone="emphasis" /> : null}
              </View>
              <ThemedText type="code" themeColor="textSecondary">
                Lv {record.level} · ★{record.stars}/{AVATAR_STAR_MAX} · {record.worn}/4 worn
              </ThemedText>
            </View>
            {record.active ? (
              <NeonPill label="Active" tone="emphasis" />
            ) : (
              <NeonButton
                label="Use"
                onPress={() => onActivateAvatar(def.id)}
                variant="secondary"
                accessibilityLabel={`Use ${def.name}`}
                style={styles.rowAction}
              />
            )}
          </View>
        );
      })}
    </NeonPanel>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const styles = StyleSheet.create({
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  filterRow: {
    marginHorizontal: -Spacing.three,
  },
  filterContent: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: NEON_ROW_LINE,
    paddingVertical: Spacing.two,
  },
  slotMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  itemIconArt: {
    width: 22,
    height: 22,
  },
  slotText: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bonusCategory: {
    gap: Spacing.one,
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
    borderBottomWidth: 1,
    borderBottomColor: NEON_ROW_LINE,
    paddingVertical: Spacing.two,
  },
  stackMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: NEON_ROW_LINE,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.two,
  },
  avatarText: {
    flex: 1,
    gap: Spacing.half,
  },
  avatarTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowAction: {
    minHeight: 28,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  mergeButtonCancel: {
    flex: 1,
  },
  mergeButtonConfirm: {
    flex: 2,
  },
  splashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
