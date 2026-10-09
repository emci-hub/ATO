/**
 * Dev Hub → AI → AI library (root, PRE_LAUNCH_DEV only: mounted inside the
 * `tools` branch of dev-lab.tsx). The shared AI library (wave93):
 *
 *   - counts per kind: live cards, buckets, waiting for review, retired, and
 *     today's free library cards vs. newly written ones (the hit rate);
 *   - newest cards (waiting first): Approve (skips the 24-hour cooling period)
 *     or Retire, two taps each;
 *   - coverage (wave94): how far the library is from needing the paid AI —
 *     deep-dive groups ready, groups readers are waiting on, people who would
 *     hit the paid AI today, the typical reader's free cards waiting, today's
 *     automatic fill vs. paid AI cards, groups skipped after failures;
 *   - "Fill the deep-dive library": the server writes cards for the thinnest
 *     deep-dive buckets (up to 3 per bucket, 2 per call), as approved seed cards,
 *     on its own root cap (library_seed_daily_cap). Two taps; stops on the cap.
 *
 * Every write is checked on the server (require_root). Nothing here sends text.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { writeLibraryCard } from '@/lib/ai-library/client';
import { DEEP_DIVE_LIBRARY, allDiveBuckets } from '@/lib/ai-library/deep-dive';
import { LIBRARY_KINDS, LIBRARY_VERSION } from '@/lib/ai-library/types';
import { CATEGORY_DEFS } from '@/lib/categories';
import { useMeContext } from '@/lib/me-context';
import { supabase } from '@/lib/supabase';

/** Cards a bucket should hold before the seed run moves on. */
export const SEED_TARGET_PER_BUCKET = 3;
/** AI calls one tap of "Fill" makes at most. */
export const SEED_CALLS_PER_TAP = 20;

type Coverage = {
  deep_dive_counts?: Record<string, number>;
  wanted?: Record<string, { groups: number; ready: number; queued: number }>;
  people?: number;
  people_need_ai?: number;
  typical_waiting?: number | null;
  versions?: Record<string, number>;
  today?: { fill_calls: number; fill_cards: number; fill_cap: number; free_served: number; tap_ai: number; skipped: number };
};

const ALL_DIVE_BUCKETS = CATEGORY_DEFS.flatMap((def) => allDiveBuckets(def.id));

function Bar({ value, total }: { value: number; total: number }) {
  const theme = useTheme();
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
    </View>
  );
}

type Row = {
  id: string;
  kind: string;
  bucket_key: string;
  card: Record<string, unknown>;
  approved: boolean;
  served_count: number;
  report_count: number;
  retired: boolean;
};

function preview(card: Record<string, unknown>): string {
  const pick = ['title', 'whatItMeansForYou', 'scene', 'means'].map((k) => card[k]).find((v) => typeof v === 'string');
  return typeof pick === 'string' ? pick.slice(0, 160) : '(no text)';
}

export function AiLibraryDev() {
  const theme = useTheme();
  const { devAccess } = useMeContext();
  const [stats, setStats] = useState<Record<string, Record<string, number>> | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [s, list, cov] = await Promise.all([
      supabase.rpc('library_stats'),
      supabase.rpc('library_admin_list', { p_kind: null, p_limit: 15, p_pending_only: false }),
      supabase.rpc('library_coverage'),
    ]);
    setCoverage(cov.error ? null : ((cov.data as Coverage | null) ?? null));
    if (s.error) {
      setNote(`Not loaded: ${s.error.message}`);
      return;
    }
    setStats((s.data as Record<string, Record<string, number>>) ?? {});
    const data = (list.data as Row[] | null) ?? [];
    // Waiting for review first, then newest.
    setRows([...data].sort((a, b) => Number(a.approved || a.retired) - Number(b.approved || b.retired)));
  }, []);

  useEffect(() => {
    if (devAccess.isRoot) void load();
  }, [devAccess.isRoot, load]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Two taps: the first arms `id` for 5 seconds. */
  const confirm = (id: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (armed === id) {
      setArmed(null);
      return true;
    }
    setArmed(id);
    timer.current = setTimeout(() => setArmed((cur) => (cur === id ? null : cur)), 5000);
    return false;
  };

  const act = async (row: Row, action: 'approve' | 'retire') => {
    if (!confirm(`${action}:${row.id}`)) return;
    const res =
      action === 'approve'
        ? await supabase.rpc('library_approve', { p_card_id: row.id })
        : await supabase.rpc('library_retire', { p_card_id: row.id, p_reason: 'root' });
    setNote(res.error ? `Not done: ${res.error.message}` : action === 'approve' ? 'Approved.' : 'Retired.');
    void load();
  };

  const fill = async () => {
    if (filling || !confirm('fill')) return;
    setFilling(true);
    setNote('Filling…');
    try {
      const counts = await supabase.rpc('library_bucket_counts', { p_kind: 'deep_dive', p_version: LIBRARY_VERSION.deep_dive });
      if (counts.error) {
        setNote(`Not started: ${counts.error.message}`);
        return;
      }
      const have = (counts.data as Record<string, number> | null) ?? {};
      const thin = CATEGORY_DEFS.flatMap((def) => allDiveBuckets(def.id))
        .map((bucket) => ({ bucket, n: have[bucket] ?? 0 }))
        .filter((row) => row.n < SEED_TARGET_PER_BUCKET)
        .sort((a, b) => a.n - b.n);
      let calls = 0;
      let written = 0;
      for (const row of thin) {
        if (calls >= SEED_CALLS_PER_TAP) break;
        calls += 1;
        const res = await writeLibraryCard('deep_dive', row.bucket, 'seed', DEEP_DIVE_LIBRARY.readCard);
        if (!res.ok && (res.reason === 'quota' || res.reason === 'missing' || res.reason === 'consent')) {
          setNote(`Stopped: ${res.reason}. ${written} cards written.`);
          return;
        }
        if (res.ok) written += res.written;
        setNote(`Filling… ${calls} calls, ${written} cards`);
      }
      setNote(`${written} cards written in ${calls} calls. ${Math.max(thin.length - calls, 0)} thin buckets left.`);
    } finally {
      setFilling(false);
      void load();
    }
  };

  if (!devAccess.isRoot) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Root only.
      </ThemedText>
    );
  }

  const diveCounts = coverage?.deep_dive_counts ?? {};
  const diveReady = ALL_DIVE_BUCKETS.filter((b) => (diveCounts[`${b}#${LIBRARY_VERSION.deep_dive}`] ?? 0) >= SEED_TARGET_PER_BUCKET).length;
  const oldCards = Object.entries(coverage?.versions ?? {})
    .filter(([key]) => {
      const [kind, version] = key.split('#');
      return !(LIBRARY_KINDS as readonly string[]).includes(kind ?? '') || LIBRARY_VERSION[kind as (typeof LIBRARY_KINDS)[number]] !== version;
    })
    .reduce((sum, [, n]) => sum + n, 0);
  const t = coverage?.today;

  return (
    <View style={styles.wrap}>
      {coverage ? (
        <View style={styles.coverage}>
          <ThemedText type="smallBold">Coverage: how far from needing the paid AI</ThemedText>
          <ThemedText type="small">
            Deep dives: {diveReady} of {ALL_DIVE_BUCKETS.length} groups ready ({SEED_TARGET_PER_BUCKET}+ cards)
          </ThemedText>
          <Bar value={diveReady} total={ALL_DIVE_BUCKETS.length} />
          {Object.entries(coverage.wanted ?? {}).map(([kind, w]) => (
            <View key={kind} style={styles.coverage}>
              <ThemedText type="small">
                {kind}: {w.ready} of {w.groups} groups people need are ready · {w.queued} in the queue
              </ThemedText>
              <Bar value={w.ready} total={w.groups} />
            </View>
          ))}
          <ThemedText type="small">
            People who’d hit the paid AI today: {coverage.people_need_ai ?? 0} of {coverage.people ?? 0} active
          </ThemedText>
          <ThemedText type="small">
            Typical reader: {coverage.typical_waiting != null ? Math.round(coverage.typical_waiting) : 0} free cards waiting
          </ThemedText>
          {t ? (
            <ThemedText type="small">
              Today: fill {t.fill_calls}/{t.fill_cap} calls, {t.fill_cards} cards · {t.free_served} free cards served · {t.tap_ai} written on a tap (paid or free reveal) ·{' '}
              {t.skipped} groups skipped after failures
            </ThemedText>
          ) : null}
          {oldCards > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {oldCards} live cards are on an old prompt version (not served).
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {stats
        ? Object.entries(stats).map(([kind, s]) => (
            <ThemedText key={kind} type="small">
              {kind}: {s.cards ?? 0} cards in {s.buckets ?? 0} buckets · {s.waiting ?? 0} waiting · {s.retired ?? 0} retired ·
              today {s.served_free_today ?? 0} free from the library, {s.written_today ?? 0} newly written
            </ThemedText>
          ))
        : null}

      <Pressable
        onPress={() => void fill()}
        disabled={filling}
        accessibilityRole="button"
        accessibilityLabel={armed === 'fill' ? 'Tap again to fill the deep-dive library' : 'Fill the deep-dive library'}
        style={({ pressed }) => [styles.button, { borderColor: armed === 'fill' ? theme.accent : theme.border }, pressed && styles.pressed]}>
        <ThemedText type="smallBold">
          {armed === 'fill' ? 'Tap again to confirm' : `Fill the deep-dive library (up to ${SEED_CALLS_PER_TAP} AI calls)`}
        </ThemedText>
      </Pressable>

      {rows.map((row) => (
        <View key={row.id} style={[styles.row, { borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {row.kind} · {row.retired ? 'retired' : row.approved ? 'approved' : 'waiting'} · shown {row.served_count} · reports{' '}
            {row.report_count}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {row.bucket_key}
          </ThemedText>
          <ThemedText type="small">{preview(row.card)}</ThemedText>
          {row.retired ? null : (
            <View style={styles.actions}>
              {row.approved ? null : (
                <Pressable onPress={() => void act(row, 'approve')} accessibilityRole="button" style={styles.action}>
                  <ThemedText type="smallBold">{armed === `approve:${row.id}` ? 'Tap again' : 'Approve'}</ThemedText>
                </Pressable>
              )}
              <Pressable onPress={() => void act(row, 'retire')} accessibilityRole="button" style={styles.action}>
                <ThemedText type="smallBold">{armed === `retire:${row.id}` ? 'Tap again' : 'Retire'}</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      ))}
      {note ? <ThemedText type="small">{note}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  coverage: { gap: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: Spacing.two, alignItems: 'center' },
  row: { borderWidth: 1, borderRadius: 10, padding: Spacing.two, gap: 4 },
  actions: { flexDirection: 'row', gap: Spacing.three },
  action: { paddingVertical: 6 },
  pressed: { opacity: 0.7 },
});
