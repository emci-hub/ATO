import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MilestoneToast } from '@/components/milestone-toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { useAppearance } from '@/lib/theme/context';
import { GROVE_ACTION_TILES, GROVE_LEDE } from '@/play/grove';
import { itemName } from '@/play/items';
import {
  DIVE_CHARGE_CAP,
  canClaimResearch,
  devAddTokens,
  devFillDiveCharges,
  devFillResearchFull,
  devFillResearchOne,
  devResetPlayStore,
  type ClaimResult,
} from '@/play/playStore';
import { usePlayStore, type PlayTransition } from '@/play/use-play-store';

/**
 * Play room — Grove screen (GAME_SPEC §3, §11 screen 1).
 *
 * Step 1 shell (placeholder avatar + "soon" tiles) now rides a real local
 * economy from `usePlayStore` (`src/play/playStore.ts`): tokens, dive charges
 * (0–10, ~10 min refill), Research (30-min cycles, 10h cap, one Claim dump) and
 * the daily tend bonus (+10 once per device-local day). Claim also dumps the
 * bag as real stub items (step 2b) — one id rolled per cycle from
 * `src/play/data/items.json`, held in `inventory` until Dress (step 4). Dive /
 * Dress / Defend stay "soon" placeholders. No Supabase — local AsyncStorage
 * only. Hidden outside pre-launch builds via PRE_LAUNCH_DEV.
 */

type PlayToast =
  | { kind: 'claim'; result: ClaimResult }
  | { kind: 'find'; foundName: string };

export default function PlayScreen() {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const { view, claim, commit, grantRandomFind } = usePlayStore();
  const [toast, setToast] = useState<PlayToast | null>(null);

  const researchReady = view != null && canClaimResearch(view);

  const handleClaim = useCallback(async () => {
    const result = await claim();
    if (result) setToast({ kind: 'claim', result });
  }, [claim]);

  /** Dev kit row: roll one find into the bag and name it in the toast. */
  const handleGrantRandomFind = useCallback(async () => {
    const id = await grantRandomFind();
    if (id) setToast({ kind: 'find', foundName: itemName(id) ?? id });
  }, [grantRandomFind]);

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

  const tokensText = view == null ? '…' : String(view.tokens);
  const chargeText =
    view == null
      ? '…'
      : view.dive.full
        ? `${view.dive.current}/${DIVE_CHARGE_CAP}`
        : `${view.dive.current}/${DIVE_CHARGE_CAP} · +1 ~${minutesUntilLabel(
            view.dive.nextChargeAt,
          )}`;

  const researchTitle =
    view == null || researchReady
      ? 'Your grove is ready.'
      : 'Researching…';
  const researchBody =
    view == null
      ? '…'
      : researchReady
        ? `${view.research.readyFinds} ${findsWord(view.research.readyFinds)} waiting — Claim gathers them.`
        : `Next find in ~${minutesUntilLabel(view.research.nextFindAt)}.`;

  const claimLabel =
    view == null ? '…' : researchReady ? 'Claim' : `Ready in ~${minutesUntilLabel(view.research.nextFindAt)}`;

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
                  {researchTitle}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {researchBody}
                </ThemedText>
              </View>
            </View>
          </ThemedView>

          {toast ? (
            <MilestoneToast
              title={
                toast.kind === 'claim'
                  ? `Claimed +${toast.result.tendTokens + toast.result.dailyBonusTokens} tokens`
                  : 'Found'
              }
              body={
                toast.kind === 'claim' ? claimToastBody(toast.result) : toast.foundName
              }
              reduceMotion={reduceMotion}
              onDone={() => setToast(null)}
            />
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.statRow}>
              <ThemedText type="smallBold">Tokens</ThemedText>
              <ThemedText type="subheading" themeColor="emphasis">
                {tokensText}
              </ThemedText>
            </View>
            <View style={styles.statRow}>
              <ThemedText type="smallBold">Dive charges</ThemedText>
              <ThemedText type="subheading" themeColor="emphasis">
                {chargeText}
              </ThemedText>
            </View>
            <Pressable
              disabled={!researchReady}
              onPress={handleClaim}
              accessibilityRole="button"
              accessibilityState={{ disabled: !researchReady }}
              style={({ pressed }) => [
                styles.claimButton,
                { backgroundColor: researchReady ? theme.accentFill : theme.backgroundSelected },
                pressed && researchReady && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: researchReady ? theme.onAccent : theme.textSecondary }}>
                {claimLabel}
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Research accrues every 30 minutes — up to a 10-hour bag, then it waits for you.
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

          {PRE_LAUNCH_DEV ? <GroveDevKit commit={commit} onGrantRandomFind={handleGrantRandomFind} /> : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Standing test panel — extend per feature.
 *
 * The one debug surface for Play: PRE_LAUNCH_DEV-only (the route above already
 * redirects when the gate is off, so this can never render in production).
 * Whenever a step adds a time/RNG-gated Play feature, add its fill/reset
 * transition to `playStore.ts` (dev*) and a row here in that same step — do
 * not start a second debug menu. All rows run pure transitions through
 * `commit` and re-render from the same store view the real UI uses.
 */
function GroveDevKit({
  commit,
  onGrantRandomFind,
}: {
  commit: (transition: PlayTransition) => boolean;
  onGrantRandomFind: () => Promise<void>;
}) {
  const theme = useTheme();
  const [resetArmed, setResetArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetArm = useCallback(() => {
    if (disarmTimer.current) {
      clearTimeout(disarmTimer.current);
      disarmTimer.current = null;
    }
    setResetArmed(false);
  }, []);

  const run = useCallback(
    (transition: PlayTransition) => {
      clearResetArm();
      commit(transition);
    },
    [clearResetArm, commit],
  );

  const pressReset = useCallback(() => {
    if (resetArmed) {
      clearResetArm();
      commit(devResetPlayStore);
      return;
    }
    setResetArmed(true);
    disarmTimer.current = setTimeout(() => setResetArmed(false), 4000);
  }, [clearResetArm, commit, resetArmed]);

  useEffect(() => clearResetArm, [clearResetArm]);

  const rows: { key: string; label: string; onPress: () => void }[] = [
    {
      key: 'research-one',
      label: 'Fill research (ready to Claim)',
      onPress: () => run(devFillResearchOne),
    },
    {
      key: 'research-full',
      label: 'Fill research full (10h cap)',
      onPress: () => run(devFillResearchFull),
    },
    { key: 'tokens', label: '+10 tokens', onPress: () => run(devAddTokens) },
    {
      key: 'charges',
      label: 'Fill dive charges to 10',
      onPress: () => run(devFillDiveCharges),
    },
    {
      key: 'grant-find',
      label: 'Grant random find',
      onPress: () => {
        clearResetArm();
        void onGrantRandomFind();
      },
    },
  ];

  return (
    <ThemedView type="backgroundElement" style={styles.devKitCard}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Dev kit · testing only
      </ThemedText>

      {rows.map((row) => (
        <Pressable
          key={row.key}
          onPress={row.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.devKitRow, pressed && styles.pressed]}>
          <ThemedText type="small">{row.label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            ›
          </ThemedText>
        </Pressable>
      ))}

      <Pressable
        onPress={pressReset}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.devKitRow,
          resetArmed && { backgroundColor: theme.backgroundSelected },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="small" themeColor={resetArmed ? 'emphasis' : undefined}>
          {resetArmed ? 'Tap again to reset the store' : 'Reset play store'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          ›
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function findsWord(count: number): string {
  return count === 1 ? 'find' : 'finds';
}

/** Whole minutes until a timestamp, floored at 1 so copy never says "0 min". */
function minutesUntilLabel(nextAt: number | null): string {
  if (nextAt == null) return '—';
  const minutes = Math.max(1, Math.ceil((nextAt - Date.now()) / 60_000));
  return `${minutes}m`;
}

/** Item names for a bag dump, capped at 3 so a 20-find Claim stays readable. */
function foundSummary(itemIds: string[]): string {
  if (itemIds.length === 0) return 'nothing found';
  const shown = Math.min(itemIds.length, 3);
  const names = itemIds
    .slice(0, shown)
    .map((id) => itemName(id) ?? id)
    .join(', ');
  const hidden = itemIds.length - shown;
  return hidden > 0 ? `Found ${names} +${hidden} more` : `Found ${names}`;
}

function claimToastBody(result: ClaimResult): string {
  const parts: string[] = [`+${result.tendTokens} tend`];
  if (result.dailyBonusTokens > 0) parts.push(`+${result.dailyBonusTokens} daily`);
  if (result.diveChargeGranted) parts.push('+1 dive charge');
  parts.push(foundSummary(result.items));
  return parts.join(' · ');
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
  devKitCard: {
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.half,
  },
  devKitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
});
