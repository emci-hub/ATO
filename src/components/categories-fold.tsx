import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBatchFold } from '@/components/questions-fold';
import { CategoryVisual } from '@/components/category-visual';
import { ConceptHint } from '@/components/concept-hint';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
import {
  allCategoryBatchesLocked,
  categoryBatchProgressFrom,
  CATEGORY_BATCH_COPY_REVIEWED,
  CATEGORY_BATCH_SIZE,
  type CategoryBatchProgress,
} from '@/lib/questions/category-batch';
import { fetchAllCategoryBatches, finalizeCategoryBatches } from '@/lib/questions/category-batch-store';
import { categoryConcept, CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { controlBorderColor } from '@/lib/theme/chrome';
import { saveCategorySpotlight, type Me } from '@/lib/me';
import { sageKnowsWeekKey } from '@/lib/sage-knows';
import { parseSageTitle } from '@/lib/sage-title';
import { localYmd } from '@/lib/local-date';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

export function CategoriesFold({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated?: () => void | Promise<void>;
}) {
  const theme = useTheme();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [openId, setOpenId] = useState<CategoryId | null>(null);
  const [batchOpenId, setBatchOpenId] = useState<CategoryId | null>(null);
  const [batchProgress, setBatchProgress] = useState<CategoryBatchProgress[]>([]);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  useCategoryDefs();

  const loadBatchProgress = useCallback(async () => {
    try {
      const batches = await fetchAllCategoryBatches();
      const byId = new Map(batches.map((b) => [b.categoryId as CategoryId, b]));
      setBatchProgress(
        getCategoryDefs().map((def) => categoryBatchProgressFrom(def.id, byId.get(def.id) ?? null)),
      );
    } catch (err) {
      console.log('[categories] batch progress load error:', err);
    }
  }, []);

  useEffect(() => {
    void loadBatchProgress();
  }, [loadBatchProgress]);
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

  return (
    <SettingsFold title={`Categories · ${ready.length} of ${readings.length} ready`}>
      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          How a few things sit together, from what you have told us. Gut-call stays off this page.
        </ThemedText>
        {(!CATEGORY_COPY_REVIEWED ||
          !CATEGORY_BAND_COPY_REVIEWED ||
          !CONCEPT_COPY_REVIEWED ||
          !CATEGORY_BATCH_COPY_REVIEWED) &&
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

        <View style={styles.batchList}>
          {getCategoryDefs().map((def) => {
            const progress = batchProgress.find((row) => row.categoryId === def.id) ?? null;
            const locked = progress?.locked === true;
            const batchOpen = batchOpenId === def.id;
            return (
              <View key={`batch-${def.id}`} style={styles.row}>
                <Pressable
                  onPress={() => setBatchOpenId(batchOpen ? null : def.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: batchOpen }}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <ThemedText type="smallBold">
                    {def.name} · {progress ? progress.answeredCount : 0} of {CATEGORY_BATCH_SIZE}
                    {locked ? ' · locked' : ''}
                  </ThemedText>
                </Pressable>
                {batchOpen ? (
                  <CategoryBatchFold
                    me={me}
                    tracks={tracks}
                    category={def.id}
                    onUpdated={async () => {
                      await loadBatchProgress();
                      await onUpdated?.();
                    }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        {allCategoryBatchesLocked(batchProgress) &&
        !promptDismissed &&
        !batchProgress.every((row) => row.finalizedAt != null) ? (
          <View style={[styles.submitPrompt, { borderColor: controlBorderColor(theme) }]}>
            <ThemedText type="smallBold">Every category is locked in.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Submit to finish, or cancel and come back later.
            </ThemedText>
            <View style={styles.submitActions}>
              <ThemedPressable
                disabled={submitBusy}
                onPress={() => {
                  setSubmitBusy(true);
                  void finalizeCategoryBatches()
                    .then(() => loadBatchProgress())
                    .catch((err) => console.log('[categories] finalize error:', err))
                    .finally(() => setSubmitBusy(false));
                }}
                style={[styles.option, { borderColor: controlBorderColor(theme) }]}>
                <ThemedText type="smallBold">Submit</ThemedText>
              </ThemedPressable>
              <Pressable
                onPress={() => setPromptDismissed(true)}
                disabled={submitBusy}
                style={({ pressed }) => [pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
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
  batchList: {
    gap: Spacing.two,
  },
  expand: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  submitPrompt: {
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  submitActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  option: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
});
