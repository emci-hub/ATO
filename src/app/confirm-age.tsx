import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AgeGateActions, AgeGateFrame } from '@/app/under-18';
import { BornOnFields } from '@/components/born-on-fields';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  ageGateFor,
  bornOnFromParts,
  errorMessageForAge,
  setLocalAgeEntry,
  UNDER_18_MESSAGE,
} from '@/lib/age';
import { setBornOn } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { controlBorderColor } from '@/lib/theme/chrome';

const SAVE_FAILED = "Couldn't save your birthday. Try again.";

/**
 * Confirm your age (emci 2026-10-20, docs/under18-access.md).
 *
 * The root layout routes here when the signed-in account has no usable
 * birthday (null, empty, malformed or in the future). A missing birthday never
 * opens the app by itself. They type it once, through the same fields as
 * sign-up and the same guarded write as You's Birthday row (`setBornOn`: the
 * 18+ check on the phone, then `me_born_on_guard` on the server):
 * - 18 or older: saved, `me` reloads, the app opens.
 * - under 18: nothing is written (both checks refuse it). The date is kept in
 *   memory for this app session only, and the layout shows the under-18 screen.
 */
export default function ConfirmAgeScreen() {
  const { me, refresh } = useMeContext();
  return (
    <ConfirmAgeView
      onSave={async (bornOn) => {
        if (!me) throw new Error(SAVE_FAILED);
        await setBornOn(me.id, bornOn);
        await refresh();
      }}
      onUnderage={(bornOn) => {
        if (me) setLocalAgeEntry({ userId: me.id, bornOn });
      }}
    />
  );
}

/**
 * The confirm screen itself. `today` is the device date (the dev preview passes
 * a fake one); `preview` turns the actions into no-op notes.
 */
export function ConfirmAgeView({
  onSave,
  onUnderage,
  today,
  preview = false,
}: {
  onSave: (bornOn: string) => Promise<void>;
  onUnderage: (bornOn: string) => void;
  today?: Date;
  preview?: boolean;
}) {
  const theme = useTheme();
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    const now = today ?? new Date();
    const parsed = bornOnFromParts(year, month, day, now);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    // Under 18 is refused by setBornOn and by the server guard, so it is never
    // sent: show the under-18 screen straight away.
    if (ageGateFor(parsed.bornOn, now) === 'blocked') {
      onUnderage(parsed.bornOn);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(parsed.bornOn);
    } catch (err) {
      const message = errorMessageForAge(err);
      // The server counts on its own (UTC) date: around midnight it can still
      // say under 18. Same answer for them: the under-18 screen.
      if (message === UNDER_18_MESSAGE) {
        onUnderage(parsed.bornOn);
        return;
      }
      setError(message ?? SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return (
    <AgeGateFrame>
      <ThemedText type="subtitle">Confirm your age</ThemedText>

      <ThemedText>
        ATO is for people 18 and older. We don&apos;t have your birthday on file, so we need it
        once before you carry on.
      </ThemedText>

      <ThemedText themeColor="textSecondary">When were you born?</ThemedText>
      <BornOnFields
        year={year}
        month={month}
        day={day}
        onYearChange={(value) => {
          setYear(value);
          clearError();
        }}
        onMonthChange={(value) => {
          setMonth(value);
          clearError();
        }}
        onDayChange={(value) => {
          setDay(value);
          clearError();
        }}
        editable={!saving}
      />
      {error ? (
        <ThemedText type="smallBold" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        onPress={() => void submit()}
        disabled={saving}
        style={({ pressed }) => [
          styles.continueButton,
          { backgroundColor: theme.backgroundElement, borderColor: controlBorderColor(theme) },
          pressed && styles.pressed,
          saving && styles.disabled,
        ]}>
        <ThemedText type="smallBold">{saving ? 'Saving…' : 'Continue'}</ThemedText>
      </Pressable>

      <ThemedText type="small" themeColor="textSecondary">
        We use it only to check your age, the same as at sign-up.
      </ThemedText>

      <AgeGateActions preview={preview} mailSubject="ATO account (confirm age)" />
    </AgeGateFrame>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#E5484D',
  },
  continueButton: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
});
