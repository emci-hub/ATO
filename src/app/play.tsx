import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { AboutScreen } from '@/play/about-screen';
import { STUB_AVATAR_ID, avatarDef } from '@/play/avatars';
import { CommandHub } from '@/play/command-hub';
import { NEON, type HubDestination } from '@/play/neon-viper';
import { PlayThemeProvider } from '@/play/play-theme';
import { SaveDumpRow } from '@/play/dev-dump';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import { DevUnlockRow } from '@/play/dev-unlock-row';
import { DiveScreen } from '@/play/dive-screen';
import { DressScreen } from '@/play/dress-screen';
import { DefendScreen } from '@/play/defend-screen';
import type { TypeTag } from '@/play/engine/type-match';
import { itemName, type ItemSlot } from '@/play/items';
import { TunePanel } from '@/play/tune-panel';
import { loadTune } from '@/play/tune';
import {
  DIVE_CHARGE_CAP,
  canClaimResearch,
  devAddDiveCharge,
  devAddTokens,
  devFillDiveCharges,
  devFillResearchFull,
  devFillResearchOne,
  devForceConquered,
  devGrantBossFragment,
  devResetAvatars,
  devResetBoundBosses,
  devResetPlayStore,
  devResetShopDaily,
  devAddAvatarLevels,
  devSetCampaignSeat,
  devUnlockBoundBoss,
  unlockAvatar,
  type ClaimResult,
  type AvatarParkMapId,
  type DefendWinContext,
  type MergeOutcome,
  type MergeTarget,
  type ShopPurchaseResult,
  type ShopRefusal,
  type SkipRewardResult,
} from '@/play/playStore';
import type { ShopTokenRow } from '@/play/shop';
import { ShopScreen } from '@/play/shop-screen';
import { usePlayStore, type PlayTransition } from '@/play/use-play-store';

/**
 * Play room — Grove + Dive + Dress (GAME_SPEC §3, §7, §9c, §11 screens 1–4).
 *
 * Grove view rides a real local economy from `usePlayStore`
 * (`src/play/playStore.ts`): tokens, dive charges (0–10, ~10 min refill),
 * Research (30-min cycles, 10h cap, one Claim dump, daily tend bonus). Claim
 * dumps the bag as real stub items. Dive (step 3) is paced (searching beat +
 * post-result cooldown; Dev kit can skip the delays) and its bust odds are
 * bent by equipped dive_luck (§7). Dress (step 4) equips 4 slots from the
 * collection, sells Looks over the soft cap, and shows the equipped-stat
 * buckets. Defend (step 5a) is a board skeleton: one path with puff
 * placeholders, leak = fail, Retry replays, Pause freezes, next wave = highest
 * cleared + 1. No Supabase — local AsyncStorage only. Hidden outside
 * pre-launch builds via PRE_LAUNCH_DEV.
 */

type PlayMode = 'grove' | 'dive' | 'dress' | 'defend' | 'shop' | 'about';

type PlayToast =
  | { kind: 'claim'; result: ClaimResult }
  | { kind: 'find'; foundName: string }
  | { kind: 'surface'; itemIds: string[] }
  | { kind: 'bust' }
  | { kind: 'message'; title: string; body: string };

export default function PlayScreen() {
  const theme = useTheme();
  const { reduceMotion } = useAppearance();
  const {
    view,
    claim,
    commit,
    grantRandomFind,
    beginDive,
    surfaceRun,
    pushDeeper,
    equip,
    unequip,
    sell,
    mergeItems,
    grantRandomPower,
    clearEquipped,
    fillJunkLooks,
    grantTideBlades,
    sellAllJunk,
    recordDefendWin,
    resetCampaign,
    setCampaignSeat,
    forceConquered,
    resetDailyClears,
    setClearsTodayFive,
    grantMilestoneWaveFive,
    resetMilestones,
    spendStarToken,
    grantStarToken,
    setCycleTint,
    forceFinal,
    resetAvatarStarCycle,
    skipToEven,
    overgear,
    forceSkipOffer,
    saveAvatarPark,
    activateAvatar,
    unlockAvatarStub,
    buyShopRow,
  } = usePlayStore();
  const [mode, setMode] = useState<PlayMode>('grove');
  const [toast, setToast] = useState<PlayToast | null>(null);
  /** Dev kit only: one-shot forced bust on the next Deeper press. */
  const [forceBustArmed, setForceBustArmed] = useState(false);
  /** Dev kit only: skip the Dive searching beat + cooldown for fast testing. */
  const [skipDelays, setSkipDelays] = useState(false);
  /** Dev kit only: pin the next merge to succeed / fail (one-shot). */
  const [forceMerge, setForceMerge] = useState<'none' | 'success' | 'fail'>('none');
  /** Dev kit only: §9c Tune panel open state (PRE_LAUNCH_DEV hides the entry). */
  const [showTune, setShowTune] = useState(false);
  /** Dev kit only: PIN-unlocked this session? (soft gate — dev-lock.ts). */
  const devUnlocked = usePlayDevUnlocked();

  // Hydrate the local tune doc once so persisted presets survive app kills.
  useEffect(() => {
    void loadTune();
  }, []);

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

  /** Dev kit row: grant one Power into the bag, named in the toast. */
  const handleGrantRandomPower = useCallback(async () => {
    const id = await grantRandomPower();
    if (id) setToast({ kind: 'find', foundName: itemName(id) ?? id });
  }, [grantRandomPower]);

  /** Dev kit row: grant 3× Tide Blade as one stack (stacking test). */
  const handleGrantTideBlades = useCallback(async () => {
    const id = await grantTideBlades();
    if (id) {
      const name = itemName(id) ?? id;
      setToast({ kind: 'find', foundName: `${name} ×3` });
    }
  }, [grantTideBlades]);

  /** Dev kit row: sell every Look in the bag. */
  const handleSellAllJunk = useCallback(async () => {
    const result = await sellAllJunk();
    if (result && result.sold > 0) {
      setToast({
        kind: 'message',
        title: 'Junk sold',
        body: `${result.sold} Looks · +${result.gainedTokens} tokens`,
      });
    }
  }, [sellAllJunk]);

  /** Dive view handlers — commit through the shared store, toast on results. */
  const handleSpendCharge = useCallback(async (): Promise<boolean> => beginDive(), [beginDive]);

  const handleSurface = useCallback(async (): Promise<boolean> => {
    const banked = await surfaceRun();
    if (banked) setToast({ kind: 'surface', itemIds: banked });
    return banked != null;
  }, [surfaceRun]);

  const handleDeeper = useCallback(async (): Promise<boolean> => {
    const outcome = await pushDeeper(forceBustArmed);
    if (forceBustArmed) setForceBustArmed(false); // one-shot arm consumed
    if (outcome?.busted) setToast({ kind: 'bust' });
    return outcome != null;
  }, [forceBustArmed, pushDeeper]);

  /** Dress handlers. Equip/sell failures surface as honest message toasts. */
  const handleEquip = useCallback(
    async (itemId: string, star: number) => {
      const outcome = await equip(itemId, star);
      if (!outcome.ok && outcome.reason === 'bag_full') {
        setToast({
          kind: 'message',
          title: 'Bag full',
          body: 'Your Basecore holds 80 finds — sell a Look to make room for a Power.',
        });
      }
    },
    [equip],
  );

  const handleSell = useCallback(
    async (itemId: string, star: number) => {
      const outcome = await sell(itemId, star);
      if (outcome.ok) {
        setToast({
          kind: 'message',
          title: 'Sold',
          body: `${outcome.name} · +${outcome.gainedTokens} tokens`,
        });
      }
    },
    [sell],
  );

  /** Risky Merge — Dive feel: toast like a Dive bust on the outcome. */
  const handleMerge = useCallback(
    async (target: MergeTarget): Promise<MergeOutcome | null> => {
      const force = forceMerge;
      if (force !== 'none') setForceMerge('none'); // one-shot arm consumed
      const outcome = await mergeItems(target, force);
      if (!outcome) return null;
      const name = itemName(target.id) ?? target.id;
      if (outcome.success) {
        setToast({
          kind: 'message',
          title: `${name} ${'★'.repeat(outcome.toStar)}`,
          body: `Merge succeeded — a ${name} spare was spent.`,
        });
      } else {
        setToast({
          kind: 'message',
          title: 'Merge failed',
          body: `${name} is untouched — one spare was spent.`,
        });
      }
      return outcome;
    },
    [forceMerge, mergeItems],
  );

  const handleUnequip = useCallback(
    (slot: ItemSlot) => {
      void unequip(slot);
    },
    [unequip],
  );

  /** Defend — persist a win (tokens + XP + level + campaign advance). Returns
   * what it paid so the overlay can show honest (possibly halved) token
   * counts. A lifetime-clear milestone (5/10/25) also toasts its Rare Look. */
  const handleRecordDefendWin = useCallback(
    async (ctx: DefendWinContext) => {
      const result = await recordDefendWin(ctx);
      if (result?.milestoneLook) {
        const name =
          itemName(result.milestoneLook.itemId) ?? result.milestoneLook.itemId;
        setToast({
          kind: 'message',
          title: 'Clear milestone',
          body: `${result.milestoneLook.count} lifetime clears — found ${name}.`,
        });
      }
      return result;
    },
    [recordDefendWin],
  );

  /** Defend dev rows — milestone testing. */
  const handleGrantMilestoneWaveFive = useCallback(async () => {
    const id = await grantMilestoneWaveFive();
    if (id) {
      setToast({
        kind: 'message',
        title: 'Wave 5 milestone',
        body: `Found ${itemName(id) ?? id}.`,
      });
    }
  }, [grantMilestoneWaveFive]);

  const handleResetMilestones = useCallback(() => {
    void resetMilestones();
  }, [resetMilestones]);

  /** Defend dev rows — campaign seat testing. */
  const handleResetCampaign = useCallback(() => {
    void resetCampaign();
  }, [resetCampaign]);

  const handleJumpMain19 = useCallback(() => {
    void setCampaignSeat('main', 19);
  }, [setCampaignSeat]);

  const handleJumpScout = useCallback(() => {
    void setCampaignSeat('main', 9);
  }, [setCampaignSeat]);

  const handleForceConquered = useCallback(() => {
    void forceConquered();
  }, [forceConquered]);

  /** Defend dev rows — daily clear half-cap testing. */
  const handleResetDailyClears = useCallback(() => {
    void resetDailyClears();
  }, [resetDailyClears]);

  const handleSetClearsTodayFive = useCallback(() => {
    void setClearsTodayFive();
  }, [setClearsTodayFive]);

  /** Avatar star (§9h): spend a token → +1 star (no-op at cap / no token). */
  const handleSpendStarToken = useCallback(async (): Promise<boolean> => {
    return spendStarToken();
  }, [spendStarToken]);

  /** Dev kit: grant one Avatar star token. */
  const handleGrantStarToken = useCallback(async () => {
    await grantStarToken();
  }, [grantStarToken]);

  /** Dev kit: set the cycle boss tint. */
  const handleSetCycleTint = useCallback(
    (tint: TypeTag) => {
      void setCycleTint(tint);
    },
    [setCycleTint],
  );

  /** Dev kit: park the seat at the Final band (Main wave 20). */
  const handleForceFinal = useCallback(() => {
    void forceFinal();
  }, [forceFinal]);

  /** Dev kit: reset the Avatar-star cycle flags. */
  const handleResetAvatarStarCycle = useCallback(() => {
    void resetAvatarStarCycle();
  }, [resetAvatarStarCycle]);

  /** Skip-to-even (§9j / Phase D): fast-forward trivial normal waves at
   * reduced pay. The Defend screen's Skip button drives this; the seat move
   * re-renders Defend back at the stop wave. */
  const handleSkipToEven = useCallback(async (): Promise<SkipRewardResult | null> => {
    const result = await skipToEven();
    if (result) {
      const parts: string[] = [
        `+${result.tokensGranted} tokens · +${result.xpGranted} XP over ${result.skippedWaves} ${
          result.skippedWaves === 1 ? 'wave' : 'waves'
        }`,
      ];
      if (result.crateItemIds.length > 0) {
        const crateName = result.crateItemIds.map((id) => itemName(id) ?? id).join(', ');
        parts.push(`skip crate: ${crateName}`);
      }
      for (const look of result.milestoneLooks) {
        parts.push(`${look.wave}th-clear milestone — ${itemName(look.itemId) ?? look.itemId}`);
      }
      setToast({ kind: 'message', title: 'Skipped ahead', body: parts.join(' · ') });
    }
    return result;
  }, [skipToEven]);

  /** Dev kit: overgear — level + ★5 + equipped ★5 Powers → GS reads huge. */
  const handleDevOvergear = useCallback(() => {
    void overgear();
  }, [overgear]);

  /** Dev kit: overgear + reset to Trial wave 1 → the skip offer force-shows. */
  const handleDevForceSkipOffer = useCallback(() => {
    void forceSkipOffer();
  }, [forceSkipOffer]);

  /** Defend drag-end → persist the Avatar park for that map (§9m). */
  const handleSaveAvatarPark = useCallback(
    (mapId: AvatarParkMapId, x: number, y: number) => {
      void saveAvatarPark(mapId, x, y);
    },
    [saveAvatarPark],
  );

  /** Avatar swap — Dress "Use": make another owned Avatar active. */
  const handleActivateAvatar = useCallback(
    (id: string) => {
      void activateAvatar(id);
    },
    [activateAvatar],
  );

  /** Avatar swap — Dress lock row: free stub unlock until Hero/IAP. */
  const handleUnlockAvatar = useCallback(
    async (id: string) => {
      const gained = await unlockAvatarStub(id);
      if (gained) {
        const def = avatarDef(id);
        setToast({
          kind: 'message',
          title: 'Avatar unlocked',
          body: `${def?.name ?? id} joined your Basecore — tap Use to make them active.`,
        });
      }
    },
    [unlockAvatarStub],
  );

  /** Token shop — buy a row (spend soft tokens, apply its effect) and toast
   * the honest result. Paid rows never charge; the screen renders them "Soon". */
  const handleBuyShopRow = useCallback(
    async (row: ShopTokenRow): Promise<ShopPurchaseResult | null> => {
      const result = await buyShopRow(row);
      if (result?.ok) {
        const parts: string[] = [`−${result.tokensSpent} tokens`];
        if (result.grantedItemId) {
          parts.push(`found ${itemName(result.grantedItemId) ?? result.grantedItemId}`);
        }
        if (row.kind === 'dive_charge') {
          parts.push(`dive charges ${result.diveChargeNow}/${DIVE_CHARGE_CAP}`);
        }
        setToast({ kind: 'message', title: row.name, body: parts.join(' · ') });
      } else if (result) {
        setToast({ kind: 'message', title: row.name, body: shopRefusalCopy(result.reason) });
      }
      return result;
    },
    [buyShopRow],
  );

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

  const toastContent =
    toast == null
      ? null
      : {
          title:
            toast.kind === 'claim'
              ? `Claimed +${toast.result.tendTokens + toast.result.dailyBonusTokens} tokens`
              : toast.kind === 'find'
                ? 'Found'
                : toast.kind === 'surface'
                  ? 'Surfaced'
                  : toast.kind === 'bust'
                    ? 'Bust'
                    : toast.title,
          body:
            toast.kind === 'claim'
              ? claimToastBody(toast.result)
              : toast.kind === 'find'
                ? toast.foundName
                : toast.kind === 'surface'
                  ? `Banked ${summarizeNames(toast.itemIds)}.`
                  : toast.kind === 'bust'
                    ? 'This haul is lost — the charge was already spent. Your Basecore is untouched.'
                    : toast.body,
        };

  const researchLine =
    view == null
      ? '…'
      : researchReady
        ? 'Research ready — Claim gathers your finds.'
        : `Next find in ~${minutesUntilLabel(view.research.nextFindAt)}.`;
  const claimLabel =
    view == null ? '…' : researchReady ? 'Claim' : `~${minutesUntilLabel(view.research.nextFindAt)}`;

  return (
    <PlayThemeProvider>
      {/* Forced ink chrome is dark regardless of the app-wide mode. */}
      <StatusBar style="light" />
      {mode === 'grove' ? (
        <SafeAreaView style={styles.hubSafeArea}>
          <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
            <CommandHub
              scrap={view?.tokens ?? null}
              wave={view?.campaign.wave_in_phase ?? 1}
              onTile={(to: HubDestination) => setMode(to)}>
              {/* Research / Claim — the token income the old Grove card carried,
               * kept reachable now that the hub replaces that card. */}
              <View style={styles.claimCard}>
                <View style={styles.claimText}>
                  <ThemedText type="smallBold">Basecore</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {researchLine}
                  </ThemedText>
                </View>
                <Pressable
                  disabled={!researchReady}
                  onPress={handleClaim}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !researchReady }}
                  style={({ pressed }) => [
                    styles.claimButton,
                    {
                      backgroundColor: researchReady ? theme.accentFill : NEON.panel,
                      borderColor: NEON.cyanDim,
                    },
                    pressed && researchReady && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: researchReady ? theme.onAccent : theme.textSecondary }}>
                    {claimLabel}
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable
                onPress={closePlay}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Exit Play"
                style={({ pressed }) => [styles.exitRow, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="textSecondary">
                  ‹ Exit Play
                </ThemedText>
              </Pressable>

              {showTune ? <TunePanel onClose={() => setShowTune(false)} /> : null}

              {PRE_LAUNCH_DEV && !devUnlocked ? <DevUnlockRow /> : null}
              {PRE_LAUNCH_DEV && devUnlocked ? (
                <GroveDevKit
                  commit={commit}
                  onGrantRandomFind={handleGrantRandomFind}
                  onGrantRandomPower={handleGrantRandomPower}
                  onGrantTideBlades={handleGrantTideBlades}
                  onSellAllJunk={handleSellAllJunk}
                  onClearEquipped={() => void clearEquipped()}
                  onFillJunkLooks={() => void fillJunkLooks()}
                  forceBustArmed={forceBustArmed}
                  onToggleForceBust={() => setForceBustArmed((armed) => !armed)}
                  skipDelays={skipDelays}
                  onToggleSkipDelays={() => setSkipDelays((skip) => !skip)}
                  forceMerge={forceMerge}
                  onSetForceMerge={setForceMerge}
                  onToggleTune={() => setShowTune((open) => !open)}
                />
              ) : null}
            </CommandHub>
          </ScrollView>
        </SafeAreaView>
      ) : (
        <ThemedView style={styles.container}>
          <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {toastContent ? (
                <MilestoneToast
                  title={toastContent.title}
                  body={toastContent.body}
                  reduceMotion={reduceMotion}
                  onDone={() => setToast(null)}
                />
              ) : null}

              {mode === 'dive' && view ? (
                <DiveScreen
                  view={view}
                  skipDelays={skipDelays}
                  reduceMotion={reduceMotion}
                  onSpendCharge={handleSpendCharge}
                  onSurface={handleSurface}
                  onDeeper={handleDeeper}
                  onBackToGrove={() => setMode('grove')}
                />
              ) : mode === 'dress' && view ? (
                <DressScreen
                  view={view}
                  skipDelays={skipDelays}
                  reduceMotion={reduceMotion}
                  onEquip={handleEquip}
                  onSell={handleSell}
                  onUnequip={handleUnequip}
                  onMerge={handleMerge}
                  onActivateAvatar={handleActivateAvatar}
                  onUnlockAvatar={(id) => void handleUnlockAvatar(id)}
                  onBackToGrove={() => setMode('grove')}
                />
              ) : mode === 'defend' && view ? (
                <DefendScreen
                  view={view}
                  reduceMotion={reduceMotion}
                  onWin={handleRecordDefendWin}
                  onResetDailyClears={handleResetDailyClears}
                  onSetClearsTodayFive={handleSetClearsTodayFive}
                  onGrantMilestoneWaveFive={handleGrantMilestoneWaveFive}
                  onResetMilestones={handleResetMilestones}
                  onResetCampaign={handleResetCampaign}
                  onJumpMain19={handleJumpMain19}
                  onJumpScout={handleJumpScout}
                  onForceConquered={handleForceConquered}
                  onSpendStarToken={handleSpendStarToken}
                  onGrantStarToken={handleGrantStarToken}
                  onSetCycleTint={handleSetCycleTint}
                  onForceFinal={handleForceFinal}
                  onResetAvatarStarCycle={handleResetAvatarStarCycle}
                  onSkipToEven={handleSkipToEven}
                  onDevOvergear={handleDevOvergear}
                  onDevForceSkipOffer={handleDevForceSkipOffer}
                  onSaveAvatarPark={handleSaveAvatarPark}
                  onBackToGrove={() => setMode('grove')}
                />
              ) : mode === 'shop' && view ? (
                <ShopScreen
                  view={view}
                  onBuyToken={handleBuyShopRow}
                  onBackToDivecore={() => setMode('grove')}
                />
              ) : mode === 'about' ? (
                <AboutScreen onBackToDivecore={() => setMode('grove')} />
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </ThemedView>
      )}
    </PlayThemeProvider>
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
  onGrantRandomPower,
  onGrantTideBlades,
  onSellAllJunk,
  onClearEquipped,
  onFillJunkLooks,
  forceBustArmed,
  onToggleForceBust,
  skipDelays,
  onToggleSkipDelays,
  forceMerge,
  onSetForceMerge,
  onToggleTune,
}: {
  commit: (transition: PlayTransition) => boolean;
  onGrantRandomFind: () => Promise<void>;
  onGrantRandomPower: () => Promise<void>;
  onGrantTideBlades: () => Promise<void>;
  onSellAllJunk: () => Promise<void>;
  onClearEquipped: () => void;
  onFillJunkLooks: () => void;
  forceBustArmed: boolean;
  onToggleForceBust: () => void;
  skipDelays: boolean;
  onToggleSkipDelays: () => void;
  forceMerge: 'none' | 'success' | 'fail';
  onSetForceMerge: (mode: 'none' | 'success' | 'fail') => void;
  onToggleTune: () => void;
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
      key: 'dive-charge',
      label: '+1 dive charge',
      onPress: () => run(devAddDiveCharge),
    },
    {
      key: 'grant-find',
      label: 'Grant random find',
      onPress: () => {
        clearResetArm();
        void onGrantRandomFind();
      },
    },
    {
      key: 'grant-power',
      label: 'Grant random Power',
      onPress: () => {
        clearResetArm();
        void onGrantRandomPower();
      },
    },
    {
      key: 'grant-tide',
      label: 'Grant 3× Tide Blade (stack test)',
      onPress: () => {
        clearResetArm();
        void onGrantTideBlades();
      },
    },
    {
      key: 'sell-all-junk',
      label: 'Sell all Junk',
      onPress: () => {
        clearResetArm();
        void onSellAllJunk();
      },
    },
    {
      key: 'fill-junk',
      label: 'Fill junk Looks (test bag-full sell)',
      onPress: () => {
        clearResetArm();
        onFillJunkLooks();
      },
    },
    {
      key: 'clear-equipped',
      label: 'Clear equipped',
      onPress: () => {
        clearResetArm();
        onClearEquipped();
      },
    },
    {
      key: 'force-bust',
      label: forceBustArmed ? 'Force bust next Deeper (armed)' : 'Force bust next Deeper',
      onPress: () => {
        clearResetArm();
        onToggleForceBust();
      },
    },
    {
      key: 'force-merge-success',
      label: forceMerge === 'success' ? 'Force merge success (armed)' : 'Force merge success',
      onPress: () => {
        clearResetArm();
        onSetForceMerge(forceMerge === 'success' ? 'none' : 'success');
      },
    },
    {
      key: 'force-merge-fail',
      label: forceMerge === 'fail' ? 'Force merge fail (armed)' : 'Force merge fail',
      onPress: () => {
        clearResetArm();
        onSetForceMerge(forceMerge === 'fail' ? 'none' : 'fail');
      },
    },
    {
      key: 'skip-delays',
      label: skipDelays ? 'Skip Dive delays (on)' : 'Skip Dive delays',
      onPress: () => {
        clearResetArm();
        onToggleSkipDelays();
      },
    },
    {
      key: 'tune',
      label: 'Tune…',
      onPress: () => {
        clearResetArm();
        onToggleTune();
      },
    },
    {
      key: 'avatar-unlock',
      label: 'Unlock stub Avatar (2nd slot)',
      onPress: () => run((doc) => unlockAvatar(doc, STUB_AVATAR_ID).doc),
    },
    {
      key: 'avatar-levels',
      label: 'Active Avatar +4 levels',
      onPress: () => run((doc) => devAddAvatarLevels(doc, 4)),
    },
    {
      key: 'avatar-reset',
      label: 'Reset Avatars to starter',
      onPress: () => run(devResetAvatars),
    },
    {
      key: 'shop-reset-daily',
      label: 'Reset shop daily caps',
      onPress: () => run(devResetShopDaily),
    },
    {
      key: 'campaign-jump-main-19',
      label: 'Jump to Main wave 19',
      onPress: () => run((doc) => devSetCampaignSeat(doc, 'main', 19)),
    },
    {
      key: 'campaign-force-conquered',
      label: 'Force Conquered +1',
      onPress: () => run(devForceConquered),
    },
    {
      key: 'boss-grant-fragment',
      label: '+1 boss fragment',
      onPress: () => run(devGrantBossFragment),
    },
    {
      key: 'boss-unlock',
      label: 'Unlock Bound Boss',
      onPress: () => run(devUnlockBoundBoss),
    },
    {
      key: 'boss-reset',
      label: 'Reset Bound Bosses',
      onPress: () => run(devResetBoundBosses),
    },
  ];

  return (
    <ThemedView type="backgroundElement" style={styles.devKitCard}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Dev kit · testing only
      </ThemedText>

      {rows.map((row) => {
        const armed =
          (row.key === 'force-bust' && forceBustArmed) ||
          (row.key === 'skip-delays' && skipDelays) ||
          (row.key === 'force-merge-success' && forceMerge === 'success') ||
          (row.key === 'force-merge-fail' && forceMerge === 'fail');
        return (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.devKitRow, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor={armed ? 'emphasis' : undefined}>
              {row.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ›
            </ThemedText>
          </Pressable>
        );
      })}

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
      <SaveDumpRow />
    </ThemedView>
  );
}

/** Whole minutes until a timestamp, floored at 1 so copy never says "0 min". */
function minutesUntilLabel(nextAt: number | null): string {
  if (nextAt == null) return '—';
  const minutes = Math.max(1, Math.ceil((nextAt - Date.now()) / 60_000));
  return `${minutes}m`;
}

/** Names for a haul, capped at 3 so a long claim/bank stays readable. */
function summarizeNames(itemIds: readonly string[]): string {
  const shown = Math.min(itemIds.length, 3);
  const names = itemIds
    .slice(0, shown)
    .map((id) => itemName(id) ?? id)
    .join(', ');
  const hidden = itemIds.length - shown;
  return hidden > 0 ? `${names} +${hidden} more` : names;
}

function foundSummary(itemIds: string[]): string {
  return itemIds.length === 0 ? 'nothing found' : `Found ${summarizeNames(itemIds)}`;
}

function claimToastBody(result: ClaimResult): string {
  const parts: string[] = [`+${result.tendTokens} tend`];
  if (result.dailyBonusTokens > 0) parts.push(`+${result.dailyBonusTokens} daily`);
  if (result.diveChargeGranted) parts.push('+1 dive charge');
  parts.push(foundSummary(result.items));
  return parts.join(' · ');
}

/** Honest copy for a token-shop refusal (why the buy didn't happen). */
function shopRefusalCopy(reason: ShopRefusal): string {
  switch (reason) {
    case 'coming_soon':
      return 'Not for sale yet — coming soon.';
    case 'insufficient':
      return 'Not enough tokens — Claim or clear a wave to earn more.';
    case 'daily_cap':
      return 'Daily limit reached — come back tomorrow.';
    case 'dive_full':
      return 'Dive charges are already full — nothing to add.';
  }
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
  /** Command Hub owns the full screen — no max width, no horizontal padding. */
  hubSafeArea: {
    flex: 1,
    backgroundColor: NEON.ink,
  },
  hubScroll: {
    flexGrow: 1,
  },
  exitRow: {
    alignSelf: 'center',
    paddingVertical: Spacing.three,
  },
  claimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: 16,
    marginTop: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    backgroundColor: 'rgba(9, 15, 28, 0.92)',
  },
  claimText: {
    flex: 1,
    gap: Spacing.half,
  },
  claimButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
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
