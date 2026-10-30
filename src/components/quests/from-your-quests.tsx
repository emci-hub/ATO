import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { questApplier } from '@/lib/quests/apply';
import { QUEST_ERROR_COPY, UI_COPY, fmt } from '@/lib/quests/strings';
import type { TraitAxis } from '@/lib/traits';

/** Undo is offered for 24 hours after Apply (the server enforces it too). */
const UNDO_MS = 24 * 60 * 60 * 1000;

interface Row {
  runId: string;
  axes: TraitAxis[];
  at: string;
}

/** Newest first; a stamp that cannot be read as a date is left out. */
export function appliedRows(runs: Record<string, { axes: TraitAxis[]; at: string }>): Row[] {
  return Object.entries(runs)
    .filter(([, r]) => Array.isArray(r.axes) && r.axes.length > 0 && Number.isFinite(Date.parse(r.at)))
    .map(([runId, r]) => ({ runId, axes: r.axes, at: r.at }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export const undoOpen = (at: string, nowMs: number): boolean => nowMs - Date.parse(at) < UNDO_MS;

/**
 * "From your quests" on You (PHASE-23): what stories added to the profile, with the
 * date, and Undo for 24 hours. The caller renders this only while Quests is on.
 * Stamps live on the phone (apply.ts), so a signed-out or new phone shows the empty line.
 */
export function FromYourQuests({ onUndone }: { onUndone?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(appliedRows(await questApplier.appliedRuns()));
    } catch {
      setRows([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const undo = async (row: Row) => {
    if (busy) return;
    setBusy(row.runId);
    setMessage(null);
    try {
      const out = await questApplier.undo(row.runId);
      if (out.status === 'undone') {
        setMessage(UI_COPY.saidUndone);
        onUndone?.();
      } else {
        setMessage(QUEST_ERROR_COPY[out.code]);
      }
    } catch {
      setMessage(QUEST_ERROR_COPY.unknown);
    } finally {
      setBusy(null);
    }
    await load();
  };

  const now = Date.now();
  return (
    <ThemedView type="backgroundElement" style={styles.card} testID="from-your-quests">
      <ThemedText type="smallBold" accessibilityRole="header">
        {UI_COPY.fromTitle}
      </ThemedText>
      {rows !== null && rows.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {UI_COPY.fromEmpty}
        </ThemedText>
      ) : null}
      {(rows ?? []).map((row) => {
        const names = row.axes.map((a) => AXIS_SHORT_NAME[a] ?? a).join(', ');
        const date = new Date(row.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        return (
          <View key={row.runId} style={styles.row}>
            <ThemedText type="small" style={styles.rowText}>
              {fmt(UI_COPY.fromRow, { axes: names, date })}
            </ThemedText>
            {undoOpen(row.at, now) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fmt(UI_COPY.fromUndoLabel, { axes: names })}
                accessibilityHint={UI_COPY.saidUndoHint}
                disabled={busy !== null}
                onPress={() => void undo(row)}
                style={({ pressed }) => [styles.undo, pressed && styles.pressed]}>
                <ThemedText type="smallBold">{busy === row.runId ? UI_COPY.fromWorking : UI_COPY.saidUndo}</ThemedText>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowText: { flex: 1 },
  undo: { minHeight: 44, minWidth: 44, paddingHorizontal: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
