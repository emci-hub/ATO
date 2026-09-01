import { Pressable, StyleSheet, View } from 'react-native';

import { ChipGroup } from '@/components/intake-chips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  CORE_INTAKE_QUESTIONS,
  CORE_INTAKE_TOTAL,
  INTAKE_SETTINGS_LABELS,
  coreIntakeAnsweredLabel,
  type CoreIntakeField,
  type CoreIntakeQuestion,
} from '@/lib/intake';

export const CORE_INTAKE_SWEEP_TITLE = 'Nine quick taps';

function titleFor(question: CoreIntakeQuestion): string {
  return question.field === 'knocks_you_off' || question.helper
    ? question.prompt
    : INTAKE_SETTINGS_LABELS[question.field];
}

function ledeFor(question: CoreIntakeQuestion): string | null {
  return question.field === 'knocks_you_off' ? null : (question.helper ?? question.prompt);
}

/**
 * Required one-page intake. All 9 core questions on a single scroll, reusing
 * the same chip sets and ChipGroup as the old per-screen wizard. Writes
 * nothing itself — the parent owns createMe and submits all 9 answers.
 */
export function CoreIntakeSweep({
  selectedFor,
  onSelect,
  busy,
  formError,
  onSubmit,
  onBack,
}: {
  selectedFor: (field: CoreIntakeField) => string[];
  onSelect: (field: CoreIntakeField, value: string) => void;
  busy: boolean;
  formError: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const answered = CORE_INTAKE_QUESTIONS.filter(
    (question) => selectedFor(question.field).length > 0,
  ).length;
  const complete = answered >= CORE_INTAKE_TOTAL;

  return (
    <View style={styles.body}>
      <Pressable
        onPress={onBack}
        disabled={busy}
        hitSlop={12}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed, busy && styles.disabled]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="subtitle">{CORE_INTAKE_SWEEP_TITLE}</ThemedText>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progress}>
        {coreIntakeAnsweredLabel(answered)}
      </ThemedText>

      {CORE_INTAKE_QUESTIONS.map((question) => {
        const selected = selectedFor(question.field);
        const title = titleFor(question);
        const lede = ledeFor(question);
        return (
          <View key={question.field} style={styles.item}>
            <ThemedText type="smallBold">{title}</ThemedText>
            {lede ? (
              <ThemedText type="small" themeColor="textSecondary">
                {lede}
              </ThemedText>
            ) : null}
            <ChipGroup
              chips={question.chips}
              selected={selected}
              multi={question.multi}
              disabled={busy}
              onSelect={(value) => onSelect(question.field, value)}
            />
          </View>
        );
      })}

      {formError ? (
        <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
          {formError}
        </ThemedText>
      ) : null}

      <Pressable
        onPress={onSubmit}
        disabled={busy || !complete}
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: '#3c87f7' },
          pressed && styles.pressed,
          (busy || !complete) && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.submitText}>
          {busy ? 'Saving…' : 'Save'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingRight: Spacing.three,
  },
  progress: {
    letterSpacing: 0.4,
  },
  item: {
    gap: Spacing.two,
  },
  submitButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitText: {
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
