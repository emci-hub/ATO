/**
 * "Dump save v" row for the Play Dev kit.
 *
 * Dev-only debugging aid: reads the raw persisted store doc straight off
 * AsyncStorage (`PLAY_STORE_KEY`) and shows its version number + full JSON,
 * so a dev can confirm the store version / migration landed exactly as the
 * persisted bytes say. Reads storage directly (not the in-memory view) so the
 * dump is honest about what a cold start would load. Rendered only inside the
 * unlocked Dev kit, so it can never appear in a production build.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PLAY_STORE_KEY } from '@/play/playStore';

type DumpState = { version: number | null; raw: string } | { error: string };

export function SaveDumpRow() {
  const [open, setOpen] = useState(false);
  const [dump, setDump] = useState<DumpState | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    try {
      const raw = await AsyncStorage.getItem(PLAY_STORE_KEY);
      if (!raw) {
        setDump({ version: null, raw: '— nothing persisted yet —' });
        return;
      }
      const parsed = JSON.parse(raw) as { version?: unknown };
      const version =
        typeof parsed?.version === 'number' && Number.isFinite(parsed.version)
          ? parsed.version
          : null;
      setDump({ version, raw });
    } catch {
      setDump({ error: 'Could not read the saved doc.' });
    }
  }

  const versionText =
    dump && 'version' in dump && dump.version != null ? `v${dump.version}` : '—';

  return (
    <View>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="emphasis">
          Dump save v
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {open ? versionText : '›'}
        </ThemedText>
      </Pressable>
      {open && dump ? (
        <ThemedView type="backgroundElement" style={styles.dumpCard}>
          {'error' in dump ? (
            <ThemedText type="small" themeColor="textSecondary">
              {dump.error}
            </ThemedText>
          ) : (
            <>
              <ThemedText type="code" themeColor="emphasis" style={styles.version}>
                Store version {versionText}
              </ThemedText>
              <ThemedText type="code" themeColor="textSecondary" style={styles.body}>
                {dump.raw}
              </ThemedText>
            </>
          )}
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  dumpCard: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  version: {
    alignSelf: 'flex-start',
  },
  body: {
    fontSize: 10,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.8,
  },
});
