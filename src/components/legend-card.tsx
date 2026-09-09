import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import { ATO_TOKEN_PRICE, atoPriceLine, atoTokenBalanceOf, ATO_TOKEN_NEED_MORE } from '@/lib/ato-tokens';

import type { ArchetypeDef, LegendVariant } from '@/lib/legends/store';

export interface LegendRerollOutcome {
  ok: boolean;
  /** Shown on failure — the caller picks the right copy (no match / already used / need more). */
  note?: string;
}

/**
 * One legend as a collapsible card. The teaser (punchy hook, no archetype
 * naming) is always visible; tapping reveals the full story, whose final
 * block carries the "[Archetype] Energy:" parallel. Same card/fold visual
 * language as SettingsFold / CategoriesFold.
 */
export function LegendCard({
  legend,
  archetype,
  me,
  onReroll,
}: {
  legend: LegendVariant;
  archetype: ArchetypeDef;
  /** Balance for the reroll button. Omitted → no reroll button (e.g. read-only previews). */
  me?: { ato_tokens?: number | null };
  /**
   * Finds the replacement (catalog lookup, no charge if none exists), spends,
   * and persists — the parent owns the catalog, so this card never computes
   * the swap itself. Omitted alongside `me` → no reroll button.
   */
  onReroll?: () => Promise<LegendRerollOutcome>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [rerollBusy, setRerollBusy] = useState(false);
  const [rerollNote, setRerollNote] = useState<string | null>(null);

  const balance = me ? atoTokenBalanceOf(me) : 0;
  const canReroll = me != null && onReroll != null && balance >= ATO_TOKEN_PRICE.legend_reroll;

  async function reroll() {
    if (!onReroll || rerollBusy || !canReroll) return;
    setRerollBusy(true);
    setRerollNote(null);
    try {
      const outcome = await onReroll();
      if (!outcome.ok) {
        setRerollNote(outcome.note ?? ATO_TOKEN_NEED_MORE);
      }
    } catch (err) {
      console.log('[legend-card] reroll error:', err);
      setRerollNote("Couldn't reroll right now. Try again.");
    } finally {
      setRerollBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${legend.name}, ${archetype.formalName} Energy`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.headerText}>
          <ThemedText type="code" themeColor="textSecondary">
            {archetype.formalName} · {legend.eraTitle}
          </ThemedText>
          <ThemedText type="smallBold">{legend.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {legend.teaser}
          </ThemedText>
        </View>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <ThemedText type="small" style={styles.story}>
            {legend.fullStory}
          </ThemedText>
        </View>
      ) : null}
      {me ? (
        <View style={styles.rerollRow}>
          <Pressable
            accessibilityRole="button"
            disabled={rerollBusy || !canReroll}
            onPress={() => void reroll()}
            style={({ pressed }) => [
              styles.rerollBtn,
              { borderColor: controlBorderColor(theme) },
              (pressed || rerollBusy || !canReroll) && styles.disabled,
            ]}>
            <ThemedText type="small" themeColor="textSecondary">
              {rerollBusy
                ? 'Rerolling…'
                : canReroll
                  ? `Reroll · ${atoPriceLine('legend_reroll')}`
                  : ATO_TOKEN_NEED_MORE}
            </ThemedText>
          </Pressable>
          {rerollNote ? (
            <ThemedText type="small" themeColor="textSecondary">
              {rerollNote}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  story: {
    lineHeight: 22,
  },
  rerollRow: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  rerollBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
