import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryStatementArchiveFold } from '@/components/category-statement-archive-fold';
import { CategoryVisual } from '@/components/category-visual';
import { ConceptHint } from '@/components/concept-hint';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AI_TAP_TIMEOUT_MS } from '@/lib/ai/generate';
import { fallbackCategoryCopies, fallbackForReading, CATEGORY_BAND_COPY_REVIEWED } from '@/lib/category-bands';
import { useCategoryDefs } from '@/lib/category-catalog';
import {
  CATEGORY_COPY_REVIEWED,
  getCategoryDefs,
  nextSpotlight,
  parseSpotlight,
  readAllCategories,
  type CategoryId,
  type CategoryReading,
} from '@/lib/categories';
import { CATEGORY_STATEMENTS_COPY_REVIEWED, generateCategoryStatements } from '@/lib/category-statements/generate-statements';
import { fetchCurrentStatements, saveCategoryStatements, type CategoryStatement } from '@/lib/category-statements/store';
import { categoryConcept, CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { FULL_PROFILE_LOCKED_COPY, fullProfileLockedLine, fullProfileProgress } from '@/lib/full-profile-gate';
import { AI_CONSENT_NEEDED_COPY, aiConsentFor, saveCategorySpotlight, type Me } from '@/lib/me';
import { sageKnowsWeekKey } from '@/lib/sage-knows';
import { parseSageTitle } from '@/lib/sage-title';
import { localYmd } from '@/lib/local-date';
import { withTimeout } from '@/lib/timeout';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

export const CATEGORY_REWRITE_LABEL = 'Write a new one';
export const CATEGORY_NOT_READY_COPY =
  'Not enough settled answers behind this one yet — answering your next 25 in Questions helps. Nothing was generated.';
export const CATEGORY_ERROR_COPY = 'Couldn’t load this one just now.';

type RowState = 'loading' | 'error' | 'not_ready' | 'locked' | 'consent';

/**
 * Categories on Explore (release pass, emci 2026-09-16).
 *
 * The WHOLE category set is always listed, open on the page — never folded,
 * never filtered to "ready", and no questions here. Tapping a category opens
 * it and, only if nothing is cached for it yet, loads that ONE category's
 * statement (one model call for one category). The saved statement is the
 * cache: next time it paints from `category_statements` with no call.
 *
 * Every gate is judged on tap, before any call, and each says what unlocks it:
 * `unlocked` (the one shared full-profile gate), AI consent (Home), then the
 * category's own readiness. Nothing on this component generates on mount.
 */
export function CategoriesFold({
  me,
  onUpdated,
  unlocked,
}: {
  me: Me;
  onUpdated?: () => void | Promise<void>;
  unlocked: boolean;
}) {
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [openId, setOpenId] = useState<CategoryId | null>(null);
  const [statements, setStatements] = useState<Map<CategoryId, CategoryStatement>>(new Map());
  const [statementsLoaded, setStatementsLoaded] = useState(false);
  const [rowState, setRowState] = useState<Partial<Record<CategoryId, RowState>>>({});
  const [historyVersion, setHistoryVersion] = useState(0);
  // Per-category attempt counter: a timed-out call that lands late must not
  // overwrite a newer retry's state.
  const attemptRef = useRef<Partial<Record<CategoryId, number>>>({});
  // Synchronous in-flight guard: render-time state can't stop a fast double tap.
  const inFlightRef = useRef<Set<CategoryId>>(new Set());
  useCategoryDefs();

  const consentGranted = aiConsentFor(me) === 'granted';

  const loadStatements = useCallback(async () => {
    try {
      const rows = await fetchCurrentStatements(me.id);
      setStatements(new Map(rows.map((row) => [row.categoryId as CategoryId, row])));
    } catch (err) {
      console.log('[categories] statements load error:', err);
    } finally {
      setStatementsLoaded(true);
    }
  }, [me.id]);

  useEffect(() => {
    void loadStatements();
  }, [loadStatements]);
  const readings = readAllCategories(tracks);
  const ready = readings.filter((row) => row.ready);
  const cached = parseSageTitle(me.sage_title);
  const fallback = fallbackCategoryCopies(tracks);
  const weekKey = sageKnowsWeekKey(localYmd(new Date(), me.timezone || 'UTC'));
  const spotlight = parseSpotlight(me.category_spotlight);

  useEffect(() => {
    let cancelled = false;
    fetchTraitTracks(me.id)
      .then((next) => {
        if (!cancelled) setTracks(next);
      })
      .catch((err) => {
        console.log('[categories] load error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [me.id, me.updated_at]);

  useEffect(() => {
    if (ready.length === 0) return;
    if (spotlight?.weekKey === weekKey && ready.some((row) => row.def.id === spotlight.categoryId)) {
      return;
    }
    const next = nextSpotlight(ready, spotlight?.categoryId ?? null);
    if (!next) return;
    void saveCategorySpotlight(me.id, { weekKey, categoryId: next }).then(() => onUpdated?.());
  }, [me.id, weekKey, ready.length, spotlight?.weekKey, spotlight?.categoryId, onUpdated]);

  const spotlightId =
    spotlight?.weekKey === weekKey && ready.some((row) => row.def.id === spotlight.categoryId)
      ? spotlight.categoryId
      : null;

  function setRow(id: CategoryId, next: RowState | null) {
    setRowState((prev) => {
      const copy = { ...prev };
      if (next) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  }

  /** The only path to a model call on Explore. Always from a tap. */
  async function loadCategory(reading: CategoryReading) {
    const id = reading.def.id;
    if (inFlightRef.current.has(id)) return;
    // Gates, in order, each reported plainly with no call behind it.
    if (!unlocked) {
      setRow(id, 'locked');
      return;
    }
    if (!consentGranted) {
      setRow(id, 'consent');
      return;
    }
    if (!reading.ready) {
      setRow(id, 'not_ready');
      return;
    }
    const attempt = (attemptRef.current[id] ?? 0) + 1;
    attemptRef.current[id] = attempt;
    inFlightRef.current.add(id);
    setRow(id, 'loading');
    try {
      const validIds = new Set(getCategoryDefs().map((def) => def.id));
      const drafts = await withTimeout(
        generateCategoryStatements([reading], validIds),
        AI_TAP_TIMEOUT_MS,
        'category-statement',
      );
      if (attemptRef.current[id] !== attempt) return;
      if (!drafts) {
        setRow(id, 'error');
        return;
      }
      await saveCategoryStatements(drafts);
      await loadStatements();
      setHistoryVersion((v) => v + 1);
      if (attemptRef.current[id] === attempt) setRow(id, null);
    } catch (err) {
      console.log('[categories] generate statement error:', err);
      if (attemptRef.current[id] === attempt) setRow(id, 'error');
    } finally {
      // Released on timeout too, so Try again works; a late result from the
      // abandoned call is discarded by the attempt check above.
      inFlightRef.current.delete(id);
    }
  }

  function handleRowPress(reading: CategoryReading) {
    const id = reading.def.id;
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    // Cached → just show it. Not cached → this tap is the request.
    if (!statements.has(id) && statementsLoaded) void loadCategory(reading);
  }

  const lockedLine = fullProfileLockedLine(fullProfileProgress(tracks), 'categories');

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Categories</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Tap a category to read it. Each one is written once, then saved.
      </ThemedText>
      {(!CATEGORY_COPY_REVIEWED ||
        !CATEGORY_BAND_COPY_REVIEWED ||
        !CONCEPT_COPY_REVIEWED ||
        !CATEGORY_STATEMENTS_COPY_REVIEWED) &&
      PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}
      {!unlocked ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={FULL_PROFILE_LOCKED_COPY}>
          {lockedLine}
        </ThemedText>
      ) : !consentGranted ? (
        <ThemedText type="small" themeColor="textSecondary">
          {AI_CONSENT_NEEDED_COPY}
        </ThemedText>
      ) : null}
      {spotlightId ? (
        <ThemedText type="code" themeColor="textSecondary">
          This week&apos;s look · {readings.find((row) => row.def.id === spotlightId)?.def.name}
        </ThemedText>
      ) : null}

      {readings.map((reading) => {
        const id = reading.def.id;
        const open = openId === id;
        const statement = statements.get(id);
        // Gate messages are re-judged every render, so one that has since
        // cleared (tracks landed, consent turned on) drops back to "Load".
        const rawState = rowState[id];
        const state =
          (rawState === 'locked' && unlocked) ||
          (rawState === 'consent' && consentGranted) ||
          (rawState === 'not_ready' && reading.ready)
            ? undefined
            : rawState;
        const copy = reading.ready ? (cached?.categories[id] ?? fallback[id]) : undefined;
        const line = reading.ready ? (copy?.line ?? fallbackForReading(reading)) : null;
        return (
          <View key={id} style={styles.row}>
            <Pressable
              onPress={() => handleRowPress(reading)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open, busy: state === 'loading' }}
              style={({ pressed }) => [styles.rowHeader, pressed && styles.pressed]}>
              <View style={styles.rowText}>
                <ConceptHint explainer={categoryConcept(id)} label={reading.def.name}>
                  <ThemedText type="smallBold">{reading.def.name}</ThemedText>
                </ConceptHint>
                {line ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {line}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText themeColor="textSecondary">{open ? '–' : '+'}</ThemedText>
            </Pressable>

            {open ? (
              <View style={styles.expand}>
                {statement ? <ThemedText type="small">{statement.statement}</ThemedText> : null}

                {state === 'loading' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Writing…
                  </ThemedText>
                ) : state === 'locked' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {lockedLine}
                  </ThemedText>
                ) : state === 'consent' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {AI_CONSENT_NEEDED_COPY}
                  </ThemedText>
                ) : state === 'not_ready' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {CATEGORY_NOT_READY_COPY}
                  </ThemedText>
                ) : state === 'error' ? (
                  <>
                    <ThemedText type="small" themeColor="textSecondary">
                      {CATEGORY_ERROR_COPY}
                    </ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadCategory(reading)}
                      style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                      <ThemedText type="link">Try again</ThemedText>
                    </Pressable>
                  </>
                ) : !statement && !statementsLoaded ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Loading…
                  </ThemedText>
                ) : !statement ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadCategory(reading)}
                    style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                    <ThemedText type="link">Load</ThemedText>
                  </Pressable>
                ) : unlocked && consentGranted && reading.ready ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadCategory(reading)}
                    style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                    <ThemedText type="link">{CATEGORY_REWRITE_LABEL}</ThemedText>
                  </Pressable>
                ) : null}

                {reading.ready ? (
                  <>
                    {copy?.full && copy.full !== line ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {copy.full}
                      </ThemedText>
                    ) : null}
                    <CategoryVisual reading={reading} />
                  </>
                ) : null}
                <CategoryStatementArchiveFold
                  userId={me.id}
                  categoryId={id}
                  refreshSignal={historyVersion}
                  title="Past statements"
                  emptyCopy="No past statements yet."
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  expand: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
