/**
 * Grove Tune panel (GAME_SPEC §9c Dev Tune) — PRE_LAUNCH_DEV only.
 *
 * Presets (Sane / Juicy / Brutal / BrokenOP) swap the whole tune doc; the
 * steppers nudge single knobs (doc becomes "custom"). Everything writes the
 * LOCAL tune singleton + persists to AsyncStorage — never synced to other
 * players — and the engines read it lazily, so a change applies to the next
 * engine read (restart the wave to fully apply). The Sane chip is Reset.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  applyPreset,
  currentPreset,
  getTune,
  saveTune,
  setKnob,
  type TuneDoc,
  type TunePresetId,
} from '@/play/tune';

const PRESET_ORDER: TunePresetId[] = ['sane', 'juicy', 'brutal', 'brokenop'];
const PRESET_LABEL: Record<TunePresetId, string> = {
  sane: 'Sane',
  juicy: 'Juicy',
  brutal: 'Brutal',
  brokenop: 'BrokenOP',
};

type KnobRow = {
  key: keyof TuneDoc;
  label: string;
  step: number;
  /** Round the value for display; default = trim trailing zeros via Number(). */
  format?: (value: number) => string;
};

const KNOBS: KnobRow[] = [
  { key: 'waveHpPerLevel', label: 'Wave HP / level', step: 0.01, format: (v) => v.toFixed(2) },
  { key: 'waveCountPerLevel', label: 'Wave count / level', step: 0.1, format: (v) => v.toFixed(1) },
  { key: 'startScrap', label: 'Start scrap', step: 10 },
  { key: 'tokenClearBase', label: 'Token / clear', step: 10 },
  { key: 'gearSoftcapWavePower', label: 'Wave-power gear cap', step: 0.5, format: (v) => v.toFixed(1) },
  { key: 'gearSoftcapOther', label: 'Other gear cap', step: 0.25, format: (v) => v.toFixed(2) },
  { key: 'diminishingAfterCap', label: 'Diminishing after cap', step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'diveBustBoostPct', label: 'Dive bust boost %', step: 1 },
  { key: 'scrapKill', label: 'Scrap / kill', step: 1 },
  { key: 'dailyClearHalfAfter', label: 'Clears before token half', step: 1 },
  { key: 'avatarCooldownMs', label: 'Avatar attack CD (ms)', step: 100 },
  { key: 'towerCooldownScale', label: 'Tower CD scale', step: 0.1, format: (v) => v.toFixed(1) },
  { key: 'skillSlowPct', label: 'Root Veil slow', step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'skillCooldownMs', label: 'Root Veil CD (ms)', step: 1000 },
  { key: 'cyclePowerStep', label: 'Cycle power step', step: 0.02, format: (v) => v.toFixed(2) },
  { key: 'typeMatchBonus', label: 'Type match bonus', step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'avatarStarDropPct', label: 'Avatar star drop %', step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'avatarStarPityClears', label: 'Avatar star pity clears', step: 1 },
  { key: 'avatarStarWavePowerStep', label: 'Star wave-power step', step: 0.01, format: (v) => v.toFixed(2) },
];

export function TunePanel({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const doc = getTune();
  const preset = currentPreset();

  const pickPreset = (id: TunePresetId) => {
    applyPreset(id);
    bump();
    void saveTune();
  };

  const nudge = <K extends keyof TuneDoc>(key: K, delta: number) => {
    const step = KNOBS.find((k) => k.key === key)?.step ?? 1;
    const value = doc[key];
    if (typeof value === 'number') {
      const next = Math.round((value + delta * step) * 1000) / 1000;
      setKnob(key, Math.max(0, next) as TuneDoc[K]);
    }
    bump();
    void saveTune();
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="emphasis">
          Tune · {preset === 'custom' ? 'custom' : PRESET_LABEL[preset]}
        </ThemedText>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close tune"
          style={({ pressed }) => [pressed && styles.pressed]}>
          <ThemedText type="code" themeColor="textSecondary">
            Done
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.presetRow}>
        {PRESET_ORDER.map((id) => {
          const selected = preset === id;
          return (
            <Pressable
              key={id}
              onPress={() => pickPreset(id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.presetChip,
                {
                  backgroundColor: selected
                    ? theme.accentFill
                    : theme.backgroundSelected,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="code"
                style={{ color: selected ? theme.onAccent : theme.text }}>
                {PRESET_LABEL[id]}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Local only — never synced. Changes apply on the next engine read
        (restart the wave to fully apply).
      </ThemedText>

      {KNOBS.map((knob) => {
        const value = doc[knob.key] as number;
        const label = knob.format ? knob.format(value) : String(value);
        return (
          <View key={knob.key} style={styles.knobRow}>
            <ThemedText type="small" style={styles.knobLabel}>
              {knob.label}
            </ThemedText>
            <View style={styles.knobControls}>
              <Pressable
                onPress={() => nudge(knob.key, -1)}
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${knob.label}`}
                style={({ pressed }) => [
                  styles.step,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="code">−</ThemedText>
              </Pressable>
              <ThemedText type="code" themeColor="emphasis" style={styles.knobValue}>
                {label}
              </ThemedText>
              <Pressable
                onPress={() => nudge(knob.key, 1)}
                accessibilityRole="button"
                accessibilityLabel={`Increase ${knob.label}`}
                style={({ pressed }) => [
                  styles.step,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="code">+</ThemedText>
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={styles.knobRow}>
        <ThemedText type="small" style={styles.knobLabel}>
          God mode (leak ignore)
        </ThemedText>
        <Pressable
          onPress={() => {
            setKnob('godMode', !doc.godMode);
            bump();
            void saveTune();
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: doc.godMode }}
          style={({ pressed }) => [
            styles.step,
            { backgroundColor: doc.godMode ? theme.accentFill : theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="code" style={{ color: doc.godMode ? theme.onAccent : theme.text }}>
            {doc.godMode ? 'On' : 'Off'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  presetChip: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  knobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  knobLabel: {
    flex: 1,
  },
  knobControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  knobValue: {
    minWidth: 48,
    textAlign: 'center',
  },
  step: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.8,
  },
});
