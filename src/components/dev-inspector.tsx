/**
 * Dev Inspector — one read-only panel that SHOWS how the app is working for the
 * signed-in account:
 *
 *   1. Your 16 axes      points, LOW / MID / HIGH, answers, settled or not, and
 *                        the last few answer values that moved each one.
 *   2. Categories        each category's result, and the axes (with their
 *                        points) that feed it — or what it still needs.
 *   3. AI gates          what every AI call needs (a tap, a finished profile,
 *                        consent, a call left today) and whether each passes.
 *   4. Question pool     where the current round's questions came from (shared
 *                        bank or written by AI), and how much bank is left.
 *
 * It only READS: the profile row, trait_tracks, trait_history, ai_usage, the
 * latest round and the pool depth. No model call, no write. Shown in the Dev
 * Tools Hub and in the floating DEV bubble on every app screen.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AI_GATE_FEATURES,
  BAND_CUTS,
  aiGates,
  axisLine,
  inspectAxes,
  inspectCategories,
  roundItemFrom,
  roundSummary,
  type RoundItemInspect,
} from '@/lib/dev-inspector-model';
import { isFullProfileDone } from '@/lib/full-profile-gate';
import { aiConsentFor } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { fetchBankProgress } from '@/lib/questions/bank-sets-server';
import { supabase } from '@/lib/supabase';
import type { TraitHistoryRow } from '@/lib/trait-history';
import { fetchTraitHistory } from '@/lib/trait-history-store';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { TRAIT_AXES, traitStateFromRow, type TraitAxis } from '@/lib/traits';
import type { SageUsageSnapshot } from '@/lib/voice/quota';
import { fetchSageUsage } from '@/lib/voice/quota-server';

type SectionId = 'axes' | 'categories' | 'gates' | 'pool';
const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'axes', title: '1 · Your 16 axes' },
  { id: 'categories', title: '2 · Categories and what feeds them' },
  { id: 'gates', title: '3 · AI gates' },
  { id: 'pool', title: '4 · Question pool' },
];

type Loaded = {
  tracks: TraitTrack[];
  history: TraitHistoryRow[];
  usage: SageUsageSnapshot | null;
  round: RoundItemInspect[] | null;
  /** True when the round could not be READ (not the same as having no round). */
  roundFailed: boolean;
  depth: Partial<Record<TraitAxis, number>> | null;
};

/** The latest round with where each question came from. Null = no round yet. */
async function loadLatestRound(): Promise<RoundItemInspect[] | null> {
  const { data: pack, error } = await supabase
    .from('question_packs')
    .select('id')
    .eq('kind', 'ongoing_round')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pack) return null;
  const { data: items, error: itemsError } = await supabase
    .from('question_items')
    .select('axis, prompt, answered_option, question_bank_item_id, sort_index')
    .eq('pack_id', pack.id)
    .order('sort_index', { ascending: true });
  if (itemsError) throw itemsError;
  const ids = (items ?? []).map((i) => i.question_bank_item_id).filter((id): id is string => typeof id === 'string');
  const sourceById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: pool, error: poolError } = await supabase.from('question_bank_pool').select('id, source').in('id', ids);
    if (poolError) throw poolError;
    for (const row of pool ?? []) sourceById.set(String(row.id), String(row.source));
  }
  return (items ?? []).map((i) => ({
    axis: String(i.axis),
    prompt: String(i.prompt ?? ''),
    answered: i.answered_option != null,
    from: roundItemFrom(
      typeof i.question_bank_item_id === 'string' ? sourceById.get(i.question_bank_item_id) : null,
      typeof i.question_bank_item_id === 'string',
    ),
  }));
}

export function DevInspector() {
  const theme = useTheme();
  const { me } = useMeContext();
  const [open, setOpen] = useState<Record<SectionId, boolean>>({ axes: true, categories: false, gates: false, pool: false });
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const userId = me?.id;

  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      // Each part is allowed to fail by itself, so one bad read never blanks the panel.
      let roundFailed = false;
      const [tracks, history, usage, round, depth] = await Promise.all([
        fetchTraitTracks(userId),
        fetchTraitHistory(userId).catch(() => [] as TraitHistoryRow[]),
        fetchSageUsage().catch(() => null),
        loadLatestRound().catch(() => {
          roundFailed = true;
          return null;
        }),
        fetchBankProgress()
          .then((p) => p.answeredByAxis as Partial<Record<TraitAxis, number>>)
          .catch(() => null),
      ]);
      setData({ tracks, history, usage, round, roundFailed, depth });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the inspector.');
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me) return null;

  const line = { borderColor: theme.textSecondary };
  const tracks = data?.tracks ?? [];
  const axes = data ? inspectAxes(traitStateFromRow(me), tracks, data.history) : [];
  const categories = data ? inspectCategories(tracks) : [];
  const gates = aiGates({
    consent: aiConsentFor(me),
    profileDone: isFullProfileDone(tracks, data != null),
    usedToday: data?.usage ? data.usage.daily : null,
    dailyCap: data?.usage ? data.usage.dailyCap : null,
    usedMonth: data?.usage ? data.usage.monthly : null,
    monthlyCap: data?.usage ? data.usage.monthlyCap : null,
  });
  const settled = axes.filter((a) => a.settled).length;

  const body: Record<SectionId, React.ReactNode> = {
    axes: (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          Points run 0 to 100. Under {BAND_CUTS.low} is LOW, over {BAND_CUTS.high} is HIGH, between is MID. Each answer moves
          the points part of the way toward that answer. Settled means categories and the insight will use it.{' '}
          {settled} of {TRAIT_AXES.length} settled.
        </ThemedText>
        {axes.map((a) => (
          <View key={a.axis} style={styles.item}>
            <ThemedText type="smallBold">{a.name}</ThemedText>
            <ThemedText type="small">{axisLine(a)}</ThemedText>
            {a.points != null ? (
              <ThemedText type="small" themeColor="textSecondary">
                {a.origin}
                {a.recent.length > 0 ? ` · score after each recent answer: ${a.recent.join(' → ')}` : ''}
              </ThemedText>
            ) : null}
          </View>
        ))}
      </>
    ),
    categories: (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          A category only uses SETTLED axes. A bar averages them; a map plots two against each other.
        </ThemedText>
        {categories.map((c) => (
          <View key={c.id} style={styles.item}>
            <ThemedText type="smallBold">
              {c.ready ? '🟢' : '⚪'} {c.name}
            </ThemedText>
            <ThemedText type="small">{c.needs ?? c.result}</ThemedText>
            {c.axes.map((x) => (
              <ThemedText key={x.axis} type="small" themeColor="textSecondary">
                {x.used ? '✓' : '·'} {x.name}: {x.points == null ? 'not answered' : `${x.points} pts`}
                {x.used ? '' : ' (not settled, not counted)'}
              </ThemedText>
            ))}
          </View>
        ))}
      </>
    ),
    gates: (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          Every AI call needs all four. The last two are checked again on the server, so the app cannot skip them.
        </ThemedText>
        {gates.map((g) => (
          <View key={g.label} style={styles.item}>
            <ThemedText type="smallBold">
              {g.pass ? '🟢' : '🔴'} {g.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {g.detail}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="smallBold">What starts each one</ThemedText>
        {AI_GATE_FEATURES.map((f) => (
          <ThemedText key={f.feature} type="small" themeColor="textSecondary">
            {f.feature}: {f.starts}. Extra limit: {f.extra}.
          </ThemedText>
        ))}
      </>
    ),
    pool: (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          A round of 16 takes from the shared bank first. AI writes only what the bank cannot fill.
        </ThemedText>
        {data?.round ? (
          <>
            <ThemedText type="smallBold">Latest round: {roundSummary(data.round)}</ThemedText>
            {data.round.map((q, i) => (
              <ThemedText key={`${i}-${q.axis}`} type="small" themeColor="textSecondary" numberOfLines={2}>
                {q.answered ? '✓' : '·'} [{q.from}] {q.axis}: {q.prompt}
              </ThemedText>
            ))}
          </>
        ) : (
          <ThemedText type="small">
            {data?.roundFailed ? 'Could not read the latest round.' : 'No round yet on this account.'}
          </ThemedText>
        )}
        <ThemedText type="smallBold">Bank questions answered, per axis (of 25)</ThemedText>
        {data?.depth ? (
          <ThemedText type="small" themeColor="textSecondary">
            {TRAIT_AXES.map((axis) => `${axis} ${data.depth?.[axis] ?? 0}`).join(' · ')}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Could not read the bank progress.
          </ThemedText>
        )}
      </>
    ),
  };

  return (
    <View style={styles.wrap} testID="dev-inspector">
      <View style={styles.head}>
        <ThemedText type="smallBold">Inspector{me.handle ? ` · @${me.handle}` : ''}</ThemedText>
        <Pressable onPress={() => void load()} disabled={busy} accessibilityRole="button" hitSlop={8}>
          <ThemedText type="link">{busy ? 'Loading…' : 'Refresh'}</ThemedText>
        </Pressable>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Read-only. Shows this account&apos;s real data. It makes no AI call.
      </ThemedText>
      {error ? <ThemedText type="small">{error}</ThemedText> : null}
      {SECTIONS.map((s) => (
        <View key={s.id}>
          <Pressable
            onPress={() => setOpen((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
            accessibilityRole="button"
            accessibilityState={{ expanded: open[s.id] }}
            style={({ pressed }) => [styles.header, line, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{s.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {open[s.id] ? '⌄' : '›'}
            </ThemedText>
          </Pressable>
          {open[s.id] ? <View style={styles.body}>{data ? body[s.id] : <ThemedText type="small">Loading…</ThemedText>}</View> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  body: { gap: Spacing.two, paddingTop: Spacing.two, paddingHorizontal: Spacing.one },
  item: { gap: 2 },
  pressed: { opacity: 0.75 },
});
