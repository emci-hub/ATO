/**
 * Shop — token shelf + paid (IAP) shelf (GAME_SPEC §9i shops, §18 F).
 *
 * Two tabs over the JSON catalogs in `data/shops/`:
 * - **Token** — spends soft `tokens` through the shared store
 *   (`purchaseShopRow`); a real effect now (one Dive charge, a merge-fuel
 *   Power crate, a Shine Stone — one a week) or a "Coming soon" stub. Daily
 *   and weekly caps are enforced store-side.
 * - **Paid** — STUBS ONLY in v0. Rows show a display price and a "Soon" pill;
 *   nothing here charges Apple. `available: false` in `paid.json`. The Prism
 *   Stone preview shows its style odds (`PRISM_STYLE_ODDS`).
 *
 * v27: the Shop is hidden — only the dev unlock reaches it (`shopUnlocked`).
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
import { PRISM_STYLES, PRISM_STYLE_ODDS, SHINY_STYLE_LABEL } from '@/play/pet-eggs';
import { DIVE_CHARGE_CAP, type PlayView, type ShopPurchaseResult } from '@/play/playStore';
import {
  paidShopRows,
  tokenShopRows,
  type ShopPaidRow,
  type ShopTokenRow,
} from '@/play/shop';

type ShopTab = 'token' | 'paid';

type ShopIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** One icon per token-row effect kind (display only). */
const TOKEN_ICONS: Record<ShopTokenRow['kind'], ShopIcon> = {
  dive_charge: 'waves',
  merge_crate: 'package-variant-closed',
  shine_stone: 'diamond-stone',
  stub: 'palette-swatch',
};

/** One icon per paid-row kind (display only). */
const PAID_ICONS: Record<ShopPaidRow['kind'], ShopIcon> = {
  paid_unique: 'star-four-points',
  hero: 'account-star',
  prism_stone: 'diamond',
  stub: 'storefront-outline',
};

/** Kenney Cursor Pack file per row kind (§19 item/shop icons); null = the
 * glyph (no pack art fits a Stone). */
const TOKEN_ICON_FILES: Record<ShopTokenRow['kind'], string | null> = {
  dive_charge: 'target_round_a',
  merge_crate: 'tool_hammer',
  shine_stone: null,
  stub: 'tool_wand',
};
const PAID_ICON_FILES: Record<ShopPaidRow['kind'], string | null> = {
  paid_unique: 'tool_sword_a',
  hero: 'gauntlet_default',
  prism_stone: null,
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
  const diveFull = row.kind === 'dive_charge' && view.dive.full;
  const affordable = priced && view.tokens >= (row.price ?? 0);

  let actionLabel: string;
  if (!priced) actionLabel = 'Coming soon';
  else if (diveFull) actionLabel = 'Charges full';
  else if (dailyCapped) actionLabel = 'Daily limit reached';
  else if (weeklyCapped) actionLabel = 'Weekly limit reached';
  else if (!affordable) actionLabel = `Need ${row.price} tokens`;
  else actionLabel = `Buy · ${row.price} tokens`;

  let note: string | null = null;
  if (row.kind === 'dive_charge') {
    note = `${view.dive.current}/${DIVE_CHARGE_CAP} charges now`;
  } else if (row.daily_limit != null) {
    note = `${boughtToday}/${row.daily_limit} bought today`;
  } else if (row.weekly_limit != null) {
    note = `${boughtWeek}/${row.weekly_limit} bought this week · ${view.pet.stones.held} held`;
  }

  return {
    priced,
    boughtToday,
    dailyLeft,
    dailyCapped,
    weeklyCapped,
    diveFull,
    affordable,
    note,
    actionLabel,
    disabled: busy || !priced || diveFull || dailyCapped || weeklyCapped || !affordable,
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

  const handleBuy = async (row: ShopTokenRow) => {
    if (busyRow) return;
    setBusyRow(row.id);
    try {
      await onBuyToken(row);
    } finally {
      setBusyRow(null);
    }
  };

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

      {tab === 'token' ? (
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
                {row.kind === 'prism_stone' ? (
                  <ThemedText type="code" themeColor="textSecondary">
                    {PRISM_STYLES.map((s) => `${SHINY_STYLE_LABEL[s]} ${PRISM_STYLE_ODDS[s]}%`).join(' · ')}
                  </ThemedText>
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
