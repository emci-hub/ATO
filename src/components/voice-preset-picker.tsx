import { StyleSheet } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { setVoicePreset, type Me } from '@/lib/me';
import {
  VOICE_PRESETS,
  VOICE_PRESET_LABELS,
  type VoicePreset,
} from '@/lib/voice/preset';

export function VoicePresetPicker({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();

  async function pick(preset: VoicePreset) {
    if (preset === me.voice_preset) return;
    try {
      await setVoicePreset(me.id, preset);
      await onUpdated();
    } catch (err) {
      console.log('[voice-preset] save error:', err);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        Sage's voice
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
        Close friend is the default. A livelier pick adds energy, not a different set of rules.
      </ThemedText>
      {VOICE_PRESETS.map((option) => {
        const selected = me.voice_preset === option;
        return (
          <ThemedPressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={VOICE_PRESET_LABELS[option]}
            accessibilityState={{ selected }}
            onPress={() => {
              void pick(option);
            }}
            style={[styles.row, selected && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{VOICE_PRESET_LABELS[option]}</ThemedText>
          </ThemedPressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.two,
  },
  heading: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  lede: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
