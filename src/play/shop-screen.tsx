/**
 * Shop — token shelf + paid (IAP) shelf (GAME_SPEC §9i shops, §18 F).
 *
 * Two tabs over the JSON catalogs in `data/shops/`:
 * - **Token** — spends soft `tokens` through the shared store
 *   (`purchaseShopRow`); a real effect now (one Dive charge, a merge-fuel
 *   Power crate) or a "Coming soon" stub. Daily caps are enforced store-side.
 * - **Paid** — STUBS ONLY in v0. Rows show a display price and a "Soon" pill;
 *   nothing here charges Apple. `available: false` in `paid.json`.
 *
 * The token shelf never sells wave_power or a cycle_power skip (§9i): both
 * would break the Conquered climb, so no such row exists in the catalog.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  stub: 'palette-swatch',
};

/** One icon per paid-row kind (display only). */
const PAID_ICONS: Record<ShopPaidRow['kind'], ShopIcon> = {
  paid_unique: 'star-four-points',
  hero: 'account-star',
  stub: 'storefront-outline',
};

/** Resolved display state of one token row (drives the button + disabled). */
type TokenRowState = {
  priced: boolean;
  boughtToday: number;
  dailyLeft: number | null;
  dailyCapped: boolean;
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
  const diveFull = row.kind === 'dive_charge' && view.dive.full;
  const affordable = priced && view.tokens >= (row.price ?? 0);

  let actionLabel: string;
  if (!priced) actionLabel = 'Coming soon';
  else if (diveFull) actionLabel = 'Charges full';
  else if (dailyCapped) actionLabel = 'Daily limit reached';
  else if (!affordable) actionLabel = `Need ${row.price} tokens`;
  else actionLabel = `Buy · ${row.price} tokens`;

  let note: string | null = null;
  if (row.kind === 'dive_charge') {
    note = `${view.dive.current}/${DIVE_CHARGE_CAP} charges now`;
  } else if (row.daily_limit != null) {
    note = `${boughtToday}/${row.daily_limit} bought today`;
  }

  return {
    priced,
    boughtToday,
    dailyLeft,
    dailyCapped,
    diveFull,
    affordable,
    note,
    actionLabel,
    disabled: busy || !priced || diveFull || dailyCapped || !affordable,
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
  const theme = useTheme();
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
      <View style={styles.topRow}>
        <Pressable
          onPress={onBackToDivecore}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ‹ Divecore
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText type="subtitle">Shop</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        Spend soft tokens on a small boost — or window-shop what is coming.
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.statRow}>
          <ThemedText type="smallBold">Tokens</ThemedText>
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
            ).map((entry) => {
              const selected = tab === entry.key;
              return (
                <Pressable
                  key={entry.key}
                  onPress={() => setTab(entry.key)}
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
                    {entry.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </ThemedView>

      {tab === 'token' ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Token shop</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bought with soft tokens. Never sells permanent power or a cycle skip — those would
            break the climb.
          </ThemedText>
          {tokenShopRows().map((row) => {
            const state = tokenRowState(view, row, busyRow === row.id);
            return (
              <View key={row.id} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialCommunityIcons
                    name={TOKEN_ICONS[row.kind]}
                    size={18}
                    color={theme.accent}
                  />
                </View>
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
                <Pressable
                  onPress={() => void handleBuy(row)}
                  disabled={state.disabled}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: state.disabled }}
                  style={({ pressed }) => [
                    styles.buyButton,
                    {
                      backgroundColor: state.disabled
                        ? theme.backgroundSelected
                        : theme.accentFill,
                    },
                    pressed && !state.disabled && styles.pressed,
                    state.disabled && styles.disabled,
                  ]}>
                  <ThemedText
                    type="code"
                    style={{ color: state.disabled ? theme.textSecondary : theme.onAccent }}>
                    {state.actionLabel}
                  </ThemedText>
                </Pressable>
              </View>
            );
          })}
        </ThemedView>
      ) : (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Paid shop</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Previews only — Apple checkout lands later. Play stays optional: Claim and Defend
            never need it.
          </ThemedText>
          {paidShopRows().map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: theme.backgroundSelected }]}>
                <MaterialCommunityIcons
                  name={PAID_ICONS[row.kind]}
                  size={18}
                  color={theme.textSecondary}
                />
              </View>
              <View style={styles.rowText}>
                <View style={styles.titleLine}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {row.name}
                  </ThemedText>
                  {row.badge ? (
                    <View style={[styles.tag, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="code" themeColor="emphasis">
                        {row.badge}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                {row.blurb ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {row.blurb}
                  </ThemedText>
                ) : null}
                <ThemedText type="code" themeColor="textSecondary">
                  {row.price_label} · not for sale yet
                </ThemedText>
              </View>
              <View style={[styles.buyButton, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="code" themeColor="textSecondary">
                  Soon
                </ThemedText>
              </View>
            </View>
          ))}
        </ThemedView>
      )}
    </>
  );
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
    marginHorizontal: -Spacing.three,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  tag: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
  },
  buyButton: {
    minWidth: 96,
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  disabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
});
