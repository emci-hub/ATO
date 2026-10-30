import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useIncludeQuests } from '@/lib/quests/include-store';
import type { TraitTrack } from '@/lib/trait-stability';

export const QUEST_TOGGLE_LABEL = 'Include Quests';
export const QUEST_TOGGLE_NOTE =
  'Adds a second, open dot where your Quests moved a trait. This phone only. It switches off when you sign out.';
export const QUEST_TOGGLE_EMPTY = 'No Quest results yet. Apply a Quest result and the open dot shows up here.';

/** "Include Quests" row under the trait bands. Off by default; device only. */
export function QuestBlendToggle({
  userId,
  tracks,
  questsOn,
}: {
  userId: string;
  tracks: readonly TraitTrack[];
  questsOn: boolean;
}) {
  const [on, setOn] = useIncludeQuests(userId);
  const hasQuestResults = tracks.some((row) => row.track === 'quest');
  // Quests switched off remotely: show the row only while the switch is still on, so it can be turned off.
  if (!questsOn && !on) return null;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={QUEST_TOGGLE_LABEL}
        accessibilityHint={QUEST_TOGGLE_NOTE}
        accessibilityState={{ checked: on }}
        onPress={() => setOn(!on)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <ThemedText type="small">{QUEST_TOGGLE_LABEL}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {on ? 'On' : 'Off'}
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        {QUEST_TOGGLE_NOTE}
      </ThemedText>
      {on && !hasQuestResults ? (
        <ThemedText type="small" themeColor="textSecondary">
          {QUEST_TOGGLE_EMPTY}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
