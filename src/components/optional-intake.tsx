import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChipGroup } from '@/components/intake-chips';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { IntakeChip } from '@/lib/intake';
import { updateTraits, type Me } from '@/lib/me';
import {
  TYPE_COPY,
  VIBE_QUESTIONS,
  type VibeQuestion,
} from '@/lib/vibe-check';
import {
  OPTIONAL_INTAKE_TOTAL,
  SLIDER_AXES,
  TYPE_CODES,
  optionalFillWrite,
  optionalProgressLabel,
  traitStateFromRow,
  unansweredOptionalScreens,
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
  onBack,
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
  onBack: () => void;
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
  const unanswered = unansweredOptionalScreens(values);
  const [sessionSkipped, setSessionSkipped] = useState<ReadonlySet<OptionalScreen>>(
    () => new Set(),
  );
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [sliderValues, setSliderValues] = useState<
    Partial<Record<(typeof SLIDER_AXES)[number], number>>
  >({});
  const [closeId, setCloseId] = useState<string | null>(null);
  const [closeSecondId, setCloseSecondId] = useState<string | null>(null);
  const [disagreeId, setDisagreeId] = useState<string | null>(null);

  if (unanswered.length === 0) return null;

  const remaining = unanswered.filter((screen) => !sessionSkipped.has(screen));
  const index = remaining.length === 0 ? 0 : Math.min(cursor, remaining.length - 1);
  const screen = remaining[index];

  function skipScreens(screens: readonly OptionalScreen[]) {
    setSessionSkipped((prev) => {
      const next = new Set(prev);
      for (const item of screens) next.add(item);
      return next;
    });
  }

  async function persistThenAdvance() {
    if (busy || screen == null) return;
    const write = optionalFillWrite(values, {
      screen,
      typeCode,
      sliderValues,
      closeId,
      closeSecondId,
      disagreeId,
    });
    setBusy(true);
    try {
      if (write) {
        await updateTraits(me.id, write.incoming, write.source, write.allowed);
        await onUpdated();
      }
      skipScreens([screen]);
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
            typeCode={typeCode}
            sliderValues={sliderValues}
            closeId={screen === 7 ? closeSecondId : closeId}
            disagreeId={disagreeId}
            onType={setTypeCode}
            onSlider={(axis, value) => {
              setSliderValues((prev) => ({ ...prev, [axis]: value }));
            }}
            onClose={screen === 7 ? setCloseSecondId : setCloseId}
            onDisagree={setDisagreeId}
            onBack={() => {
              if (index <= 0) return;
              setCursor(index - 1);
            }}
            onSkipThis={() => skipScreens([screen])}
            onSkipRest={() => skipScreens(remaining)}
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
