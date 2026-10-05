import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ONGOING_ROUND_SIZE } from '@/lib/questions/tiered-axis-plan';
import { fetchLatestOngoingRoundPack } from '@/lib/questions/store';
import { isUnansweredQuestionItem } from '@/lib/questions/rotation';

/** A small ring that fills as a count goes up, with the count in the middle. */
export function ProgressRing({ value, total, size = 44 }: { value: number; total: number; size?: number }) {
  const theme = useTheme();
  const stroke = 4;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${value} of ${total}`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.backgroundSelected} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap={theme.cutCorners ? 'butt' : 'round'}
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - share)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <ThemedText type="codeBold">{value}</ThemedText>
      </View>
    </View>
  );
}

/**
 * How far into the current round of 16 this account is: one plain read of the
 * latest round pack (no model call). A finished or missing round reads 0 — the
 * next one starts fresh. `null` until the read lands or when it fails.
 */
export function useRoundProgress(userId: string | undefined, refreshKey?: unknown): number | null {
  const [answered, setAnswered] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchLatestOngoingRoundPack()
      .then((pack) => {
        if (cancelled) return;
        if (!pack) return setAnswered(0);
        const done = pack.items.filter((item) => !isUnansweredQuestionItem(item)).length;
        setAnswered(done >= pack.items.length ? 0 : Math.min(done, ONGOING_ROUND_SIZE));
      })
      .catch((err) => console.log('[round-progress] read error:', err));
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);
  return answered;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
