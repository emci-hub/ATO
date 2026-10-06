import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BankFinishFold } from '@/components/bank-finish-fold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import type { Me } from '@/lib/me';
import { parseSnapshot, type ProfileSnapshot } from '@/lib/profile-history';
import { QUESTION_BANK } from '@/lib/questions/bank/index';
import { bankProgressFrom } from '@/lib/questions/bank-sets';
import type { TraitTrack } from '@/lib/trait-stability';
import { TRAIT_AXES, type TraitAxis } from '@/lib/traits';

/**
 * Dev harness for the after-25 view (wave86): Change answers, Undo, Start
 * Fresh keep/wipe and the card binder, on fixed sample data with no server
 * reads (BankFinishFold's `preview`). Not linked from the app except the Hub's
 * Labs list; open /profile-card-lab. Pre-launch only.
 */
export default function ProfileCardLabScreen() {
  if (!PRE_LAUNCH_DEV) {
    return <Redirect href="/" />;
  }
  return <ProfileCardLab />;
}

const NOW_VALUES: Record<TraitAxis, number> = {
  openness: 0.78,
  conscientiousness: 0.64,
  extraversion: 0.31,
  agreeableness: 0.57,
  steadiness: 0.49,
  attachment_anxiety: 0.42,
  attachment_avoidance: 0.36,
  conflict_assertiveness: 0.61,
  conflict_cooperativeness: 0.55,
  autonomy: 0.82,
  competence: 0.66,
  relatedness: 0.44,
  growth_mindset: 0.73,
  locus_of_control: 0.68,
  self_efficacy: 0.59,
  playfulness: 0.52,
};

const shift = (delta: Partial<Record<TraitAxis, number>>) =>
  Object.fromEntries(TRAIT_AXES.map((a) => [a, Math.round((NOW_VALUES[a] + (delta[a] ?? 0)) * 1000) / 1000]));

const SNAPSHOTS: ProfileSnapshot[] = [
  parseSnapshot('sep', '2026-09-15T03:07:00Z', 'monthly', { values: shift({ openness: -0.16, autonomy: -0.12, extraversion: 0.22 }) }),
  parseSnapshot('aug', '2026-08-15T03:07:00Z', 'monthly', { values: shift({ openness: -0.3, playfulness: 0.2, steadiness: -0.15 }) }),
].filter((s): s is ProfileSnapshot => s != null);

const ME = {
  id: 'lab',
  updated_at: '2026-10-06T00:00:00Z',
  ...NOW_VALUES,
  trait_sources: {},
  trait_touched_at: {},
} as unknown as Me;

const TRACKS: TraitTrack[] = TRAIT_AXES.map((axis, i) => ({
  axis,
  track: 'report',
  value: NOW_VALUES[axis],
  stability: i % 5 === 0 ? 0.2 : 0.8,
  answerCount: 25,
  lastTouched: '2026-10-06T00:00:00Z',
  lastDepthAt: null,
}));

const ALL_IDS = QUESTION_BANK.map((q) => q.id);
const ANSWERS = new Map(QUESTION_BANK.map((q, i) => [q.id, i % q.options.length]));
const noop = async () => {};

function ProfileCardLab() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.inner}>
            <ThemedText type="subtitle">Profile cards lab</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Sample data. Nothing here reads or writes the server.
            </ThemedText>
            <BankFinishFold
              me={ME}
              tracks={TRACKS}
              progress={bankProgressFrom(ALL_IDS)}
              onUpdated={noop}
              onReload={noop}
              preview={{ snapshots: SNAPSHOTS, answers: ANSWERS, flags: new Set<TraitAxis>(['extraversion']) }}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: { alignItems: 'center', paddingVertical: Spacing.four },
  inner: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, gap: Spacing.three },
});
