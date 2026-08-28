import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipGroup } from '@/components/intake-chips';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CORE_INTAKE_QUESTIONS,
  INTAKE_SETTINGS_LABELS,
  displayIntakeValue,
  joinKnocks,
  parseKnocks,
  selectedIntakeValues,
  type CoreIntakeField,
  type KnocksChip,
} from '@/lib/intake';
import { updateIntake, type IntakePatch, type Me } from '@/lib/me';

/**
 * You-tab editor for the 9 onboarding identity chips. Same chip sets as
 * signup. show_up still seeds color; talk_style still seeds Sage's tone.
 */
export function IntakeSettings({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState<CoreIntakeField | null>(null);
  const [saving, setSaving] = useState<CoreIntakeField | null>(null);

  async function save(field: CoreIntakeField, patch: IntakePatch) {
    if (saving) return;
    setSaving(field);
    try {
      await updateIntake(me.id, patch);
      await onUpdated();
      if (field !== 'knocks_you_off') setOpen(null);
    } catch (err) {
      console.log('[intake-settings] save error:', err);
    } finally {
      setSaving(null);
    }
  }

  function onSelect(field: CoreIntakeField, value: string) {
    if (field === 'knocks_you_off') {
      const current = parseKnocks(me.knocks_you_off);
      const chip = value as KnocksChip;
      const next = current.includes(chip)
        ? current.filter((item) => item !== chip)
        : [...current, chip];
      if (next.length === 0) return;
      void save(field, { knocks_you_off: joinKnocks(next) });
      return;
    }
    if (selectedIntakeValues(field, me)[0] === value) {
      setOpen(null);
      return;
    }
    void save(field, { [field]: value } as IntakePatch);
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.heading}>
        How you show up
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
        Tap a row to change it. Same answers as when you signed up.
      </ThemedText>
      {CORE_INTAKE_QUESTIONS.map((question) => {
        const selected = selectedIntakeValues(question.field, me);
        const expanded = open === question.field;
        const busy = saving === question.field;
        return (
          <View key={question.field}>
            <ThemedPressable
              accessibilityRole="button"
              accessibilityLabel={INTAKE_SETTINGS_LABELS[question.field]}
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : question.field)}
              style={[styles.row, expanded && { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {INTAKE_SETTINGS_LABELS[question.field]}
              </ThemedText>
              <ThemedText type="small" style={styles.value}>
                {displayIntakeValue(question.field, me)}
              </ThemedText>
            </ThemedPressable>
            {expanded ? (
              <View style={styles.chips}>
                <ThemedText type="small" themeColor="textSecondary">
                  {question.prompt}
                </ThemedText>
                <ChipGroup
                  chips={question.chips}
                  selected={selected}
                  multi={question.multi}
                  disabled={busy || saving != null}
                  inset
                  onSelect={(value) => onSelect(question.field, value)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
});
