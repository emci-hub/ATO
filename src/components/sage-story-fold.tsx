import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AiBadge } from '@/components/ai-badge';
import { LibraryCardFooter } from '@/components/library-card-footer';
import { STORY_LIBRARY, storyBucketKey } from '@/lib/ai-library/story';
import { serveLibraryCard, writeLibraryCard } from '@/lib/ai-library/client';
import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { generateStoryCardText } from '@/lib/explore/generate';
import { logAiReject } from '@/lib/ai/reject-log';
import { AI_PRICE_LABEL, AI_TOKEN_PRICE, AI_TOKENS_NEEDED, atoTokenBalanceOf } from '@/lib/ato-tokens';
import { refundAiTokens } from '@/lib/ato-tokens-server';
import { useMeContext } from '@/lib/me-context';
import { categoryAxisCodes, categoryDisplayName } from '@/lib/category-labels';
import { categoryLeans, categoryScore } from '@/lib/category-deep-dive/dive';
import { buildStoryCardPrompt, parseStoryCardAnswer, storyCardBody, type StoryCard } from '@/lib/story-card';
import { titleCase } from '@/lib/legend-figures/story';
import { SAGE_STORY_META } from '@/lib/ai/call-sites';
import { AI_TAP_TIMEOUT_MS } from '@/lib/ai/generate';
import { FULL_PROFILE_LOCKED_COPY, fullProfileLockedLine, fullProfileProgress } from '@/lib/full-profile-gate';
import { localYmd } from '@/lib/local-date';
import { AI_CONSENT_NEEDED_COPY, type Me } from '@/lib/me';
import { withTimeout } from '@/lib/timeout';
import {
  STORY_LABEL,
  STORY_LEDE,
  formatStoryTensionNote,
  parseSageStory,
  storyFingerprint,
  storyNamesACategory,
  storyReady,
  type SageStory,
} from '@/lib/sage-story';
import { claimStoryGenerate, saveSageStory } from '@/lib/sage-story-store';
import { categoryById, readyCategories } from '@/lib/categories';
import { pickStoryThread, threadRecord } from '@/lib/story-thread';
import { divergingAxesFromTracks } from '@/lib/trait-history';
import { type TraitTrack } from '@/lib/trait-stability';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { matchingJargonTerm } from '@/lib/voice/jargon';
import { shouldUseLocalAi } from '@/lib/ai/override';

export const STORY_LOAD_LABEL = 'Load story';
export const STORY_RELOAD_LABEL = 'Load a new story';
export const STORY_NOT_READY_COPY =
  'Not ready yet — your answers still need to settle. Nothing was generated.';
export const STORY_UNAVAILABLE_COPY = 'Couldn’t load it just now — tap to try again.';
export const STORY_STALE_COPY = 'Your answers have moved since this was written.';
/** Shared library (wave93): stories from people with leanings like yours, free. */
export const STORY_OPEN_LABEL = 'Load story · free';
export const STORY_ANOTHER_LABEL = 'Load a new story · free';
export const STORY_NEW_LABEL = 'Write me a brand-new story';
export const STORY_EMPTY_COPY = 'You’ve read every story for leanings like yours. Sage can write a brand-new one.';
export const STORY_DAILY_COPY = 'That’s today’s free stories. A brand-new one is still open, or come back tomorrow.';

type LoadState = 'idle' | 'loading' | 'not_ready' | 'unavailable' | 'tokens' | 'empty' | 'daily';

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
  consentGranted,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  tracksReady: boolean;
  crisisToday: boolean;
  unlocked: boolean;
  /** Home's consent answer. The server refuses the call without it anyway. */
  consentGranted: boolean;
}) {
  const [story, setStory] = useState<SageStory | null>(() => parseSageStory(me.sage_story));
  const [state, setState] = useState<LoadState>('idle');
  // Only the newest tap may write UI state — a timed-out attempt that lands
  // late must not flip a retry's spinner back.
  const attemptRef = useRef(0);
  // A timeout only stops the WAIT: the claimed, paid run keeps going and still
  // saves. A retry joins that run instead of paying for a second one.
  const runningRef = useRef<Promise<SageStory | null> | null>(null);
  const tokensShortRef = useRef(false);
  const emptyReasonRef = useRef<'empty' | 'daily' | null>(null);
  const { refresh: refreshMe } = useMeContext();
  const tokens = atoTokenBalanceOf(me);
  const divergence = divergingAxesFromTracks(tracks);
  const divergenceNote = formatStoryTensionNote(divergence);
  const divergenceAxis = divergence[0]?.axis ?? null;
  const fingerprint = storyFingerprint(tracks, divergenceNote);
  /** The library had nothing new for this reader today: offer a brand-new story. */
  const [needNew, setNeedNew] = useState(false);

  // A local parse of what is already on the `me` row. No network, no model —
  // this is the only thing that runs without a tap.
  useEffect(() => {
    setStory(parseSageStory(me.sage_story));
    setState('idle');
  }, [me.sage_story]);

  const loadStory = useCallback(async (mode: 'library' | 'new' = 'library') => {
    if (state === 'loading') return;
    if (!consentGranted) return;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
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

    // Story v2: the app picks the 1–2 categories and the joke target before
    // any call; the next load takes the best combo that is not the last one.
    const thread = pickStoryThread({ tracks, last: story?.thread ?? null, crisisToday });
    if (!thread) {
      setState('not_ready');
      return;
    }
    const ymd = localYmd(new Date(), me.timezone || 'UTC');

    // Library first (wave93): the phone sends only the bucket; the server serves
    // an unseen story free, or writes a brand-new one for 5 tokens.
    const bucket = storyBucketKey(thread);
    const libraryRun = async (): Promise<SageStory | null | 'missing'> => {
      if (!bucket) {
        // No shared bucket for this thread: a free tap never charges; offer the paid one.
        if (mode === 'library') {
          emptyReasonRef.current = 'empty';
          return null;
        }
        return 'missing';
      }
      const res =
        mode === 'library'
          ? await serveLibraryCard('story', bucket, STORY_LIBRARY.readCard)
          : await writeLibraryCard('story', bucket, 'paid', STORY_LIBRARY.readCard);
      if (!res.ok) {
        if (res.reason === 'missing') return 'missing';
        if (res.reason === 'empty' || res.reason === 'daily') {
          emptyReasonRef.current = res.reason;
        } else if (res.reason === 'tokens') {
          tokensShortRef.current = true;
        }
        return null;
      }
      const served = 'served' in res ? res.served : null;
      if (!served) return null;
      const next: SageStory = {
        body: storyCardBody(served.card),
        card: served.card,
        fingerprint,
        generatedOn: ymd,
        categoryIds: readyCategories(tracks).map((row) => row.def.id),
        thread: threadRecord(thread),
        libraryId: served.id,
        others: served.others,
      };
      await saveSageStory(me.id, next);
      return next;
    };

    /** Before wave93 is live: the old one-person path. */
    const run = async (): Promise<SageStory | null> => {
      const lib = await libraryRun();
      if (lib !== 'missing') return lib;
      const claim = await claimStoryGenerate();
      if (!claim.ok) {
        // wave92: a new Story is one AI view (5 ATO tokens).
        if (claim.reason === 'tokens') tokensShortRef.current = true;
        return null;
      }
      // Story v3 (2026-10-09): one call, answered as card parts and checked part by part.
      let card: StoryCard | null = null;
      for (let pass = 1; pass <= 2; pass += 1) {
        const text = await generateStoryCardText(
          buildStoryCardPrompt({ tracks, divergenceNote, divergenceAxis, thread, userId: me.id, ymd }),
          SAGE_STORY_META,
        );
        if (!text) break;
        const parsed = parseStoryCardAnswer(text, { jokeAsked: true });
        const c = parsed.card;
        // Every shown part, not just the body: the deeper parts and the title/joke too.
        const joined = c
          ? [storyCardBody(c), c.noticed, c.otherWay, c.nextTime, c.joke, c.title].filter(Boolean).join(' ')
          : '';
        if (parsed.card && !containsFrameworkTerm(joined) && !matchingJargonTerm(joined) && !storyNamesACategory(joined)) {
          card = parsed.card;
          break;
        }
        logAiReject('story', parsed.reason ?? 'framework or jargon', pass);
      }
      if (!card) {
        // Charged at the claim but no card came back: give the tokens back.
        await refundAiTokens('story');
        return null;
      }
      const next: SageStory = {
        body: storyCardBody(card),
        card,
        fingerprint,
        generatedOn: ymd,
        categoryIds: readyCategories(tracks).map((row) => row.def.id),
        thread: threadRecord(thread),
      };
      await saveSageStory(me.id, next);
      return next;
    };

    try {
      let pending = runningRef.current;
      if (!pending) {
        pending = run();
        runningRef.current = pending;
        const mine = pending;
        void mine.then(
          () => {
            if (runningRef.current === mine) runningRef.current = null;
          },
          () => {
            if (runningRef.current === mine) runningRef.current = null;
          },
        );
      }
      // Bounded: slow networks end in "tap to try again", not a spinner.
      const next = await withTimeout(pending, AI_TAP_TIMEOUT_MS, 'story-generate');
      if (attempt !== attemptRef.current) return;
      void refreshMe();
      if (!next) {
        const empty = emptyReasonRef.current;
        emptyReasonRef.current = null;
        if (empty) setNeedNew(true);
        setState(tokensShortRef.current ? 'tokens' : empty ?? 'unavailable');
        tokensShortRef.current = false;
        return;
      }
      setNeedNew(false);
      setStory(next);
      setState('idle');
    } catch (err) {
      console.log('[sage-story] generate error:', err);
      if (attempt === attemptRef.current) setState('unavailable');
    }
  }, [state, consentGranted, tracks, story, crisisToday, divergenceNote, divergenceAxis, fingerprint, me.id, me.timezone, refreshMe]);

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
            <ThemedText type="smallBold">
              {tracksReady ? fullProfileLockedLine(fullProfileProgress(tracks)) : FULL_PROFILE_LOCKED_COPY}
            </ThemedText>
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
  const loadLabel = needNew ? `${STORY_NEW_LABEL} · ${AI_PRICE_LABEL}` : story?.body ? STORY_ANOTHER_LABEL : STORY_OPEN_LABEL;
  // The told-vs-played line is personal, so it is never in a shared story: it
  // shows here, on this phone only, when the story covers that trait (wave93).
  const storyAxes = story?.thread
    ? story.thread.categories.flatMap((id) => categoryById(id)?.axes ?? [])
    : [];
  const tensionLine = story?.card && divergenceNote && divergenceAxis && storyAxes.includes(divergenceAxis) ? divergenceNote : null;

  return (
    <View style={styles.wrap} testID="sage-story-fold">
      <SettingsFold title={STORY_LABEL}>
        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {STORY_LEDE}
          </ThemedText>

          {/* A model wrote the story, so it carries the tap-for-details AI icon (emci 2026-10-07). */}
          {story?.card ? (
            <>
              <StoryCardView card={story.card} categoryIds={story.thread?.categories ?? []} tracks={tracks} />
              {tensionLine ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {tensionLine}
                </ThemedText>
              ) : null}
              <LibraryCardFooter libraryId={story.libraryId} others={story.others} />
            </>
          ) : (
            <>
              {story?.body ? <AiBadge /> : null}
              {story?.body ? <ThemedText type="small">{story.body}</ThemedText> : null}
            </>
          )}
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
          {state === 'empty' || state === 'daily' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {state === 'empty' ? STORY_EMPTY_COPY : STORY_DAILY_COPY}
            </ThemedText>
          ) : null}

          {/*
            The tap. `tracksReady` gates only the BUTTON, not the cached story
            above it: generating from a half-loaded `tracks` would write a
            story against the wrong profile.
          */}
          {state === 'tokens' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {AI_TOKENS_NEEDED}
            </ThemedText>
          ) : null}
          {!consentGranted ? (
            <ThemedText type="small" themeColor="textSecondary">
              {AI_CONSENT_NEEDED_COPY}
            </ThemedText>
          ) : tracksReady && needNew && tokens < AI_TOKEN_PRICE ? (
            <ThemedText type="small" themeColor="textSecondary">
              {AI_TOKENS_NEEDED}
            </ThemedText>
          ) : tracksReady ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={loadLabel}
              disabled={state === 'loading'}
              onPress={() => {
                void loadStory(needNew ? 'new' : 'library');
              }}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <ThemedText type="link">
                {state === 'loading' ? 'Writing…' : state === 'unavailable' ? 'Try again' : loadLabel}
              </ThemedText>
            </Pressable>
          ) : null}

        </View>
      </SettingsFold>
    </View>
  );
}

/** The Story as a card, like Legends and the deep dive (2026-10-09). */
function StoryCardView({
  card,
  categoryIds,
  tracks,
}: {
  card: StoryCard;
  categoryIds: readonly string[];
  tracks: readonly TraitTrack[];
}) {
  // "Built from": the categories behind it, as a label — never in the text.
  const built = categoryIds
    .map((id) => categoryById(id))
    .filter((def): def is NonNullable<ReturnType<typeof categoryById>> => def != null)
    .map((def) => {
      const score = categoryScore(categoryLeans(def, tracks));
      return `${categoryDisplayName(def)} ${categoryAxisCodes(def)}${score != null ? ` ${score}` : ''}`;
    });
  return (
    <View style={styles.card}>
      {card.title ? (
        <StoryPart title="Your story title">
          <ThemedText type="subheading">{titleCase(card.title)}</ThemedText>
        </StoryPart>
      ) : null}
      <StoryPart title="The scene">
        <ThemedText>{card.scene}</ThemedText>
      </StoryPart>
      <StoryPart title="The moment">
        <ThemedText>{card.moment}</ThemedText>
      </StoryPart>
      {card.handle ? (
        <StoryPart title="How you handle it">
          <ThemedText>{card.handle}</ThemedText>
        </StoryPart>
      ) : null}
      {card.noticed ? (
        <StoryPart title="What they noticed">
          <ThemedText>{card.noticed}</ThemedText>
        </StoryPart>
      ) : null}
      {card.otherWay ? (
        <StoryPart title="The other way it could have gone">
          <ThemedText>{card.otherWay}</ThemedText>
        </StoryPart>
      ) : null}
      <StoryPart title="What it means for you">
        <ThemedText>{card.means}</ThemedText>
      </StoryPart>
      {card.joke ? (
        <StoryPart title="The funny part">
          <ThemedText>{card.joke}</ThemedText>
        </StoryPart>
      ) : null}
      {card.nextTime ? (
        <StoryPart title="Next time">
          <ThemedText style={styles.italic}>{card.nextTime}</ThemedText>
        </StoryPart>
      ) : null}
      {built.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Built from: {built.join(' · ')}
        </ThemedText>
      ) : null}
    </View>
  );
}

function StoryPart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.part}>
      <View style={styles.partHead}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {title}
        </ThemedText>
        <AiBadge />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  italic: { fontStyle: 'italic' },
  part: { gap: 4 },
  partHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
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
