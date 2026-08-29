import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Updates from 'expo-updates';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  formatRunningUpdate,
  groupIdFromManifest,
  type RunningUpdateSnapshot,
} from '@/lib/running-update';

function readRunningUpdate(): RunningUpdateSnapshot {
  try {
    return {
      enabled: Updates.isEnabled,
      isEmbedded: Updates.isEmbeddedLaunch,
      updateId: Updates.updateId,
      groupId: groupIdFromManifest(Updates.manifest),
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
    };
  } catch {
    return {
      enabled: false,
      isEmbedded: false,
      updateId: null,
      groupId: null,
      channel: null,
      runtimeVersion: null,
    };
  }
}

/**
 * Glanceable "what is this phone running." Group id when the manifest has it,
 * otherwise the short running-update UUID. Local/dev says so instead of faking an id.
 */
export function RunningUpdateLine({ compact = false }: { compact?: boolean }) {
  const snap = useMemo(() => readRunningUpdate(), []);
  const label = formatRunningUpdate(snap);
  const copyValue = snap.groupId ?? snap.updateId ?? label.line;

  return (
    <ThemedView
      type="backgroundElement"
      style={compact ? styles.compact : styles.card}
      testID="running-update">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Build ${label.line}. Tap to copy.`}
        onPress={() => {
          void Clipboard.setStringAsync(copyValue);
        }}
        style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Build
        </ThemedText>
        <ThemedText type="small" style={styles.value} testID="running-update-line">
          {label.line}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  compact: {
    padding: 0,
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
});
