import { Pressable, StyleSheet, View } from 'react-native';

import { ChipGroup } from '@/components/intake-chips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { IntakeChip } from '@/lib/intake';
import {
  TYPE_COPY,
  VIBE_QUESTIONS,
  type VibeQuestion,
} from '@/lib/vibe-check';
import {
  OPTIONAL_INTAKE_TOTAL,
  SLIDER_AXES,
  TYPE_CODES,
  optionalProgressLabel,
  type OptionalScreen,
  type ClosePatternId,
  type DisagreeId,
} from '@/lib/traits';

const TYPE_CHIPS: IntakeChip[] = TYPE_CODES.map((code) => ({ value: code, label: code }));

export type { OptionalScreen };

export function OptionalGate({
  busy,
  onSkip,
  onAdd,
}: {
  busy: boolean;
  onSkip: () => void;
  onAdd: () => void;
}) {
  return (
    <>
      <ThemedText type="subtitle">Want to add a bit more?</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        If you already know more about how you show up, you can add it. Totally optional.
        This is a starting point. It can change.
      </ThemedText>
      <Pressable
        onPress={onSkip}
        disabled={busy}
        style={({ pressed }) => [styles.skipButton, pressed && styles.pressed, busy && styles.disabled]}>
        <ThemedText type="smallBold">Skip</ThemedText>
      </Pressable>
      <Pressable
        onPress={onAdd}
        disabled={busy}
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: '#3c87f7' },
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.submitText}>
          Add a bit more
        </ThemedText>
      </Pressable>
    </>
  );
}

function vibeChips(question: VibeQuestion): IntakeChip[] {
  return question.chips.map(({ value, label }) => ({ value, label }));
}

function selectedFor(
  question: VibeQuestion,
  sliderValues: Partial<Record<(typeof SLIDER_AXES)[number], number>>,
  closeId: string | null,
  disagreeId: string | null,
): string[] {
  if (question.kind === 'slider') {
    const score = sliderValues[question.axis];
    if (typeof score !== 'number') return [];
    const hit = question.chips.find((chip) => chip.score === score);
    return hit ? [hit.value] : [];
  }
  if (question.kind === 'close') return closeId ? [closeId] : [];
  return disagreeId ? [disagreeId] : [];
}

export function OptionalStep({
  screen,
  busy,
  typeCode,
  sliderValues,
  closeId,
  disagreeId,
  onType,
  onSlider,
  onClose,
  onDisagree,
  onSkipThis,
  onSkipRest,
  onContinue,
}: {
  screen: OptionalScreen;
  busy: boolean;
  typeCode: string | null;
  sliderValues: Partial<Record<(typeof SLIDER_AXES)[number], number>>;
  closeId: string | null;
  disagreeId: string | null;
  onType: (value: string) => void;
  onSlider: (axis: (typeof SLIDER_AXES)[number], value: number) => void;
  onClose: (value: string) => void;
  onDisagree: (value: string) => void;
  onSkipThis: () => void;
  onSkipRest: () => void;
  onContinue: () => void;
}) {
  const last = screen === OPTIONAL_INTAKE_TOTAL - 1;
  const question = screen === 0 ? null : VIBE_QUESTIONS[screen - 1];

  function onVibeSelect(value: string) {
    if (!question) return;
    if (question.kind === 'slider') {
      const chip = question.chips.find((item) => item.value === value);
      if (chip) onSlider(question.axis, chip.score);
      return;
    }
    if (question.kind === 'close') {
      onClose(value as ClosePatternId);
      return;
    }
    onDisagree(value as DisagreeId);
  }

  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progress}>
        {optionalProgressLabel(screen + 1)}
      </ThemedText>
      {screen === 0 ? (
        <>
          <ThemedText type="subtitle">{TYPE_COPY.label}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
            {TYPE_COPY.description}
          </ThemedText>
          <ChipGroup chips={TYPE_CHIPS} selected={typeCode ? [typeCode] : []} disabled={busy} onSelect={onType} />
        </>
      ) : null}
      {question ? (
        <>
          {question.kind !== 'disagree' && question.fieldLabel ? (
            <>
              <ThemedText type="subtitle">{question.fieldLabel}</ThemedText>
              {question.fieldDescription ? (
                <ThemedText themeColor="textSecondary" style={styles.lede}>
                  {question.fieldDescription}
                </ThemedText>
              ) : null}
            </>
          ) : null}
          <ThemedText type={question.fieldLabel ? 'smallBold' : 'subtitle'}>{question.prompt}</ThemedText>
          <ChipGroup
            chips={vibeChips(question)}
            selected={selectedFor(question, sliderValues, closeId, disagreeId)}
            disabled={busy}
            onSelect={onVibeSelect}
          />
        </>
      ) : null}

      <View style={styles.skipRow}>
        <Pressable
          onPress={onSkipThis}
          disabled={busy}
          style={({ pressed }) => [styles.skipLink, pressed && styles.pressed, busy && styles.disabled]}>
          <ThemedText type="smallBold">Skip this one</ThemedText>
        </Pressable>
        <Pressable
          onPress={onSkipRest}
          disabled={busy}
          style={({ pressed }) => [styles.skipLink, pressed && styles.pressed, busy && styles.disabled]}>
          <ThemedText type="smallBold">Skip the rest</ThemedText>
        </Pressable>
      </View>

      <View style={styles.navRow}>
        <Pressable
          onPress={onContinue}
          disabled={busy}
          style={({ pressed }) => [
            styles.submitButton,
            styles.nextButton,
            { backgroundColor: '#3c87f7' },
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}>
          <ThemedText type="smallBold" style={styles.submitText}>
            {busy ? 'Saving…' : last ? 'Done' : 'Continue'}
          </ThemedText>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  lede: {
    paddingBottom: Spacing.two,
  },
  progress: {
    letterSpacing: 0.4,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  skipLink: {
    paddingVertical: Spacing.two,
  },
  skipButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  submitButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  nextButton: {
    flex: 1,
    marginTop: 0,
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
