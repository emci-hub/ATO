import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ProviderStatusDot } from '@/components/provider-status-dot';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AI_PROVIDER_IDS,
  PROVIDER_LIMITS,
  configuredProvider,
  resolveActiveProvider,
  setProviderOverride,
  type AiProviderId,
} from '@/lib/ai';
import { fetchProviderCounts, type ProviderCounts } from '@/lib/ai/usage';
import { controlBorderColor, NO_PINCH_ZOOM } from '@/lib/theme/chrome';

/**
 * Hidden provider switcher. Opened by tapping the Build line five times.
 * Override is AsyncStorage on this device only — never synced.
 */
export default function AiLabScreen() {
  const theme = useTheme();
  const bundled = configuredProvider();
  const [active, setActive] = useState<AiProviderId>(bundled);
  const [counts, setCounts] = useState<ProviderCounts | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshCounts = useCallback(async () => {
    setCountError(null);
    try {
      setCounts(await fetchProviderCounts());
    } catch (err) {
      console.log('[ai-lab] counts error:', err);
      setCountError('Could not load self-tracked counts.');
    }
  }, []);

  useEffect(() => {
    void resolveActiveProvider().then(setActive);
    void refreshCounts();
  }, [refreshCounts]);

  async function pick(id: AiProviderId) {
    setBusy(true);
    try {
      await setProviderOverride(id === bundled ? null : id);
      setActive(id);
    } finally {
      setBusy(false);
    }
  }

  async function useDefault() {
    setBusy(true);
    try {
      await setProviderOverride(null);
      setActive(bundled);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedPressable onPress={() => router.back()} style={styles.back}>
              <ThemedText type="smallBold">Back</ThemedText>
            </ThemedPressable>
            <ThemedText type="subtitle">AI provider</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This device only. Other accounts keep the bundled default (
              {PROVIDER_LIMITS[bundled].label}).
            </ThemedText>
            <ProviderStatusDot provider={active} />
          </View>

          {AI_PROVIDER_IDS.map((id) => {
            const limit = PROVIDER_LIMITS[id];
            const selected = active === id;
            const usage = id === 'local' ? null : counts?.[id];
            return (
              <ThemedView key={id} type="backgroundElement" style={styles.card}>
                <ThemedPressable
                  disabled={busy}
                  onPress={() => void pick(id)}
                  style={[
                    styles.row,
                    { borderColor: selected ? theme.accent : controlBorderColor(theme) },
                    selected && styles.selected,
                  ]}>
                  <ThemedText type="smallBold">{limit.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {id === bundled ? 'bundled default' : id}
                    {selected ? ' · in use' : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {limit.note}
                  </ThemedText>
                  {id === 'local' ? null : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Last minute: {usage?.minute ?? '—'}
                      {limit.rpm != null ? ` / ~${limit.rpm} ref` : ''}
                      {' · '}
                      Last 24h: {usage?.day ?? '—'}
                      {limit.rpd != null ? ` / ~${limit.rpd} ref` : ''}
                    </ThemedText>
                  )}
                </ThemedPressable>
              </ThemedView>
            );
          })}

          <ThemedText type="small" themeColor="textSecondary">
            These are self-tracked call counts from this app, not the provider's
            official billing numbers. Windows are rolling (last 60 seconds / last
            24 hours), not the provider's reset window. Dashboards like Google
            Cloud Monitoring need separate admin credentials — the API key cannot
            read them.
          </ThemedText>

          {countError ? (
            <ThemedText type="small" themeColor="textSecondary">
              {countError}
            </ThemedText>
          ) : null}

          <ThemedPressable
            onPress={() => void refreshCounts()}
            style={[styles.btn, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="smallBold">Refresh counts</ThemedText>
          </ThemedPressable>

          <ThemedPressable
            onPress={() => void useDefault()}
            disabled={busy}
            style={[styles.btn, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="smallBold">Use bundled default</ThemedText>
          </ThemedPressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.half,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  row: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Spacing.four,
  },
  selected: {
    borderWidth: 2,
  },
  btn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
