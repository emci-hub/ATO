/**
 * Dress — 4 slots + bag + risky Merge (Play step 4 + merge polish, GAME_SPEC
 * §9 inventory / §9c / §11 screen 4; GAME_DATA item + equipped shape).
 *
 * Pure read/view of `view`. The bag is stacks (`{ id, count, star }` — each
 * row one distinct id+star tier). Interactions delegate up through `play.tsx`
 * to the shared playStore.
 *
 * Every item row works the same way (2026-09-27 redesign, emci):
 * - tap the row → it EXPANDS in place: rarity / kind / slot, its bonuses now
 *   and at the next star, what a merge costs, and its actions (Equip, Take
 *   off, Sell). There is no separate detail screen.
 * - the row's own "Merge · 55%" button merges right there. A miss permanently
 *   spends one fuel copy (the main is never lost), so it takes two taps: the
 *   first arms it ("Tap again · 55%", lapses after a few seconds), the second
 *   rolls with Dive's paced beat. The result — a green glow + "✓ Merged ★3",
 *   or a red flash + shake + "✗ Missed · spare spent" — plays on the row
 *   itself (`merge-row.tsx`). There is no detached confirm card any more.
 *
 * Mergeable: a Worn power with a bagged spare of the same tier, or a bag
 * stack holding ≥ 2 of its tier; ★n → ★n+1 odds 70/55/40/28/18. No Defend.
 * No Supabase.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ComponentProps, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import {
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
import { itemArtSource } from '@/play/art';
import { FinishPicker } from '@/play/finish-picker';
import type { PlayTransition } from '@/play/use-play-store';
import {
  bagRowKey,
  mergeButtonA11y,
  mergeButtonLabel,
  mergeFeedbackLabel,
  wornRowKey,
  type MergeButtonState,
  type MergeRowFeedback,
} from '@/play/merge-inline';
import {
  MERGE_MISS_COLOR,
  MERGE_OK_COLOR,
  MergeFeedbackRow,
  useInlineMerge,
} from '@/play/merge-row';
import { allAvatarDefs, avatarDef } from '@/play/avatars';
import { getTune } from '@/play/tune';
import { ELEMENT_LABEL, type Element } from '@/play/kits';
import {
  LEGEND_EXPLAINER,
  LEGEND_FIRST_TIP_BODY,
  LEGEND_FIRST_TIP_TITLE,
  gearMatchLine,
  legendBoostLine,
  legendLevelLine,
  legendNextLine,
} from '@/play/legend-copy';
import { HeroGrid } from '@/play/hero-grid';
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
  onSetAvatarHero,
  onBackToGrove,
  commit,
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
  /** Slice A2.5 — make an owned HERO the Avatar (the sprite + skill kit you
   * fight as). Same setter the own-sheet uses, so it also gives up that hero's
   * tower bind if it had one. The board now draws the hero's own sprite set. */
  onSetAvatarHero: (heroId: string) => void;
  onBackToGrove: () => void;
  /** v30 — pet finish. The hero grid stays the hero switch. */
  commit: (transition: PlayTransition) => boolean;
}) {
  const theme = useTheme();
  const [filter, setFilter] = useState<BagFilter>('all');
  /** The one expanded row (a `wornRowKey` / `bagRowKey`), or null. */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const merge = useInlineMerge(skipDelays, onMerge);

  const totalOwned = view.totalOwned;
  const overCap = totalOwned >= INVENTORY_SOFT_CAP;
  const activeBonuses = STAT_ORDER.filter((stat) => view.statSums[stat] > 0);
  const anyBonuses = activeBonuses.length > 0;
  const stacks = visibleStacks(view.inventory, filter);

  const toggleRow = (key: string) =>
    setExpandedKey((current) => (current === key ? null : key));

  return (
    <LegendElementContext.Provider value={view.legendElement}>
      <NeonBackLink onPress={onBackToGrove} />

      <NeonHeader
        title="Dress"
        lede="Four slots. Equip Powers to shape your Basecore — Looks are for the eye."
      />

      <LegendFirstTip />

      <NeonPanel>
        <FinishPicker
          view={view}
          commit={commit}
          pet={view.pet.state}
          dyeOn={view.pet.dyeOn}
          reduceMotion={reduceMotion}
        />
      </NeonPanel>

      {/* Heroes first (2026-09-28): the grid is the real switch surface — which
       * hero you fight as (art + Veil), and what its attack becomes with the
       * active Legend's element. */}
      <HeroGrid
        activeHeroId={view.activeAvatarHeroId}
        ownedHeroIds={view.ownedHeroIds}
        boundHeroIds={view.boundHeroIds}
        legendElement={view.legendElement}
        onSetAvatarHero={onSetAvatarHero}
      />

      {/* Legends (2026-09-28): one per element. The active Legend sets the
       * element of every attack; its record holds level, stars and worn gear. */}
      <AvatarPicker
        view={view}
        onActivateAvatar={onActivateAvatar}
        onUnlockAvatar={onUnlockAvatar}
      />

      <NeonPanel>
        <NeonLabel>Worn</NeonLabel>
        {SLOT_ORDER.map((slot) => {
          const ref = view.equipped[slot] ?? null;
          const key = wornRowKey(slot, ref?.id ?? null);
          return (
            <SlotRow
              key={slot}
              slot={slot}
              ref={ref}
              fuelInBag={ref ? hasFuel(view, ref) : false}
              expanded={expandedKey === key}
              onToggle={() => toggleRow(key)}
              mergeState={merge.buttonState(key)}
              mergeLocked={merge.busy}
              feedback={merge.feedbackFor(key)}
              reduceMotion={reduceMotion}
              onUnequip={onUnequip}
              onMerge={(target) => merge.press(key, target)}
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
            const key = bagRowKey(stack.id, stack.star);
            return (
              <StackRow
                key={key}
                stack={stack}
                sameTierWorn={sameTierWorn}
                expanded={expandedKey === key}
                onToggle={() => toggleRow(key)}
                mergeState={merge.buttonState(key)}
                mergeLocked={merge.busy}
                feedback={merge.feedbackFor(key)}
                reduceMotion={reduceMotion}
                onEquip={onEquip}
                onSell={onSell}
                onMerge={(target) => merge.press(key, target)}
              />
            );
          })
        )}
      </NeonPanel>
    </LegendElementContext.Provider>
  );
}

/** The active Legend's element, for gear rows (a worn Power of the same
 * element gets its stats raised — shown on the row, never invisible). */
const LegendElementContext = createContext<Element | null>(null);

/** One-time first-visit tip key (device-local; dismissing it is permanent). */
const LEGEND_TIP_KEY = 'ato.play.tip.legends.v1';

/** The first-visit tip explaining Legend → hero → gear. Hidden until the
 * saved flag is read, so it never flashes for a player who dismissed it. */
function LegendFirstTip() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(LEGEND_TIP_KEY)
      .then((seen) => {
        if (alive && !seen) setShow(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!show) return null;
  return (
    <NeonPanel>
      <NeonLabel>{LEGEND_FIRST_TIP_TITLE}</NeonLabel>
      <ThemedText type="small" themeColor="textSecondary">
        {LEGEND_FIRST_TIP_BODY}
      </ThemedText>
      <NeonButton
        label="Got it"
        onPress={() => {
          setShow(false);
          AsyncStorage.setItem(LEGEND_TIP_KEY, '1').catch(() => {});
        }}
        variant="secondary"
        accessibilityLabel="Dismiss the Legend tip"
      />
    </NeonPanel>
  );
}

/** "Legend +100%" pill for a worn/bagged Power matching the active Legend. */
function GearMatchPill({ def }: { def: ItemDef }) {
  const legend = useContext(LegendElementContext);
  if (!legend || def.core.kind !== 'power' || def.core.type_tag !== legend) return null;
  return <NeonPill label={`Legend +${Math.round(getTune().gearMatchBonus * 100)}%`} tone="emphasis" />;
}

/** Does the bag hold ≥1 spare of the exact tier this worn ref is on? */
function hasFuel(view: PlayView, ref: ItemRef): boolean {
  return view.inventory.some(
    (stack) => stack.id === ref.id && stack.star === ref.star && stack.count >= 1,
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

/** Props every item row shares: expand-in-place + the inline merge flow. */
type RowMergeProps = {
  expanded: boolean;
  onToggle: () => void;
  mergeState: MergeButtonState;
  /** True while any row's roll or its cooldown runs — every Merge is locked. */
  mergeLocked: boolean;
  feedback: MergeRowFeedback | null;
  reduceMotion: boolean;
  onMerge: (target: MergeTarget) => void;
};

/** One Worn slot. Tap to expand (details + Take off); Merge when a spare of
 * the same tier is in the bag. */
function SlotRow({
  slot,
  ref,
  fuelInBag,
  expanded,
  onToggle,
  mergeState,
  mergeLocked,
  feedback,
  reduceMotion,
  onUnequip,
  onMerge,
}: RowMergeProps & {
  slot: ItemSlot;
  ref: ItemRef | null;
  fuelInBag: boolean;
  onUnequip: (slot: ItemSlot) => void;
}) {
  const def = ref ? getItemDef(ref.id) : undefined;
  const pct = ref ? mergeSuccessPct(ref.star) : null;
  const canMerge = !!ref && !!def && def.core.kind === 'power' && fuelInBag && pct != null;
  return (
    <MergeFeedbackRow feedback={feedback} reduceMotion={reduceMotion} style={styles.itemRow}>
      <View style={styles.itemRowTop}>
        <Pressable
          disabled={!def}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ disabled: !def, expanded }}
          accessibilityLabel={
            def ? `${def.core.name}, ${SLOT_LABELS[slot]}. ${expanded ? 'Hide' : 'Show'} details` : undefined
          }
          style={({ pressed }) => [styles.itemMain, pressed && def && styles.pressed]}>
          <ItemIcon art={def?.core.art} slot={slot} />
          <View style={styles.itemText}>
            <ThemedText type="small" themeColor="textSecondary">
              {SLOT_LABELS[slot]}
            </ThemedText>
            {def && ref ? (
              <View style={styles.itemTitleLine}>
                <ThemedText type="smallBold">
                  {def.core.name}
                  {starLabel(ref.star) ? ` ${starLabel(ref.star)}` : ''}
                </ThemedText>
                {def ? <GearMatchPill def={def} /> : null}
                {feedback ? <FeedbackPill feedback={feedback} /> : null}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Empty
              </ThemedText>
            )}
            {def && ref ? (
              <ThemedText type="code" themeColor="textSecondary">
                {describeItem(def, ref.star)}
              </ThemedText>
            ) : null}
          </View>
          {def ? <RowChevron expanded={expanded} /> : null}
        </Pressable>
        {canMerge && ref && def && pct != null ? (
          <InlineMergeButton
            state={mergeState}
            locked={mergeLocked}
            pct={pct}
            name={def.core.name}
            onPress={() => onMerge({ id: ref.id, star: ref.star, main: 'worn' })}
          />
        ) : null}
      </View>
      {expanded && def && ref ? (
        <ItemDetails
          def={def}
          star={ref.star}
          mergeNote={
            canMerge
              ? 'Merge spends one matching spare from your bag. A miss keeps this item.'
              : null
          }>
          <NeonButton
            label="Take off"
            onPress={() => onUnequip(slot)}
            variant="secondary"
            accessibilityLabel={`Take off ${def.core.name}`}
            style={styles.detailAction}
          />
        </ItemDetails>
      ) : null}
    </MergeFeedbackRow>
  );
}

/** One bag stack. Tap to expand (details + Equip / Sell); Merge when the stack
 * holds ≥ 2 of its tier. */
function StackRow({
  stack,
  sameTierWorn,
  expanded,
  onToggle,
  mergeState,
  mergeLocked,
  feedback,
  reduceMotion,
  onEquip,
  onSell,
  onMerge,
}: RowMergeProps & {
  stack: ItemStack;
  sameTierWorn: boolean;
  onEquip: (itemId: string, star: number) => void;
  onSell: (itemId: string, star: number) => void;
}) {
  const def = getItemDef(stack.id);
  if (!def) {
    return (
      <View style={styles.itemRow}>
        <ThemedText type="smallBold">
          Unknown item ×{stack.count}
          {starLabel(stack.star)}
        </ThemedText>
      </View>
    );
  }
  const sellable = def.core.kind === 'look';
  const pct = mergeSuccessPct(stack.star);
  // A power stack with ≥ 2 of its tier can merge (one main + one fuel).
  const canMerge = def.core.kind === 'power' && stack.count >= 2 && pct != null;
  const star = starLabel(stack.star);

  return (
    <MergeFeedbackRow feedback={feedback} reduceMotion={reduceMotion} style={styles.itemRow}>
      <View style={styles.itemRowTop}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${def.core.name}${star ? ` ${star}` : ''}, ${stack.count} held. ${
            expanded ? 'Hide' : 'Show'
          } details`}
          style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}>
          <ItemIcon art={def.core.art} slot={def.core.slot} />
          <View style={styles.itemText}>
            <View style={styles.itemTitleLine}>
              <ThemedText type="smallBold">
                {def.core.name}
                {star ? ` ${star}` : ''}
              </ThemedText>
              {stack.count > 1 ? <NeonPill label={`×${stack.count}`} tone="emphasis" /> : null}
              <GearMatchPill def={def} />
              {sameTierWorn ? <NeonPill label="Spare" /> : null}
              {feedback ? <FeedbackPill feedback={feedback} /> : null}
            </View>
            <ThemedText type="code" themeColor="textSecondary">
              {describeItem(def, stack.star)}
            </ThemedText>
          </View>
          <RowChevron expanded={expanded} />
        </Pressable>
        {canMerge && pct != null ? (
          <InlineMergeButton
            state={mergeState}
            locked={mergeLocked}
            pct={pct}
            name={def.core.name}
            onPress={() => onMerge({ id: stack.id, star: stack.star, main: 'bag' })}
          />
        ) : null}
      </View>
      {expanded ? (
        <ItemDetails
          def={def}
          star={stack.star}
          mergeNote={
            canMerge ? 'Merge spends one of these as fuel. A miss keeps the rest.' : null
          }>
          {sameTierWorn ? (
            <ThemedText type="small" themeColor="textSecondary">
              You&apos;re already wearing this tier — these are spares and merge fuel.
            </ThemedText>
          ) : (
            <NeonButton
              label="Equip"
              onPress={() => onEquip(stack.id, stack.star)}
              accessibilityLabel={`Equip ${def.core.name}${star ? ` ${star}` : ''}`}
              style={styles.detailAction}
            />
          )}
          {sellable ? (
            <NeonButton
              label={`Sell one · +${LOOK_SELL_TOKENS}`}
              onPress={() => onSell(stack.id, stack.star)}
              variant="secondary"
              accessibilityLabel={`Sell one ${def.core.name}`}
              style={styles.detailAction}
            />
          ) : null}
        </ItemDetails>
      ) : null}
    </MergeFeedbackRow>
  );
}

/** The row's own Merge button: two taps (arm, then roll), odds always on it. */
function InlineMergeButton({
  state,
  locked,
  pct,
  name,
  onPress,
}: {
  state: MergeButtonState;
  locked: boolean;
  pct: number;
  name: string;
  onPress: () => void;
}) {
  return (
    <NeonButton
      label={mergeButtonLabel(state, pct)}
      onPress={onPress}
      disabled={locked || state === 'rolling'}
      variant={state === 'armed' ? 'primary' : 'danger'}
      accessibilityLabel={mergeButtonA11y(state, name, pct)}
      style={styles.rowAction}
    />
  );
}

/** "✓ Merged ★3" / "✗ Missed · spare spent", pinned to the row that changed. */
function FeedbackPill({ feedback }: { feedback: MergeRowFeedback }) {
  return (
    <ThemedText
      type="code"
      accessibilityLiveRegion="polite"
      style={{ color: feedback.success ? MERGE_OK_COLOR : MERGE_MISS_COLOR }}>
      {mergeFeedbackLabel(feedback)}
    </ThemedText>
  );
}

function RowChevron({ expanded }: { expanded: boolean }) {
  return (
    <MaterialCommunityIcons
      name={expanded ? 'chevron-up' : 'chevron-down'}
      size={18}
      color={NEON.textMuted}
    />
  );
}

/** The expanded half of a row: what the item is, what it does now and at the
 * next star, what merging costs, then the row's actions. */
function ItemDetails({
  def,
  star,
  mergeNote,
  children,
}: {
  def: ItemDef;
  star: number;
  mergeNote: string | null;
  children: ReactNode;
}) {
  const now = formatItemStats(def, star);
  const next = mergeSuccessPct(star) != null ? formatItemStats(def, star + 1) : null;
  const legend = useContext(LegendElementContext);
  const match = legend && def.core.kind === 'power' ? gearMatchLine(def.core.type_tag, legend) : null;
  return (
    <View style={styles.details}>
      {match ? (
        <ThemedText type="smallBold" themeColor="emphasis">
          {match}
        </ThemedText>
      ) : null}
      <ThemedText type="code" themeColor="textSecondary">
        {SLOT_LABELS[def.core.slot]} slot
      </ThemedText>
      {def.core.kind === 'look' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Looks are for the eye — no bonuses.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small">
            <ThemedText type="smallBold">Now{starLabel(star) ? ` ${starLabel(star)}` : ''}: </ThemedText>
            {now ?? 'no bonuses'}
          </ThemedText>
          {next ? (
            <ThemedText type="small" themeColor="textSecondary">
              <ThemedText type="smallBold">At ★{star + 1}: </ThemedText>
              {next}
            </ThemedText>
          ) : null}
        </>
      )}
      {mergeNote ? (
        <ThemedText type="small" themeColor="textSecondary">
          {mergeNote}
        </ThemedText>
      ) : null}
      <View style={styles.detailActions}>{children}</View>
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
 * The Legends section (2026-09-28): one Legend per element. The ACTIVE Legend
 * sets the element of your Avatar's and every hero's attack; levelling it makes
 * that element stronger. Each card shows its element, what it boosts, its
 * current level effect and what the next level adds. Rows one or more levels
 * behind the highest owned Legend carry the ×2.5 EXP catch-up badge. Locked
 * Legends unlock free for now (no shop yet).
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
  const [open, setOpen] = useState(true);
  return (
    <NeonPanel>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.statRow}>
        <NeonLabel>{open ? 'Legends — hide' : 'Legends — show'}</NeonLabel>
        <ThemedText type="smallBold" themeColor="emphasis">
          {activeDef ? `${activeDef.name} · ${ELEMENT_LABEL[activeDef.element]}` : view.activeAvatarId}
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        {LEGEND_EXPLAINER}
      </ThemedText>
      {open
        ? allAvatarDefs().map((def) => {
            const record = owned.get(def.id);
            return (
              <View
                key={def.id}
                style={[styles.avatarRow, record?.active && { borderColor: def.color }]}>
                <NeonIconFrame
                  size={34}
                  style={record?.active ? { backgroundColor: def.color, borderColor: def.color } : undefined}>
                  <MaterialCommunityIcons
                    name={def.icon}
                    size={18}
                    color={record?.active ? '#FFFFFF' : def.color}
                  />
                </NeonIconFrame>
                <View style={styles.avatarText}>
                  <View style={styles.avatarTitleLine}>
                    <ThemedText type="smallBold" themeColor={record ? undefined : 'textSecondary'}>
                      {def.name}
                    </ThemedText>
                    <NeonPill label={ELEMENT_LABEL[def.element]} />
                    {record?.catchup ? <NeonPill label="×2.5 EXP" tone="emphasis" /> : null}
                  </View>
                  <ThemedText type="code" themeColor="textSecondary">
                    {legendBoostLine(def)}
                  </ThemedText>
                  {record ? (
                    <>
                      <ThemedText type="code">{legendLevelLine(record.level)}</ThemedText>
                      <ThemedText type="code" themeColor="textSecondary">
                        {`${legendNextLine(record.level)} · ★${record.stars}/${AVATAR_STAR_MAX} · ${record.worn}/4 worn`}
                      </ThemedText>
                    </>
                  ) : null}
                </View>
                {!record ? (
                  <NeonButton
                    label="Unlock"
                    onPress={() => onUnlockAvatar(def.id)}
                    variant="secondary"
                    accessibilityLabel={`Unlock ${def.name}`}
                    style={styles.rowAction}
                  />
                ) : record.active ? (
                  <NeonPill label="Active" tone="emphasis" />
                ) : (
                  <NeonButton
                    label="Use"
                    onPress={() => onActivateAvatar(def.id)}
                    variant="secondary"
                    accessibilityLabel={`Use ${def.name}, ${ELEMENT_LABEL[def.element]}`}
                    style={styles.rowAction}
                  />
                )}
              </View>
            );
          })
        : null}
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
  /** One item row (Worn slot or bag stack): the tappable top line plus, when
   * expanded, its details. The merge glow paints behind the whole row. */
  itemRow: {
    borderBottomWidth: 1,
    borderBottomColor: NEON_ROW_LINE,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  itemRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  itemText: {
    flex: 1,
    gap: Spacing.half,
  },
  itemTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  itemIconArt: {
    width: 22,
    height: 22,
  },
  /** Expanded details sit under the text, indented past the 34px icon. */
  details: {
    gap: Spacing.one,
    paddingLeft: 34 + Spacing.two,
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  detailAction: {
    minHeight: 32,
    paddingHorizontal: Spacing.three,
  },
  bonusCategory: {
    gap: Spacing.one,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  pressed: {
    opacity: 0.8,
  },
});
