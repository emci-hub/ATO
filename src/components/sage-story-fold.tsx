import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { generateStoryBody } from '@/lib/explore/generate';
import { localYmd } from '@/lib/local-date';
import type { Me } from '@/lib/me';
import {
  STORY_COPY_REVIEWED,
  STORY_LABEL,
  STORY_LEDE,
  buildStoryPrompt,
  parseSageStory,
  storyFingerprint,
  storyNamesACategory,
  storyReady,
  type SageStory,
} from '@/lib/sage-story';
import { claimStoryGenerate, saveSageStory } from '@/lib/sage-story-store';
import { readyCategories } from '@/lib/categories';
import { formatDivergenceNote, divergingAxesFromTracks } from '@/lib/trait-history';
import type { TraitTrack } from '@/lib/trait-stability';
import { VOICE_CONFIG } from '@/lib/voice/config';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { matchingJargonTerm } from '@/lib/voice/jargon';

/**
 * Longer-form Story under pinned Categories on Explore.
 * Own quota. Fingerprint-gated. No offline fallback — hide the section
 * when Gemini is unreachable or the profile is still thin.
 *
 * UNREVIEWED. Diagnosis-adjacent. Same bar as the Crisis spec.
 */
export function SageStoryFold({
  me,
  tracks,
  tracksReady,
  crisisToday,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  tracksReady: boolean;
  crisisToday: boolean;
}) {
  const [story, setStory] = useState<SageStory | null>(() => parseSageStory(me.sage_story));
  const divergenceNote = formatDivergenceNote(divergingAxesFromTracks(tracks));
  const fingerprint = storyFingerprint(tracks, divergenceNote);

  useEffect(() => {
    setStory(parseSageStory(me.sage_story));
  }, [me.sage_story]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!tracksReady || crisisToday) {
        if (!cancelled) setStory(null);
        return;
      }
      if (!storyReady(tracks)) {
        if (!cancelled) setStory(null);
        return;
      }

      const today = localYmd(new Date(), me.timezone || 'UTC');
      const cached = parseSageStory(me.sage_story);
      if (cached && cached.fingerprint === fingerprint) {
        if (!cancelled) setStory(cached);
        return;
      }

      if (VOICE_CONFIG.provider === 'local' || !VOICE_CONFIG.geminiApiKey) {
        if (!cancelled) setStory(null);
        return;
      }

      try {
        const claim = await claimStoryGenerate();
        if (!claim.ok) {
          if (!cancelled) setStory(null);
          return;
        }
        let body: string | null = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          const raw = await generateStoryBody(buildStoryPrompt({ tracks, divergenceNote }));
          if (!raw) break;
          if (containsFrameworkTerm(raw) || matchingJargonTerm(raw) || storyNamesACategory(raw)) {
            continue;
          }
          body = raw;
          break;
        }
        if (!body) {
          if (!cancelled) setStory(null);
          return;
        }
        const next: SageStory = {
          body,
          fingerprint,
          generatedOn: today,
          categoryIds: readyCategories(tracks).map((row) => row.def.id),
        };
        await saveSageStory(me.id, next);
        if (!cancelled) setStory(next);
      } catch (err) {
        console.log('[sage-story] generate error:', err);
        if (!cancelled) setStory(null);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [me.id, me.timezone, me.sage_story, tracks, tracksReady, fingerprint, crisisToday, divergenceNote]);

  if (!story?.body) return null;

  return (
    <View style={styles.wrap} testID="sage-story-fold">
      <SettingsFold title={STORY_LABEL}>
        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {STORY_LEDE}
          </ThemedText>
          {!STORY_COPY_REVIEWED ? (
            <ThemedText type="code" themeColor="textSecondary">
              Draft copy — waiting on emci review. Not shippable.
            </ThemedText>
          ) : null}
          <ThemedText type="small">{story.body}</ThemedText>
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
});
