import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DAILY_LINES } from '@/lib/daily-line/bank';
import { clearLeans, eligibleLines, pickDailyLine, type LineDay } from '@/lib/daily-line/pick';
import { clearDailyLineState, loadDailyLineState } from '@/lib/daily-line/state';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { addDaysYmd, localYmd } from '@/lib/local-date';
import { controlBorderColor } from '@/lib/theme/chrome';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

const PREVIEW_DAYS = 7;

interface Preview {
  ymd: string;
  text: string;
  keys: string;
  source: 'shown' | 'planned' | 'would pick';
}

/**
 * Dev Tools Hub: see what the daily line picker will do for this account
 * without waiting a week. The preview is read-only. "Clear" wipes only this
 * phone's line history (which lines were shown, the taps, the planned
 * mornings) and takes two taps.
 */
export function DailyLineDev({ userId, timeZone }: { userId: string; timeZone: string }) {
  const theme = useTheme();
  const [rows, setRows] = useState<Preview[] | null>(null);
  const [summary, setSummary] = useState('');
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [tracks, state] = await Promise.all([fetchTraitTracks(userId), loadDailyLineState(userId)]);
      const leans = clearLeans(tracks);
      const today = localYmd(new Date(), timeZone);
      const history: LineDay[] = [
        ...state.days,
        ...Object.entries(state.planned).map(([ymd, id]) => ({ ymd, id })),
      ];
      const out: Preview[] = [];
      for (let i = 0; i < PREVIEW_DAYS; i += 1) {
        const ymd = addDaysYmd(today, i);
        const shown = state.days.find((day) => day.ymd === ymd);
        const plannedId = state.planned[ymd];
        const known = DAILY_LINES.find((line) => line.id === (shown?.id ?? plannedId));
        const line = known ?? pickDailyLine({ userId, ymd, leans, history });
        if (!known) history.push({ ymd, id: line.id });
        out.push({
          ymd,
          text: line.text,
          keys: line.keys.length > 0 ? line.keys.join(' + ') : 'starter',
          source: shown ? 'shown' : plannedId && known ? 'planned' : 'would pick',
        });
      }
      setRows(out);
      setSummary(
        `${leans.length} clear leans · ${eligibleLines(leans).length} of ${DAILY_LINES.length} lines fit this account · ${state.days.length} days of history`,
      );
    } catch (err) {
      console.log('[daily-line-dev] load error:', err);
      setNote('Couldn’t load.');
    }
  }, [userId, timeZone]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!PRE_LAUNCH_DEV) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">Daily line — next {PREVIEW_DAYS} days</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        What Home and the morning push will say for this account. Read-only. {summary}
      </ThemedText>
      {(rows ?? []).map((row) => (
        <View key={row.ymd} style={styles.row}>
          <ThemedText type="code" themeColor="textSecondary">
            {row.ymd} · {row.source} · {row.keys}
          </ThemedText>
          <ThemedText type="small">{row.text}</ThemedText>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (!armed) {
            setArmed(true);
            setNote('Tap again to clear this phone’s line history.');
            return;
          }
          setArmed(false);
          void clearDailyLineState().then(() => {
            setNote('Cleared. Reopen Home for a fresh pick.');
            void load();
          });
        }}
        style={({ pressed }) => [
          styles.button,
          { borderColor: controlBorderColor(theme) },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">{armed ? 'Tap again to clear' : 'Clear line history (this phone)'}</ThemedText>
      </Pressable>
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.half,
  },
  button: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
