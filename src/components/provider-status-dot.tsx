import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AI_CONFIG, isRemoteReady, pingProvider, type AiProviderId } from '@/lib/ai';
import { withTimeout } from '@/lib/timeout';

const CHECK_INTERVAL_MS = 60_000;
const CHECK_TIMEOUT_MS = 25_000;

type Status = 'checking' | 'connected' | 'unavailable' | 'not-configured' | 'local';

const DOT_COLOR: Record<Status, string> = {
  checking: '#9CA3AF',
  connected: '#22C55E',
  unavailable: '#EF4444',
  'not-configured': '#9CA3AF',
  local: '#9CA3AF',
};

const STATUS_LABEL: Record<Status, string> = {
  checking: 'Checking…',
  connected: 'Connected',
  unavailable: 'Unavailable',
  'not-configured': 'No API key',
  local: 'No connectivity check for local',
};

const MISSING_KEY_PATTERN = /key_missing/;

/**
 * Pings the currently-selected AI provider through the same request path
 * production calls use (see pingProvider), on mount and every 60s. Tap to
 * reveal the last error — phones have no hover to show it on.
 */
export function ProviderStatusDot({ provider }: { provider: AiProviderId }) {
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);

    if (provider === 'local') {
      setStatus('local');
      setError(null);
      return;
    }
    if (!isRemoteReady(AI_CONFIG, provider)) {
      setStatus('not-configured');
      setError(null);
      return;
    }

    const remoteProvider = provider;
    let cancelled = false;

    // A fresh provider means a fresh check — never show the previous
    // provider's status while the new one is still being pinged.
    setStatus('checking');
    setError(null);

    async function check(isFirst: boolean) {
      if (!isFirst) {
        setStatus((current) => (current === 'connected' || current === 'unavailable' ? current : 'checking'));
      }
      try {
        await withTimeout(pingProvider(remoteProvider), CHECK_TIMEOUT_MS, 'provider ping');
        if (cancelled) return;
        setStatus('connected');
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        if (MISSING_KEY_PATTERN.test(message)) {
          setStatus('not-configured');
          setError(null);
        } else {
          setStatus('unavailable');
          setError(message);
        }
      }
    }

    void check(true);
    const timer = setInterval(() => void check(false), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [provider]);

  const canExpand = status === 'unavailable' && error;

  return (
    <ThemedPressable
      disabled={!canExpand}
      onPress={() => setExpanded((v) => !v)}
      style={styles.row}>
      <View style={[styles.dot, { backgroundColor: DOT_COLOR[status] }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {STATUS_LABEL[status]}
      </ThemedText>
      {expanded && error ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </ThemedPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  error: {
    flexBasis: '100%',
  },
});
