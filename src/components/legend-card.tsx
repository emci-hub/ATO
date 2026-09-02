import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { ArchetypeDef, LegendDef } from '@/lib/legends/store';

/**
 * One legend as a collapsible card. The teaser (punchy hook, no archetype
 * naming) is always visible; tapping reveals the full story, whose final
 * block carries the "[Archetype] Energy:" parallel. Same card/fold visual
 * language as SettingsFold / CategoriesFold.
 */
export function LegendCard({
  legend,
  archetype,
}: {
  legend: LegendDef;
  archetype: ArchetypeDef;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

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
  pressed: {
    opacity: 0.8,
  },
});
