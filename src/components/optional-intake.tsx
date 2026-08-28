import { Pressable, StyleSheet, View } from 'react-native';

import { AxisTaps } from '@/components/axis-taps';
import { ChipGroup } from '@/components/intake-chips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { IntakeChip } from '@/lib/intake';
import {
  OPTIONAL_INTAKE_TOTAL,
  SLIDER_AXES,
  TYPE_CODES,
  optionalProgressLabel,
  type ClosePatternId,
  type DisagreeId,
} from '@/lib/traits';

const CLOSE_CHIPS: IntakeChip<ClosePatternId>[] = [
  { value: 'close_steady', label: 'I feel close and steady with people' },
  { value: 'worry_pull_away', label: 'I worry people will pull away' },
  { value: 'keep_distance', label: 'I keep some distance even with people I like' },
  { value: 'want_and_pull', label: 'I want closeness and also want to pull back' },
];

const DISAGREE_CHIPS: IntakeChip<DisagreeId>[] = [
  { value: 'push_my_way', label: 'I put my own point on the table' },
  { value: 'win_we_both', label: 'I look for something we can both live with' },
  { value: 'split_difference', label: 'I split the difference' },
  { value: 'step_back', label: 'I step back from the disagreement' },
  { value: 'give_ground', label: 'I give ground to keep the peace' },
];

const TYPE_CHIPS: IntakeChip[] = TYPE_CODES.map((code) => ({ value: code, label: code }));

const SLIDER_COPY: { axis: (typeof SLIDER_AXES)[number]; label: string; hint: string }[] = [
  { axis: 'openness', label: 'New ideas', hint: 'Left = stick with what I know. Right = try the untried path.' },
  { axis: 'conscientiousness', label: 'Follow-through', hint: 'Left = keep plans loose. Right = see a plan through.' },
  { axis: 'extraversion', label: 'People time', hint: 'Left = quieter time. Right = energy from people.' },
  { axis: 'agreeableness', label: 'Going along', hint: 'Left = hold my ground. Right = keep things easy.' },
  { axis: 'steadiness', label: 'Even keel', hint: 'Left = I feel it when things wobble. Right = I stay even.' },
];

export type OptionalScreen = 0 | 1 | 2 | 3;

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

  return (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progress}>
        {optionalProgressLabel(screen + 1)}
      </ThemedText>
      {screen === 0 ? (
        <>
          <ThemedText type="subtitle">If you already know a four-letter type, tap it</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
            16 personality types. Skip if you don&apos;t use one.
          </ThemedText>
          <ChipGroup chips={TYPE_CHIPS} selected={typeCode ? [typeCode] : []} disabled={busy} onSelect={onType} />
        </>
      ) : null}
      {screen === 1 ? (
        <>
          <ThemedText type="subtitle">If you already know how you trend, mark it</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
            Leave a row blank if you&apos;re not sure. Blank stays blank — we do not fill in the middle for you.
          </ThemedText>
          <View style={styles.sliderStack}>
            {SLIDER_COPY.map((row) => (
              <AxisTaps
                key={row.axis}
                label={row.label}
                hint={row.hint}
                value={sliderValues[row.axis] ?? null}
                disabled={busy}
                onChange={(value) => onSlider(row.axis, value)}
              />
            ))}
          </View>
        </>
      ) : null}
      {screen === 2 ? (
        <>
          <ThemedText type="subtitle">When you&apos;re close to someone, what usually shows up?</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
            A starting point, not a lifetime label. Skip if none of these fit.
          </ThemedText>
          <ChipGroup
            chips={CLOSE_CHIPS}
            selected={closeId ? [closeId] : []}
            disabled={busy}
            onSelect={onClose}
          />
        </>
      ) : null}
      {screen === 3 ? (
        <>
          <ThemedText type="subtitle">When there&apos;s a disagreement, what&apos;s your first move?</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
            About this kind of moment, not who you are. Skip if none of these fit.
          </ThemedText>
          <ChipGroup
            chips={DISAGREE_CHIPS}
            selected={disagreeId ? [disagreeId] : []}
            disabled={busy}
            onSelect={onDisagree}
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
  sliderStack: {
    gap: Spacing.three,
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
