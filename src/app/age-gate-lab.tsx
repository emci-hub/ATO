/**
 * Dev age-gate preview (emci 2026-10-20, docs/under18-access.md).
 *
 * Mounts the REAL /under-18 and /confirm-age screens (Under18View,
 * ConfirmAgeView) with synthetic born_on fixtures and a fake "today". Nothing
 * here reads or writes an account: no `me` row, no birthday save, no sign-out,
 * and the Delete account sheet opens in preview mode (its final button returns
 * before the delete call). Dev builds only: the route sits in the PRE_LAUNCH_DEV group
 * of the root layout and redirects when DEV_TOOLS_AVAILABLE is off; the Hub
 * panel renders inside the `tools` branch of dev-lab.tsx.
 *
 * URL params (for screenshots): ?preset=<id>&today=YYYY-MM-DD&bare=1
 * (bare = just the screen, no control strip).
 */
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConfirmAgeView } from '@/app/confirm-age';
import { Under18View } from '@/app/under-18';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { accessDateFor, isReadableBornOn, resolveAgeGate } from '@/lib/age';
import { DEV_TOOLS_AVAILABLE } from '@/lib/dev-mode';
import { controlBorderColor } from '@/lib/theme/chrome';

type Fixture = { id: string; label: string; bornOn: string | null; today: string };

/** Synthetic accounts. None of these is a real person or a real row. */
export const AGE_GATE_FIXTURES: readonly Fixture[] = [
  { id: '17y364d', label: '17y 364d (18 tomorrow)', bornOn: '2008-10-21', today: '2026-10-20' },
  { id: 'exactly18', label: 'Exactly 18 today', bornOn: '2008-10-20', today: '2026-10-20' },
  { id: '18plus1', label: '18 and 1 day', bornOn: '2008-10-19', today: '2026-10-20' },
  { id: 'feb29-before', label: '29 Feb, 28 Feb 2026', bornOn: '2008-02-29', today: '2026-02-28' },
  { id: 'feb29-open', label: '29 Feb, 1 Mar 2026', bornOn: '2008-02-29', today: '2026-03-01' },
  { id: 'null', label: 'null born_on', bornOn: null, today: '2026-10-20' },
  { id: 'empty', label: 'empty born_on', bornOn: '', today: '2026-10-20' },
  { id: 'malformed', label: 'malformed (2008-13-45)', bornOn: '2008-13-45', today: '2026-10-20' },
  { id: 'future', label: 'future (2027-01-01)', bornOn: '2027-01-01', today: '2026-10-20' },
];

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

function ymdOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AgeGateLabScreen() {
  const params = useLocalSearchParams<{ preset?: string; today?: string; bare?: string }>();
  if (!DEV_TOOLS_AVAILABLE) return <Redirect href="/" />;
  return (
    <ThemedView style={styles.fill}>
      <AgeGatePreviewPanel
        initialPreset={typeof params.preset === 'string' ? params.preset : undefined}
        initialToday={typeof params.today === 'string' ? params.today : undefined}
        bare={params.bare === '1'}
        fullScreen
      />
    </ThemedView>
  );
}

/** Presets + fake clock + the real screen for the resulting gate state. */
export function AgeGatePreviewPanel({
  initialPreset,
  initialToday,
  bare = false,
  fullScreen = false,
}: {
  initialPreset?: string;
  initialToday?: string;
  bare?: boolean;
  fullScreen?: boolean;
}) {
  const theme = useTheme();
  const start = AGE_GATE_FIXTURES.find((f) => f.id === initialPreset) ?? AGE_GATE_FIXTURES[0];
  const [fixtureId, setFixtureId] = useState(start.id);
  const [today, setToday] = useState(
    initialToday && isReadableBornOn(initialToday) ? initialToday : start.today,
  );
  // What the confirm screen "entered" this preview session (never saved).
  const [entered, setEntered] = useState<{ bornOn: string; adult: boolean } | null>(null);

  const fixture = AGE_GATE_FIXTURES.find((f) => f.id === fixtureId) ?? AGE_GATE_FIXTURES[0];
  const todayDate = useMemo(() => dateFromYmd(today), [today]);
  const localEntry = entered && !entered.adult ? entered.bornOn : null;
  const gate = resolveAgeGate(fixture.bornOn, localEntry, todayDate);
  const enteredAdult = gate.state === 'confirm' && entered?.adult;

  function pick(next: Fixture) {
    setFixtureId(next.id);
    setToday(next.today);
    setEntered(null);
  }

  function shiftDay(delta: number) {
    const d = dateFromYmd(today);
    d.setDate(d.getDate() + delta);
    setToday(ymdOf(d));
  }

  const screen =
    gate.state === 'blocked' ? (
      <Under18View bornOn={gate.bornOn} preview />
    ) : gate.state === 'confirm' && !enteredAdult ? (
      <ConfirmAgeView
        key={`${fixture.id}:${today}`}
        today={todayDate}
        preview
        onSave={async (bornOn) => {
          setEntered({ bornOn, adult: true });
        }}
        onUnderage={(bornOn) => setEntered({ bornOn, adult: false })}
      />
    ) : (
      <View style={styles.openBox}>
        <ThemedText type="subtitle">App opens</ThemedText>
        <ThemedText themeColor="textSecondary">
          {enteredAdult
            ? `Confirmed ${entered?.bornOn} (18+). In the app the birthday is saved and the tabs open. Nothing was saved here.`
            : 'Gate state: open. In the app this account goes straight to the tabs.'}
        </ThemedText>
      </View>
    );

  if (bare) return <View style={styles.fill}>{screen}</View>;

  return (
    <View style={fullScreen ? styles.fill : undefined}>
      <View style={[styles.controls, fullScreen && styles.controlsFull]}>
        <ThemedText type="smallBold">Age gate preview — synthetic fixtures, nothing is saved</ThemedText>
        <View style={styles.chips}>
          {AGE_GATE_FIXTURES.map((f) => {
            const selected = f.id === fixture.id;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => pick(f)}
                style={[
                  styles.chip,
                  { borderColor: controlBorderColor(theme) },
                  selected && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="small">{f.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.clockRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => shiftDay(-1)} style={[styles.chip, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="small">− day</ThemedText>
          </Pressable>
          <ThemedText type="code">today {today}</ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Next day" onPress={() => shiftDay(1)} style={[styles.chip, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="small">+ day</ThemedText>
          </Pressable>
        </View>
        <ThemedText type="code" themeColor="textSecondary">
          born_on {fixture.bornOn === null ? 'null' : JSON.stringify(fixture.bornOn)} → {gate.state}
          {gate.state === 'blocked' && gate.bornOn ? ` · back on ${accessDateFor(gate.bornOn)}` : ''}
          {localEntry ? ' (entered on confirm, memory only)' : ''}
        </ThemedText>
      </View>
      <View
        style={[
          fullScreen ? styles.fill : styles.embedded,
          { borderColor: controlBorderColor(theme) },
        ]}>
        {screen}
      </View>
      {fullScreen ? null : (
        <Pressable accessibilityRole="link" onPress={() => router.push('/age-gate-lab')} style={styles.openFull}>
          <ThemedText type="link">Open full screen</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  controls: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  controlsFull: {
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  embedded: {
    height: 640,
    borderWidth: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  openBox: {
    flex: 1,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  openFull: {
    paddingVertical: Spacing.two,
  },
});
