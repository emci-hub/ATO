import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChapterCard } from '@/components/quests/chapter-card';
import { ChoiceCard, type ChoiceState } from '@/components/quests/choice-card';
import { D20Tile } from '@/components/quests/d20-tile';
import { BeatCard, ContinueButton, Dialogue } from '@/components/quests/dialogue';
import { EndingCard } from '@/components/quests/ending-card';
import { Glass } from '@/components/quests/glass';
import { SaidCard } from '@/components/quests/said-card';
import { Stage } from '@/components/quests/stage';
import { StatBars } from '@/components/quests/stat-bar';
import { TopBar } from '@/components/quests/top-bar';
import { MaxContentWidth } from '@/constants/theme';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { useSession } from '@/hooks/use-session';
import { AXIS_SHORT_NAME } from '@/lib/axis-poles';
import { haptic } from '@/lib/motion-tokens';
import { campaignById } from '@/lib/quests/content';
import { RUN, picksOf, resolveScene, rewindTarget, sceneLines, type ActiveRun, type RunMode } from '@/lib/quests/run';
import { runStore, endingsFound, type QuestProgress } from '@/lib/quests/run-store';
import { SAID_COPY, UI_COPY, fmt } from '@/lib/quests/strings';
import { scoreRun } from '@/lib/quests/score';
import { QT, QT_RADIUS, QT_SPACE, QT_TYPE, plateHeight } from '@/lib/quests/theme';
import { useQuestRun } from '@/lib/quests/use-run';
import { validateCampaign } from '@/lib/quests/validate';
import {
  canSave,
  chapterCount,
  lastLivePick,
  saidModel,
  statAnnouncement,
  statChanges,
  type StatChange,
} from '@/lib/quests/view';
import type { QuestCampaign, Stat } from '@/lib/quests/types';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';
import type { TraitAxis } from '@/lib/traits';

/** The hold animation plays this long before the choice lands (the ring already filled for a hold). */
const COMMIT_BEAT_MS = 260;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** "What your choices said": up to three cards, nothing pre-ticked, Save stubbed until PHASE-17. */
function SaidView({
  run,
  campaign,
  onFinish,
  onDiscard,
}: {
  run: ActiveRun;
  campaign: QuestCampaign;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const userId = session?.user.id;
  const [tracks, setTracks] = useState<TraitTrack[] | null>(null);
  const [progress, setProgress] = useState<QuestProgress | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<TraitAxis>>(new Set());
  const [notMe, setNotMe] = useState<ReadonlySet<TraitAxis>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let alive = true;
    runStore.loadProgress().then((p) => alive && setProgress(p));
    (userId ? fetchTraitTracks(userId) : Promise.resolve([] as TraitTrack[]))
      .then((t) => alive && setTracks(t))
      .catch(() => alive && setTracks([]));
    return () => {
      alive = false;
    };
  }, [userId]);

  const model = useMemo(() => {
    if (!tracks || !progress) return null;
    return saidModel(
      scoreRun({
        campaign,
        picks: picksOf(run),
        mode: run.mode,
        now,
        tracks,
        priorEvidenceRuns: progress.evidence[campaign.id] ?? [],
      }),
    );
  }, [campaign, run, now, tracks, progress]);

  const toggle = (set: ReadonlySet<TraitAxis>, axis: TraitAxis): ReadonlySet<TraitAxis> => {
    const next = new Set(set);
    if (next.has(axis)) next.delete(axis);
    else next.add(axis);
    return next;
  };

  const hasCards = !!model && model.cards.length > 0;
  const ready = hasCards ? canSave(ticked, notMe) : true;

  return (
    <>
      <ScrollView contentContainerStyle={styles.panelScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <Text style={styles.saidTitle} accessibilityRole="header">
            {UI_COPY.saidTitle}
          </Text>
          {model === null ? (
            <Text style={styles.sub} accessibilityLiveRegion="polite">
              {UI_COPY.loading}
            </Text>
          ) : (
            <>
              {model.note === 'for_fun' ? <Text style={styles.sub}>{UI_COPY.saidFunRun}</Text> : null}
              {model.note === 'evidence_window' ? <Text style={styles.sub}>{UI_COPY.saidEvidenceWindow}</Text> : null}
              {!hasCards && !model.note ? <Text style={styles.sub}>{UI_COPY.saidNothing}</Text> : null}
              {model.cards.map((card, i) => (
                <SaidCard
                  key={card.axis}
                  card={card}
                  index={i}
                  ticked={ticked.has(card.axis) && !notMe.has(card.axis)}
                  notMe={notMe.has(card.axis)}
                  onTick={() => setTicked((s) => toggle(s, card.axis))}
                  onNotMe={() => setNotMe((s) => toggle(s, card.axis))}
                />
              ))}
              {model.contradiction ? <Text style={styles.sub}>{SAID_COPY.contradiction}</Text> : null}
              {model.notEnough.length > 0 ? (
                <View style={styles.notEnough}>
                  <Text style={styles.label}>{UI_COPY.saidNotEnough}</Text>
                  <Text style={styles.sub}>
                    {fmt(UI_COPY.saidNotEnoughBody, { axes: model.notEnough.map((a) => AXIS_SHORT_NAME[a]).join(', ') })}
                  </Text>
                </View>
              ) : null}
            </>
          )}
          <Text style={styles.ethics}>{UI_COPY.saidEthics}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={UI_COPY.saidMessing}
            onPress={() => setConfirm(true)}
            style={styles.messing}
          >
            <Text style={styles.messingText}>{UI_COPY.saidMessing}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.column}>
          <ContinueButton
            label={hasCards ? (ready ? UI_COPY.saidSave : UI_COPY.saidTickFirst) : UI_COPY.saidDone}
            disabled={model === null || !ready}
            onPress={onFinish}
          />
          {__DEV__ && hasCards ? <Text style={styles.note}>{UI_COPY.saidSaveStub}</Text> : null}
        </View>
      </View>

      <Modal transparent animationType="fade" visible={confirm} onRequestClose={() => setConfirm(false)}>
        <View style={styles.scrim}>
          <Glass style={styles.sheet}>
            <Text style={styles.saidTitle} accessibilityRole="header">
              {UI_COPY.messingTitle}
            </Text>
            <Text style={styles.sub}>{UI_COPY.messingBody}</Text>
            <ContinueButton label={UI_COPY.messingConfirm} onPress={onDiscard} />
            <Pressable accessibilityRole="button" onPress={() => setConfirm(false)} style={styles.messing}>
              <Text style={styles.messingText}>{UI_COPY.messingKeep}</Text>
            </Pressable>
          </Glass>
        </View>
      </Modal>
    </>
  );
}

function Centered({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.saidTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.sub}>{body}</Text>
      <View style={styles.centerButton}>
        <ContinueButton label={UI_COPY.close} onPress={onClose} />
      </View>
    </View>
  );
}

export default function QuestRunScreen() {
  const params = useLocalSearchParams<{ id: string; mode?: string; fresh?: string }>();
  const campaignId = String(params.id ?? '');
  const mode: RunMode = params.mode === 'fun' ? 'fun' : 'me';
  const { run, status, resumed, funBecause, dispatch } = useQuestRun(campaignId, { mode, fresh: params.fresh === '1' });
  const campaign = campaignById(campaignId);
  const rm = useMotionReduced();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const plate = plateHeight(height);

  const [typing, setTyping] = useState<{ npc: boolean } | null>(null);
  const [hopKey, setHopKey] = useState(0);
  const [rewindKey, setRewindKey] = useState(0);
  const [beatKey, setBeatKey] = useState(0);
  const [committing, setCommitting] = useState<string | null>(null);
  const [beatFrom, setBeatFrom] = useState<Record<Stat, number> | null>(null);
  const [seenChapter, setSeenChapter] = useState<number | null | 'init'>('init');
  const [found, setFound] = useState<QuestProgress | null>(null);
  const busy = useRef(false);

  const active = run.phase === 'select' ? null : run;
  const scene = active && campaign && active.sceneId ? resolveScene(campaign, active.sceneId) : undefined;
  const ending = active?.endingId && campaign ? campaign.endings.find((e) => e.id === active.endingId) : undefined;
  const chapters = campaign ? chapterCount(campaign.scenes) : 1;
  const devErrors = useMemo(() => (__DEV__ && campaign ? validateCampaign(campaign).errors : []), [campaign]);

  // A finished or discarded run goes back to the list.
  useEffect(() => {
    if (status !== 'ready' || run.phase !== 'select') return;
    if (router.canGoBack()) router.back();
    else router.replace('/quest' as Href);
  }, [status, run.phase]);

  // A tap on a screen that is already gone must not commit.
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // A resumed scene never shows its chapter card again; a fresh run starts with chapter 1's.
  useEffect(() => {
    if (status === 'ready' && seenChapter === 'init') setSeenChapter(resumed && scene ? scene.chapter : null);
  }, [status, seenChapter, resumed, scene]);

  // "Ending 2 of 4": read after the reducer step has saved the ending (the store runs in call order).
  const phase = active?.phase;
  useEffect(() => {
    if (phase !== 'ending' && phase !== 'said') return undefined;
    let alive = true;
    runStore.loadProgress().then((p) => alive && setFound(p));
    return () => {
      alive = false;
    };
  }, [phase]);

  const chapterNow = scene?.chapter ?? chapters;
  const target = active && campaign ? rewindTarget(campaign, active) : null;
  // The count is for the chapter the Rewind would undo; no target means none left.
  const rewindsLeft = active && target ? Math.max(0, RUN.rewindsPerChapter - (active.rewinds[String(target.chapter)] ?? 0)) : 0;

  const changes: StatChange[] = useMemo(
    () => (active?.phase === 'beat' && beatFrom ? statChanges(beatFrom, active.stats) : []),
    [active, beatFrom],
  );
  const beatPick = active ? lastLivePick(active.history) : undefined;
  const beatChoice = beatPick && campaign ? resolveScene(campaign, beatPick.sceneId)?.choices.find((c) => c.id === beatPick.choiceId) : undefined;

  // Once per beat: say what changed, and a Success haptic if anything went up (a d20 tile has its own).
  useEffect(() => {
    if (!beatKey || changes.length === 0) return;
    AccessibilityInfo.announceForAccessibility(statAnnouncement(changes));
    if (changes.some((c) => c.delta > 0) && !beatPick?.roll) haptic.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey]);

  const choose = useCallback(
    async (choiceId: string) => {
      if (busy.current || !active || active.phase === 'beat') return;
      busy.current = true;
      try {
        setBeatFrom(active.stats);
        setCommitting(choiceId);
        // Cards ignore taps while committing, so `pending` is still this choice after the wait.
        await dispatch({ type: 'select', choiceId });
        if (!rm) await wait(COMMIT_BEAT_MS);
        if (!alive.current) {
          setCommitting(null);
          return;
        }
        // The beat number moves with the commit, so the d20 tile mounts once.
        setBeatKey((k) => k + 1);
        setHopKey((k) => k + 1);
        await dispatch({ type: 'commit' });
        setCommitting(null);
      } finally {
        busy.current = false;
      }
    },
    [active, dispatch, rm],
  );

  const close = () => router.back();

  if (!campaign || status === 'missing') {
    return (
      <View style={styles.root}>
        <Centered title={UI_COPY.errorTitle} body={UI_COPY.errorBody} onClose={close} />
      </View>
    );
  }
  if (devErrors.length > 0) {
    return (
      <View style={styles.root}>
        <Centered title={UI_COPY.errorTitle} body={fmt(UI_COPY.contentInvalid, { first: devErrors[0] })} onClose={close} />
      </View>
    );
  }
  if (status === 'loading' || !active) {
    return (
      <View style={styles.root}>
        <Centered title={campaign.title} body={UI_COPY.loading} onClose={close} />
      </View>
    );
  }

  const location = scene?.art.location ?? ending?.art ?? campaign.scenes[0].art.location;
  const cardUp = active.phase === 'scene' && !!scene && seenChapter !== 'init' && seenChapter !== scene.chapter && !active.typedDone.includes(scene.id);
  // Until the first chapter decision is made, nothing starts typing behind the card.
  const sceneReady = seenChapter !== 'init' && !cardUp;
  const inPlay = active.phase === 'scene' || active.phase === 'commit' || active.phase === 'beat';

  const choiceState = (id: string): ChoiceState => {
    if (committing) return id === committing ? 'selected' : 'dimmed';
    return active.phase === 'commit' && active.pending === id ? 'selected' : 'idle';
  };

  return (
    <View style={styles.root}>
      <View>
        <Stage
          location={location}
          tint={scene?.art.tint}
          cast={scene?.art.cast}
          height={plate}
          typing={!!typing}
          npcSpeaking={!!typing?.npc}
          hopKey={hopKey}
          rewindKey={rewindKey}
          assemble={active.phase === 'ending'}
          paused={cardUp}
        />
        <TopBar
          chapter={chapterNow}
          chapters={chapters}
          rewindsLeft={rewindsLeft}
          fun={active.mode === 'fun'}
          onClose={close}
          onRewind={
            inPlay && target && !committing
              ? async () => {
                  await dispatch({ type: 'rewind' });
                  setRewindKey((k) => k + 1);
                  setBeatFrom(null);
                }
              : undefined
          }
        />
      </View>

      {active.phase !== 'said' ? (
        <View style={styles.stats}>
          <StatBars stats={active.stats} changes={changes} beatKey={beatKey} />
        </View>
      ) : null}

      {active.notice === 'restarted' ? (
        <View style={styles.column}>
          <Glass style={styles.noticeCard}>
            <Text style={styles.sub}>{UI_COPY.noticeRestarted}</Text>
            <Pressable accessibilityRole="button" onPress={() => dispatch({ type: 'dismissNotice' })} style={styles.messing}>
              <Text style={styles.messingText}>{UI_COPY.noticeGotIt}</Text>
            </Pressable>
          </Glass>
        </View>
      ) : null}
      {funBecause === 'evidence_window' && active.phase === 'scene' && active.history.length === 0 ? (
        <View style={styles.column}>
          <Text style={styles.sub}>{UI_COPY.saidEvidenceWindow}</Text>
        </View>
      ) : null}

      {active.phase === 'said' && campaign ? (
        <SaidView
          key={active.runId}
          run={active}
          campaign={campaign}
          onFinish={() => dispatch({ type: 'finish' })}
          onDiscard={() => dispatch({ type: 'discard' })}
        />
      ) : (
        <ScrollView
          style={styles.panel}
          contentContainerStyle={[styles.panelScroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {(active.phase === 'scene' || active.phase === 'commit') && scene && sceneReady ? (
              <>
                <Dialogue
                  key={scene.id}
                  lines={sceneLines(scene, active.flags)}
                  instant={active.typedDone.includes(scene.id)}
                  onTyping={setTyping}
                  onDone={() => dispatch({ type: 'typed', sceneId: scene.id })}
                />
                {active.typedDone.includes(scene.id) ? (
                  <View style={styles.choices}>
                    {scene.choices.map((choice, i) => (
                      <ChoiceCard
                        key={choice.id}
                        choice={choice}
                        stats={active.stats}
                        index={i}
                        state={choiceState(choice.id)}
                        onSelect={() => {
                          if (!busy.current) dispatch({ type: 'select', choiceId: choice.id });
                        }}
                        onChoose={() => choose(choice.id)}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {active.phase === 'beat' && beatChoice ? (
              <BeatCard choiceLabel={beatChoice.label} result={beatChoice.result}>
                {beatChoice.check && beatPick?.roll && beatFrom ? (
                  <D20Tile key={beatKey} roll={beatPick.roll} check={beatChoice.check} value={beatFrom[beatChoice.check.stat]} />
                ) : null}
                <ContinueButton onPress={() => dispatch({ type: 'continue' })} />
              </BeatCard>
            ) : null}

            {active.phase === 'ending' && ending ? (
              <Animated.View entering={FadeIn.duration(rm ? 300 : 400)}>
                <EndingCard
                  ending={ending}
                  found={found ? endingsFound(found, campaign).found : 1}
                  total={endingsFound(found ?? { endings: {}, evidence: {} }, campaign).total}
                  onContinue={() => dispatch({ type: 'continue' })}
                />
              </Animated.View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {cardUp && scene ? (
        <ChapterCard
          key={scene.chapter}
          chapter={scene.chapter}
          subtitle={campaign.title}
          onDone={() => setSeenChapter(scene.chapter)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: QT.bg },
  stats: { paddingTop: 14, paddingBottom: 6 },
  panel: { flex: 1 },
  panelScroll: { alignItems: 'center', paddingTop: 12, paddingBottom: 24 },
  column: { width: '100%', maxWidth: Math.min(MaxContentWidth, 600), paddingHorizontal: QT_SPACE.gutter, gap: QT_SPACE.cardGap },
  choices: { marginTop: 4 },
  sticky: {
    alignItems: 'center',
    paddingTop: 10,
    backgroundColor: 'rgba(7,11,22,0.96)',
    borderTopWidth: 1,
    borderTopColor: QT.glassBorder,
  },
  saidTitle: { ...QT_TYPE.h1, color: QT.text },
  sub: { ...QT_TYPE.small, color: QT.sub },
  label: { ...QT_TYPE.label, color: QT.sub },
  note: { ...QT_TYPE.small, color: QT.sub, textAlign: 'center' },
  ethics: { ...QT_TYPE.small, color: QT.sub, textAlign: 'center', marginTop: 4 },
  notEnough: { gap: 4 },
  messing: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  messingText: { ...QT_TYPE.ui, color: QT.sky },
  noticeCard: { padding: 12, gap: 4, marginTop: 8 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: QT_SPACE.gutter },
  sheet: { padding: QT_SPACE.pad + 4, gap: 12, borderRadius: QT_RADIUS.card },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerButton: { width: '100%', maxWidth: 320 },
});
