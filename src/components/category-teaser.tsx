import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { ConceptHint } from '@/components/concept-hint';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fallbackCategoryCopies, fallbackForReading, CATEGORY_BAND_COPY_REVIEWED } from '@/lib/category-bands';
import { useCategoryDefs } from '@/lib/category-catalog';
import { categoryById, readCategory } from '@/lib/categories';
import { categoryConcept, CONCEPT_COPY_REVIEWED } from '@/lib/concept-explainers';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { fetchLatestExplorePack } from '@/lib/explore/store';
import { exploreTraitsFromPack, pickDailyTeaser, readStoredTeaser, writeStoredTeaser } from '@/lib/home-teaser';
import { localYmd } from '@/lib/local-date';
import type { Me } from '@/lib/me';
import { parseSageTitle } from '@/lib/sage-title';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import type { TraitTrack } from '@/lib/trait-stability';
import { controlBorderColor } from '@/lib/theme/chrome';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryId } from '@/lib/categories';

export function CategoryTeaser({ me }: { me: Me }) {
  const theme = useTheme();
  useCategoryDefs();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [id, setId] = useState<CategoryId | null>(null);
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ymd = localYmd(new Date(), me.timezone || 'UTC');
    Promise.all([fetchTraitTracks(me.id), fetchLatestExplorePack().catch(() => null), readStoredTeaser(me.id, ymd)])
      .then(([nextTracks, pack, stored]) => {
        if (cancelled) return;
        setTracks(nextTracks);
        const extra = [
          ...(me.sage_knows.last_axis ? [me.sage_knows.last_axis] : []),
          ...exploreTraitsFromPack(pack),
        ];
        const picked = pickDailyTeaser({
          userId: me.id,
          ymd,
          tracks: nextTracks,
          touched: me.trait_touched_at,
          extraAxes: extra,
          stored,
        });
        setId(picked);
        if (picked && picked !== stored) void writeStoredTeaser(me.id, ymd, picked);
      })
      .catch((err) => {
        console.log('[category-teaser] load error:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [me.id, me.timezone, me.updated_at, me.sage_knows.last_axis, me.trait_touched_at]);

  if (!id) return null;
  const def = categoryById(id);
  if (!def) return null;
  const reading = readCategory(def, tracks);
  if (!reading.ready) return null;
  const cached = parseSageTitle(me.sage_title);
  const fallback = fallbackCategoryCopies(tracks);
  const copy = cached?.categories[id] ?? fallback[id];
  const line = copy?.line ?? fallbackForReading(reading);
  const full = copy?.full ?? line;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: controlBorderColor(theme) }]}
      testID="category-teaser">
      <Pressable
        onPress={() => setPeek((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: peek }}
        style={({ pressed }) => [pressed && styles.pressed]}>
        <ConceptHint explainer={categoryConcept(id)} label={def.name}>
          <ThemedText type="smallBold">{def.name}</ThemedText>
        </ConceptHint>
        <ThemedText type="small" themeColor="textSecondary">
          {line}
        </ThemedText>
        {(!CATEGORY_BAND_COPY_REVIEWED || !CONCEPT_COPY_REVIEWED) && PRE_LAUNCH_DEV ? (
          <ThemedText type="code" themeColor="textSecondary">
            Draft copy — waiting on emci review.
          </ThemedText>
        ) : null}
      </Pressable>
      {peek ? (
        <View style={styles.peek}>
          <ThemedText type="small">{full}</ThemedText>
          <Pressable
            onPress={() => router.push('/sage')}
            accessibilityRole="button"
            accessibilityLabel="Open Explore for more"
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <ThemedText type="smallBold">More in Explore ›</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  peek: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
