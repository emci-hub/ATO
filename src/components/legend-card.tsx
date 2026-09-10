import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import { ATO_TOKEN_PRICE, atoPriceLine, atoTokenBalanceOf, ATO_TOKEN_NEED_MORE } from '@/lib/ato-tokens';
import { archetypeName, LEGEND_SKINS, type LegendSkin } from '@/lib/legends64/archetypes';

export interface LegendRerollOutcome {
  ok: boolean;
  /** Shown on failure — the caller picks the right copy (quota / already used / need more). */
  note?: string;
}

/**
 * One Legend as a card: a name (per skin) and one generated story, shown the
 * same under every skin — switching skins swaps only the displayed name,
 * never the story text and never a regeneration (core loop redesign §4).
 */
export function LegendCard({
  code,
  story,
  skin,
  onSkinChange,
  me,
  onReroll,
}: {
  code: string;
  story: string;
  skin: LegendSkin;
  onSkinChange: (skin: LegendSkin) => void;
  /** Balance for the reroll button. Omitted → no reroll button (e.g. read-only previews). */
  me?: { ato_tokens?: number | null };
  /** Omitted alongside `me` → no reroll button. */
  onReroll?: () => Promise<LegendRerollOutcome>;
}) {
  const theme = useTheme();
  const [rerollBusy, setRerollBusy] = useState(false);
  const [rerollNote, setRerollNote] = useState<string | null>(null);

  const name = archetypeName(code, skin) ?? code;
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
      <View style={styles.skinRow}>
        {LEGEND_SKINS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: option === skin }}
            onPress={() => onSkinChange(option)}
            style={({ pressed }) => [
              styles.skinChip,
              { borderColor: controlBorderColor(theme) },
              option === skin && { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="code" themeColor={option === skin ? undefined : 'textSecondary'}>
              {option}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      <ThemedText type="smallBold">{name}</ThemedText>
      <ThemedText type="small" style={styles.story}>
        {story}
      </ThemedText>
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
    padding: Spacing.three,
    gap: Spacing.two,
  },
  skinRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  skinChip: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  story: {
    lineHeight: 22,
  },
  rerollRow: {
    gap: Spacing.one,
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
