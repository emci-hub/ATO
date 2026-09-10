import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegendCard, type LegendRerollOutcome } from '@/components/legend-card';
import { LegendHistoryFold } from '@/components/legend-history-fold';
import { MilestoneToast } from '@/components/milestone-toast';
import { NAV_PIXEL_HEADER_INSET } from '@/components/nav-pixel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMeContext } from '@/lib/me-context';
import {
  applyDevArchetypePreset,
  applyDevThinProfilePreset,
  DEV_ARCHETYPE_PRESETS,
  DEV_TEST_USER_ID,
  devPresetById,
  type DevArchetypePresetId,
} from '@/lib/dev-test-user';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { DEFAULT_LEGEND_SKIN, LEGENDS64_COPY_REVIEWED, splitArchetypeCode, type LegendSkin } from '@/lib/legends64/archetypes';
import { archetypeCode } from '@/lib/legends64/classify';
import { generateLegendStory } from '@/lib/legends64/generate-story';
import { fetchCurrentGeneration, saveGeneration } from '@/lib/legends64/store';
import { persistCelebratedMilestones } from '@/lib/me';
import { checkMilestones, type MilestoneDef } from '@/lib/milestones';
import { bankTotalProgress } from '@/lib/questions/local';
import { legendsUnlocked } from '@/lib/questions/progressive-unlock';
import { claimFullProfileComplete } from '@/lib/ato-tokens-server';
import { ATO_TOKEN_NEED_MORE } from '@/lib/ato-tokens';
import { rerollLegend } from '@/lib/questions/reroll';
import { supabase } from '@/lib/supabase';
import { useAppearance } from '@/lib/theme/context';
import { NO_PINCH_ZOOM } from '@/lib/theme/chrome';
import {
  isThinProfile,
  missingAxis,
  PROFILE_LOCKED_COPY,
  PROFILE_LOCKED_CTA,
  settledCount,
  type TraitTrack,
} from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import { traitStateFromRow } from '@/lib/traits';

interface CurrentLegend {
  /** id of the legend_generations row, when known — excluded from the archive fold so the currently-shown story isn't duplicated there. Null right after a fresh generate/reroll only if the save somehow returned no id. */
  id: string | null;
  code: string;
  story: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; current: CurrentLegend | null }
  | { status: 'error'; message: string };

/**
 * Dev-testing strip for the fixed dev-test user (@atodev), __DEV__ only.
 * Applies one of the 4 archetype trait presets (core loop redesign §4 —
 * each targets a distinct classify.ts archetypeCode, see dev-test-user.ts).
 * Never renders for a real account — their traits cannot be overwritten
 * from here.
 */
function DevTestPresetStrip({ onApplied }: { onApplied: () => void }) {
  const theme = useTheme();
  const { refresh } = useMeContext();
  const [isDevUser, setIsDevUser] = useState(false);
  const [busyId, setBusyId] = useState<DevArchetypePresetId | 'thin' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!PRE_LAUNCH_DEV) return;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setIsDevUser(data.user?.id === DEV_TEST_USER_ID);
      })
      .catch(() => {
        // Signed out or network error — keep the strip hidden.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!PRE_LAUNCH_DEV || !isDevUser) return null;

  async function applyPreset(id: DevArchetypePresetId) {
    if (busyId) return;
    setBusyId(id);
    setNote(null);
    try {
      await applyDevArchetypePreset(id);
      await refresh();
      onApplied();
      const preset = devPresetById(id);
      setNote(preset ? `Preset applied — should classify as ${preset.code}.` : 'Preset applied.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not apply the preset.');
    } finally {
      setBusyId(null);
    }
  }

  async function applyThin() {
    if (busyId) return;
    setBusyId('thin');
    setNote(null);
    try {
      await applyDevThinProfilePreset();
      await refresh();
      onApplied();
      setNote('Thin profile applied.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not apply the thin profile.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.presetCard}>
      <ThemedText type="smallBold">Dev · test persona</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Set traits to a known archetype code. Your current generation (if any) is left as-is —
        use Reroll to get a fresh one for the new code.
      </ThemedText>
      <View style={styles.presetRow}>
        {DEV_ARCHETYPE_PRESETS.map((preset) => {
          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              onPress={() => void applyPreset(preset.id)}
              disabled={busyId !== null}
              style={({ pressed }) => [
                styles.presetChip,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{preset.code}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Or clear the profile entirely — no axis answered, no settled tracks — to
        reach the thin-profile gate below.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={() => void applyThin()}
        disabled={busyId !== null}
        style={({ pressed }) => [
          styles.presetChip,
          styles.thinChip,
          { backgroundColor: theme.backgroundSelected },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold">Thin profile</ThemedText>
      </Pressable>
      {busyId ? (
        <ThemedText type="small" themeColor="textSecondary">
          Applying…
        </ThemedText>
      ) : note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {note}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

/**
 * Legends — one story for the 64-archetype code this person's traits land
 * on (core loop redesign §4), shown under a switchable name/skin (real,
 * gaming, godType, anime, funny, dark — the story text never changes, only
 * the displayed name). Manual trigger only: nothing generates until tapped.
 * A reroll (paid, 10 ATO tokens/day) generates and stores a fresh story for
 * whatever code the person's traits currently resolve to.
 */
export default function LegendsScreen() {
  const { me, refresh } = useMeContext();
  const { reduceMotion } = useAppearance();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [retryTick, setRetryTick] = useState(0);
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  const [tracksReady, setTracksReady] = useState(false);
  const [skin, setSkin] = useState<LegendSkin>(DEFAULT_LEGEND_SKIN);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [generateNote, setGenerateNote] = useState<string | null>(null);

  useEffect(() => {
    if (!me?.id) return;
    let cancelled = false;
    setTracksReady(false);
    fetchTraitTracks(me.id)
      .then((rows) => {
        if (cancelled) return;
        setTracks(rows);
        setTracksReady(true);
      })
      .catch((err) => {
        console.log('[legends] tracks error:', err);
        // Ready with zero tracks reads as a thin profile, which is the honest
        // state when we cannot prove otherwise — better than the bare empty copy.
        if (!cancelled) setTracksReady(true);
      });
    return () => {
      cancelled = true;
    };
    // retryTick so a dev preset (which writes tracks directly, without moving
    // me.updated_at) refetches instead of leaving stale tracks for the mount.
  }, [me?.id, me?.updated_at, retryTick]);

  useEffect(() => {
    if (!me?.id) {
      setLoad({ status: 'loading' });
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading' });
    fetchCurrentGeneration(me.id)
      .then((generation) => {
        if (cancelled) return;
        setLoad({
          status: 'ready',
          current: generation ? { id: generation.id, code: generation.archetypeCode, story: generation.story } : null,
        });
      })
      .catch((err) => {
        console.log('[legends] load error:', err);
        if (!cancelled) {
          setLoad({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load your legend.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [me?.id, retryTick]);

  const settled = settledCount(tracks);
  const thin = isThinProfile(settled);
  const focusAxis = me ? missingAxis(traitStateFromRow(me).values, tracks) : null;
  function goToQuestions() {
    if (focusAxis) {
      router.push({ pathname: '/intake-sweep', params: { axis: focusAxis } });
    } else {
      router.push({ pathname: '/intake-sweep' });
    }
  }

  /** The code this person's traits resolve to RIGHT NOW — used for both the first-ever manual generation and every reroll, never the previously-stored generation's (possibly stale) code. */
  function currentCode(): string | null {
    if (!me) return null;
    return archetypeCode(me);
  }

  async function handleGenerate() {
    const code = currentCode();
    if (!me || !code || generateBusy) return;
    setGenerateBusy(true);
    setGenerateNote(null);
    try {
      const split = splitArchetypeCode(code);
      if (!split) return;
      const outcome = await generateLegendStory(split.core, split.modifier);
      if (outcome.kind !== 'ok') {
        setGenerateNote(
          outcome.kind === 'quota' ? "Today's search limit is reached — try again tomorrow." : "Couldn't search right now. Try again.",
        );
        return;
      }
      const id = await saveGeneration(code, outcome.story);
      setLoad({ status: 'ready', current: { id, code, story: outcome.story } });
      setHistoryVersion((v) => v + 1);
    } catch (err) {
      console.log('[legends] generate error:', err);
      setGenerateNote("Couldn't search right now. Try again.");
    } finally {
      setGenerateBusy(false);
    }
  }

  async function handleReroll(): Promise<LegendRerollOutcome> {
    const code = currentCode();
    if (!code) return { ok: false, note: "Couldn't reroll right now. Try again." };
    const { result, story, generationId } = await rerollLegend(code);
    if (!result.ok || !story) {
      const note =
        result.reason === 'quota'
          ? "Today's search limit is reached — try again tomorrow."
          : result.already
            ? 'Already rerolled today.'
            : result.reason === 'generation_failed'
              ? "Couldn't reroll right now. Try again."
              : ATO_TOKEN_NEED_MORE;
      return { ok: false, note };
    }
    setLoad({ status: 'ready', current: { id: generationId, code, story } });
    setHistoryVersion((v) => v + 1);
    void refresh().catch((err) => console.log('[legends] refresh after reroll error:', err));
    return { ok: true };
  }

  // Progressive unlock (§6, retargeted per emci's explicit call): Legends
  // unlocks at question 50 of the frozen intake, REPLACING the prior
  // isProfileSettled gate — the tiered intake alone doesn't satisfy
  // isProfileSettled for every axis (10 of 16 axes only reach 2 intake
  // answers, below the 3-answer stability floor), so that gate would have
  // kept Legends locked past question 50 for most users. Checked only once
  // tracks have loaded, so the screen doesn't flash locked before it knows
  // better. classify.ts's archetypeCode stays untouched (deterministic, no
  // spend) — this only decides what renders.
  const locked = tracksReady && !legendsUnlocked(tracks);

  // One-time "Legends unlocked!" celebration, on top of `locked` above —
  // kept exactly as before the rewrite; unrelated to which content system
  // renders once unlocked.
  const [unlockToast, setUnlockToast] = useState<MilestoneDef | null>(null);
  const celebratingUnlockRef = useRef(false);

  useEffect(() => {
    if (!me || !tracksReady || locked || celebratingUnlockRef.current) return;
    const celebrated = me.celebrated_milestone_ids ?? [];
    const crossed = checkMilestones('bankTotalProgress', bankTotalProgress(tracks).answered, celebrated)
      .filter((def) => def.id === 'legends_unlocked');
    if (crossed.length === 0) return;
    celebratingUnlockRef.current = true;
    setUnlockToast(crossed[0]!);
    claimFullProfileComplete().catch((err) => {
      console.log('[legends] claimFullProfileComplete error:', err);
    });
    persistCelebratedMilestones(me.id, [...celebrated, ...crossed.map((def) => def.id)])
      .then(() => refresh())
      .catch((err) => {
        console.log('[legends] persistCelebratedMilestones error:', err);
        celebratingUnlockRef.current = false;
      });
  }, [me, tracksReady, locked, refresh, tracks]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView {...NO_PINCH_ZOOM} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Legends</ThemedText>
            <ThemedText themeColor="textSecondary">
              One story for the archetype your traits land on right now — chosen from how you
              actually sit, not a label that sticks.
            </ThemedText>
            {!LEGENDS64_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
              <ThemedText type="code" themeColor="textSecondary">
                Draft copy — waiting on emci review.
              </ThemedText>
            ) : null}
          </View>

          {load.status === 'ready' && tracksReady && !locked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Roll a fresh read across your categories and story"
              onPress={() => router.push('/roll')}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
              <ThemedText type="link">Roll</ThemedText>
            </Pressable>
          ) : null}

          {unlockToast ? (
            <MilestoneToast
              key={unlockToast.id}
              title={unlockToast.title}
              body={unlockToast.body}
              reduceMotion={reduceMotion}
              onDone={() => setUnlockToast(null)}
            />
          ) : null}

          {load.status === 'loading' ? (
            <ThemedText themeColor="textSecondary">Loading your legend…</ThemedText>
          ) : null}

          {load.status === 'error' ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText>Could not load your legend right now.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {load.message}
              </ThemedText>
              <Pressable
                onPress={() => setRetryTick((tick) => tick + 1)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="link">Try again</ThemedText>
              </Pressable>
            </ThemedView>
          ) : null}

          {load.status === 'ready' && locked ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{PROFILE_LOCKED_COPY}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${PROFILE_LOCKED_COPY}. ${PROFILE_LOCKED_CTA}.`}
                onPress={goToQuestions}
                style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                <ThemedText type="link">{PROFILE_LOCKED_CTA}</ThemedText>
              </Pressable>
            </ThemedView>
          ) : load.status === 'ready' ? (
            load.current ? (
              <LegendCard
                code={load.current.code}
                story={load.current.story}
                skin={skin}
                onSkinChange={setSkin}
                me={me ? { ato_tokens: me.ato_tokens } : undefined}
                onReroll={me ? handleReroll : undefined}
              />
            ) : tracksReady && thin ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">Your profile is still taking shape.</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Answer a few questions so your traits settle, and your legend will be ready to
                  search for.
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={goToQuestions}
                  style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                  <ThemedText type="link">Answer questions</ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold">let&apos;s search your legend?</ThemedText>
                <Pressable
                  accessibilityRole="button"
                  disabled={generateBusy}
                  onPress={() => void handleGenerate()}
                  style={({ pressed }) => [styles.cta, (pressed || generateBusy) && styles.pressed]}>
                  <ThemedText type="link">{generateBusy ? 'Searching…' : 'Search'}</ThemedText>
                </Pressable>
                {generateNote ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {generateNote}
                  </ThemedText>
                ) : null}
              </ThemedView>
            )
          ) : null}

          {me ? (
            <LegendHistoryFold
              userId={me.id}
              excludeId={load.status === 'ready' ? (load.current?.id ?? null) : null}
              skin={skin}
              refreshSignal={historyVersion}
              title="Past legends"
              emptyCopy="No past legends yet — every generation you search for or reroll shows up here."
            />
          ) : null}

          <DevTestPresetStrip onApplied={() => setRetryTick((tick) => tick + 1)} />

          <ThemedText type="small" themeColor="textSecondary" style={styles.attr}>
            Matched to your traits, never a diagnosis. A search or reroll can turn up a
            different story than last time.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  scroll: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    gap: Spacing.half,
    paddingRight: NAV_PIXEL_HEADER_INSET,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  thinChip: {
    alignSelf: 'flex-start',
  },
  presetCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  presetChip: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  attr: {
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
