/**
 * Explore — the category deep dive (emci, 2026-10-08; moved from Home 2026-10-09).
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
import { LibraryCardFooter } from '@/components/library-card-footer';
import { TeamBadge } from '@/components/team-badge';
import { wantLibraryCards } from '@/lib/ai-library/client';
import { diveBucketKey } from '@/lib/ai-library/deep-dive';
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
import {
  categoryLeans,
  categoryScore,
  leanLabel,
  type DiveLean,
} from '@/lib/category-deep-dive/dive';
import { writeCategoryDeepDive } from '@/lib/category-deep-dive/generate';
import { diveLibraryKey, openLibraryDive, writeNewDive, type LibraryDiveOutcome } from '@/lib/category-deep-dive/library';
import { LIBRARY_VERSION } from '@/lib/ai-library/types';
import { cardJokeStyle } from '@/lib/voice/card-joke';
import { AI_PRICE_LABEL, AI_TOKEN_PRICE, AI_TOKENS_NEEDED } from '@/lib/ato-tokens';
import {
  diveDay,
  fetchServerDives,
  loadDiveState,
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
/** Shared library (wave93): a card from people with leanings like yours, free. */
export const DEEP_DIVE_OPEN_LABEL = 'Open my deep dive · free';
export const DEEP_DIVE_ANOTHER_LABEL = 'Show me another angle · free';
export const DEEP_DIVE_NEW_LABEL = 'Write me a brand-new one';
export const DEEP_DIVE_EMPTY =
  'You’ve read every deep dive for leanings like yours. A new one is being written for you, free: check back in about an hour. Or write one now.';
export const DEEP_DIVE_DAILY = 'That’s today’s free deep dives. A brand-new one is still open, or come back tomorrow.';
export const DEEP_DIVE_USED = 'That’s the most deep dives for today. Come back tomorrow.';
export const DEEP_DIVE_FAILED = 'Sage couldn’t write this one just now. Try again tomorrow.';
export const DEEP_DIVE_UNAVAILABLE = 'Deep dives aren’t switched on yet. Your leanings show either way.';
export const DEEP_DIVE_SLOW = 'Taking a little longer than usual. It will appear here when it’s ready.';
export const DEEP_DIVE_AI_OFF = 'Turn on AI on You to get the written deep dive. Your leanings show either way.';
export const DEEP_DIVE_STALE = 'Written before your answers moved. A fresh one is ready to write.';
export const DEEP_DIVE_REWRITE = 'Sage writes these more clearly now. A fresh one is ready to write.';
export const DEEP_DIVE_OPENS_TOMORROW = 'Already written with today’s deep dive. It opens here tomorrow, free.';
export const DEEP_DIVE_READY_TOMORROW = 'deep dive ready tomorrow';
export const DEEP_DIVE_PCT_NOTE = '50% is the middle; 100% is all the way to that side.';

export function CategoryDeepDiveCard({
  userId,
  tracks,
  consentGranted,
  tokens,
  onSpent,
}: {
  userId: string;
  tracks: readonly TraitTrack[];
  consentGranted: boolean;
  /** ATO token balance: each deep dive (2 cards) costs one AI view (wave92). */
  tokens: number;
  /** Refresh the balance after a charge or refund. */
  onSpent: () => void;
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
  const key = def ? diveLibraryKey(def.id, leans) : '';
  /** The library had nothing new for this bucket today: offer a brand-new card. */
  const [needNew, setNeedNew] = useState<string | null>(null);
  const entry: DiveEntry | null = def && state ? state.dives[def.id] ?? null : null;
  const fresh = entry != null && entry.dive.leansKey === key;
  /** A bundled card written today for tomorrow: shown once its day comes. */
  const opensLater = entry?.dive.opensOn != null && entry.dive.opensOn > diveDay();
  // Tokens decide how often now (wave92); the server keeps a safety ceiling of 5 a day.
  const affordable = tokens >= AI_TOKEN_PRICE;

  /** Before wave93 is live: the old one-person path (one paid call, two categories). */
  const writeOld = useCallback(async () => {
    if (!def || leans.length === 0) return;
    const epochAtStart = epochRef.current;
    {
      // The day's claim is spent once the call starts, so a slow answer is
      // waited for (with a note), never thrown away.
      // Bundle: the next strongest open category without a fresh card rides
      // along in the same call and opens tomorrow (emci, 2026-10-08).
      const today = diveDay();
      const extraRow = rows.find(
        (row) =>
          row.open &&
          row.def.id !== def.id &&
          row.rowLeans.length > 0 &&
          // Only a category with no card yet: never overwrite one the person already has.
          stateRef.current?.dives[row.def.id] == null,
      );
      const main = { def, leans, jokeStyle: cardJokeStyle(`${userId}|${def.id}|${today}`) };
      const extra = extraRow
        ? { def: extraRow.def, leans: extraRow.rowLeans, jokeStyle: cardJokeStyle(`${userId}|${extraRow.def.id}|${today}`) }
        : null;
      const pending = writeCategoryDeepDive({ main, extra, consentGranted }).catch(
        () => ({ ok: false, reason: 'failed' }) as const,
      );
      let outcome = await withTimeout(pending, AI_TAP_TIMEOUT_MS, 'deep-dive').catch(() => null);
      if (outcome == null) {
        setNote(DEEP_DIVE_SLOW);
        outcome = await pending;
      }
      // A wipe while it was being written wins: never write it back.
      if (epochRef.current !== epochAtStart) return;
      onSpent();
      if (!outcome.ok) {
        setNote(
          outcome.reason === 'tokens'
            ? AI_TOKENS_NEEDED
            : outcome.reason === 'used'
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
      // Saved under the library key, so the card counts as fresh and the free button doesn't charge again.
      const made: DiveEntry = { dive: { ...outcome.dive, leansKey: key }, madeOn: today };
      const extraMade: DiveEntry | null =
        outcome.extra && extraRow
          ? {
              dive: {
                ...outcome.extra,
                leansKey: diveLibraryKey(extraRow.def.id, extraRow.rowLeans),
                opensOn: diveDay(new Date(Date.now() + 86_400_000)),
              },
              madeOn: today,
            }
          : null;
      const base = stateRef.current ?? { userId, dives: {} };
      const next: DiveLocalState = {
        ...base,
        dives: {
          ...base.dives,
          [def.id]: made,
          ...(extraMade ? { [extraMade.dive.categoryId]: extraMade } : {}),
        },
      };
      stateRef.current = next;
      setState(next);
      void saveDiveState(next);
      void (async () => {
        await saveServerDive(made);
        if (extraMade) await saveServerDive(extraMade);
      })();
    }
  }, [def, leans, key, consentGranted, userId, rows, onSpent]);

  /**
   * Library first (wave93): 'library' serves an unseen card from people with
   * leanings like yours, free; 'new' asks the server to write a brand-new one
   * (5 tokens). The phone never sends any text, only the bucket.
   */
  const open = useCallback(
    async (mode: 'library' | 'new') => {
      if (!def || writingRef.current || leans.length === 0) return;
      writingRef.current = true;
      setBusy(true);
      setNote(null);
      const epochAtStart = epochRef.current;
      try {
        const pending: Promise<LibraryDiveOutcome> = (
          mode === 'library' ? openLibraryDive(def.id, leans) : writeNewDive(def.id, leans)
        ).catch(() => ({ ok: false, reason: 'failed' }) as const);
        let outcome = await withTimeout(pending, AI_TAP_TIMEOUT_MS, 'deep-dive').catch(() => null);
        if (outcome == null) {
          setNote(DEEP_DIVE_SLOW);
          outcome = await pending;
        }
        // A wipe while it was being written wins: never write it back.
        if (epochRef.current !== epochAtStart) return;
        if (mode === 'new') onSpent();
        if (!outcome.ok) {
          if (outcome.reason === 'missing') {
            await writeOld();
            return;
          }
          if (outcome.reason === 'empty' || outcome.reason === 'daily') setNeedNew(def.id);
          // Look-ahead (wave94): the hourly fill writes this group next, free.
          if (outcome.reason === 'empty') void wantLibraryCards('deep_dive', [diveBucketKey(def.id, leans)]);
          setNote(
            outcome.reason === 'empty'
              ? DEEP_DIVE_EMPTY
              : outcome.reason === 'daily'
                ? DEEP_DIVE_DAILY
                : outcome.reason === 'tokens'
                  ? AI_TOKENS_NEEDED
                  : outcome.reason === 'quota'
                    ? DEEP_DIVE_USED
                    : outcome.reason === 'consent'
                      ? DEEP_DIVE_AI_OFF
                      : DEEP_DIVE_FAILED,
          );
          return;
        }
        setNeedNew(null);
        const today = diveDay();
        const served = outcome.served;
        const made: DiveEntry = {
          dive: { ...served.card, categoryId: def.id, leansKey: key },
          madeOn: today,
          libraryId: served.id,
          others: served.others,
        };
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
    },
    [def, leans, key, userId, onSpent, writeOld],
  );

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
      <TeamBadge
        categoryId={def.id}
        bucket={diveBucketKey(def.id, leans)}
        previousBucket={
          entry && entry.dive.leansKey !== key && entry.dive.leansKey.startsWith(`${LIBRARY_VERSION.deep_dive}|dd|`)
            ? entry.dive.leansKey.slice(LIBRARY_VERSION.deep_dive.length + 1)
            : null
        }
      />

      {entry && opensLater ? (
        <ThemedText type="small" themeColor="textSecondary">
          {DEEP_DIVE_OPENS_TOMORROW}
        </ThemedText>
      ) : entry ? (
        <>
          <DiveBody entry={entry} />
          <LibraryCardFooter libraryId={entry.libraryId} others={entry.others} />
        </>
      ) : null}
      {entry && !fresh ? (
        <ThemedText type="small" themeColor="textSecondary">
          {entry.dive.leansKey.startsWith(`${LIBRARY_VERSION.deep_dive}|dd|`) ? DEEP_DIVE_STALE : DEEP_DIVE_REWRITE}
        </ThemedText>
      ) : null}

      {!consentGranted ? (
        fresh ? null : (
          <ThemedText type="small" themeColor="textSecondary">
            {DEEP_DIVE_AI_OFF}
          </ThemedText>
        )
      ) : needNew !== def.id ? (
        <Pressable
          onPress={() => void open('library')}
          disabled={busy || state == null}
          accessibilityRole="button"
          accessibilityLabel={`${fresh ? DEEP_DIVE_ANOTHER_LABEL : DEEP_DIVE_OPEN_LABEL}: ${categoryDisplayName(def)}`}
          style={({ pressed }) => [
            fresh ? styles.secondary : styles.button,
            fresh ? { borderColor: theme.border } : { backgroundColor: theme.accentFill },
            (pressed || busy) && styles.pressed,
          ]}>
          {busy ? (
            <ActivityIndicator color={fresh ? theme.text : theme.onAccent} />
          ) : (
            <ThemedText type="smallBold" style={[styles.buttonText, { color: fresh ? theme.text : theme.onAccent }]}>
              {fresh ? DEEP_DIVE_ANOTHER_LABEL : DEEP_DIVE_OPEN_LABEL}
            </ThemedText>
          )}
        </Pressable>
      ) : !affordable ? (
        <ThemedText type="small" themeColor="textSecondary">
          {AI_TOKENS_NEEDED}
        </ThemedText>
      ) : (
        <Pressable
          onPress={() => void open('new')}
          disabled={busy || state == null}
          accessibilityRole="button"
          accessibilityLabel={`${DEEP_DIVE_NEW_LABEL}, ${AI_PRICE_LABEL}: ${categoryDisplayName(def)}`}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accentFill }, (pressed || busy) && styles.pressed]}>
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <ThemedText type="smallBold" style={[styles.buttonText, { color: theme.onAccent }]}>
              {DEEP_DIVE_NEW_LABEL} · {AI_PRICE_LABEL}
            </ThemedText>
          )}
        </Pressable>
      )}
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
        const waiting = (state?.dives[row.id]?.dive.opensOn ?? '') > diveDay();
        const summary = open
          ? `${rowLeans.map((lean) => leanLabel(lean)).join(' · ')}${waiting ? ` · ${DEEP_DIVE_READY_TOMORROW}` : ''}`
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
      {dive.othersNotice ? (
        <Part title="What others might notice">
          <ThemedText>{dive.othersNotice}</ThemedText>
        </Part>
      ) : null}
      <Part title="What it means for you">
        <ThemedText>{dive.whatItMeansForYou}</ThemedText>
      </Part>
      {dive.joke ? (
        <Part title="The funny part">
          <ThemedText>{dive.joke}</ThemedText>
        </Part>
      ) : null}
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
  secondary: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  button: { minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, marginTop: Spacing.one },
  buttonText: { flexShrink: 1, textAlign: 'center' },
});
