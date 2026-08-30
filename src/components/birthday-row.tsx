import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BornOnFields } from '@/components/born-on-fields';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  bornOnFromParts,
  errorMessageForAge,
  formatBornOnDisplay,
  partsFromBornOn,
  signupAgeMessage,
} from '@/lib/age';
import { setBornOn, type Me } from '@/lib/me';

const NULL_CHIP = '—';

type Mode = 'idle' | 'confirm' | 'edit';

/**
 * Account-fold birthday editor. Null is fillable (same em dash as a null
 * intake chip). A set date stays read-only until they confirm they mean it.
 */
export function BirthdayRow({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('idle');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bornOn = me.born_on;
  const isSet = !!bornOn;

  function openEditor(from: string | null) {
    if (from) {
      const parts = partsFromBornOn(from);
      setYear(parts.year);
      setMonth(parts.month);
      setDay(parts.day);
    } else {
      setYear('');
      setMonth('');
      setDay('');
    }
    setError(null);
    setMode('edit');
  }

  function onRowPress() {
    if (mode !== 'idle') {
      setMode('idle');
      setError(null);
      return;
    }
    if (isSet) return;
    openEditor(null);
  }

  function onEditPress() {
    setError(null);
    setMode('confirm');
  }

  async function save() {
    if (saving) return;
    const parsed = bornOnFromParts(year, month, day);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    const blocked = signupAgeMessage(parsed.bornOn);
    if (blocked) {
      setError(blocked);
      return;
    }
    setSaving(true);
    try {
      await setBornOn(me.id, parsed.bornOn);
      await onUpdated();
      setMode('idle');
      setError(null);
    } catch (err) {
      setError(
        errorMessageForAge(err) ??
          (err instanceof Error ? err.message : "Couldn't save your birthday. Try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  const rowStyle = [styles.row, mode !== 'idle' && { backgroundColor: theme.backgroundSelected }];
  const label = (
    <ThemedText type="small" themeColor="textSecondary">
      Birthday
    </ThemedText>
  );
  const value = (
    <ThemedText type="small" style={styles.value}>
      {bornOn ? formatBornOnDisplay(bornOn) : NULL_CHIP}
    </ThemedText>
  );

  return (
    <View>
      {isSet && mode === 'idle' ? (
        <View style={rowStyle}>
          {label}
          {value}
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="edit"
            onPress={onEditPress}
            hitSlop={8}
            style={styles.edit}>
            <ThemedText type="small" themeColor="textSecondary">
              edit
            </ThemedText>
          </ThemedPressable>
        </View>
      ) : (
        <ThemedPressable
          accessibilityRole="button"
          accessibilityLabel="Birthday"
          accessibilityState={{ expanded: mode !== 'idle' }}
          onPress={onRowPress}
          style={rowStyle}>
          {label}
          {value}
        </ThemedPressable>
      )}

      {mode === 'confirm' ? (
        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            Are you sure you want to change your birthday?
          </ThemedText>
          <View style={styles.actions}>
            <ThemedPressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setMode('idle')}
              style={styles.action}>
              <ThemedText type="smallBold">Cancel</ThemedText>
            </ThemedPressable>
            <ThemedPressable
              accessibilityRole="button"
              accessibilityLabel="Change"
              onPress={() => openEditor(bornOn)}
              style={styles.action}>
              <ThemedText type="smallBold">Change</ThemedText>
            </ThemedPressable>
          </View>
        </View>
      ) : null}

      {mode === 'edit' ? (
        <View style={styles.body}>
          <BornOnFields
            year={year}
            month={month}
            day={day}
            onYearChange={(value) => {
              setYear(value);
              setError(null);
            }}
            onMonthChange={(value) => {
              setMonth(value);
              setError(null);
            }}
            onDayChange={(value) => {
              setDay(value);
              setError(null);
            }}
            editable={!saving}
          />
          {error ? (
            <ThemedText type="smallBold" style={{ color: '#E5484D' }}>
              {error}
            </ThemedText>
          ) : null}
          <ThemedPressable
            accessibilityRole="button"
            accessibilityLabel="Save birthday"
            onPress={() => void save()}
            disabled={saving}
            style={[styles.save, saving && styles.disabled]}>
            <ThemedText type="smallBold">{saving ? 'Saving…' : 'Save'}</ThemedText>
          </ThemedPressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  edit: {
    paddingLeft: Spacing.one,
  },
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  action: {
    paddingVertical: Spacing.one,
  },
  save: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.one,
  },
  disabled: {
    opacity: 0.6,
  },
});
