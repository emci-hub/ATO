import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryStatementArchiveFold } from '@/components/category-statement-archive-fold';
import { CategoryVisual } from '@/components/category-visual';
import { ConceptHint } from '@/components/concept-hint';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fallbackCategoryCopies, fallbackForReading, CATEGORY_BAND_COPY_REVIEWED } from '@/lib/category-bands';
import { useCategoryDefs } from '@/lib/category-catalog';
import {
  CATEGORY_COPY_REVIEWED,
  getCategoryDefs,
  missingAxisForCategory,
  nextSpotlight,
  parseSpotlight,
  readAllCategories,
  type CategoryId,
} from '@/lib/categories';
import { CATEGORY_STATEMENTS_COPY_REVIEWED, generateCategoryStatements } from '@/lib/category-statements/generate-statements';
import { fetchCurrentStatements, saveCategoryStatements, type CategoryStatement } from '@/lib/category-statements/store';
import { categoryConcept, CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { FULL_PROFILE_LOCKED_COPY } from '@/lib/full-profile-gate';
import { saveCategorySpotlight, type Me } from '@/lib/me';
import { sageKnowsWeekKey } from '@/lib/sage-knows';
import { parseSageTitle } from '@/lib/sage-title';
import { localYmd } from '@/lib/local-date';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

export const CATEGORIES_LOAD_LABEL = 'Load categories';
export const CATEGORIES_RELOAD_LABEL = 'Load new categories';
export const CATEGORIES_NOT_READY_COPY =
  'No category has enough answers behind it yet. Nothing was generated.';

/**
 * Categories on Explore. `unlocked` is the ONE shared gate
 * (`lib/full-profile-gate.ts`) — the same signal behind Home's Load insight /
 * Load story and Questions' next 25 (ISOLATION_PLAN §7 Card E). Until the bank
 * is finished there is no Load button at all, so Explore has no way to spend a
 * model call. Category readiness itself is checked on tap and reported without
 * calling one.
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
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateNote, setGenerateNote] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  useCategoryDefs();

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

  async function handleGenerateStatements() {
    if (generateBusy) return;
    // Readiness is judged HERE, before any call, and says so plainly: a
    // generator that lacks data reports it rather than paying to find out.
    if (ready.length === 0) {
      setGenerateNote(CATEGORIES_NOT_READY_COPY);
      return;
    }
    setGenerateBusy(true);
    setGenerateNote(null);
    try {
      const validIds = new Set(getCategoryDefs().map((def) => def.id));
      const drafts = await generateCategoryStatements(ready, validIds);
      if (!drafts) {
        setGenerateNote("Couldn't put that together right now. Try again.");
        return;
      }
      await saveCategoryStatements(drafts);
      await loadStatements();
      setHistoryVersion((v) => v + 1);
    } catch (err) {
      console.log('[categories] generate statements error:', err);
      setGenerateNote("Couldn't put that together right now. Try again.");
    } finally {
      setGenerateBusy(false);
    }
  }

  return (
    <SettingsFold title={`Categories · ${ready.length} of ${readings.length} ready`}>
      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          How a few things sit together, from what you have told us. Gut-call stays off this page.
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
        {spotlightId ? (
          <ThemedText type="code" themeColor="textSecondary">
            This week&apos;s look · {readings.find((row) => row.def.id === spotlightId)?.def.name}
          </ThemedText>
        ) : null}
        {readings.map((reading) => {
          if (!reading.ready) {
            const axis = missingAxisForCategory(reading, tracks);
            return (
              <View key={reading.def.id} style={styles.row}>
                <Pressable
                  onPress={() =>
                    router.push(
                      axis
                        ? { pathname: '/intake-sweep', params: { axis } }
                        : { pathname: '/intake-sweep' },
                    )
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {reading.def.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Not ready yet — needs more answers. Tap to help it along.
                  </ThemedText>
                </Pressable>
              </View>
            );
          }
          const copy = cached?.categories[reading.def.id] ?? fallback[reading.def.id];
          const line = copy?.line ?? fallbackForReading(reading);
          const full = copy?.full ?? line;
          const open = openId === reading.def.id;
          return (
            <View key={reading.def.id} style={styles.row}>
              <Pressable
                onPress={() => setOpenId(open ? null : reading.def.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ConceptHint explainer={categoryConcept(reading.def.id)} label={reading.def.name}>
                  <ThemedText type="smallBold">{reading.def.name}</ThemedText>
                </ConceptHint>
                <ThemedText type="small" themeColor="textSecondary">
                  {line}
                </ThemedText>
              </Pressable>
              {open ? (
                <View style={styles.expand}>
                  <ThemedText type="small">{full}</ThemedText>
                  <CategoryVisual reading={reading} />
                </View>
              ) : null}
            </View>
          );
        })}

        {ready.length > 0 ? (
          <View style={styles.statementList}>
            <ThemedText type="smallBold">Statements</ThemedText>
            {ready.map((reading) => {
              const statement = statements.get(reading.def.id);
              return (
                <View key={`statement-${reading.def.id}`} style={styles.row}>
                  <ThemedText type="smallBold">{reading.def.name}</ThemedText>
                  {statement ? (
                    <ThemedText type="small">{statement.statement}</ThemedText>
                  ) : statementsLoaded ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      Not generated yet.
                    </ThemedText>
                  ) : null}
                  <CategoryStatementArchiveFold
                    userId={me.id}
                    categoryId={reading.def.id}
                    refreshSignal={historyVersion}
                    title="Past statements"
                    emptyCopy="No past statements yet."
                  />
                </View>
              );
            })}
            {unlocked ? (
              <Pressable
                accessibilityRole="button"
                disabled={generateBusy}
                onPress={() => void handleGenerateStatements()}
                style={({ pressed }) => [styles.cta, (pressed || generateBusy) && styles.pressed]}>
                <ThemedText type="link">
                  {generateBusy
                    ? 'Loading…'
                    : statements.size > 0
                      ? CATEGORIES_RELOAD_LABEL
                      : CATEGORIES_LOAD_LABEL}
                </ThemedText>
              </Pressable>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {FULL_PROFILE_LOCKED_COPY}
              </ThemedText>
            )}
            {generateNote ? (
              <ThemedText type="small" themeColor="textSecondary">
                {generateNote}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </View>
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  row: {
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
  statementList: {
    gap: Spacing.two,
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
