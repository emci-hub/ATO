import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinueButton } from '@/components/quests/dialogue';
import { Glass } from '@/components/quests/glass';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { MaxContentWidth } from '@/constants/theme';
import { DUR, SPRING_POP, UI_IN, haptic } from '@/lib/motion-tokens';
import { QUEST_CAMPAIGNS, campaignById } from '@/lib/quests/content';
import { resolveScene, type ActiveRun, type RunMode } from '@/lib/quests/run';
import { runStore, endingsFound, type QuestProgress } from '@/lib/quests/run-store';
import { UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_RADIUS, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';
import { chapterCount } from '@/lib/quests/view';

/** Samples are for development only; real campaigns arrive with PHASE-18. */
const SHOWN = QUEST_CAMPAIGNS.filter((c) => __DEV__ || !c.isSample);

const SEGMENTS: { mode: RunMode; label: string }[] = [
  { mode: 'me', label: UI_COPY.modeMe },
  { mode: 'fun', label: UI_COPY.modeFun },
];

/** "As me / For fun": the thumb springs across. Reduce Motion: it just moves. */
function ModeToggle({ mode, onChange }: { mode: RunMode; onChange: (m: RunMode) => void }) {
  const rm = useMotionReduced();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(mode === 'me' ? 0 : 1);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (width / 2) }] }));
  const pick = (m: RunMode) => {
    haptic.press();
    x.value = rm ? (m === 'me' ? 0 : 1) : withSpring(m === 'me' ? 0 : 1, SPRING_POP);
    onChange(m);
  };
  return (
    <View
      style={styles.toggle}
      accessibilityRole="radiogroup"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
    >
      <Animated.View pointerEvents="none" style={[styles.thumb, { width: width / 2 }, thumb]} />
      {SEGMENTS.map((s) => (
        <Pressable
          key={s.mode}
          accessibilityRole="radio"
          accessibilityState={{ checked: mode === s.mode }}
          accessibilityLabel={s.label}
          onPress={() => pick(s.mode)}
          style={styles.segment}
        >
          <Text style={[styles.segmentText, mode === s.mode && styles.segmentOn]}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function QuestSelectScreen() {
  const rm = useMotionReduced();
  const [mode, setMode] = useState<RunMode>('me');
  const [progress, setProgress] = useState<QuestProgress | null>(null);
  const [saved, setSaved] = useState<ActiveRun | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [p, loaded] = await Promise.all([runStore.loadProgress(), runStore.loadRun()]);
        if (!alive) return;
        setProgress(p);
        setSaved(loaded.run);
      })().catch(() => alive && setProgress({ endings: {}, evidence: {} }));
      return () => {
        alive = false;
      };
    }, []),
  );

  const start = (id: string) => {
    haptic.commit();
    router.push(`/quest/${id}?mode=${mode}&fresh=1` as Href);
  };
  const resume = (id: string) => {
    haptic.commit();
    router.push(`/quest/${id}` as Href);
  };

  const savedCampaign = saved ? campaignById(saved.campaignId) : undefined;
  const rise = (i: number) =>
    rm ? FadeIn.duration(300) : FadeInDown.delay(i * 70).duration(DUR.scene - 100).easing(UI_IN);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={UI_COPY.close}
              onPress={() => router.back()}
              style={styles.close}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">
              {UI_COPY.selectTitle}
            </Text>
          </View>
          <Text style={styles.lead}>{UI_COPY.selectLead}</Text>

          <ModeToggle mode={mode} onChange={setMode} />
          <Text style={styles.note}>{mode === 'me' ? UI_COPY.modeMeNote : UI_COPY.modeFunNote}</Text>

          {progress === null ? (
            <Text style={styles.note} accessibilityLiveRegion="polite">
              {UI_COPY.loading}
            </Text>
          ) : null}

          {savedCampaign && saved ? (
            <Animated.View entering={rise(0)}>
              <Glass ring style={styles.card}>
                <Text style={styles.campaign}>{savedCampaign.title}</Text>
                <Text style={styles.meta}>
                  {fmt(UI_COPY.continueMeta, {
                    chapter: (saved.sceneId ? resolveScene(savedCampaign, saved.sceneId)?.chapter : undefined) ?? chapterCount(savedCampaign.scenes),
                    chapters: chapterCount(savedCampaign.scenes),
                  })}
                </Text>
                <ContinueButton label={UI_COPY.continueRun} onPress={() => resume(savedCampaign.id)} />
              </Glass>
            </Animated.View>
          ) : null}

          {progress !== null && SHOWN.length === 0 ? (
            <Animated.View entering={rise(0)}>
              <Glass style={styles.card}>
                <Text style={styles.campaign}>{UI_COPY.emptyTitle}</Text>
                <Text style={styles.meta}>{UI_COPY.emptyBody}</Text>
              </Glass>
            </Animated.View>
          ) : null}

          {progress !== null
            ? SHOWN.map((c, i) => {
                const { found, total } = endingsFound(progress, c);
                return (
                  <Animated.View key={c.id} entering={rise(i + 1)}>
                    <Glass style={styles.card}>
                      <Text style={styles.campaign} accessibilityRole="header">
                        {c.title}
                      </Text>
                      <Text style={styles.meta}>{fmt(UI_COPY.campaignMeta, { minutes: c.minutes, found, total })}</Text>
                      <ContinueButton label={UI_COPY.startRun} onPress={() => start(c.id)} />
                    </Glass>
                  </Animated.View>
                );
              })
            : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: QT.bg },
  scroll: { alignItems: 'center', paddingBottom: 48 },
  column: { width: '100%', maxWidth: Math.min(MaxContentWidth, 600), paddingHorizontal: QT_SPACE.gutter, gap: QT_SPACE.cardGap },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: QT.glassFill,
    borderWidth: 1,
    borderColor: QT.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: QT.text, fontSize: 16, fontWeight: '700' },
  title: { ...QT_TYPE.display, color: QT.text },
  lead: { ...QT_TYPE.body, color: QT.sub },
  toggle: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: QT_RADIUS.pill,
    backgroundColor: QT.glassFill,
    borderWidth: 1,
    borderColor: QT.glassBorder,
  },
  thumb: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: QT_RADIUS.pill,
    backgroundColor: 'rgba(34,211,238,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.5)',
  },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  segmentText: { ...QT_TYPE.ui, color: QT.sub },
  segmentOn: { color: QT.text },
  note: { ...QT_TYPE.small, color: QT.sub },
  card: { padding: QT_SPACE.pad + 2, gap: 10 },
  campaign: { ...QT_TYPE.h1, color: QT.text },
  meta: { ...QT_TYPE.small, color: QT.sub },
});
