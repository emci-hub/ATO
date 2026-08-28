import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatSageUsage, type SageUsageSnapshot } from '@/lib/voice/quota';
import { fetchSageUsage } from '@/lib/voice/quota-server';

function useSageUsage(revision = 0): SageUsageSnapshot | null {
  const [usage, setUsage] = useState<SageUsageSnapshot | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    fetchSageUsage()
      .then((next) => {
        if (!cancelled) setUsage(next);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return load();
  }, [load, revision]);

  return usage;
}

/** Compact Sage-tab line. Hidden until a snapshot lands. */
export function SageUsageLine({ revision = 0 }: { revision?: number }) {
  const usage = useSageUsage(revision);
  if (!usage) return null;
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.line}>
      {formatSageUsage(usage.daily, usage.dailyCap, 'today')}
    </ThemedText>
  );
}

/** You-tab fold. Collapsed by default — usage is there if they look. */
export function SageUsageFold({ revision = 0 }: { revision?: number }) {
  const usage = useSageUsage(revision);
  return (
    <SettingsFold title="Sage today">
      {usage ? (
        <>
          <ThemedText type="small" style={styles.foldLine}>
            {formatSageUsage(usage.daily, usage.dailyCap, 'today')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.foldLine}>
            {formatSageUsage(usage.monthly, usage.monthlyCap, 'this month')}
          </ThemedText>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.foldLine}>
          Usage will show here once it loads.
        </ThemedText>
      )}
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  line: {
    paddingHorizontal: Spacing.half,
    paddingBottom: Spacing.one,
  },
  foldLine: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
