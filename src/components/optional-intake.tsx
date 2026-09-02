import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChipGroup } from '@/components/intake-chips';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { IntakeChip } from '@/lib/intake';
import { updateTraits, type Me } from '@/lib/me';
import {
  deferredUnansweredAxes,
  mergedDeferral,
} from '@/lib/questions/deferral';
import { saveQuestionDeferral } from '@/lib/questions/store';
import { SCENARIO_QUESTIONS } from '@/lib/vibe-check';
import {
  OPTIONAL_INTAKE_TOTAL,
  axesWrittenByOptionalScreen,
  optionalFillWrite,
  optionalProgressLabel,
  traitStateFromRow,
  unansweredOptionalScreens,
  type OptionalScreen,
  type TraitAxis,
} from '@/lib/traits';

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

function scenarioChips(screen: OptionalScreen): IntakeChip[] {
  return SCENARIO_QUESTIONS[screen].options.map(({ value, label }) => ({ value, label }));
}

/**
 * Onboarding's single-scroll version of the 8 scenario questions — same
 * shape as CoreIntakeSweep. Answering nothing is fine; unlike core intake
 * this never gates Save on completeness.
 */
export function OptionalIntakeSweep({
  answers,
  busy,
  formError,
  onSelect,
  onSubmit,
  onSkip,
  onBack,
}: {
  answers: Partial<Record<OptionalScreen, string>>;
  busy: boolean;
  formError: string | null;
  onSelect: (screen: OptionalScreen, value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const answeredCount = SCENARIO_QUESTIONS.filter((_, i) => answers[i as OptionalScreen]).length;

  return (
    <View style={styles.sweepBody}>
      <Pressable
        onPress={onBack}
        disabled={busy}
        hitSlop={12}
        style={({ pressed }) => [styles.backLink, pressed && styles.pressed, busy && styles.disabled]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="subtitle">Want to add a bit more?</ThemedText>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progress}>
        {optionalProgressLabel(answeredCount)}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.lede}>
        If you already know more about how you show up, you can add it. Totally optional —
        answer what you want, skip the rest. This is a starting point. It can change.
      </ThemedText>

      {SCENARIO_QUESTIONS.map((question, i) => {
        const screen = i as OptionalScreen;
        const selected = answers[screen];
        return (
          <View key={screen} style={styles.item}>
            <ThemedText type="smallBold">{question.prompt}</ThemedText>
            <ChipGroup
              chips={scenarioChips(screen)}
              selected={selected ? [selected] : []}
              disabled={busy}
              onSelect={(value) => onSelect(screen, value)}
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
        disabled={busy}
        style={({ pressed }) => [
          styles.submitButton,
          { backgroundColor: '#3c87f7' },
          pressed && styles.pressed,
          busy && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.submitText}>
          {busy ? 'Saving…' : 'Save'}
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={onSkip}
        disabled={busy}
        style={({ pressed }) => [styles.skipButton, pressed && styles.pressed, busy && styles.disabled]}>
        <ThemedText type="smallBold">Skip for now</ThemedText>
      </Pressable>
    </View>
  );
}

export function OptionalStep({
  screen,
  busy,
  selectedOptionId,
  onSelect,
  onBack,
  onSkipThis,
  onSkipRest,
  onContinue,
}: {
  screen: OptionalScreen;
  busy: boolean;
  selectedOptionId: string | null;
  onSelect: (value: string) => void;
  onBack: () => void;
  onSkipThis: () => void;
  onSkipRest: () => void;
  onContinue: () => void;
}) {
  const last = screen === OPTIONAL_INTAKE_TOTAL - 1;
  const question = SCENARIO_QUESTIONS[screen];

  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progress}>
        {optionalProgressLabel(screen + 1)}
      </ThemedText>
      <ThemedText type="subtitle">{question.prompt}</ThemedText>
      <ChipGroup
        chips={scenarioChips(screen)}
        selected={selectedOptionId ? [selectedOptionId] : []}
        disabled={busy}
        onSelect={onSelect}
      />

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
          onPress={onBack}
          disabled={busy}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed, busy && styles.disabled]}>
          <ThemedText type="smallBold">Back</ThemedText>
        </Pressable>
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

/**
 * You-tab fill-later for skipped optional screens. Same OptionalStep UI as
 * onboarding. Additive null-axis writes only — never claims the weekly Ask.
 */
export function OptionalIntakeFill({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated: () => void | Promise<void>;
}) {
  const values = traitStateFromRow(me).values;
  const deferred = new Set(deferredUnansweredAxes(values, me.question_deferred));
  const unanswered = unansweredOptionalScreens(values).filter(
    (screen) =>
      !axesWrittenByOptionalScreen(screen).some((axis) => deferred.has(axis)),
  );
  const [sessionSkipped, setSessionSkipped] = useState<ReadonlySet<OptionalScreen>>(
    () => new Set(),
  );
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Partial<Record<OptionalScreen, string>>>({});

  if (unanswered.length === 0) return null;

  const remaining = unanswered.filter((screen) => !sessionSkipped.has(screen));
  const index = remaining.length === 0 ? 0 : Math.min(cursor, remaining.length - 1);
  const screen = remaining[index];

  function markSkipped(screens: readonly OptionalScreen[]) {
    setSessionSkipped((prev) => {
      const next = new Set(prev);
      for (const item of screens) next.add(item);
      return next;
    });
  }

  /** A skipped optional screen defers its still-unanswered axes to the pool. */
  async function skipScreens(screens: readonly OptionalScreen[]) {
    const axes: TraitAxis[] = [];
    const seen = new Set<TraitAxis>();
    for (const item of screens) {
      for (const axis of axesWrittenByOptionalScreen(item)) {
        if (seen.has(axis)) continue;
        seen.add(axis);
        if (values[axis] == null) axes.push(axis);
      }
    }
    if (axes.length === 0) {
      markSkipped(screens);
      return;
    }
    setBusy(true);
    try {
      const next = mergedDeferral(me.question_deferred, values, axes);
      await saveQuestionDeferral(me.id, next);
      await onUpdated();
      markSkipped(screens);
    } catch (err) {
      console.log('[optional-intake] skip error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function persistThenAdvance() {
    if (busy || screen == null) return;
    const write = optionalFillWrite(values, {
      screen,
      optionId: answers[screen] ?? null,
    });
    setBusy(true);
    try {
      if (write) {
        await updateTraits(me.id, write.incoming, write.source, write.allowed);
        await onUpdated();
        // Answered: nothing to defer (all the screen's writable null axes are
        // now set). Just move the stepper on.
        markSkipped([screen]);
      } else {
        // No option selected — this advance is effectively a skip, so relocate
        // the screen's still-unanswered axes to the pool.
        await skipScreens([screen]);
      }
    } catch (err) {
      console.log('[optional-intake] fill error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsFold title="Want to add a bit more?">
      <View style={styles.fillBody}>
        {screen == null ? null : (
          <OptionalStep
            screen={screen}
            busy={busy}
            selectedOptionId={answers[screen] ?? null}
            onSelect={(value) => {
              setAnswers((prev) => ({ ...prev, [screen]: value }));
            }}
            onBack={() => {
              if (index <= 0) return;
              setCursor(index - 1);
            }}
            onSkipThis={() => void skipScreens([screen])}
            onSkipRest={() => void skipScreens(remaining)}
            onContinue={() => void persistThenAdvance()}
          />
        )}
      </View>
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  lede: {
    paddingBottom: Spacing.two,
  },
  progress: {
    letterSpacing: 0.4,
  },
  sweepBody: {
    gap: Spacing.three,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
    paddingRight: Spacing.three,
  },
  item: {
    gap: Spacing.two,
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
  backButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
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
  fillBody: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
});
