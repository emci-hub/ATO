import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { generateStoryBody } from '@/lib/explore/generate';
import { SAGE_STORY_META } from '@/lib/ai/call-sites';
import { FULL_PROFILE_LOCKED_COPY } from '@/lib/full-profile-gate';
import { localYmd } from '@/lib/local-date';
import type { Me } from '@/lib/me';
import {
  STORY_COPY_REVIEWED,
  STORY_LABEL,
  STORY_LEDE,
  buildStoryPrompt,
  formatStoryTensionNote,
  parseSageStory,
  storyFingerprint,
  storyNamesACategory,
  storyReady,
  type SageStory,
} from '@/lib/sage-story';
import { claimStoryGenerate, saveSageStory } from '@/lib/sage-story-store';
import { readyCategories } from '@/lib/categories';
import { divergingAxesFromTracks } from '@/lib/trait-history';
import { type TraitTrack } from '@/lib/trait-stability';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { matchingJargonTerm } from '@/lib/voice/jargon';
import { shouldUseLocalAi } from '@/lib/ai/override';

export const STORY_LOAD_LABEL = 'Load story';
export const STORY_RELOAD_LABEL = 'Load a new story';
export const STORY_NOT_READY_COPY =
  'Not ready yet — your answers still need to settle. Nothing was generated.';
export const STORY_UNAVAILABLE_COPY = 'Couldn’t write one just now. Try again later.';
export const STORY_STALE_COPY = 'Your answers have moved since this was written.';

type LoadState = 'idle' | 'loading' | 'not_ready' | 'unavailable';

/**
 * Longer-form Story on Home. **Tap-only** (ISOLATION_PLAN §7 Card B, emci
 * 2026-09-15): this fold used to generate from a `useEffect` the moment
 * `storyReady(tracks)` went true, which meant every cold open of Home could
 * spend a model call nobody asked for — and, unlike the daily insight, that
 * path never checked AI consent at all. Now nothing leaves the device until
 * the user presses Load.
 *
 * `unlocked` is the one shared gate (`lib/full-profile-gate.ts`) — the same
 * signal behind Load insight, the next-25 round and Load categories. Story's
 * own `storyReady` is **content readiness**, checked on tap, and a
 * not-ready profile gets a plain message with no model call behind it.
 *
 * UNREVIEWED. Diagnosis-adjacent. Same bar as the Crisis spec.
 */
export function SageStoryFold({
  me,
  tracks,
  tracksReady,
  crisisToday,
  unlocked,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  tracksReady: boolean;
  crisisToday: boolean;
  unlocked: boolean;
}) {
  const [story, setStory] = useState<SageStory | null>(() => parseSageStory(me.sage_story));
  const [state, setState] = useState<LoadState>('idle');
  const divergenceNote = formatStoryTensionNote(divergingAxesFromTracks(tracks));
  const fingerprint = storyFingerprint(tracks, divergenceNote);

  // A local parse of what is already on the `me` row. No network, no model —
  // this is the only thing that runs without a tap.
  useEffect(() => {
    setStory(parseSageStory(me.sage_story));
    setState('idle');
  }, [me.sage_story]);

  const loadStory = useCallback(async () => {
    if (state === 'loading') return;
    setState('loading');

    // Readiness is judged HERE, before any call, and says so plainly — emci's
    // standing rule: a generator that lacks data reports it, it does not pay
    // for a model call to find out.
    if (!storyReady(tracks)) {
      setState('not_ready');
      return;
    }

    if (await shouldUseLocalAi()) {
      setState('unavailable');
      return;
    }

    try {
      const claim = await claimStoryGenerate();
      if (!claim.ok) {
        setState('unavailable');
        return;
      }
      let body: string | null = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const raw = await generateStoryBody(
          buildStoryPrompt({ tracks, divergenceNote }),
          SAGE_STORY_META,
        );
        if (!raw) break;
        if (containsFrameworkTerm(raw) || matchingJargonTerm(raw) || storyNamesACategory(raw)) {
          continue;
        }
        body = raw;
        break;
      }
      if (!body) {
        setState('unavailable');
        return;
      }
      const next: SageStory = {
        body,
        fingerprint,
        generatedOn: localYmd(new Date(), me.timezone || 'UTC'),
        categoryIds: readyCategories(tracks).map((row) => row.def.id),
      };
      await saveSageStory(me.id, next);
      setStory(next);
      setState('idle');
    } catch (err) {
      console.log('[sage-story] generate error:', err);
      setState('unavailable');
    }
  }, [state, tracks, divergenceNote, fingerprint, me.id, me.timezone]);

  // Crisis still suppresses Story entirely — unchanged, and the one case where
  // the fold shows nothing at all.
  if (crisisToday) return null;

  // Locked: the bank isn't finished. One shared line, one route out.
  if (!unlocked) {
    return (
      <View style={styles.wrap} testID="sage-story-fold">
        <SettingsFold title={STORY_LABEL}>
          <View style={styles.body}>
            <ThemedText type="small" themeColor="textSecondary">
              {STORY_LEDE}
            </ThemedText>
            <ThemedText type="smallBold">{FULL_PROFILE_LOCKED_COPY}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${FULL_PROFILE_LOCKED_COPY} Answer the questions.`}
              onPress={() => router.push({ pathname: '/intake-sweep' })}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <ThemedText type="link">Answer the questions</ThemedText>
            </Pressable>
          </View>
        </SettingsFold>
      </View>
    );
  }

  const fresh = story?.body != null && story.fingerprint === fingerprint;
  const loadLabel = story?.body ? STORY_RELOAD_LABEL : STORY_LOAD_LABEL;

  return (
    <View style={styles.wrap} testID="sage-story-fold">
      <SettingsFold title={STORY_LABEL}>
        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {STORY_LEDE}
          </ThemedText>
          {!STORY_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
            <ThemedText type="code" themeColor="textSecondary">
              Draft copy — waiting on emci review. Not shippable.
            </ThemedText>
          ) : null}

          {story?.body ? <ThemedText type="small">{story.body}</ThemedText> : null}
          {story?.body && !fresh ? (
            <ThemedText type="small" themeColor="textSecondary">
              {STORY_STALE_COPY}
            </ThemedText>
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

          {/*
            The tap. `tracksReady` gates only the BUTTON, not the cached story
            above it: generating from a half-loaded `tracks` would write a
            story against the wrong profile.
          */}
          {tracksReady ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={loadLabel}
              disabled={state === 'loading'}
              onPress={() => {
                void loadStory();
              }}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <ThemedText type="link">
                {state === 'loading' ? 'Writing…' : loadLabel}
              </ThemedText>
            </Pressable>
          ) : null}

        </View>
      </SettingsFold>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: Spacing.two,
  },
  body: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.8,
  },
});
