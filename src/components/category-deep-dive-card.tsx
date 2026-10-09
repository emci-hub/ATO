/**
 * Home — the category deep dive (emci, 2026-10-08).
 *
 * Pick a category → your leanings in it ("Adventurous 78%", worked out on the
 * phone, no AI) → "Write my deep dive" runs the ONE model call
 * (`writeCategoryDeepDive`: consent, then the server's daily claim, then the
 * call). One new card a day; a saved card opens free. Nothing here calls a
 * model on mount (`check:no-auto-ai` lists this file).
 *
 * Separate from the daily insight above it, which stays stored copy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AiBadge } from '@/components/ai-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { AI_TAP_TIMEOUT_MS } from '@/lib/ai/generate';
import { codeForAxis } from '@/lib/axis-codes';
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { readCategory, type CategoryDef } from '@/lib/categories';
import { useCategoryDefs } from '@/lib/category-catalog';
import { categoryAxisCodes, categoryDisplayName } from '@/lib/category-labels';
import { categoryLeans, categoryScore, leanLabel, leansKey, type DiveLean } from '@/lib/category-deep-dive/dive';
import { writeCategoryDeepDive } from '@/lib/category-deep-dive/generate';
import {
  diveDay,
  fetchServerDives,
  loadDiveState,
  madeToday,
  mergeDives,
  saveDiveState,
  saveServerDive,
  type DiveEntry,
  type DiveLocalState,
} from '@/lib/category-deep-dive/store';
import { titleCase } from '@/lib/legend-figures/story';
import type { TraitTrack } from '@/lib/trait-stability';
import { withTimeout } from '@/lib/timeout';

export const DEEP_DIVE_KICKER = 'Deep dive';
export const DEEP_DIVE_LEDE = 'How far you lean in each part of you. Tap one and Sage writes a deep dive about it.';
export const DEEP_DIVE_LEGEND =
  'One number for each part of you: how strongly you lean overall, counting your surest answers most (strongest first). Tap for each trait. The small letters are the traits behind it.';
export const DEEP_DIVE_ROW_LOCKED = 'Answer more questions to open this one.';
export const DEEP_DIVE_WRITE_LABEL = 'Write my deep dive';
export const DEEP_DIVE_DONE_TODAY = 'You’ve had today’s deep dive. Come back tomorrow for another.';
export const DEEP_DIVE_USED = 'No deep dive left today. Come back tomorrow.';
export const DEEP_DIVE_FAILED = 'Sage couldn’t write this one just now. Try again tomorrow.';
export const DEEP_DIVE_UNAVAILABLE = 'Deep dives aren’t switched on yet. Your leanings show either way.';
export const DEEP_DIVE_SLOW = 'Taking a little longer than usual. It will appear here when it’s ready.';
export const DEEP_DIVE_AI_OFF = 'Turn on AI on You to get the written deep dive. Your leanings show either way.';
export const DEEP_DIVE_STALE = 'Written before your answers moved. A fresh one is ready to write.';
export const DEEP_DIVE_PCT_NOTE = '50% is the middle; 100% is all the way to that side.';

export function CategoryDeepDiveCard({
  userId,
  tracks,
  consentGranted,
}: {
  userId: string;
  tracks: readonly TraitTrack[];
  consentGranted: boolean;
}) {
  const theme = useTheme();
  const defs = useCategoryDefs();
  const epoch = useAccountDataEpoch();
  const [state, setState] = useState<DiveLocalState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  /** One write at a time: a double tap must not pay twice. */
  const writingRef = useRef(false);
  const stateRef = useRef<DiveLocalState | null>(null);
  const epochRef = useRef(epoch);

  const readyIds = useMemo(
    () => new Set(defs.filter((row) => readCategory(row, tracks).ready).map((row) => row.id)),
    [defs, tracks],
  );

  useEffect(() => {
    epochRef.current = epoch;
    let live = true;
    stateRef.current = null;
    setState(null);
    setNote(null);
    void (async () => {
      const [local, server] = await Promise.all([loadDiveState(userId), fetchServerDives()]);
      if (!live || epochRef.current !== epoch) return;
      // A card written meanwhile is already in stateRef: keep it.
      const next: DiveLocalState = {
        userId,
        dives: mergeDives(server ?? [], { ...local.dives, ...(stateRef.current?.dives ?? {}) }),
      };
      stateRef.current = next;
      setState(next);
    })();
    return () => {
      live = false;
    };
  }, [userId, epoch]);

  // One number per category, strongest first; locked ones last (catalog order otherwise).
  const rows = useMemo(
    () =>
      defs
        .map((row, index) => {
          const open = readyIds.has(row.id);
          const rowLeans = open ? categoryLeans(row, tracks) : [];
          return { def: row, index, open, rowLeans, score: categoryScore(rowLeans) };
        })
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.index - b.index),
    [defs, readyIds, tracks],
  );
  const def: CategoryDef | null = defs.find((row) => row.id === selected && readyIds.has(row.id)) ?? null;
  const leans: DiveLean[] = useMemo(() => (def ? categoryLeans(def, tracks) : []), [def, tracks]);
  const key = leansKey(leans);
  const entry: DiveEntry | null = def && state ? state.dives[def.id] ?? null : null;
  const fresh = entry != null && entry.dive.leansKey === key;
  const usedToday = state ? madeToday(state.dives, diveDay()) : false;

  const write = useCallback(async () => {
    if (!def || writingRef.current || leans.length === 0) return;
    writingRef.current = true;
    setBusy(true);
    setNote(null);
    const epochAtStart = epochRef.current;
    try {
      // The day's claim is spent once the call starts, so a slow answer is
      // waited for (with a note), never thrown away.
      const pending = writeCategoryDeepDive({ def, leans, consentGranted }).catch(
        () => ({ ok: false, reason: 'failed' }) as const,
      );
      let outcome = await withTimeout(pending, AI_TAP_TIMEOUT_MS, 'deep-dive').catch(() => null);
      if (outcome == null) {
        setNote(DEEP_DIVE_SLOW);
        outcome = await pending;
      }
      // A wipe while it was being written wins: never write it back.
      if (epochRef.current !== epochAtStart) return;
      if (!outcome.ok) {
        setNote(
          outcome.reason === 'used'
            ? DEEP_DIVE_USED
            : outcome.reason === 'consent'
              ? DEEP_DIVE_AI_OFF
              : outcome.reason === 'unavailable'
                ? DEEP_DIVE_UNAVAILABLE
                : DEEP_DIVE_FAILED,
        );
        return;
      }
      setNote(null);
      const made: DiveEntry = { dive: outcome.dive, madeOn: diveDay() };
      const base = stateRef.current ?? { userId, dives: {} };
      const next: DiveLocalState = { ...base, dives: { ...base.dives, [def.id]: made } };
      stateRef.current = next;
      setState(next);
      void saveDiveState(next);
      void saveServerDive(made);
    } finally {
      writingRef.current = false;
      setBusy(false);
    }
  }, [def, leans, consentGranted, userId]);

  const detail = def ? (
    <View style={styles.detail}>
      {leans.map((row) => (
        <View key={row.axis} style={styles.leanRow} accessible accessibilityLabel={`${leanLabel(row)}, ${row.pct} percent`}>
          <View style={styles.leanHead}>
            <ThemedText type="smallBold" style={styles.flex}>
              {leanLabel(row)}{' '}
              <ThemedText type="small" themeColor="textSecondary">
                · {AXIS_SHORT_NAME[row.axis]} ({codeForAxis(row.axis)})
              </ThemedText>
            </ThemedText>
            <ThemedText type="smallBold">{row.pct}%</ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.fill, { width: `${row.pct}%`, backgroundColor: theme.accent }]} />
          </View>
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        {DEEP_DIVE_PCT_NOTE}
      </ThemedText>

      {entry ? <DiveBody entry={entry} /> : null}
      {entry && !fresh ? (
        <ThemedText type="small" themeColor="textSecondary">
          {DEEP_DIVE_STALE}
        </ThemedText>
      ) : null}

      {!fresh ? (
        !consentGranted ? (
          <ThemedText type="small" themeColor="textSecondary">
            {DEEP_DIVE_AI_OFF}
          </ThemedText>
        ) : usedToday ? (
          <ThemedText type="small" themeColor="textSecondary">
            {DEEP_DIVE_DONE_TODAY}
          </ThemedText>
        ) : (
          <Pressable
            onPress={() => void write()}
            disabled={busy || state == null}
            accessibilityRole="button"
            accessibilityLabel={`${DEEP_DIVE_WRITE_LABEL}: ${categoryDisplayName(def)}`}
            style={({ pressed }) => [styles.button, { backgroundColor: theme.accentFill }, (pressed || busy) && styles.pressed]}>
            {busy ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <ThemedText type="smallBold" style={[styles.buttonText, { color: theme.onAccent }]}>
                {DEEP_DIVE_WRITE_LABEL}
              </ThemedText>
            )}
          </Pressable>
        )
      ) : null}
      {note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </View>
  ) : null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        {DEEP_DIVE_KICKER}
      </ThemedText>
      <ThemedText themeColor="textSecondary">{DEEP_DIVE_LEDE}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {DEEP_DIVE_LEGEND}
      </ThemedText>

      {rows.map(({ def: row, open, rowLeans, score }) => {
        const on = open && row.id === selected;
        const name = categoryDisplayName(row);
        const summary = open
          ? rowLeans.map((lean) => leanLabel(lean)).join(' · ')
          : DEEP_DIVE_ROW_LOCKED;
        return (
          <View key={row.id}>
            <Pressable
              onPress={() => {
                setSelected(on ? null : row.id);
                setNote(null);
              }}
              disabled={!open || busy}
              accessibilityRole="button"
              accessibilityLabel={`${name}${score != null ? `, ${score} overall` : ''}, traits ${categoryAxisCodes(row)}. ${summary}`}
              accessibilityState={{ expanded: on, disabled: !open || busy }}
              style={({ pressed }) => [
                styles.row,
                { borderColor: on ? theme.accent : theme.border },
                !open && styles.locked,
                pressed && styles.pressed,
              ]}>
              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <ThemedText type="smallBold" style={styles.name}>
                    {name}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.codes}>
                    {categoryAxisCodes(row)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {summary}
                </ThemedText>
              </View>
              {score != null ? (
                <ThemedText type="subheading" style={[styles.score, { color: theme.accent }]}>
                  {score}
                </ThemedText>
              ) : null}
              {open ? (
                <ThemedText themeColor="textSecondary" style={styles.chevron}>
                  {on ? '⌄' : '›'}
                </ThemedText>
              ) : null}
            </Pressable>
            {on ? detail : null}
          </View>
        );
      })}
    </ThemedView>
  );
}

function DiveBody({ entry }: { entry: DiveEntry }) {
  const theme = useTheme();
  const { dive } = entry;
  return (
    <View style={styles.body}>
      <View style={[styles.titleBox, { borderColor: theme.accent }]}>
        <View style={styles.head}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Your title here
          </ThemedText>
          <AiBadge />
        </View>
        <ThemedText type="subheading">{titleCase(dive.title)}</ThemedText>
      </View>
      <Part title="Where it shows up">
        {dive.showsUp.map((row) => (
          <ThemedText key={row.axis}>
            <ThemedText type="smallBold">{AXIS_SHORT_NAME[row.axis]}: </ThemedText>
            {row.line}
          </ThemedText>
        ))}
      </Part>
      {dive.mix ? (
        <Part title="How they mix">
          <ThemedText>{dive.mix}</ThemedText>
        </Part>
      ) : null}
      <Part title="What others might notice">
        <ThemedText>{dive.othersNotice}</ThemedText>
      </Part>
      <Part title="What it means for you">
        <ThemedText>{dive.whatItMeansForYou}</ThemedText>
      </Part>
    </View>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.part}>
      <View style={styles.head}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {title}
        </ThemedText>
        <AiBadge />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.two },
  kicker: { textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  locked: { opacity: 0.55 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  name: { flexShrink: 1 },
  /** The two-letter trait legend, small and raised like a superscript. */
  codes: { fontSize: 10, lineHeight: 12, letterSpacing: 0.5 },
  chevron: { fontSize: 20 },
  score: { minWidth: 32, textAlign: 'right' },
  detail: { gap: Spacing.two, paddingTop: Spacing.two, paddingHorizontal: Spacing.one },
  pressed: { opacity: 0.7 },
  leanRow: { gap: 4 },
  leanHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  body: { gap: Spacing.two, marginTop: Spacing.one },
  titleBox: { borderWidth: 1, borderRadius: 12, padding: Spacing.two, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  part: { gap: 4 },
  button: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, marginTop: Spacing.one },
  buttonText: { flexShrink: 1, textAlign: 'center' },
});
