import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InfoReveal, ShapedByList } from '@/components/info-reveal';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TraitTagRow } from '@/components/trait-tag-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountDataEpoch } from '@/lib/account-data-epoch';
import { categoryTags, pickCategoryCard } from '@/lib/category-bank';
import { useCategoryDefs } from '@/lib/category-catalog';
import { categoryConcept } from '@/lib/concept-explainers';
import { SHAPED_BY_LABEL, shapedByRows } from '@/lib/shaped-by';
import {
  nextSpotlight,
  parseSpotlight,
  readAllCategories,
  type CategoryId,
  type CategoryReading,
} from '@/lib/categories';
import { FULL_PROFILE_LOCKED_COPY, fullProfileLockedLine, fullProfileProgress } from '@/lib/full-profile-gate';
import { saveCategorySpotlight, type Me } from '@/lib/me';
import { sageKnowsWeekKey } from '@/lib/sage-knows';
import { localYmd } from '@/lib/local-date';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { categoryWaitingLine } from '@/lib/questions/staged-intake-copy';
import { ONGOING_ROUND_SIZE } from '@/lib/questions/tiered-axis-plan';

export const CATEGORY_NOT_READY_COPY = `Your next ${ONGOING_ROUND_SIZE} in Questions get it there.`;

/**
 * Why a category is not open yet, with the count: how many settled traits it
 * needs and how many it has. A "map" category needs both of its two.
 */
export function categoryNeedsLine(reading: CategoryReading): string {
  const need = reading.def.shape === 'map' ? 2 : reading.def.minStable;
  const have = Math.min(reading.stableAxes.length, need);
  return `Needs ${need} settled trait${need === 1 ? '' : 's'} behind it — you have ${have}.`;
}

/**
 * Names the traits a closed category is waiting on (staged intake, 2026-10-02),
 * so it never reads blank; the generic line only when every trait it uses is
 * already settled (it then needs a different mix, which a round also brings).
 */
export function categoryWaitingCopy(reading: CategoryReading): string {
  const settled = new Set(reading.stableAxes);
  const waiting = reading.def.axes.filter((axis) => !settled.has(axis)).map((axis) => AXIS_SHORT_NAME[axis]);
  return waiting.length > 0 ? categoryWaitingLine(waiting) : CATEGORY_NOT_READY_COPY;
}

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

/**
 * Categories on Explore (release pass, emci 2026-09-16; stored cards, emci
 * 2026-10-07).
 *
 * The WHOLE category set is always listed, open on the page — never folded,
 * never filtered to "ready", and no questions here. Tapping a category opens
 * its STORED card (lib/category-bank): the cell its reading falls in, this
 * week's wording, and one chip row of trait tags. Nothing is generated and
 * nothing is written, so there is no consent gate and no reroll
 * (REROLLS_FROZEN, lib/rerolls.ts). The old AI statements are not shown.
 *
 * Gates, judged every render, each saying what unlocks it: `unlocked` (the one
 * shared full-profile gate), then the category's own readiness.
 */
export function CategoriesFold({
  me,
  tracks: parentTracks,
  onUpdated,
  unlocked,
}: {
  me: Me;
  /**
   * Tracks the parent already fetched on focus (Explore). When given, they win
   * over this card's own fetch, so the card can never show older counts than
   * the screen around it.
   */
  tracks?: TraitTrack[];
  onUpdated?: () => void | Promise<void>;
  unlocked: boolean;
}) {
  const theme = useTheme();
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksLoaded, setTracksLoaded] = useState(false);
  const [openId, setOpenId] = useState<CategoryId | null>(null);
  useCategoryDefs();

  const dataEpoch = useAccountDataEpoch();
  const readings = readAllCategories(tracks);
  const ready = readings.filter((row) => row.ready);
  const todayYmd = localYmd(new Date(), me.timezone || 'UTC');
  const weekKey = sageKnowsWeekKey(todayYmd);
  const spotlight = parseSpotlight(me.category_spotlight);

  useEffect(() => {
    let cancelled = false;
    fetchTraitTracks(me.id)
      .then((next) => {
        if (!cancelled) setTracks(next);
      })
      .catch((err) => {
        console.log('[categories] load error:', err);
      })
      .finally(() => {
        if (!cancelled) setTracksLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // dataEpoch: a dev jump or Start over rewrote the account under this card.
  }, [me.id, me.updated_at, dataEpoch]);

  // The parent's focus refetch is newer than this card's own mount fetch.
  useEffect(() => {
    if (!parentTracks) return;
    setTracks(parentTracks);
    setTracksLoaded(true);
  }, [parentTracks]);

  useEffect(() => {
    if (ready.length === 0) return;
    if (spotlight?.weekKey === weekKey && ready.some((row) => row.def.id === spotlight.categoryId)) {
      return;
    }
    const next = nextSpotlight(ready, spotlight?.categoryId ?? null);
    if (!next) return;
    void saveCategorySpotlight(me.id, { weekKey, categoryId: next }).then(() => onUpdated?.());
  }, [me.id, weekKey, ready.length, spotlight?.weekKey, spotlight?.categoryId, onUpdated]);

  function handleRowPress(reading: CategoryReading) {
    const id = reading.def.id;
    setOpenId(openId === id ? null : id);
  }

  /** Everything one category row needs, judged every render. No call, no write. */
  function rowModel(reading: CategoryReading) {
    const id = reading.def.id;
    const open = openId === id;
    // An unknown catalog id has no stored card and shows none.
    const card = reading.ready ? pickCategoryCard({ userId: me.id, reading, ymd: todayYmd }) : null;
    const state: 'loading' | 'locked' | 'not_ready' | null = !tracksLoaded
      ? 'loading'
      : !unlocked
        ? 'locked'
        : !reading.ready
          ? 'not_ready'
          : null;
    // Before tracks land every category reads as not ready; say "Loading"
    // rather than flash a count of zero at a finished user.
    const summary = card?.summary ?? (state === 'loading' ? 'Loading…' : categoryNeedsLine(reading));
    return { id, open, card, state, summary };
  }

  const tileTints = [theme.accent, theme.accentSecondary, theme.accentTertiary, theme.emphasis];

  const lockedLine = fullProfileLockedLine(fullProfileProgress(tracks), 'categories');

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Categories</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Tap a category to read it.
      </ThemedText>

      <View style={styles.grid}>
        {pairsOf(readings).map((pair) => (
          <View key={pair.map((r) => r.def.id).join('|')} style={styles.pairWrap}>
            <View style={styles.pair}>
              {pair.map((reading) => {
                const m = rowModel(reading);
                // "locked" is the shared gate only; a category still waiting on
                // its traits is just dimmed. Nothing is judged before tracks land.
                const locked = tracksLoaded && !unlocked;
                const closed = tracksLoaded && (!unlocked || !reading.ready);
                const tint = tileTints[readings.indexOf(reading) % tileTints.length];
                return (
                  <ThemedPressable
                    key={reading.def.id}
                    onPress={() => handleRowPress(reading)}
                    accessibilityRole="button"
                    accessibilityLabel={`${categoryDisplayName(reading.def)}${locked ? ', locked' : ''}. ${m.summary}`}
                    accessibilityState={{ expanded: m.open }}
                    style={[
                      styles.tile,
                      {
                        borderColor: m.open ? theme.accent : theme.border,
                        borderRadius: theme.cutCorners ? 0 : Math.min(theme.radius, 16),
                        backgroundColor: m.open ? theme.backgroundSelected : theme.background,
                      },
                    ]}>
                    <View style={styles.tileTop}>
                      <View
                        style={[
                          styles.glyph,
                          {
                            backgroundColor: closed ? theme.backgroundSelected : tint,
                            borderRadius: theme.cutCorners ? 0 : 8,
                          },
                        ]}>
                        <ThemedText type="code" style={{ color: closed ? theme.textSecondary : theme.onAccent }}>
                          {closed ? '·' : categoryDisplayName(reading.def).slice(0, 1)}
                        </ThemedText>
                      </View>
                      {locked ? (
                        <ThemedText type="code" themeColor="textSecondary">
                          locked
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {categoryDisplayName(reading.def)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.tileLine}>
                      {m.summary}
                    </ThemedText>
                  </ThemedPressable>
                );
              })}
              {pair.length === 1 ? <View style={styles.tileSpacer} /> : null}
            </View>
            {pair.map((reading) => {
              const { id, open, card, state } = rowModel(reading);
              return (
                <View key={`open-${id}`}>
                  {open ? (
                    <ThemedView type="background" style={styles.expand}>
                      {state === 'loading' ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          Loading…
                        </ThemedText>
                      ) : state === 'locked' ? (
                        <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={FULL_PROFILE_LOCKED_COPY}>
                          {lockedLine}
                        </ThemedText>
                      ) : state === 'not_ready' ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {categoryNeedsLine(reading)} {categoryWaitingCopy(reading)}
                        </ThemedText>
                      ) : card ? (
                        /* Stored copy: one chip row of trait tags, then the card. No AI pill. */
                        <>
                          <TraitTagRow tags={categoryTags(reading.def, tracks)} />
                          <ThemedText type="small">{card.summary}</ThemedText>
                          <CardPart label="Strength" text={card.strength} />
                          <CardPart label="Watch-out" text={card.watchOut} />
                          <CardPart label="Try this" text={card.tryThis} />
                        </>
                      ) : null}

                      {/* The working, one tap away: which traits this category is built
                          from and which way each one leans. Closed by default. */}
                      {reading.ready && !state ? (
                        <InfoReveal label={SHAPED_BY_LABEL}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {categoryConcept(id)}
                          </ThemedText>
                          <ShapedByList rows={shapedByRows(reading.def.axes, tracks)} />
                        </InfoReveal>
                      ) : null}
                    </ThemedView>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
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

/** Two tiles per row; an odd last tile keeps its half width. */
function pairsOf<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  grid: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  pairWrap: {
    gap: Spacing.two,
  },
  pair: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    padding: Spacing.two + Spacing.one,
    gap: Spacing.one,
  },
  tileSpacer: {
    flex: 1,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glyph: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLine: {
    fontSize: 12,
    lineHeight: 16,
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
});
