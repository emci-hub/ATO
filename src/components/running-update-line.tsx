import { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { canSeeDevLab } from '@/lib/dev-access';
import { useDevAccessUnlocked } from '@/lib/dev-access-unlock';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { useMeContext } from '@/lib/me-context';
import {
  buildKindLabel,
  formatPublishedAt,
  formatRunningUpdate,
  groupIdFromManifest,
  type RunningUpdateSnapshot,
} from '@/lib/running-update';

/**
 * App version + platform build identifier, straight from the bundled config
 * -- no `expo-application` (not installed; adding it means a native rebuild,
 * which this component must never require). `expoConfig` is exactly what
 * `AppVersionDevUnlock` already reads for the version string, so this reuses
 * the same source rather than inventing a second one.
 *
 * The build number is honest, not guessed: this repo's `eas.json` sets
 * `appVersionSource: "remote"` with `autoIncrement` on production, so EAS
 * manages the number on its own servers and only writes it into the native
 * project at build time -- it does not always land back in `expoConfig` here.
 * Shown when present, "—" when not, never fabricated.
 */
function readAppBuild(): { version: string; build: string } {
  const config = Constants.expoConfig;
  const version = config?.version ?? '—';
  const build =
    Platform.OS === 'ios'
      ? (config?.ios?.buildNumber ?? '—')
      : (config?.android?.versionCode != null ? String(config.android.versionCode) : '—');
  return { version, build };
}

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
 * Glanceable "what is this phone running" -- restored on You 2026-09-15
 * (emci: build/update info kept live alongside sign out, delete account and
 * AI consent). App version + build, the short OTA id, when it was published
 * (local time), channel/runtime, and a plain "Original build" vs "OTA update"
 * label so it never has to be inferred from the id shape. Group id when the
 * manifest has it, otherwise the short running-update UUID. Local/dev says so
 * instead of faking an id.
 */
export function RunningUpdateLine({ compact = false }: { compact?: boolean }) {
  const snap = useMemo(() => readRunningUpdate(), []);
  const label = formatRunningUpdate(snap);
  const kindLabel = buildKindLabel(label.kind);
  const { version, build } = useMemo(() => readAppBuild(), []);
  const copyValue = snap.groupId ?? snap.updateId ?? label.line;
  const secret = useRef({ n: 0, at: 0 });
  // This row renders on You for EVERY account, so the 5-tap shortcut below
  // has to carry the same gate `/ai-lab` itself does — otherwise any user
  // could open the provider switcher. Copy-to-clipboard stays open to all;
  // only the hidden navigation is gated.
  const { devAccess } = useMeContext();
  const devUnlocked = useDevAccessUnlocked();
  const canOpenAiLab = canSeeDevLab({
    isDev: PRE_LAUNCH_DEV || devUnlocked,
    isRoot: devAccess.isRoot,
    capabilities: devAccess.capabilities,
  });
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
        accessibilityLabel={`${kindLabel}. Version ${version} (${build}). Build ${label.line}${published ? `. Published ${published}` : ''}. Tap to copy.`}
        onPress={() => {
          void Clipboard.setStringAsync(copyValue);
          const now = Date.now();
          if (now - secret.current.at > 2500) secret.current.n = 0;
          secret.current.at = now;
          secret.current.n += 1;
          if (secret.current.n >= 5) {
            secret.current.n = 0;
            if (canOpenAiLab) router.push('/ai-lab');
          }
        }}
        style={styles.column}>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Version
          </ThemedText>
          <ThemedText type="small" style={styles.value} testID="running-update-version">
            {version}
            {build === '—' ? ' (build n/a)' : ` (${build})`}
          </ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Build
          </ThemedText>
          <ThemedText type="small" style={styles.value} testID="running-update-line">
            {label.line}
          </ThemedText>
        </View>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            Source
          </ThemedText>
          <ThemedText type="smallBold" style={styles.value} testID="running-update-kind">
            {kindLabel}
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
