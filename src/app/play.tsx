import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilestoneToast } from '@/components/milestone-toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppearance } from '@/lib/theme/context';
import { useTheme } from '@/hooks/use-theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import {
  GROVE_ACTION_TILES,
  GROVE_LEDE,
  PREVIEW_CLAIM_TOKENS,
  PREVIEW_START_TOKENS,
  RESEARCH_PREVIEW_BODY,
  RESEARCH_PREVIEW_TITLE,
} from '@/play/grove';

/**
 * Play room — Grove screen (GAME_SPEC §3, §11 screen 1).
 *
 * Step 1 shell only: placeholder avatar, preview tokens, a Claim button that
 * bumps a fake bag toast, and Dive/Dress/Defend marked "soon". No store yet —
 * Step 2 lands `playStore` (AsyncStorage) and swaps the preview numbers out.
 * Routable because it lives under `src/app/`; all Play data/logic will stay in
 * `src/play/`. Hidden outside pre-launch builds via PRE_LAUNCH_DEV.
 */
export default function PlayScreen() {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const [tokens, setTokens] = useState(PREVIEW_START_TOKENS);
  const [claimed, setClaimed] = useState(false);

  const handleClaim = useCallback(() => {
    setTokens((current) => current + PREVIEW_CLAIM_TOKENS);
    setClaimed(true);
  }, []);

  function closePlay() {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Deep link / web entry with no history: land on the You tab.
      router.replace('/you');
    }
  }

  if (!PRE_LAUNCH_DEV) {
    return <Redirect href="/" />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topRow}>
            <Pressable onPress={closePlay} hitSlop={12} style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ‹ Back
              </ThemedText>
            </Pressable>
          </View>

          <ThemedText type="subtitle">Grove</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.lede}>
            {GROVE_LEDE}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.groveRow}>
              {/* Placeholder avatar — TODO: SakPix swap. No mock PNGs in v0. */}
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                <MaterialCommunityIcons name="sprout" size={44} color={theme.accent} />
              </View>
              <View style={styles.groveText}>
                <ThemedText type="heading">Your grove</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {RESEARCH_PREVIEW_TITLE}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {RESEARCH_PREVIEW_BODY}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {claimed ? (
            <MilestoneToast
              title={`Claimed +${PREVIEW_CLAIM_TOKENS} tokens`}
              body="Preview bag — real finds arrive with Step 2."
              reduceMotion={reduceMotion}
              onDone={() => setClaimed(false)}
            />
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.statRow}>
              <ThemedText type="smallBold">Tokens</ThemedText>
              <ThemedText type="subheading" themeColor="emphasis">
                {tokens}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleClaim}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.claimButton,
                { backgroundColor: theme.accentFill },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Claim
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Preview economy — resets when real Research arrives.
            </ThemedText>
          </ThemedView>

          <View style={styles.actionList}>
            {GROVE_ACTION_TILES.map((tile) => (
              <ThemedView key={tile.kind} type="backgroundElement" style={styles.actionCard}>
                <MaterialCommunityIcons name={tile.icon} size={22} color={theme.textSecondary} />
                <View style={styles.actionText}>
                  <ThemedText type="smallBold">{tile.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {tile.lede}
                  </ThemedText>
                </View>
                <View style={[styles.soonBadge, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="code" themeColor="textSecondary">
                    {tile.soon}
                  </ThemedText>
                </View>
              </ThemedView>
            ))}
          </View>
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
  scrollContent: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lede: {
    marginTop: -Spacing.one,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  groveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groveText: {
    flex: 1,
    gap: Spacing.half,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  claimButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  actionList: {
    gap: Spacing.two,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    opacity: 0.9,
  },
  actionText: {
    flex: 1,
    gap: Spacing.half,
  },
  soonBadge: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.8,
  },
});
