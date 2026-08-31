import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { voiceMeFrom } from '@/lib/intake';
import { type Me } from '@/lib/me';
import { generateSageInsight } from '@/lib/sage-insight';
import {
  spendTokens,
} from '@/lib/tokens-server';
import {
  TOKEN_INSIGHT_HINT,
  TOKEN_INSIGHT_LABEL,
  TOKEN_NEED_MORE,
  TOKEN_PRICE,
  tokenBalanceOf,
} from '@/lib/tokens';
import { controlBorderColor } from '@/lib/theme/chrome';

/** Extra Sage observation. Conversational. No trait write. Spends after a body lands. */
export function SageInsightSpend({
  me,
  settled = 0,
  onUpdated,
}: {
  me: Me;
  /** Stability-weighted N of currently-defined axes settled. */
  settled?: number;
  onUpdated: () => void | Promise<void>;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notes = tokenBalanceOf(me);
  const can = notes >= TOKEN_PRICE.sage_insight;

  async function run() {
    if (busy || !can) return;
    setBusy(true);
    setError(null);
    try {
      const next = await generateSageInsight(voiceMeFrom(me), settled);
      if (!next) {
        setError("Couldn't land that. Notes were not spent.");
        return;
      }
      const spent = await spendTokens('sage_insight');
      if (!spent.ok) {
        setError(TOKEN_NEED_MORE);
        return;
      }
      setBody(next);
      await onUpdated();
    } catch (err) {
      console.log('[sage-insight] error:', err);
      setError("Couldn't land that. Notes were not spent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">{TOKEN_INSIGHT_LABEL}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {TOKEN_INSIGHT_HINT} · {TOKEN_PRICE.sage_insight} notes
      </ThemedText>
      {body ? (
        <ThemedText>{body}</ThemedText>
      ) : (
        <ThemedPressable
          disabled={busy || !can}
          onPress={() => void run()}
          style={[
            styles.btn,
            { borderColor: controlBorderColor(theme) },
            (busy || !can) && styles.disabled,
          ]}>
          <ThemedText type="smallBold">
            {can ? `Spend ${TOKEN_PRICE.sage_insight}` : TOKEN_NEED_MORE}
          </ThemedText>
        </ThemedPressable>
      )}
      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.half,
    paddingBottom: Spacing.two,
  },
  btn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
});
