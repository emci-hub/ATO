import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AxisTaps } from '@/components/axis-taps';
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
  TRAIT_AXES,
  traitStateFromRow,
  type TraitAxis,
} from '@/lib/traits';

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
          return (
            <View key={axis} style={styles.axis}>
              <ThemedText type="smallBold">{copy.label}</ThemedText>
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
});
