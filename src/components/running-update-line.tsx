import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  formatPublishedAt,
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
      createdAt: Updates.createdAt,
    };
  } catch {
    return {
      enabled: false,
      isEmbedded: false,
      updateId: null,
      groupId: null,
      channel: null,
      runtimeVersion: null,
      createdAt: null,
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
  const secret = useRef({ n: 0, at: 0 });
  // Only a real running update has a real publish date — never shown for
  // embedded/local, same "honest, not faked" rule as the line itself. Its own
  // line rather than appended to `label.line`: that line is already close to
  // the row's width on a real device, and a right-aligned single line has no
  // wrap guard.
  const published =
    label.kind === 'group' || label.kind === 'update' ? formatPublishedAt(snap.createdAt) : null;

  return (
    <ThemedView
      type="backgroundElement"
      style={compact ? styles.compact : styles.card}
      testID="running-update">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Build ${label.line}${published ? `. Published ${published}` : ''}. Tap to copy.`}
        onPress={() => {
          void Clipboard.setStringAsync(copyValue);
          const now = Date.now();
          if (now - secret.current.at > 2500) secret.current.n = 0;
          secret.current.at = now;
          secret.current.n += 1;
          if (secret.current.n >= 5) {
            secret.current.n = 0;
            router.push('/ai-lab');
          }
        }}
        style={styles.column}>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Build
          </ThemedText>
          <ThemedText type="small" style={styles.value} testID="running-update-line">
            {label.line}
          </ThemedText>
        </View>
        {published ? (
          <ThemedText
            type="code"
            themeColor="textSecondary"
            style={styles.published}
            testID="running-update-published">
            Published {published}
          </ThemedText>
        ) : null}
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
  column: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
  published: {
    textAlign: 'right',
    marginTop: Spacing.half,
  },
});
