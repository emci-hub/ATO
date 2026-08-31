import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AxisCodeLabel } from '@/components/axis-code-label';
import { AxisTaps } from '@/components/axis-taps';
import { DepthDive } from '@/components/depth-dive';
import { SettingsFold } from '@/components/settings-fold';
import { TraitBandVisual } from '@/components/trait-bands-fold';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  FULL_PROFILE_LABEL,
  FULL_PROFILE_LEDE,
  NOT_ANSWERED_YET,
  answeredAxisLabel,
  formatTraitTouchedAt,
  sourceProvenance,
} from '@/lib/full-profile';
import { updateTraits, type Me } from '@/lib/me';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import { TRAIT_BAND_PHRASES } from '@/lib/trait-bands';
import {
  historyForAxis,
  shiftLine,
  TRAIT_SHIFT_EMPTY,
  TRAIT_SHIFT_LABEL,
  type TraitHistoryRow,
} from '@/lib/trait-history';
import { fetchTraitHistory } from '@/lib/trait-history-store';
import {
  TRAIT_AXES,
  traitStateFromRow,
  type TraitAxis,
} from '@/lib/traits';
import { TOKEN_DEPTH_HINT, TOKEN_DEPTH_LABEL, TOKEN_NEED_MORE, TOKEN_PRICE, tokenBalanceOf } from '@/lib/tokens';

/**
 * Private You-tab inventory of all 15 axes. Auth is the tab shell.
 * Writes go through `updateTraits` — tap-form for a first answer (`self_tap`),
 * Settings correction for a later edit (`self_settings`). Same merge as
 * OptionalIntakeFill / Not quite. Does not claim the weekly Ask slot.
 */
export function FullProfileFold({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated: () => void | Promise<void>;
}) {
  const state = traitStateFromRow(me);
  const [editing, setEditing] = useState<TraitAxis | null>(null);
  const [busy, setBusy] = useState(false);
  const [openShift, setOpenShift] = useState<TraitAxis | null>(null);
  const [history, setHistory] = useState<TraitHistoryRow[]>([]);
  const [diving, setDiving] = useState<TraitAxis | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTraitHistory(me.id)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((err) => {
        console.log('[full-profile] history error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [me.id, me.updated_at]);

  async function save(axis: TraitAxis, value: number) {
    if (busy) return;
    setBusy(true);
    try {
      const source = state.values[axis] == null ? 'self_tap' : 'self_settings';
      await updateTraits(me.id, { [axis]: value }, source, [axis]);
      await onUpdated();
      setEditing(null);
    } catch (err) {
      console.log('[full-profile] save error:', err);
    } finally {
      setBusy(false);
    }
  }

  const notes = tokenBalanceOf(me);
  const canDepth = notes >= TOKEN_PRICE.profile_depth;

  return (
    <SettingsFold title={`${FULL_PROFILE_LABEL} · ${answeredAxisLabel(state.values)}`}>
      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
          {FULL_PROFILE_LEDE}
        </ThemedText>
        {TRAIT_AXES.map((axis) => {
          const value = state.values[axis];
          const filled = value != null && Number.isFinite(value);
          const copy = AXIS_EDITOR_COPY[axis];
          const phrases = TRAIT_BAND_PHRASES[axis];
          const provenance = sourceProvenance(state.sources[axis]);
          const updated = formatTraitTouchedAt(state.touched[axis], me.timezone || 'UTC');
          const open = editing === axis;
          const shifts = historyForAxis(history, axis);
          const showingShift = openShift === axis;
          return (
            <View key={axis} style={styles.axis}>
              <AxisCodeLabel axis={axis} name={copy.label} />
              {filled ? (
                <TraitBandVisual
                  band={{ axis, value, low: phrases.low, high: phrases.high }}
                />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {NOT_ANSWERED_YET}
                </ThemedText>
              )}
              {provenance ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {provenance.line}
                </ThemedText>
              ) : null}
              {updated ? (
                <ThemedText type="code" themeColor="textSecondary">
                  {updated}
                </ThemedText>
              ) : null}
              <ThemedPressable
                accessibilityRole="button"
                accessibilityLabel={TRAIT_SHIFT_LABEL}
                onPress={() => setOpenShift(showingShift ? null : axis)}
                style={styles.edit}>
                <ThemedText type="small" themeColor="textSecondary">
                  {TRAIT_SHIFT_LABEL}
                </ThemedText>
              </ThemedPressable>
              {showingShift ? (
                <View style={styles.shift}>
                  {shifts.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {TRAIT_SHIFT_EMPTY}
                    </ThemedText>
                  ) : (
                    shifts.map((row, index) => {
                      const prev = index === 0 ? null : shifts[index - 1]!.value;
                      return (
                        <ThemedText
                          key={row.id}
                          type="small"
                          themeColor="textSecondary">
                          {shiftLine(axis, prev, row.value, row.createdAt, me.timezone || 'UTC')}
                        </ThemedText>
                      );
                    })
                  )}
                </View>
              ) : null}
              {open ? (
                <View>
                  <AxisTaps
                    label={copy.label}
                    hint={copy.hint}
                    value={filled ? value : null}
                    disabled={busy}
                    onChange={(next) => {
                      void save(axis, next);
                    }}
                  />
                  <ThemedPressable
                    onPress={() => setEditing(null)}
                    disabled={busy}
                    style={styles.edit}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Not now
                    </ThemedText>
                  </ThemedPressable>
                </View>
              ) : (
                <ThemedPressable
                  accessibilityRole="button"
                  accessibilityLabel={filled ? 'Update how you are leaning' : 'Answer this one'}
                  onPress={() => setEditing(axis)}
                  disabled={busy}
                  style={styles.edit}>
                  <ThemedText type="smallBold">
                    {filled ? 'Update how you are leaning' : 'Answer this one'}
                  </ThemedText>
                </ThemedPressable>
              )}
              {diving === axis ? (
                <DepthDive
                  me={me}
                  axis={axis}
                  onClose={() => setDiving(null)}
                  onUpdated={onUpdated}
                />
              ) : (
                <ThemedPressable
                  accessibilityRole="button"
                  accessibilityLabel={TOKEN_DEPTH_LABEL}
                  onPress={() => {
                    if (!canDepth) return;
                    setDiving(axis);
                  }}
                  disabled={busy || !canDepth}
                  style={styles.edit}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {canDepth
                      ? `${TOKEN_DEPTH_LABEL} · ${TOKEN_PRICE.profile_depth}`
                      : TOKEN_NEED_MORE}
                  </ThemedText>
                </ThemedPressable>
              )}
              <ThemedText type="code" themeColor="textSecondary">
                {TOKEN_DEPTH_HINT}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.four,
  },
  lede: {
    paddingBottom: Spacing.one,
  },
  axis: {
    gap: Spacing.two,
  },
  edit: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  shift: {
    gap: Spacing.one,
    paddingLeft: Spacing.one,
  },
});
