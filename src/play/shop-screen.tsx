/**
 * Shop — token shelf + paid (IAP) shelf (GAME_SPEC §9i shops, §18 F).
 *
 * Three tabs over the JSON catalogs in `data/shops/`:
 * - **Token** — spends soft `tokens` through the shared store
 *   (`purchaseShopRow`); a real effect now (one Dive charge, a merge-fuel
 *   Power crate, a Shine Stone — one a week) or a "Coming soon" stub. Daily
 *   and weekly caps are enforced store-side.
 * - **Tide shelf** — pass-only token rows. Visible without a pass ("Tide Pass
 *   only"); buyable with soft tokens while a Tide Pass is on.
 * - **Paid** — STUBS ONLY. Rows show a display price and a "Soon" pill;
 *   nothing here charges Apple. The Tide Pass card is not for sale.
 *
 * Pre-launch (`PLAY_EVERYTHING_FREE`): the Hub shows Shop for everyone.
 * A release build still hides it (`shopUnlocked`).
 *
 * The token shelf never sells wave_power or a cycle_power skip (§9i): both
 * would break the Conquered climb, so no such row exists in the catalog.
 *
 * Chrome (Slice 3): Neon Viper only — cyan-glow `NeonPanel` cards, mono cyan
 * headings/chips, near-square icon frames + buttons. Logic is unchanged.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { cursorIcon } from '@/play/art';
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
import { STAR_PEARL_PITY } from '@/play/pet-eggs';
import { GuideView } from '@/play/guide-sheet';
import { DIVE_CHARGE_CAP, type PlayView, type ShopPurchaseResult } from '@/play/playStore';
import {
  paidShopRows,
  tideShopRows,
  tokenShopRows,
  type ShopPaidRow,
  type ShopTokenRow,
} from '@/play/shop';

type ShopTab = 'token' | 'tide' | 'paid';

type ShopIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** One icon per token-row effect kind (display only). */
const TOKEN_ICONS: Record<ShopTokenRow['kind'], ShopIcon> = {
  dive_charge: 'waves',
  merge_crate: 'package-variant-closed',
  shine_stone: 'diamond-stone',
  prism_stone: 'diamond',
  star_pearl: 'star-four-points',
  stub: 'palette-swatch',
};

/** One icon per paid-row kind (display only). */
const PAID_ICONS: Record<ShopPaidRow['kind'], ShopIcon> = {
  paid_unique: 'star-four-points',
  hero: 'account-star',
  prism_stone: 'diamond',
  pass: 'waves',
  stub: 'storefront-outline',
};

/** Kenney Cursor Pack file per row kind (§19 item/shop icons); null = the
 * glyph (no pack art fits a Stone). */
const TOKEN_ICON_FILES: Record<ShopTokenRow['kind'], string | null> = {
  dive_charge: 'target_round_a',
  merge_crate: 'tool_hammer',
  shine_stone: null,
  prism_stone: null,
  star_pearl: null,
  stub: 'tool_wand',
};
const PAID_ICON_FILES: Record<ShopPaidRow['kind'], string | null> = {
  paid_unique: 'tool_sword_a',
  hero: 'gauntlet_default',
  prism_stone: null,
  pass: null,
  stub: 'tool_torch',
};

/** Shop row icon: Kenney Cursor Pack art, falling back to a glyph. */
function ShopRowIcon({
  file,
  fallback,
  color,
}: {
  file: string | null;
  fallback: ShopIcon;
  color: string;
}) {
  const source = file ? cursorIcon(file) : undefined;
  return (
    <NeonIconFrame size={34}>
      {source ? (
        <Image source={source} contentFit="contain" style={styles.rowIconArt} />
      ) : (
        <MaterialCommunityIcons name={fallback} size={18} color={color} />
      )}
    </NeonIconFrame>
  );
}

/** Resolved display state of one token row (drives the button + disabled). */
type TokenRowState = {
  priced: boolean;
  boughtToday: number;
  dailyLeft: number | null;
  dailyCapped: boolean;
  weeklyCapped: boolean;
  passLocked: boolean;
  passCapped: boolean;
  diveFull: boolean;
  affordable: boolean;
  note: string | null;
  actionLabel: string;
  disabled: boolean;
};

function tokenRowState(view: PlayView, row: ShopTokenRow, busy: boolean): TokenRowState {
  const priced = row.kind !== 'stub' && row.price != null;
  const boughtToday = view.shopCounts[row.id] ?? 0;
  const dailyLeft =
    row.daily_limit == null ? null : Math.max(0, row.daily_limit - boughtToday);
  const dailyCapped = dailyLeft != null && dailyLeft <= 0;
  const boughtWeek = view.shopWeekCounts[row.id] ?? 0;
  const weeklyCapped = row.weekly_limit != null && boughtWeek >= row.weekly_limit;
  const boughtPass = view.shopPassCounts[row.id] ?? 0;
  const passLocked = row.pass_only && !view.pet.tide.active;
  const passCapped = row.per_pass_limit != null && boughtPass >= row.per_pass_limit;
  const diveFull = row.kind === 'dive_charge' && view.dive.full;
  const affordable = priced && view.tokens >= (row.price ?? 0);

  let actionLabel: string;
  if (!priced) actionLabel = 'Coming soon';
  else if (passLocked) actionLabel = 'Tide Pass only';
  else if (diveFull) actionLabel = 'Charges full';
  else if (dailyCapped) actionLabel = 'Daily limit reached';
  else if (weeklyCapped) actionLabel = 'Weekly limit reached';
  else if (passCapped) actionLabel = 'Pass limit reached';
  else if (!affordable) actionLabel = `Need ${row.price} tokens`;
  else actionLabel = `Buy · ${row.price} tokens`;

  let note: string | null = null;
  if (row.kind === 'dive_charge') {
    note = `${view.dive.current}/${DIVE_CHARGE_CAP} charges now`;
  } else if (row.daily_limit != null) {
    note = `${boughtToday}/${row.daily_limit} bought today`;
  } else if (row.weekly_limit != null) {
    note = `${boughtWeek}/${row.weekly_limit} bought this week · ${view.pet.stones.held} held`;
  } else if (row.per_pass_limit != null) {
    note = `${boughtPass}/${row.per_pass_limit} this pass`;
    if (row.kind === 'star_pearl') note = `${note} · +${STAR_PEARL_PITY} Legendary progress`;
  }

  return {
    priced,
    boughtToday,
    dailyLeft,
    dailyCapped,
    weeklyCapped,
    passLocked,
    passCapped,
    diveFull,
    affordable,
    note,
    actionLabel,
    disabled: busy || !priced || passLocked || diveFull || dailyCapped || weeklyCapped || passCapped || !affordable,
  };
}

export function ShopScreen({
  view,
  onBuyToken,
  onBackToDivecore,
}: {
  view: PlayView;
  onBuyToken: (row: ShopTokenRow) => Promise<ShopPurchaseResult | null>;
  onBackToDivecore: () => void;
}) {
  const [tab, setTab] = useState<ShopTab>('token');
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);

  const handleBuy = async (row: ShopTokenRow) => {
    if (busyRow) return;
    setBusyRow(row.id);
    try {
      await onBuyToken(row);
    } finally {
      setBusyRow(null);
    }
  };

  if (guide) {
    return (
      <>
        <NeonBackLink onPress={() => setGuide(false)} />
        <GuideView initial="shop" />
      </>
    );
  }

  return (
    <>
      <NeonBackLink onPress={onBackToDivecore} />

      <NeonHeader
        title="Shop"
        lede="Spend soft tokens on a small boost — or window-shop what is coming."
      />

      <NeonPanel>
        <View style={styles.statRow}>
          <NeonLabel>Tokens</NeonLabel>
          <ThemedText type="subheading" themeColor="emphasis">
            {view.tokens}
          </ThemedText>
        </View>
        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}>
            {(
              [
                { key: 'token' as const, label: 'Token shop' },
                { key: 'tide' as const, label: 'Tide shelf' },
                { key: 'paid' as const, label: 'Paid shop' },
              ]
            ).map((entry) => (
              <NeonChip
                key={entry.key}
                label={entry.label}
                selected={tab === entry.key}
                onPress={() => setTab(entry.key)}
              />
            ))}
          </ScrollView>
        </View>
      </NeonPanel>

      {tab === 'tide' ? (
        <NeonPanel>
          <NeonLabel>Tide shelf</NeonLabel>
          <ThemedText type="small" themeColor="textSecondary">
            {view.pet.tide.active
              ? `Tide Pass on · ${view.pet.tide.daysHeld} days left. Bought with soft tokens. Limits reset each pass.`
              : 'Tide Pass only. You can see what a pass adds — these rows stay locked until one is on.'}
          </ThemedText>
          <NeonChip label="? Tide Pass & Shop" onPress={() => setGuide(true)} accessibilityLabel="Open the Guide: Tide Pass and Shop" />
          {tideShopRows().map((row) => {
            const state = tokenRowState(view, row, busyRow === row.id);
            return (
              <View key={row.id} style={styles.row}>
                <ShopRowIcon file={TOKEN_ICON_FILES[row.kind]} fallback={TOKEN_ICONS[row.kind]} color={NEON.cyan} />
                <View style={styles.rowText}>
                  <ThemedText type="smallBold">{row.name}</ThemedText>
                  {row.blurb ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {row.blurb}
                    </ThemedText>
                  ) : null}
                  {state.note ? (
                    <ThemedText type="code" themeColor="textSecondary">
                      {state.note}
                    </ThemedText>
                  ) : null}
                </View>
                <NeonButton
                  label={state.actionLabel}
                  onPress={() => void handleBuy(row)}
                  disabled={state.disabled}
                  accessibilityLabel={state.actionLabel}
                  style={styles.buyButton}
                />
              </View>
            );
          })}
        </NeonPanel>
      ) : tab === 'token' ? (
        <NeonPanel>
          <NeonLabel>Token shop</NeonLabel>
          <ThemedText type="small" themeColor="textSecondary">
            Bought with soft tokens. Never sells permanent power or a cycle skip — those would
            break the climb.
          </ThemedText>
          {tokenShopRows().map((row) => {
            const state = tokenRowState(view, row, busyRow === row.id);
            return (
              <View key={row.id} style={styles.row}>
                <ShopRowIcon
                  file={TOKEN_ICON_FILES[row.kind]}
                  fallback={TOKEN_ICONS[row.kind]}
                  color={NEON.cyan}
                />
                <View style={styles.rowText}>
                  <ThemedText type="smallBold">{row.name}</ThemedText>
                  {row.blurb ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {row.blurb}
                    </ThemedText>
                  ) : null}
                  {state.note ? (
                    <ThemedText type="code" themeColor="textSecondary">
                      {state.note}
                    </ThemedText>
                  ) : null}
                </View>
                <NeonButton
                  label={state.actionLabel}
                  onPress={() => void handleBuy(row)}
                  disabled={state.disabled}
                  accessibilityLabel={state.actionLabel}
                  style={styles.buyButton}
                />
              </View>
            );
          })}
        </NeonPanel>
      ) : (
        <NeonPanel>
          <NeonLabel>Paid shop</NeonLabel>
          <ThemedText type="small" themeColor="textSecondary">
            Previews only — Apple checkout lands later. Play stays optional: Claim and Defend
            never need it.
          </ThemedText>
          {paidShopRows().map((row) => (
            <View key={row.id} style={styles.row}>
              <ShopRowIcon
                file={PAID_ICON_FILES[row.kind]}
                fallback={PAID_ICONS[row.kind]}
                color={NEON.textMuted}
              />
              <View style={styles.rowText}>
                <View style={styles.titleLine}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {row.name}
                  </ThemedText>
                  {row.badge ? <NeonPill label={row.badge} tone="emphasis" /> : null}
                </View>
                {row.blurb ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {row.blurb}
                  </ThemedText>
                ) : null}
                {row.kind === 'pass' ? (
                  <NeonChip label="? Tide Pass & Shop" onPress={() => setGuide(true)} accessibilityLabel="Open the Guide: Tide Pass and Shop" />
                ) : null}
                <ThemedText type="code" themeColor="textSecondary">
                  {row.price_label} · not for sale yet
                </ThemedText>
              </View>
              <NeonButton
                label="Soon"
                onPress={() => {}}
                disabled
                variant="secondary"
                style={styles.buyButton}
              />
            </View>
          ))}
        </NeonPanel>
      )}
    </>
  );
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: NEON_ROW_LINE,
    paddingVertical: Spacing.two,
  },
  rowIconArt: {
    width: 20,
    height: 20,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  buyButton: {
    minWidth: 96,
  },
});
