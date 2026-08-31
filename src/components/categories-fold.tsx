import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryVisual } from '@/components/category-visual';
import { ConceptHint } from '@/components/concept-hint';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fallbackCategoryCopies, fallbackForReading, CATEGORY_BAND_COPY_REVIEWED } from '@/lib/category-bands';
import {
  CATEGORY_COPY_REVIEWED,
  nextSpotlight,
  parseSpotlight,
  readAllCategories,
  type CategoryId,
} from '@/lib/categories';
import { categoryConcept, CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';
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
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [openId, setOpenId] = useState<CategoryId | null>(null);
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
    <SettingsFold title={`Categories · ${ready.length} of ${readings.length} showing`}>
      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          How a few things sit together, from what you have told us. Gut-call stays off this page.
        </ThemedText>
        {!CATEGORY_COPY_REVIEWED || !CATEGORY_BAND_COPY_REVIEWED || !CONCEPT_COPY_REVIEWED ? (
          <ThemedText type="code" themeColor="textSecondary">
            Draft copy — waiting on emci review.
          </ThemedText>
        ) : null}
        {spotlightId ? (
          <ThemedText type="code" themeColor="textSecondary">
            This week&apos;s look · {readings.find((row) => row.def.id === spotlightId)?.def.name}
          </ThemedText>
        ) : null}
        {ready.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing here yet. A category shows once enough of it has settled.
          </ThemedText>
        ) : (
          ready.map((reading) => {
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
          })
        )}
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
  expand: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
