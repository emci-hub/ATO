import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { AI_TAP_TIMEOUT_MS } from '@/lib/ai/generate';
import { fallbackCategoryCopies, fallbackForReading } from '@/lib/category-bands';
import { useCategoryDefs } from '@/lib/category-catalog';
import {
  getCategoryDefs,
  nextSpotlight,
  parseSpotlight,
  readAllCategories,
  type CategoryId,
  type CategoryReading,
} from '@/lib/categories';
import { parseCategoryCard } from '@/lib/category-statements/card';
import { generateCategoryStatements } from '@/lib/category-statements/generate-statements';
import { fetchCurrentStatements, saveCategoryStatements, type CategoryStatement } from '@/lib/category-statements/store';
import { FULL_PROFILE_LOCKED_COPY, fullProfileLockedLine, fullProfileProgress } from '@/lib/full-profile-gate';
import { AI_CONSENT_NEEDED_COPY, aiConsentFor, saveCategorySpotlight, type Me } from '@/lib/me';
import { sageKnowsWeekKey } from '@/lib/sage-knows';
import { parseSageTitle } from '@/lib/sage-title';
import { localYmd } from '@/lib/local-date';
import { withTimeout } from '@/lib/timeout';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

export const CATEGORY_REWRITE_LABEL = 'Refresh';
export const CATEGORY_NOT_READY_COPY =
  'Not enough settled answers behind this one yet — answering your next 25 in Questions helps. Nothing was generated.';
export const CATEGORY_ERROR_COPY = 'Couldn’t load this one just now.';
export const CATEGORY_ROW_NOT_READY_COPY = 'Answer a few more questions to open this one.';

/**
 * Display-only names. "Love / closeness" (attachment) and "Independence &
 * closeness" (autonomy vs. connection) read like duplicates but are built from
 * different traits, so they stay two categories — only the labels change.
 */
const CATEGORY_DISPLAY_NAMES: Partial<Record<CategoryId, string>> = {
  cat_love: 'Love & closeness',
  cat_independence: 'Independence',
};

function categoryDisplayName(def: { id: CategoryId; name: string }): string {
  return CATEGORY_DISPLAY_NAMES[def.id] ?? def.name;
}

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
        Tap a category to read it.
      </ThemedText>

      {readings.map((reading) => {
        const id = reading.def.id;
        const open = openId === id;
        const statement = statements.get(id);
        const card = statement ? parseCategoryCard(statement.statement) : null;
        // Gate messages are re-judged every render, so one that has since
        // cleared (tracks landed, consent turned on) drops back.
        const rawState = rowState[id];
        const state =
          (rawState === 'locked' && unlocked) ||
          (rawState === 'consent' && consentGranted) ||
          (rawState === 'not_ready' && reading.ready)
            ? undefined
            : rawState;
        const copy = reading.ready ? (cached?.categories[id] ?? fallback[id]) : undefined;
        const summary =
          card?.summary ??
          (reading.ready ? (copy?.line ?? fallbackForReading(reading)) : CATEGORY_ROW_NOT_READY_COPY);
        const canRefresh = unlocked && consentGranted && reading.ready;
        return (
          <View key={id} style={styles.row}>
            <Pressable
              onPress={() => handleRowPress(reading)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open, busy: state === 'loading' }}
              style={({ pressed }) => [styles.rowHeader, pressed && styles.pressed]}>
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{categoryDisplayName(reading.def)}</ThemedText>
                {!open ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {summary}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText
                themeColor="textSecondary"
                style={[styles.chevron, open && styles.chevronOpen]}>
                ›
              </ThemedText>
            </Pressable>

            {open ? (
              <ThemedView type="background" style={styles.expand}>
                {card && state !== 'loading' ? (
                  <>
                    <ThemedText type="small">{card.summary}</ThemedText>
                    {card.strength ? <CardPart label="Strength" text={card.strength} /> : null}
                    {card.watchOut ? <CardPart label="Watch-out" text={card.watchOut} /> : null}
                    {card.tryThis ? <CardPart label="Try this" text={card.tryThis} /> : null}
                  </>
                ) : null}

                {state === 'loading' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Reading your answers…
                  </ThemedText>
                ) : state === 'locked' ? (
                  <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={FULL_PROFILE_LOCKED_COPY}>
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
                  <View style={styles.inline}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {CATEGORY_ERROR_COPY}
                    </ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void loadCategory(reading)}
                      style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                      <ThemedText type="link">Try again</ThemedText>
                    </Pressable>
                  </View>
                ) : !card && !statementsLoaded ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Loading…
                  </ThemedText>
                ) : !card ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadCategory(reading)}
                    style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                    <ThemedText type="link">Load</ThemedText>
                  </Pressable>
                ) : null}

                {card && statement && state !== 'loading' ? (
                  <View style={styles.footer}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
                      Based on your answers · updated {formatUpdated(statement.createdAt)}
                    </ThemedText>
                    {canRefresh ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${CATEGORY_REWRITE_LABEL} ${categoryDisplayName(reading.def)}`}
                        hitSlop={8}
                        onPress={() => void loadCategory(reading)}
                        style={({ pressed }) => pressed && styles.pressed}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.refresh}>
                          {CATEGORY_REWRITE_LABEL}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </ThemedView>
            ) : null}
          </View>
        );
      })}
    </ThemedView>
  );
}

function CardPart({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.part}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{text}</ThemedText>
    </View>
  );
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
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
    gap: Spacing.two,
    marginTop: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  part: {
    gap: Spacing.half,
  },
  inline: {
    gap: Spacing.one,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
  },
  refresh: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  chevron: {
    fontSize: 20,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
