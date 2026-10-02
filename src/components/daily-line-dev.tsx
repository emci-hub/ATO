import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BANK_IS_LOADED, DAILY_LINES, allLines, dailyLineById } from '@/lib/daily-line/bank';
import { clearLeans, eligibleLines, pickDailyLine, type LineDay } from '@/lib/daily-line/pick';
import { clearMyDailyLinesRemote } from '@/lib/daily-line/pool-store';
import { clearDailyLineState, loadDailyLineState } from '@/lib/daily-line/state';
import { loadAiLineLog, pullDailyLines, type AiLineLog } from '@/lib/daily-line/sync';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { addDaysYmd, localYmd } from '@/lib/local-date';
import { controlBorderColor } from '@/lib/theme/chrome';
import { withTimeout } from '@/lib/timeout';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

const PREVIEW_DAYS = 7;

interface Preview {
  ymd: string;
  text: string;
  keys: string;
  source: 'shown' | 'planned' | 'would pick';
  ai: boolean;
}

/**
 * Dev Tools Hub: see what the daily line picker will do for this account
 * without waiting a week, and see exactly what the model wrote the last time
 * an insight was loaded — which lines were kept and which were thrown out, and
 * why. The preview is read-only. "Clear" wipes this account's line history on
 * this phone and in the database (own rows only) and takes two taps.
 */
export function DailyLineDev({ userId, timeZone }: { userId: string; timeZone: string }) {
  const theme = useTheme();
  const [rows, setRows] = useState<Preview[] | null>(null);
  const [summary, setSummary] = useState('');
  const [aiLog, setAiLog] = useState<AiLineLog | null>(null);
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const today = localYmd(new Date(), timeZone);
      // Best effort: the preview still works from the phone's copy if this fails.
      const pulled = await withTimeout(pullDailyLines(userId, today), 4000, 'daily-line-dev-pull').then(
        () => true,
        () => false,
      );
      const [tracks, state, log] = await Promise.all([
        fetchTraitTracks(userId),
        loadDailyLineState(userId),
        loadAiLineLog(userId),
      ]);
      const leans = clearLeans(tracks);
      const history: LineDay[] = [
        ...state.days,
        ...Object.entries(state.planned).map(([ymd, id]) => ({ ymd, id })),
      ];
      const out: Preview[] = [];
      for (let i = 0; i < PREVIEW_DAYS; i += 1) {
        const ymd = addDaysYmd(today, i);
        const shown = state.days.find((day) => day.ymd === ymd);
        const plannedId = state.planned[ymd];
        const known = dailyLineById(shown?.id ?? plannedId ?? '');
        const line = known ?? pickDailyLine({ userId, ymd, leans, history });
        if (!known) history.push({ ymd, id: line.id });
        out.push({
          ymd,
          text: line.text,
          keys: line.keys.length > 0 ? line.keys.join(' + ') : 'starter',
          source: shown ? 'shown' : plannedId && known ? 'planned' : 'would pick',
          ai: line.source === 'ai',
        });
      }
      const all = allLines();
      setRows(out);
      setAiLog(log);
      setSummary(
        [
          BANK_IS_LOADED ? `${DAILY_LINES.length} picked lines shipped` : `${DAILY_LINES.length} first-draft lines shipped (no winners loaded yet)`,
          `${all.filter((line) => line.source === 'ai').length} AI lines of your own`,
          `${leans.length} clear leans`,
          `${eligibleLines(leans).length} of ${all.length} lines fit this account`,
          `${state.days.length} days of history`,
          pulled ? 'database in sync' : 'database not reached (using this phone’s copy)',
        ].join(' · '),
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
            {row.ai ? ' · AI' : ''}
          </ThemedText>
          <ThemedText type="small">{row.text}</ThemedText>
        </View>
      ))}

      <ThemedText type="smallBold">Last AI top-up</ThemedText>
      {aiLog ? (
        <View style={styles.row}>
          <ThemedText type="code" themeColor="textSecondary">
            {aiLog.at.slice(0, 16).replace('T', ' ')} · kept {aiLog.kept.length} · dropped {aiLog.dropped.length}
          </ThemedText>
          {aiLog.kept.map((line) => (
            <ThemedText key={line.text} type="small">
              ✓ {line.text} ({line.tag})
            </ThemedText>
          ))}
          {aiLog.dropped.map((line) => (
            <ThemedText key={line.text} type="small" themeColor="textSecondary">
              ✗ {line.text} — {line.reason}
            </ThemedText>
          ))}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          None yet. Load an insight on Home; the same AI call writes a few lines for this account.
        </ThemedText>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (!armed) {
            setArmed(true);
            setNote('Tap again to clear this account’s line history, here and in the database.');
            return;
          }
          setArmed(false);
          void Promise.all([
            clearDailyLineState(),
            clearMyDailyLinesRemote().catch((err) => {
              console.log('[daily-line-dev] remote clear skipped:', err);
              return 0;
            }),
          ]).then(() => {
            setNote('Cleared. Reopen Home for a fresh pick.');
            void load();
          });
        }}
        style={({ pressed }) => [
          styles.button,
          { borderColor: controlBorderColor(theme) },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">{armed ? 'Tap again to clear' : 'Clear my line history'}</ThemedText>
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
