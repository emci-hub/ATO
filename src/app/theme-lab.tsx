import { Redirect } from 'expo-router';
import { useState } from 'react';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AskSheet from '@/components/ask-sheet';
import { AppearancePicker } from '@/components/appearance-picker';
import { MilestoneBadges } from '@/components/check-milestone-badge';
import { RevealCard } from '@/components/reveal-card';
import { RankingCard } from '@/components/ranking-card';
import { ScenarioCard } from '@/components/scenario-card';
import { QuestGrowthBars } from '@/components/quest-growth-bars';
import { GradientFill } from '@/components/gradient-fill';
import { LivingBg } from '@/components/living-bg';
import { PlusPop } from '@/components/plus-pop';
import { PressPop } from '@/components/press-pop';
import { Sheen } from '@/components/sheen';
import { ThemedTabBar } from '@/components/themed-tab-bar';
import { TraitConstellation } from '@/components/trait-constellation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppearance } from '@/lib/theme/context';
import { useTheme } from '@/hooks/use-theme';
import { unlockedBadgeFixture } from '@/lib/badges';
import {
  homeSageLabel,
  homeSageLede,
  NUDGE_LABEL,
  SAGE_COACH_LABEL,
  SAGE_NOT_A_PERSON,
} from '@/lib/sage-copy';
import type { AskPick } from '@/lib/ask';
import type { RevealPick } from '@/lib/reveal';
import { RANKING_ROUNDS, type RankingPrompt } from '@/lib/ranking';
import { composeSageKnowsLine } from '@/lib/sage-knows';
import { SCENARIO_DECK, type ScenarioPrompt } from '@/lib/scenario';
import type { TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, TRAIT_POLE_LINES } from '@/lib/traits';

// Motion-lab fixtures: nine lit axes (one firmly settled = gold), and last
// week's version of the same figure for the morph.
const labTrack = (axis: (typeof TRAIT_AXES)[number], value: number, stability: number): TraitTrack => ({
  axis,
  track: 'report',
  value,
  stability,
  answerCount: 6,
  lastTouched: '2026-10-20T00:00:00.000Z',
  lastDepthAt: null,
});
const LAB_TRACKS: TraitTrack[] = TRAIT_AXES.slice(0, 9).map((axis, i) =>
  labTrack(axis, 0.2 + ((i * 0.37) % 0.7), i === 2 ? 0.9 : 0.25 + i * 0.05),
);
const LAB_GHOST: TraitTrack[] = LAB_TRACKS.map((t, i) => ({ ...t, value: Math.min(1, Math.max(0, t.value + (i % 2 ? 0.2 : -0.2))) }));

const THEME_REVEAL_WEEK: RevealPick = {
  kind: 'week-pattern',
  text: "You showed up on 3 Checks this week. The Dos stayed one-step sized.",
};

const THEME_REVEAL_FACT: RevealPick = {
  kind: 'fact',
  text: 'Still true: I finish work at four',
};

const THEME_RANKING: RankingPrompt = {
  axis: 'extraversion',
  items: RANKING_ROUNDS.extraversion,
  order: RANKING_ROUNDS.extraversion.map((item) => item.id),
  weekKey: '2026-08-23',
};

const THEME_SCENARIO_LOCUS: ScenarioPrompt = {
  axis: 'locus_of_control',
  def: SCENARIO_DECK.locus_of_control,
  weekKey: '2026-08-23',
};

const THEME_SCENARIO_AUTONOMY: ScenarioPrompt = {
  axis: 'autonomy',
  def: SCENARIO_DECK.autonomy,
  weekKey: '2026-08-23',
};

const THEME_ASK_SAGE_KNOWS: AskPick = {
  kind: 'sage_knows',
  prompt: {
    axis: 'extraversion',
    ...composeSageKnowsLine(TRAIT_POLE_LINES.extraversion.high, null),
  },
};

const THEME_ASK_RANKING: AskPick = {
  kind: 'ranking',
  prompt: THEME_RANKING,
};

const THEME_ASK_SCENARIO: AskPick = {
  kind: 'scenario',
  prompt: THEME_SCENARIO_LOCUS,
};

/**
 * Dev harness for the five appearance modes. Mirrors Home card chrome so
 * modes can be compared without a session. Production: /theme-lab is blocked.
 */
export default function ThemeLabScreen() {
  const theme = useTheme();
  const { id } = useAppearance();

  if (!PRE_LAUNCH_DEV) {
    return <Redirect href="/" />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Home</ThemedText>
            <ThemedText themeColor="textSecondary">
              {homeSageLede(id)}
            </ThemedText>
            <MilestoneBadges defaultOpen {...unlockedBadgeFixture()} />
          </View>

          <ThemedView type="backgroundElement" style={styles.todayCard}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.sageKicker}>
              {homeSageLabel(id)} · read
            </ThemedText>
            <ThemedText>First one logged. No pressure — just seeing what&apos;s actually true day to day.</ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.todayCard}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
              do
            </ThemedText>
            <ThemedText>After you make coffee, sit for one minute before opening your phone.</ThemedText>
          </ThemedView>
          <ThemedView type="backgroundElement" style={styles.todayCard}>
            <ThemedText type="code" themeColor="textSecondary" style={styles.sageKicker}>
              {NUDGE_LABEL}
            </ThemedText>
            <ThemedText>
              Sleep is what you said knocks you off, and it showed up in this week&apos;s Checks. Today&apos;s Do stays small so tomorrow is still reachable.
            </ThemedText>
          </ThemedView>

          <ThemedText type="smallBold">Reveal · week pattern</ThemedText>
          <RevealCard pick={THEME_REVEAL_WEEK} />
          <ThemedText type="smallBold">Reveal · fact</ThemedText>
          <RevealCard pick={THEME_REVEAL_FACT} />
          <ThemedText type="smallBold">Reveal · Reduce Motion</ThemedText>
          <RevealCard pick={THEME_REVEAL_WEEK} forceReduceMotion />
          <ThemedText type="smallBold">Reveal · empty pool</ThemedText>
          <RevealCard pick={null} />
          <ThemedText type="smallBold">Ranking · extraversion</ThemedText>
          <RankingCard forcePick={THEME_RANKING} />
          <ThemedText type="smallBold">Scenario · first thought</ThemedText>
          <ScenarioCard forcePick={THEME_SCENARIO_LOCUS} />
          <ThemedText type="smallBold">Scenario · my way</ThemedText>
          <ScenarioCard forcePick={THEME_SCENARIO_AUTONOMY} />
          <ThemedText type="smallBold">Ask sheet · does ATO know you</ThemedText>
          <AskSheet pick={THEME_ASK_SAGE_KNOWS} />
          <ThemedText type="smallBold">Ask sheet · ranking</ThemedText>
          <AskSheet pick={THEME_ASK_RANKING} />
          <ThemedText type="smallBold">Ask sheet · scenario</ThemedText>
          <AskSheet pick={THEME_ASK_SCENARIO} />
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.accentFill }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Logged it
            </ThemedText>
          </Pressable>

          <ThemedView type="backgroundElement" style={styles.faceCard}>
            <ThemedText type="code" themeColor="textSecondary">
              face · shape
            </ThemedText>
            <QuestGrowthBars presence={2} depth={1} />
          </ThemedView>

          <MotionLab />

          <AppearancePicker />

          {/* Talk was deleted with Sage (2026-10-14): Insights has no chat. */}
          <View style={styles.header}>
            <ThemedText type="subtitle">{SAGE_COACH_LABEL}</ThemedText>
            <ThemedText themeColor="textSecondary">{SAGE_NOT_A_PERSON}</ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
      <ThemedTabBar pointerEvents="none">
        {(['Home', 'Insights', 'Questions', 'Explore'] as const).map((label, i) => (
          <ThemedView
            key={label}
            type={i === 0 ? 'backgroundSelected' : 'background'}
            style={styles.tabPreview}>
            <ThemedText type="small" themeColor={i === 0 ? 'text' : 'textSecondary'}>
              {label}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedTabBar>
    </ThemedView>
  );
}

/** Every motion primitive, normal and Reduce Motion side by side (PHASE-03). */
function MotionLab() {
  const theme = useTheme();
  const [pops, setPops] = useState(0);
  const [changed, setChanged] = useState<readonly (typeof TRAIT_AXES)[number][]>([]);
  return (
    <View style={styles.header}>
      <ThemedText type="subtitle">Motion primitives</ThemedText>
      {([false, true] as const).map((rm) => (
        <ThemedView key={String(rm)} type="backgroundElement" style={styles.motionCard}>
          <ThemedText type="smallBold">{rm ? 'Reduce Motion' : 'Normal'}</ThemedText>
          <View style={styles.motionRow}>
            <PressPop
              forceReduceMotion={rm}
              accessibilityRole="button"
              accessibilityLabel="Press pop"
              onPress={() => setPops((n) => n + 1)}
              style={[styles.motionButton, { backgroundColor: theme.accentFill }]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                PressPop +1
              </ThemedText>
            </PressPop>
            <View style={styles.plusHost}>
              <PlusPop label="+5" trigger={pops} forceReduceMotion={rm} color={theme.accent} />
            </View>
          </View>
          <Sheen forceReduceMotion={rm} borderRadius={Spacing.three} style={[styles.motionButton, { backgroundColor: theme.accentFill }]}>
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Sheen
            </ThemedText>
          </Sheen>
          <View style={[styles.motionBox, { backgroundColor: theme.background }]}>
            <LivingBg forceReduceMotion={rm} colors={[`${theme.accent}55`, `${theme.accentSecondary}55`]} />
            <ThemedText type="smallBold">LivingBg</ThemedText>
          </View>
          <View style={styles.motionBox}>
            <GradientFill colors={['#5EEAD4', '#22D3EE', '#6366F1']} stops={[0, 0.45, 1]} borderRadius={Spacing.three} />
            <ThemedText type="smallBold" style={{ color: '#05070D' }}>
              GradientFill
            </ThemedText>
          </View>
          <TraitConstellation
            tracks={LAB_TRACKS}
            ghostTracks={LAB_GHOST}
            changedAxes={changed}
            size={240}
            variant="hero"
            forceReduceMotion={rm}
          />
        </ThemedView>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Brighten two stars"
        onPress={() => setChanged([TRAIT_AXES[0], TRAIT_AXES[4]])}
        style={[styles.motionButton, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">Brighten two stars</ThemedText>
      </Pressable>
      <ThemedText type="smallBold">Constellation · header / mini / badge / empty</ThemedText>
      <View style={styles.motionRow}>
        <TraitConstellation tracks={LAB_TRACKS} size={120} variant="header" />
        <TraitConstellation tracks={LAB_TRACKS} size={64} variant="mini" />
        <TraitConstellation tracks={LAB_TRACKS} size={32} variant="badge" />
      </View>
      <TraitConstellation tracks={[]} size={240} />
    </View>
  );
}

const styles = StyleSheet.create({
  motionCard: {
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'center',
  },
  motionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  motionButton: {
    minHeight: 44,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusHost: {
    width: 60,
    height: 44,
    justifyContent: 'center',
  },
  motionBox: {
    width: 240,
    height: 90,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  scrollContent: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: 96,
  },
  tabPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  header: {
    gap: Spacing.half,
  },
  todayCard: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  sageKicker: {
    textTransform: 'none',
  },
  primaryButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  faceCard: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  inputFake: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sendFake: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
