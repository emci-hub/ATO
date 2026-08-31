import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { recordForcedPick, recordStandaloneScenario, type Me } from '@/lib/me';
import { forcedPickForAxis } from '@/lib/ranking';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import { isExtraAxis, scenarioForAxis } from '@/lib/scenario';
import { depthKindFor } from '@/lib/depth-dive';
import { TOKEN_PRICE } from '@/lib/tokens';
import { spendTokens } from '@/lib/tokens-server';
import type { TraitAxis } from '@/lib/traits';
import { DEPTH_COOLDOWN_HOURS, depthReady } from '@/lib/trait-stability';
import { stampAxisDepth } from '@/lib/trait-tracks-store';
import { controlBorderColor } from '@/lib/theme/chrome';

/**
 * Token-spent capture. Ranking pick for core axes; gut-call for EXTRA_AXES.
 * Spends only after a successful write. Skip spends nothing.
 */
export function DepthDive({
  me,
  axis,
  lastDepthAt,
  onClose,
  onUpdated,
}: {
  me: Me;
  axis: TraitAxis;
  lastDepthAt?: string | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = depthKindFor(axis);
  const preferAlt = me.trait_sources[axis] === 'self_game';
  const ready = depthReady(lastDepthAt ?? null);

  async function afterWrite() {
    await stampAxisDepth(me.id, axis).catch((err) => {
      console.log('[depth] stamp error:', err);
    });
    const spent = await spendTokens('profile_depth');
    if (!spent.ok) {
      setError('Could not spend notes. The answer still saved.');
    }
    await onUpdated();
    onClose();
  }

  async function pickRanking(pole: 'high' | 'low') {
    if (busy) return;
    if (!ready) {
      setError(`Another pass on this one waits ${DEPTH_COOLDOWN_HOURS} hours.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { wrote } = await recordForcedPick(me.id, axis, pole);
      if (!wrote) {
        setError('Nothing new to save here. No notes spent.');
        return;
      }
      await afterWrite();
    } catch (err) {
      console.log('[depth] ranking error:', err);
      setError('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function pickScenario(pole: 'high' | 'low') {
    if (busy || !isExtraAxis(axis)) return;
    if (!ready) {
      setError(`Another pass on this one waits ${DEPTH_COOLDOWN_HOURS} hours.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { wrote } = await recordStandaloneScenario(me.id, axis, pole);
      if (!wrote) {
        setError('A told answer already sits here, so this did not change it. No notes spent.');
        return;
      }
      await afterWrite();
    } catch (err) {
      console.log('[depth] scenario error:', err);
      setError('Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const ranking = kind === 'ranking' ? forcedPickForAxis(axis) : null;
  const scenario = kind === 'scenario' && isExtraAxis(axis) ? scenarioForAxis(axis, preferAlt) : null;
  const copy = AXIS_EDITOR_COPY[axis];

  return (
    <View style={styles.block} testID={`depth-dive-${axis}`}>
      <ThemedText type="smallBold">{copy.label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {ready
          ? `${TOKEN_PRICE.profile_depth} notes if you pick. Skip costs nothing.`
          : `Another pass on this one waits ${DEPTH_COOLDOWN_HOURS} hours. Skip costs nothing.`}
      </ThemedText>
      {ranking ? (
        <View style={styles.choices}>
          <ThemedPressable
            disabled={busy}
            onPress={() => void pickRanking('high')}
            style={[styles.choice, { borderColor: controlBorderColor(theme) }]}
            testID="depth-rank-high">
            <ThemedText type="smallBold">{ranking.high.text}</ThemedText>
          </ThemedPressable>
          <ThemedPressable
            disabled={busy}
            onPress={() => void pickRanking('low')}
            style={[styles.choice, { borderColor: controlBorderColor(theme) }]}
            testID="depth-rank-low">
            <ThemedText type="smallBold">{ranking.low.text}</ThemedText>
          </ThemedPressable>
        </View>
      ) : null}
      {scenario ? (
        <View style={styles.choices}>
          <ThemedText>{scenario.def.setup}</ThemedText>
          <ThemedPressable
            disabled={busy}
            onPress={() => void pickScenario('high')}
            style={[styles.choice, { borderColor: controlBorderColor(theme) }]}
            testID="depth-scene-high">
            <ThemedText type="smallBold">{scenario.def.high.label}</ThemedText>
          </ThemedPressable>
          <ThemedPressable
            disabled={busy}
            onPress={() => void pickScenario('low')}
            style={[styles.choice, { borderColor: controlBorderColor(theme) }]}
            testID="depth-scene-low">
            <ThemedText type="smallBold">{scenario.def.low.label}</ThemedText>
          </ThemedPressable>
        </View>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      ) : null}
      <ThemedPressable onPress={onClose} disabled={busy} style={styles.skip}>
        <ThemedText type="small" themeColor="textSecondary">
          Skip
        </ThemedText>
      </ThemedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  choices: {
    gap: Spacing.two,
  },
  choice: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  skip: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
});
