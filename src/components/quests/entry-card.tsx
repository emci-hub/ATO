import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { QUEST_CAMPAIGNS } from '@/lib/quests/content';
import { questsVisible, useQuestFlags } from '@/lib/quests/flags';
import { runStore, endingsFound } from '@/lib/quests/run-store';
import { UI_COPY, fmt } from '@/lib/quests/strings';
import { controlBorderColor } from '@/lib/theme/chrome';

/** Same list the Quests screen shows: samples are development only. */
const SHOWN = QUEST_CAMPAIGNS.filter((c) => __DEV__ || !c.isSample);

/** Opens the Quests list. Pushed first so a closing sheet cannot unmount it. */
export const openQuests = () => router.push('/quest' as Href);

/** "N of M endings found" across the campaigns that are on, or null before the progress is read. */
function useEndingsLine(enabled: boolean, flags: ReturnType<typeof useQuestFlags>['flags']): string | null {
  const [line, setLine] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !flags) return;
      let alive = true;
      runStore
        .loadProgress()
        .then((p) => {
          if (!alive) return;
          const on = SHOWN.filter((c) => questsVisible(flags, c.id));
          const sum = on.reduce(
            (acc, c) => {
              const { found, total } = endingsFound(p, c);
              return { found: acc.found + found, total: acc.total + total };
            },
            { found: 0, total: 0 },
          );
          setLine(sum.found > 0 ? fmt(UI_COPY.entryMeta, sum) : UI_COPY.entryMetaNone);
        })
        .catch(() => alive && setLine(UI_COPY.entryMetaNone));
      return () => {
        alive = false;
      };
    }, [enabled, flags]),
  );
  return line;
}

/** Insights card (PHASE-23). Renders nothing while Quests is off, loading, or has no campaign on. */
export function QuestsEntryCard() {
  const theme = useTheme();
  const { flags } = useQuestFlags();
  const on = !!flags && SHOWN.some((c) => questsVisible(flags, c.id));
  const line = useEndingsLine(on, flags);
  if (!on) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={line ? `${UI_COPY.entryTitle}. ${line}` : UI_COPY.entryTitle}
      onPress={openQuests}
      testID="quests-entry-card"
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={[styles.card, { borderColor: controlBorderColor(theme) }]}>
        <MaterialCommunityIcons name="book-open-page-variant-outline" size={22} color={theme.accent} />
        <View style={styles.text}>
          <ThemedText type="smallBold">{UI_COPY.entryTitle}</ThemedText>
          {line ? (
            <ThemedText type="small" themeColor="textSecondary">
              {line}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText themeColor="textSecondary">›</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/** More sheet row (PHASE-23). Same gate as the card; mounts only while the sheet is open, so the flag is read fresh. */
export function QuestsMoreRow({ onClose, rowStyle, pressedStyle, labelStyle }: {
  onClose: () => void;
  rowStyle: object;
  pressedStyle: object;
  labelStyle: object;
}) {
  const theme = useTheme();
  const { flags } = useQuestFlags();
  if (!flags || !SHOWN.some((c) => questsVisible(flags, c.id))) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={UI_COPY.entryOpen}
      onPress={() => {
        openQuests();
        onClose();
      }}
      style={({ pressed }) => [rowStyle, { borderColor: controlBorderColor(theme) }, pressed && pressedStyle]}>
      <MaterialCommunityIcons name="book-open-page-variant-outline" size={22} color={theme.text} />
      <ThemedText type="small" style={labelStyle}>
        {UI_COPY.moreRow}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  text: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.7 },
});
