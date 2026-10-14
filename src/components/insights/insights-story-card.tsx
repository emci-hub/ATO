import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StoryV2View } from '@/components/story-v2-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { readyCategories, type CategoryId } from '@/lib/categories';
import { categoryLeans, categoryScore } from '@/lib/category-deep-dive/dive';
import { fnv1a } from '@/lib/daily-line/bank';
import { FULL_PROFILE_LOCKED_COPY, fullProfileLockedLine, fullProfileProgress } from '@/lib/full-profile-gate';
import { localYmd } from '@/lib/local-date';
import type { Me } from '@/lib/me';
import { isStoryV2, isStoryV3, storyCardBody, type StoryCard } from '@/lib/story-card';
import { pickStoryBankCard } from '@/lib/story-bank';
import {
  loadStoryBankHistory,
  nextBankRecentHooks,
  nextBankSeenIds,
  rememberStoryBankHistory,
  type StoryBankHistory,
} from '@/lib/story-bank/history';
import { pickStoryThread, threadRecord } from '@/lib/story-thread';
import { pickStoryTemplate, scriptToCard } from '@/lib/story-v3';
import {
  STORY_LABEL,
  STORY_LEDE,
  formatStoryTensionNote,
  parseSageStory,
  storyFingerprint,
  storyReady,
  type SageStory,
} from '@/lib/sage-story';
import { saveSageStory } from '@/lib/sage-story-store';
import { controlBorderColor } from '@/lib/theme/chrome';
import { divergingAxesFromTracks } from '@/lib/trait-history';
import type { TraitTrack } from '@/lib/trait-stability';

export const STORY_OPEN_LABEL = 'Load story';
export const STORY_ANOTHER_LABEL = 'Load a new story';
export const STORY_NOT_READY_COPY = 'Not ready yet — your answers still need to settle.';
export const STORY_UNAVAILABLE_COPY = 'Couldn’t load it just now — tap to try again.';
export const STORY_STALE_COPY = 'Your answers have moved since this was picked.';

type LoadState = 'idle' | 'loading' | 'not_ready' | 'unavailable';
type StoryAngle = 'friends' | 'work' | 'home';
const STORY_ANGLES_CYCLE: readonly StoryAngle[] = ['friends', 'work', 'home'];

function storyAngleFor(seed: string): StoryAngle {
  return STORY_ANGLES_CYCLE[fnv1a(seed) % STORY_ANGLES_CYCLE.length]!;
}

/**
 * A card written from the templates (`story-v3`) or the stored bank (v2).
 * Anything a model wrote before (old AI stories, library cards) is not shown
 * on Insights: the screen is template-only. Nothing is deleted.
 */
export function isTemplateStory(story: SageStory | null): story is SageStory & { card: StoryCard } {
  if (!story?.card) return false;
  if (!isStoryV2(story.card) && !isStoryV3(story.card)) return false;
  return story.card.source === 'template' || story.card.source === 'bank';
}

/**
 * The Story on Insights (moved from Home, 2026-10-14). TEMPLATE-ONLY: the card
 * is built on the phone from `story-v3` (with the v2 bank as fallback). No
 * model call, no AI library, no tokens, no consent — and no "write one now".
 * A tap picks a new one; nothing runs on mount but a local parse.
 */
export function InsightsStoryCard({
  me,
  tracks,
  tracksReady,
  unlocked,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  tracksReady: boolean;
  unlocked: boolean;
}) {
  const theme = useTheme();
  const parsed = parseSageStory(me.sage_story);
  const [story, setStory] = useState<SageStory | null>(isTemplateStory(parsed) ? parsed : null);
  const [state, setState] = useState<LoadState>('idle');
  const historyRef = useRef<StoryBankHistory>({ seenIds: [], recentHooks: [] });
  const busyRef = useRef(false);
  const divergenceNote = formatStoryTensionNote(divergingAxesFromTracks(tracks));
  const fingerprint = storyFingerprint(tracks, divergenceNote);

  useEffect(() => {
    const next = parseSageStory(me.sage_story);
    setStory(isTemplateStory(next) ? next : null);
    setState('idle');
  }, [me.sage_story]);

  useEffect(() => {
    void loadStoryBankHistory(me.id).then((history) => {
      historyRef.current = history;
    });
  }, [me.id]);

  const loadStory = useCallback(async () => {
    // A ref, not state: two taps inside one frame both see 'idle'.
    if (busyRef.current) return;
    busyRef.current = true;
    setState('loading');
    try {
      if (!storyReady(tracks)) {
        setState('not_ready');
        return;
      }
      const thread = pickStoryThread({ tracks, last: story?.thread ?? null, noJoke: false });
      if (!thread) {
        setState('not_ready');
        return;
      }
      const ymd = localYmd(new Date(), me.timezone || 'UTC');
      const lead = thread.categories[0];
      const setting = storyAngleFor(`${threadRecord(thread).categories.join('+')}|${ymd}`);
      const seenIds = nextBankSeenIds(historyRef.current.seenIds, story?.card?.bankId ?? '');
      const score = lead ? categoryScore(categoryLeans(lead.reading.def, tracks)) : null;
      const template = pickStoryTemplate({
        categoryId: (lead?.reading.def.id ?? 'cat_social') as CategoryId,
        setting,
        lean: lead?.lead?.lean ?? 'high',
        seenIds,
        seed: `${me.id}|${ymd}|${fingerprint}`,
        traitScore: score,
      });
      const templateCard = template ? scriptToCard(template, score) : null;
      const card =
        templateCard ??
        pickStoryBankCard({
          categoryId: lead?.reading.def.id ?? '',
          setting,
          lean: lead?.lead?.lean ?? null,
          seenIds,
          recentHooks: story?.card?.hook
            ? nextBankRecentHooks(historyRef.current.recentHooks, story.card.hook)
            : historyRef.current.recentHooks,
          seed: `${me.id}|${ymd}|${fingerprint}`,
        });
      if (!card) {
        setState('unavailable');
        return;
      }
      if (card.bankId) {
        historyRef.current = {
          seenIds: nextBankSeenIds(historyRef.current.seenIds, card.bankId),
          recentHooks: nextBankRecentHooks(historyRef.current.recentHooks, card.hook ?? ''),
        };
        void rememberStoryBankHistory(me.id, historyRef.current);
      }
      const next: SageStory = {
        body: storyCardBody(card),
        card,
        fingerprint,
        generatedOn: ymd,
        categoryIds: readyCategories(tracks).map((row) => row.def.id),
        thread: threadRecord(thread),
      };
      setStory(next);
      await saveSageStory(me.id, next);
      setState('idle');
    } catch (err) {
      console.log('[insights] story error:', err);
      setState('unavailable');
    } finally {
      busyRef.current = false;
    }
  }, [tracks, story, me.id, me.timezone, fingerprint]);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: controlBorderColor(theme) }]}
      testID="insights-story-card">
      <ThemedText type="smallBold">{STORY_LABEL}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {STORY_LEDE}
      </ThemedText>

      {!unlocked ? (
        <>
          <ThemedText type="smallBold">
            {tracksReady ? fullProfileLockedLine(fullProfileProgress(tracks)) : FULL_PROFILE_LOCKED_COPY}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${FULL_PROFILE_LOCKED_COPY} Answer the questions.`}
            onPress={() => router.push('/intake-sweep')}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <ThemedText type="link">Answer the questions</ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          {story ? (
            <View style={styles.body}>
              <StoryV2View card={story.card!} categoryIds={story.thread?.categories ?? []} tracks={tracks} />
              {story.fingerprint !== fingerprint ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {STORY_STALE_COPY}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
          {state === 'not_ready' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {STORY_NOT_READY_COPY}
            </ThemedText>
          ) : null}
          {state === 'unavailable' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {STORY_UNAVAILABLE_COPY}
            </ThemedText>
          ) : null}
          {tracksReady ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={story ? STORY_ANOTHER_LABEL : STORY_OPEN_LABEL}
              disabled={state === 'loading'}
              onPress={() => {
                void loadStory();
              }}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <ThemedText type="link">
                {state === 'loading'
                  ? 'Picking…'
                  : state === 'unavailable'
                    ? 'Try again'
                    : story
                      ? STORY_ANOTHER_LABEL
                      : STORY_OPEN_LABEL}
              </ThemedText>
            </Pressable>
          ) : null}
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  body: {
    gap: Spacing.two,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
