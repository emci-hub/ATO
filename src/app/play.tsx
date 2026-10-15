import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayDevFab } from '@/components/play-dev-fab';
import { DevSlotOutlet } from '@/play/dev-slot';
import { PetDevPanel } from '@/play/pet-dev-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useImmersiveMode } from '@/hooks/use-immersive-mode';
import { useTheme } from '@/hooks/use-theme';
import { playDevFabVisible } from '@/lib/dev-fab-model';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { useAppearance } from '@/lib/theme/context';
import { AboutScreen } from '@/play/about-screen';
import { STUB_AVATAR_ID, avatarDef } from '@/play/avatars';
import { CommandHub } from '@/play/command-hub';
import {
  StreetBlock,
  StreetLockerTabs,
  StreetResourceBar,
  StreetTabBar,
  type StreetTab,
} from '@/play/street-shell';
import { streetUiOn } from '@/play/street-ui';
import { NEON, shopUnlocked, type HubDestination } from '@/play/neon-viper';
import { PlayThemeProvider } from '@/play/play-theme';
import { GameScreen, useStageFrame } from '@/play/stage-layout';
import { noticeEvents, type NoticeWatch } from '@/play/notify/events';
import { notify, useNoticeOptions, useNoticePause, useNoticeTargets, type NoticeTarget } from '@/play/notify/notify';
import { SaveDumpRow } from '@/play/dev-dump';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import { DevUnlockRow } from '@/play/dev-unlock-row';
import { DiveScreen, type DiveDeeperResult, type DiveSurfaceSummary } from '@/play/dive-screen';
import { DIVECORE_POWERS_PER_DAY, POWER_OVERFLOW_SHELLS, type DivePath } from '@/play/dive-loot';
import { shownFindName } from '@/play/dive-street-names';
import { DressScreen } from '@/play/dress-screen';
import {
  backDecision,
  isEdgeSwipeComplete,
  isEdgeSwipeStart,
  type BackSource,
  type InnerBack,
} from '@/play/edge-back';
import { findGlow } from '@/play/dive-fx-model';
import { DivecoreSettingsSheet } from '@/play/divecore-settings';
import { DivecoreTutorial } from '@/play/divecore-tutorial';
import { resolveReduceMotion, usePlayMotionMode } from '@/play/play-motion';
import { LayoutShot, type LayoutInset, type LayoutShotKind } from '@/play/layout-shot';
import { PetScreen, usePlayNoticesSync, type PetTalkEvent } from '@/play/pet-screen';
import type { PetTalkSituation } from '@/play/pet-talk';
import { DefendScreen } from '@/play/defend-screen';
import { SheetLabScreen } from '@/play/sheet-lab-screen';
import { SwordForgeScreen } from '@/play/sword-forge-screen';
import { SwordLabScreen } from '@/play/sword-lab-screen';
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
  applySwordAction,
  devEquipSword,
  markExpeditionToasted,
  noteDefendLeak,
  setPlaySettings,
  unlockAvatar,
  type ClaimResult,
  type AvatarParkMapId,
  type DefendWinContext,
  type MergeOutcome,
  type MergeTarget,
  type ShopPurchaseResult,
  type ShopRefusal,
  type SkipRewardResult,
  type SwordAction,
} from '@/play/playStore';
import type { SwordTier } from '@/play/swords';
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

type PlayMode = 'grove' | 'dive' | 'pet' | 'dress' | 'defend' | 'shop' | 'about' | 'sheetlab' | 'swords' | 'swordlab';

export default function PlayScreen() {
  const theme = useTheme();
  // Reduce motion (v24): follows the phone unless overridden in Divecore
  // Settings — Play only; the rest of the app keeps following the phone.
  const { reduceMotion: phoneReduceMotion } = useAppearance();
  const motionMode = usePlayMotionMode();
  const reduceMotion = resolveReduceMotion(motionMode, phoneReduceMotion);
  const {
    view,
    claim,
    commit,
    commitSaved,
    grantRandomFind,
    beginDive,
    beginFreeDive,
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
    setAvatarHero,
    bindHeroAsTower,
    dismissHeroOffer,
    devOwnHero,
    devOwnAllHeroes,
    devSetAvatarHero,
    devClearHeroOffer,
    devClearOwnedHeroes,
    buyShopRow,
  } = usePlayStore();
  const shotParams = useLocalSearchParams<{ shot?: string; inset?: string; phase?: string }>();
  const [mode, setMode] = useState<PlayMode>('grove');
  // Fullscreen while on the Defend board (setup and waves): the status bar
  // hides and comes back on leaving Defend or exiting Play. Shared hook —
  // any screen opts in the same way.
  useImmersiveMode(mode === 'defend');
  // Street shell (Streetwear art style): the bars own the top/bottom safe area.
  const insets = useSafeAreaInsets();
  /** The list screens' fixed frame (Block, Locker, Store); game screens take their own. */
  const listFrame = useStageFrame('list');
  // Pet (v20): keep the opt-in hunger reminder in step with the pet from
  // anywhere in Play (a TD win feeds it too), not only the Pet screen.
  usePlayNoticesSync(view ?? null);

  // Back one level (2026-09-29): Play is one route with its sub-screens as a
  // `mode`, so the phone's own back used to leave Play from anywhere (and skip
  // Defend's Leave confirm). The native swipe now only runs on the hub; on a
  // sub-screen our left-edge swipe and Android back step back one level, the
  // sub-screen first (`InnerBack`, registered by Defend / Pet), else the hub.
  const innerBackRef = useRef<InnerBack | null>(null);
  const registerBack = useCallback((inner: InnerBack | null) => {
    innerBackRef.current = inner;
  }, []);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  /** Dive only opens from the Pet room now (overhaul, 2026-09-29), so its
   * back always returns to the room; every other sub-screen goes to the hub. */
  const leaveSubScreen = useCallback(() => {
    setMode(modeRef.current === 'dive' ? 'pet' : 'grove');
  }, []);
  /** A dive / TD / find moment for the pet to talk about once (room overhaul). */
  const [petTalk, setPetTalk] = useState<PetTalkEvent>(null);
  const clearPetTalk = useCallback(() => setPetTalk(null), []);
  // Keys only ever go up, so a cleared event can never be mistaken for a new one.
  const petTalkSeq = useRef(0);
  const nudgePet = useCallback((situation: PetTalkSituation) => {
    petTalkSeq.current += 1;
    setPetTalk({ situation, key: petTalkSeq.current });
  }, []);
  /** v24: the hub's Settings sheet and the tutorial close first on back. */
  const [hubSettingsOpen, setHubSettingsOpen] = useState(false);
  const [tutorialReplay, setTutorialReplay] = useState(false);
  // Hold notices (except errors) while the tutorial or the hub Settings sheet covers the screen.
  useNoticePause(hubSettingsOpen || (view != null && (tutorialReplay || !view.settings.tutorialSeen)));
  const overlayRef = useRef<(() => void) | null>(null);
  const goBackOneLevel = useCallback((source: BackSource): boolean => {
    if (overlayRef.current) {
      overlayRef.current();
      return true;
    }
    const decision = backDecision(modeRef.current === 'grove', innerBackRef.current, source);
    if (decision === 'native') return false;
    if (decision === 'ignore') return true;
    if (innerBackRef.current?.back()) return true;
    leaveSubScreen();
    return true;
  }, [leaveSubScreen]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => goBackOneLevel('hardware'));
    return () => sub.remove();
  }, [goBackOneLevel]);
  const edgeSwipe = useMemo(
    () =>
      PanResponder.create({
        // Capture only a move that starts at the left edge and runs sideways —
        // taps, scrolls and board drags elsewhere are never claimed.
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          modeRef.current !== 'grove' &&
          innerBackRef.current?.edgeSwipe !== false &&
          isEdgeSwipeStart(g.x0, g.dx, g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_e, g) => {
          if (isEdgeSwipeComplete(g.dx, g.vx)) goBackOneLevel('edge');
        },
      }),
    [goBackOneLevel],
  );
  // Phase 2 (2026-10-14): every Play notice goes through notify() → the NoticeLane of the
  // screen on top. Play sets the mode (All / Important only), Reduce Motion and tap targets.
  useNoticeOptions({ mode: view?.settings.notices ?? 'all', reduceMotion });
  /** A notice tapped through to the Journal (Pet → Info → Journal), until used. */
  const [openJournal, setOpenJournal] = useState(false);
  const journalOpened = useCallback(() => setOpenJournal(false), []);
  const goNoticeTarget = useCallback((target: Exclude<NoticeTarget, null>) => {
    if (target === 'dive') setMode('dive');
    else if (target === 'pet') setMode('pet');
    else {
      setMode('pet');
      setOpenJournal(true);
    }
  }, []);
  useNoticeTargets(goNoticeTarget);
  /** v26: open Pet → Info → Guide from the hub ⚙ or the tutorial. */
  const [openGuide, setOpenGuide] = useState(false);
  const guideOpened = useCallback(() => setOpenGuide(false), []);
  /** Dev kit only: one-shot forced bust on the next Deeper press. */
  const [forceBustArmed, setForceBustArmed] = useState(false);
  /** Dev kit only: skip the Dive searching beat + cooldown for fast testing. */
  const [skipDelays, setSkipDelays] = useState(false);
  /** Dev kit only: pin the next merge to succeed / fail (one-shot). */
  const [forceMerge, setForceMerge] = useState<'none' | 'success' | 'fail'>('none');
  /** Dev kit only: §9c Tune panel open state (PRE_LAUNCH_DEV hides the entry). */
  const [showTune, setShowTune] = useState(false);
  const [swordNotice, setSwordNotice] = useState<string | null>(null);
  /** Dev kit only: PIN-unlocked this session? (soft gate — dev-lock.ts). */
  const devUnlocked = usePlayDevUnlocked();
  const [devKitOpen, setDevKitOpen] = useState(false);
  const closeDevKit = useCallback(() => setDevKitOpen(false), []);
  const showPlayDevFab = playDevFabVisible({ preLaunchDev: PRE_LAUNCH_DEV, playDevUnlocked: devUnlocked });

  // Hydrate the local tune doc once so persisted presets survive app kills.
  useEffect(() => {
    void loadTune();
  }, []);

  const researchReady = view != null && canClaimResearch(view);

  const handleClaim = useCallback(async () => {
    const result = await claim();
    if (result) {
      notify({ kind: 'notify', title: `Claimed +${result.tendTokens + result.dailyBonusTokens} tokens`, body: claimNoticeBody(result) });
    }
  }, [claim]);

  /** Dev kit row: roll one find into the bag and name it in the notice. */
  const handleGrantRandomFind = useCallback(async () => {
    const id = await grantRandomFind();
    if (id) notify({ kind: 'notify', title: 'Found', body: itemName(id) ?? id });
  }, [grantRandomFind]);

  /** Dev kit row: grant one Power into the bag, named in the notice. */
  const handleGrantRandomPower = useCallback(async () => {
    const id = await grantRandomPower();
    if (id) notify({ kind: 'notify', title: 'Found', body: itemName(id) ?? id });
  }, [grantRandomPower]);

  /** Dev kit row: grant 3× Tide Blade as one stack (stacking test). */
  const handleGrantTideBlades = useCallback(async () => {
    const id = await grantTideBlades();
    if (id) notify({ kind: 'notify', title: 'Found', body: `${itemName(id) ?? id} ×3` });
  }, [grantTideBlades]);

  /** Dev kit row: sell every Look in the bag. */
  const handleSellAllJunk = useCallback(async () => {
    const result = await sellAllJunk();
    if (result && result.sold > 0) {
      notify({ kind: 'notify', title: 'Junk sold', body: `${result.sold} Looks · +${result.gainedTokens} tokens` });
    }
  }, [sellAllJunk]);

  /** Dive view handlers — commit through the shared store, toast on results. */
  const handleSpendCharge = useCallback(async (): Promise<boolean> => beginDive(), [beginDive]);
  const handleFreeDive = useCallback(async (): Promise<boolean> => beginFreeDive(), [beginFreeDive]);

  /** Expedition return (v21): announce it once per return, wherever you are
   * in Play (the save remembers it was shown). On the Pet screen the note
   * itself is the announcement. The note stays there until dismissed. */
  const expeditionNote = view?.pet.expeditionNote ?? null;
  const expeditionNoteFresh = view?.pet.expeditionNoteFresh ?? false;
  useEffect(() => {
    if (!expeditionNote || !expeditionNoteFresh) return;
    if (mode !== 'pet') {
      notify({ kind: 'notify', title: 'Pet is back', body: `Brought back ${shownFindName(expeditionNote)}. Tap to visit.`, target: 'pet', dedupeKey: 'expedition' });
    }
    commit((doc) => markExpeditionToasted(doc));
  }, [commit, expeditionNote, expeditionNoteFresh, mode]);

  /** v25: hatch / reveal / milestone-ready news → notices (see noticeEvents). */
  const watchRef = useRef<NoticeWatch | null>(null);
  const watchStage = view?.pet.state.stage ?? null;
  const watchOdds = view?.pet.oddsOpen ?? false;
  const watchReady = view ? view.milestones.filter((m) => m.done && !m.claimed).length : 0;
  const watchStreakYmd = view?.pet.streak.ymd ?? null;
  const watchStreakDay = view?.pet.streak.last ?? null;
  useEffect(() => {
    if (watchStage == null) return;
    const next: NoticeWatch = {
      stage: watchStage,
      oddsOpen: watchOdds,
      milestonesReady: watchReady,
      streakYmd: watchStreakYmd,
      streakDay: watchStreakDay,
    };
    for (const n of noticeEvents(watchRef.current, next, mode === 'pet')) notify(n);
    watchRef.current = next;
  }, [mode, watchOdds, watchReady, watchStage, watchStreakDay, watchStreakYmd]);

  /** Surface: returns what the Dive scene counts up (finds + shells). */
  const handleSurface = useCallback(async (): Promise<DiveSurfaceSummary | null> => {
    const surfaced = await surfaceRun();
    if (!surfaced) return null;
    notify({ kind: 'notify', title: 'Surfaced', body: surfaceNoticeBody(surfaced) });
    nudgePet(surfaced.banked.some((id) => findGlow(id) !== 'common') ? 'rare_find' : 'surfaced');
    return {
      finds: surfaced.free ? 0 : surfaced.banked.length,
      shells: surfaced.shellsGained,
      ids: surfaced.banked,
    };
  }, [nudgePet, surfaceRun]);

  /** `shownPct` is the bust % on screen for that path when Deeper was
   * pressed; if the real odds moved since, nothing is rolled and the new % is
   * shown instead. */
  const handleDeeper = useCallback(
    async (path: DivePath, shownPct: number | null): Promise<DiveDeeperResult> => {
      const outcome = await pushDeeper(forceBustArmed, path, shownPct);
      if (outcome?.changed) {
        notify({ kind: 'error', title: 'Odds changed', body: `This path is now ${outcome.bustPct}%. Nothing rolled — tap again.` });
        return { outcome: 'changed', rescued: [] };
      }
      if (forceBustArmed) setForceBustArmed(false); // one-shot arm consumed
      if (outcome?.busted) {
        notify({ kind: 'notify', title: 'Busted', body: bustNoticeBody(outcome.rescued) });
        nudgePet('busted');
      }
      if (outcome == null) return null;
      return { outcome: outcome.busted ? 'bust' : 'safe', rescued: outcome.busted ? outcome.rescued : [] };
    },
    [forceBustArmed, nudgePet, pushDeeper],
  );

  /** Dress handlers. Equip/sell failures surface as honest message toasts. */
  const handleEquip = useCallback(
    async (itemId: string, star: number) => {
      const outcome = await equip(itemId, star);
      if (!outcome.ok && outcome.reason === 'bag_full') {
        notify({ kind: 'error', title: 'Bag full', body: 'Sell a Look to make room for a Power.' });
      }
    },
    [equip],
  );

  const handleSell = useCallback(
    async (itemId: string, star: number) => {
      const outcome = await sell(itemId, star);
      if (outcome.ok) {
        notify({ kind: 'notify', title: 'Sold', body: `${outcome.name} · +${outcome.gainedTokens} tokens` });
      }
    },
    [sell],
  );

  /** Risky Merge. The result is shown on the item's own Dress row (glow /
   * flash + "✓ Merged ★3" / "✗ Missed", `merge-row.tsx`) — no toast, so the
   * feedback lands where the player is looking. */
  const handleMerge = useCallback(
    async (target: MergeTarget): Promise<MergeOutcome | null> => {
      const force = forceMerge;
      if (force !== 'none') setForceMerge('none'); // one-shot arm consumed
      return mergeItems(target, force);
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
      if (result?.duplicate) return null;
      if (result) nudgePet('waves_cleared');
      if (result?.milestoneLook) {
        const name =
          itemName(result.milestoneLook.itemId) ?? result.milestoneLook.itemId;
        notify({ kind: 'celebrate', title: 'Clear milestone', body: `${result.milestoneLook.count} lifetime clears — found ${name}.` });
      }
      // Slice A2: a first-own also queues `hero_offer` in the save, which the
      // Defend screen renders as the hero sheet (owned + the two actions). No
      // toast here — one surface, so the two never stack.
      return result;
    },
    [nudgePet, recordDefendWin],
  );

  /** Defend dev rows — milestone testing. */
  const handleGrantMilestoneWaveFive = useCallback(async () => {
    const id = await grantMilestoneWaveFive();
    if (id) {
      notify({ kind: 'celebrate', title: 'Wave 5 milestone', body: `Found ${itemName(id) ?? id}.` });
    }
  }, [grantMilestoneWaveFive]);

  const handleResetMilestones = useCallback(() => {
    void resetMilestones();
  }, [resetMilestones]);

  /** Defend dev rows — campaign seat testing. */
  const handleResetCampaign = useCallback(() => {
    void resetCampaign();
  }, [resetCampaign]);

  const handleJumpMain9 = useCallback(() => {
    void setCampaignSeat('main', 9);
  }, [setCampaignSeat]);

  const handleJumpScout = useCallback(() => {
    void setCampaignSeat('main', 5);
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
      notify({ kind: 'notify', title: 'Skipped ahead', body: parts.join(' · ') });
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
        notify({ kind: 'celebrate', title: 'Avatar unlocked', body: `${def?.name ?? id} joined your Basecore.` });
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
        if (result.shellsInstead > 0) {
          parts.push(`${result.shellsInstead} shells (Powers for today were full)`);
        }
        notify({ kind: 'notify', title: `${row.name}`, body: parts.join(' · ') });
      } else if (result) {
        notify({ kind: 'error', title: `${row.name}`, body: shopRefusalCopy(result.reason) });
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

  // Dev-only device frames for the pet room and Dive (layout shots). The
  // query never changes a normal visit to /play.
  if (
    shotParams.shot === 'pet' ||
    shotParams.shot === 'dive' ||
    shotParams.shot === 'catch' ||
    shotParams.shot === 'train' ||
    shotParams.shot === 'play'
  ) {
    const inset: LayoutInset =
      shotParams.inset === 'se' || shotParams.inset === 'max' || shotParams.inset === 'and' || shotParams.inset === '15'
        ? shotParams.inset
        : '15';
    return (
      <LayoutShot
        kind={shotParams.shot as LayoutShotKind}
        inset={inset}
        phase={shotParams.phase === 'pre' ? 'pre' : 'mid'}
      />
    );
  }

  const researchLine =
    view == null
      ? '…'
      : researchReady
        ? 'Research ready — Claim gathers your finds.'
        : `Next find in ~${minutesUntilLabel(view.research.nextFindAt)}.`;
  const claimLabel =
    view == null ? '…' : researchReady ? 'Claim' : `~${minutesUntilLabel(view.research.nextFindAt)}`;

  // v24: the tutorial shows once (a save with progress counts as seen), and
  // whenever it is replayed from Settings.
  const showTutorial = view != null && (tutorialReplay || !view.settings.tutorialSeen);
  const hubOverlayOpen = hubSettingsOpen || showTutorial;
  overlayRef.current = showTutorial
    ? () => {
        setTutorialReplay(false);
        commit((doc) => (doc.play_settings.tutorialSeen ? null : setPlaySettings(doc, { tutorialSeen: true })));
      }
    : hubSettingsOpen && mode === 'grove'
      ? () => setHubSettingsOpen(false)
      : null;

  const groveDevKitPanel = (afterNavigate?: () => void, focus: readonly GroveDevSectionId[] = []) => (
    <GroveDevKit
      focus={focus}
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
      onToggleTune={() => {
        afterNavigate?.();
        setShowTune((open) => !open);
      }}
      onOpenSheetLab={() => {
        afterNavigate?.();
        setMode('sheetlab');
      }}
      onOpenSwordLab={() => {
        afterNavigate?.();
        setMode('swordlab');
      }}
    />
  );

  // Street shell (Streetwear art style, emci 2026-10-11): resource bar + tab bar
  // wrap the screens; The Block replaces the hub's tile wall. Paint and layout
  // only — every tab calls the same setMode the Classic tiles use.
  const street = streetUiOn() && view != null && mode !== 'dive' && mode !== 'sheetlab' && mode !== 'swordlab';
  const streetTab: StreetTab | null =
    mode === 'grove'
      ? 'block'
      : mode === 'defend'
        ? 'turf'
        : mode === 'pet'
          ? 'hideout'
          : mode === 'dress' || mode === 'swords'
            ? 'locker'
            : mode === 'shop'
              ? 'store'
              : null;
  const goStreetTab = (tab: StreetTab) => {
    const to: PlayMode =
      tab === 'block' ? 'grove' : tab === 'turf' ? 'defend' : tab === 'hideout' ? 'pet' : tab === 'locker' ? 'dress' : 'shop';
    if (to === mode) return;
    if (to !== 'shop' || shopUnlocked(devUnlocked)) setMode(to);
  };
  const hubExtras = (
    <>
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
      {PRE_LAUNCH_DEV && devUnlocked ? groveDevKitPanel() : null}
    </>
  );

  // Stage layout (Phase 1, emci 2026-10-14): every Street screen is a GameScreen with fixed
  // regions — the shell hands each one its resource bar (TopBar) and tab bar, so no screen is
  // sized by what a flex column leaves over. Bars never resize; only the middle fades on a switch.
  const shellTop =
    street && view ? (
      <StreetResourceBar
        caps={view.tokens}
        tokens={view.dive.current}
        tokensMax={DIVE_CHARGE_CAP}
        shine={view.pet.stones.held}
        prism={view.pet.stones.prism}
        reduceMotion={reduceMotion}
        onSettings={() => {
          setMode('grove');
          setHubSettingsOpen(true);
        }}
      />
    ) : null;
  const shellTabs =
    street && view ? (
      <StreetTabBar
        active={streetTab}
        showStore={shopUnlocked(devUnlocked)}
        reduceMotion={reduceMotion}
        bottomInset={insets.bottom}
        onTab={goStreetTab}
      />
    ) : null;
  /** A list screen (Block, Locker, Store, About): the stage is the scroll body. */
  const listScreen = (content: ReactNode, edgeToEdge = false) => (
    <GameScreen
      frame={listFrame}
      topBar={shellTop}
      tabBar={shellTabs}
      fadeKey={mode}
      reduceMotion={reduceMotion}
      background={NEON.ink}
      stage={
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={edgeToEdge ? styles.hubScroll : styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={edgeToEdge ? undefined : styles.listColumn}>{content}</View>
        </ScrollView>
      }
    />
  );

  const diveEl = view ? (
    <DiveScreen
      view={view}
      skipDelays={skipDelays}
      reduceMotion={reduceMotion}
      onSpendCharge={handleSpendCharge}
      onFreeDive={handleFreeDive}
      commit={commit}
      onSurface={handleSurface}
      onDeeper={handleDeeper}
      registerBack={registerBack}
      onBack={leaveSubScreen}
    />
  ) : null;
  const petEl = view ? (
    <PetScreen
      view={view}
      commit={commit}
      commitSaved={commitSaved}
      registerBack={registerBack}
      reduceMotion={reduceMotion}
      talkEvent={petTalk}
      onTalkConsumed={clearPetTalk}
      onBack={() => setMode('grove')}
      onGoDive={() => setMode('dive')}
      onReplayTutorial={() => setTutorialReplay(true)}
      openJournal={openJournal}
      onJournalOpened={journalOpened}
      openGuide={openGuide}
      onGuideOpened={guideOpened}
      shellTop={shellTop}
      shellTabs={shellTabs}
    />
  ) : null;
  const defendEl = view ? (
    <DefendScreen
      view={view}
      reduceMotion={reduceMotion}
      onWin={handleRecordDefendWin}
      onResetDailyClears={handleResetDailyClears}
      onSetClearsTodayFive={handleSetClearsTodayFive}
      onGrantMilestoneWaveFive={handleGrantMilestoneWaveFive}
      onResetMilestones={handleResetMilestones}
      onResetCampaign={handleResetCampaign}
      onJumpMain9={handleJumpMain9}
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
      onSetAvatarHero={setAvatarHero}
      onBindHeroAsTower={bindHeroAsTower}
      onDismissHeroOffer={() => void dismissHeroOffer()}
      onDevOwnHero={devOwnHero}
      onDevOwnAllHeroes={devOwnAllHeroes}
      onDevSetAvatarHero={devSetAvatarHero}
      onDevClearHeroOffer={devClearHeroOffer}
      onDevClearOwnedHeroes={devClearOwnedHeroes}
      onOpenDress={() => setMode('dress')}
      onOpenSwords={() => setMode('swords')}
      onLeak={() => commit(noteDefendLeak)}
      registerBack={registerBack}
      onBackToGrove={() => setMode('grove')}
      shellTop={shellTop}
      shellTabs={shellTabs}
    />
  ) : null;
  /** Locker, Store, About, the labs: plain scroll content. */
  const listContent =
    mode === 'dress' && view ? (
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
        onSetAvatarHero={(heroId) => void setAvatarHero(heroId)}
        onBackToGrove={() => setMode('grove')}
        commit={commit}
      />
    ) : mode === 'shop' && view && shopUnlocked(devUnlocked) ? (
      <ShopScreen view={view} onBuyToken={handleBuyShopRow} onBackToDivecore={() => setMode('grove')} />
    ) : mode === 'about' ? (
      <AboutScreen onBackToDivecore={() => setMode('grove')} />
    ) : mode === 'sheetlab' ? (
      <SheetLabScreen onBack={() => setMode('grove')} />
    ) : mode === 'swords' && view ? (
      <SwordForgeScreen
        swords={view.swords}
        notice={swordNotice}
        onAction={(action: SwordAction) => {
          const ok = commit((doc) => applySwordAction(doc, action));
          setSwordNotice(ok ? null : 'Could not do that. Unequip it, or bring more copies.');
        }}
        onBack={() => setMode('defend')}
      />
    ) : mode === 'swordlab' && PRE_LAUNCH_DEV && devUnlocked ? (
      <SwordLabScreen
        onBack={() => setMode('grove')}
        onEquip={(element: string, tier: SwordTier) => {
          commit((doc) => devEquipSword(doc, element, tier));
        }}
      />
    ) : null;

  const streetScreens = !street || !view ? null : mode === 'grove' ? (
    listScreen(
      <StreetBlock
        pet={view.pet.state}
        wave={view.campaign.wave_in_phase ?? 1}
        diveActive={view.diveRun.active}
        charges={view.dive.current}
        chargesMax={DIVE_CHARGE_CAP}
        reduceMotion={reduceMotion}
        onHideout={() => setMode('pet')}
        onTurf={() => setMode('defend')}
        onUnderground={() => setMode('dive')}>
        {hubExtras}
      </StreetBlock>,
      true,
    )
  ) : mode === 'pet' ? (
    petEl
  ) : mode === 'defend' ? (
    defendEl
  ) : (
    listScreen(
      <>
        {mode === 'dress' || mode === 'swords' ? (
          <StreetLockerTabs
            active={mode === 'swords' ? 'blades' : 'fits'}
            onFits={() => setMode('dress')}
            onBlades={() => setMode('swords')}
          />
        ) : null}
        {listContent}
      </>,
    )
  );

  // Loading (no save yet) and the full-screen modes (Dive, the labs): the old column.
  const screens = (
    mode === 'grove' ? (
          <SafeAreaView style={styles.hubSafeArea}>
            <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
              <CommandHub
                diveActive={view?.diveRun.active ?? false}
                devUnlocked={devUnlocked}
                scrap={view?.tokens ?? null}
                wave={view?.campaign.wave_in_phase ?? 1}
                onTile={(to: HubDestination) => {
                  if (to !== 'shop' || shopUnlocked(devUnlocked)) setMode(to);
                }}
                onSettings={() => setHubSettingsOpen(true)}>
                {hubExtras}
              </CommandHub>
            </ScrollView>
          </SafeAreaView>
        ) : (
          <View style={styles.edgeWrap} {...edgeSwipe.panHandlers}>
            {mode === 'dive' && view ? (
              // Dive owns the whole screen: its GameScreen reads the safe area itself.
              <View style={styles.fullSafeArea}>{diveEl}</View>
            ) : mode === 'pet' && view ? (
              <View style={styles.fullSafeArea}>{petEl}</View>
            ) : mode === 'defend' && view ? (
              <View style={styles.fullSafeArea}>{defendEl}</View>
            ) : (
            <ThemedView style={styles.container}>
              <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent}>{listContent}</ScrollView>
              </SafeAreaView>
            </ThemedView>
            )}
          </View>
        )
  );

  return (
    <PlayThemeProvider>
      {/* Forced ink chrome is dark regardless of the app-wide mode. */}
      <StatusBar style="light" />
      {/* The phone's own swipe-back leaves Play — only from the hub. */}
      <Stack.Screen options={{ gestureEnabled: mode === 'grove' && !hubOverlayOpen }} />
      {streetScreens ? (
        <View style={styles.streetRoot} {...(mode === 'grove' ? null : edgeSwipe.panHandlers)}>
          {streetScreens}
        </View>
      ) : (
        screens
      )}
      {view && mode === 'grove' ? (
        <DivecoreSettingsSheet
          open={hubSettingsOpen}
          onClose={() => setHubSettingsOpen(false)}
          view={view}
          commit={commit}
          reduceMotion={reduceMotion}
          onReplayTutorial={() => setTutorialReplay(true)}
          onOpenGuide={() => {
            setMode('pet');
            setOpenGuide(true);
          }}
        />
      ) : null}
      {showTutorial ? (
        <DivecoreTutorial
          onDone={() => {
            setTutorialReplay(false);
            commit((doc) => (doc.play_settings.tutorialSeen ? null : setPlaySettings(doc, { tutorialSeen: true })));
          }}
          onGuide={() => {
            setTutorialReplay(false);
            commit((doc) => (doc.play_settings.tutorialSeen ? null : setPlaySettings(doc, { tutorialSeen: true })));
            setMode('pet');
            setOpenGuide(true);
          }}
        />
      ) : null}
      {showPlayDevFab ? (
        <PlayDevFab
          open={devKitOpen}
          onOpenChange={setDevKitOpen}
          panel={
            // The tools for the mode you are in come first; the general kit follows,
            // with that mode's group already open.
            <View key={mode} style={styles.devFabPanel}>
              <ThemedText type="smallBold" themeColor="emphasis">
                {DEV_MODE_LABEL[mode]} tools
              </ThemedText>
              {mode === 'pet' && view ? (
                <PetDevPanel pet={view.pet.state} commit={commit} startOpen={['pet', 'eggs', 'room']} />
              ) : null}
              {/* A screen that owns live state (Defend) hands its buttons over here. */}
              <DevSlotOutlet />
              {groveDevKitPanel(closeDevKit, devFocusForMode(mode))}
            </View>
          }
        />
      ) : null}
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
 *
 * The rows are grouped into collapsible sections (all collapsed on entry) so the
 * kit reads as a short index instead of one long list — the same shape Defend's
 * Dev kit uses.
 */

/** One Dev kit row. */
type DevKitRowDef = { key: string; label: string; onPress: () => void };

/** The collapsible groups the Grove Dev kit folds into. */
type GroveDevSectionId = 'dive' | 'bag' | 'tokens' | 'avatars' | 'campaign' | 'misc';

/** What the floating DEV kit calls each mode. */
const DEV_MODE_LABEL: Record<PlayMode, string> = {
  grove: 'Hub',
  dive: 'Dive',
  pet: 'Pet',
  dress: 'Bag',
  defend: 'Defend',
  shop: 'Shop',
  about: 'About',
  sheetlab: 'Sheet lab',
  swords: 'Swords',
  swordlab: 'Sword lab',
};

/** The general-kit groups that matter in each mode — opened on entry. */
function devFocusForMode(mode: PlayMode): readonly GroveDevSectionId[] {
  if (mode === 'dive') return ['dive'];
  if (mode === 'dress') return ['bag', 'avatars'];
  if (mode === 'defend' || mode === 'swords') return ['campaign'];
  if (mode === 'shop') return ['tokens'];
  return [];
}

function GroveDevKit({
  focus = [],
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
  onOpenSheetLab,
  onOpenSwordLab,
}: {
  /** Groups open on entry (the floating kit opens the current mode's). */
  focus?: readonly GroveDevSectionId[];
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
  onOpenSheetLab: () => void;
  onOpenSwordLab: () => void;
}) {
  const theme = useTheme();
  const [resetArmed, setResetArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Which Dev kit sections are expanded. ALL collapsed on entry — the kit is a
   * long list, so a tester opens just the group they need. */
  const [openSections, setOpenSections] = useState<Record<GroveDevSectionId, boolean>>({
    dive: focus.includes('dive'),
    bag: focus.includes('bag'),
    tokens: focus.includes('tokens'),
    avatars: focus.includes('avatars'),
    campaign: focus.includes('campaign'),
    misc: focus.includes('misc'),
  });
  const toggleSection = useCallback((id: GroveDevSectionId) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

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

  /** The Dev kit's rows, grouped into collapsible sections (same shape as
   * Defend's). Every action that used to sit in one flat list is still here, in
   * the same form — only the grouping changed. */
  const sections: { id: GroveDevSectionId; title: string; rows: DevKitRowDef[] }[] = [
    {
      id: 'dive',
      title: 'Dive',
      rows: [
        { key: 'charges', label: 'Fill dive charges to 10', onPress: () => run(devFillDiveCharges) },
        { key: 'dive-charge', label: '+1 dive charge', onPress: () => run(devAddDiveCharge) },
        {
          key: 'force-bust',
          label: forceBustArmed ? 'Force bust next Deeper (armed)' : 'Force bust next Deeper',
          onPress: () => {
            clearResetArm();
            onToggleForceBust();
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
      ],
    },
    {
      id: 'bag',
      title: 'Bag / Merge',
      rows: [
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
      ],
    },
    {
      id: 'tokens',
      title: 'Tokens / Research',
      rows: [
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
          key: 'shop-reset-daily',
          label: 'Reset shop daily caps',
          onPress: () => run(devResetShopDaily),
        },
      ],
    },
    {
      id: 'avatars',
      title: 'Avatars',
      rows: [
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
      ],
    },
    {
      id: 'campaign',
      title: 'Campaign / Boss',
      rows: [
        {
          key: 'campaign-jump-main-9',
          label: 'Jump to Main wave 9',
          onPress: () => run((doc) => devSetCampaignSeat(doc, 'main', 9)),
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
        { key: 'boss-unlock', label: 'Unlock Bound Boss', onPress: () => run(devUnlockBoundBoss) },
        { key: 'boss-reset', label: 'Reset Bound Bosses', onPress: () => run(devResetBoundBosses) },
      ],
    },
    {
      id: 'misc',
      title: 'Misc',
      rows: [
        {
          key: 'tune',
          label: 'Tune…',
          onPress: () => {
            clearResetArm();
            onToggleTune();
          },
        },
        {
          key: 'sheet-lab',
          label: 'Sheet Lab (sprite sheets)…',
          onPress: () => {
            clearResetArm();
            onOpenSheetLab();
          },
        },
        {
          key: 'sword-lab',
          label: 'Sword lab (equip any sword)…',
          onPress: () => {
            clearResetArm();
            onOpenSwordLab();
          },
        },
      ],
    },
  ];

  /** One Dev kit row. `armed` marks the one-shot force toggles so a tester can
   * see the arm state from the section list without opening anything extra. */
  const renderRow = (row: DevKitRowDef) => {
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
  };

  return (
    <ThemedView type="backgroundElement" style={styles.devKitCard}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Dev kit · testing only
      </ThemedText>

      {sections.map((section) => {
        const open = openSections[section.id];
        return (
          <View key={section.id}>
            <Pressable
              onPress={() => toggleSection(section.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={open ? `Collapse ${section.title}` : `Expand ${section.title}`}
              style={({ pressed }) => [
                styles.devKitSectionHeader,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor="emphasis">
                {section.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {open ? '⌄' : '›'}
              </ThemedText>
            </Pressable>
            {open ? (
              <View style={styles.devKitSectionBody}>{section.rows.map(renderRow)}</View>
            ) : null}
          </View>
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

/*
 * Notice bodies: one line in the NoticeLane, most important first (the line ends in "…" when it
 * runs out of room). The full haul is in the Dive's haul reveal and the Locker.
 */

/** Names for a haul, capped at 3 so a long claim/bank stays readable. */
function summarizeNames(itemIds: readonly string[]): string {
  const shown = Math.min(itemIds.length, 3);
  const names = itemIds
    .slice(0, shown)
    .map((id) => shownFindName(id))
    .join(', ');
  const hidden = itemIds.length - shown;
  return hidden > 0 ? `${names} +${hidden} more` : names;
}

function finds(n: number): string {
  return `${n} ${n === 1 ? 'find' : 'finds'}`;
}

function claimNoticeBody(result: ClaimResult): string {
  const parts: string[] = [`+${result.tendTokens} tend`];
  if (result.dailyBonusTokens > 0) parts.push(`+${result.dailyBonusTokens} daily`);
  if (result.diveChargeGranted) parts.push('+1 charge');
  parts.push(result.items.length === 0 ? 'no finds' : finds(result.items.length));
  return parts.join(' · ');
}

function surfaceNoticeBody(s: {
  banked: string[];
  shellsGained: number;
  free: boolean;
  netFind: string | null;
  heartyFind: string | null;
  powersConverted: number;
  powersToday: number;
  swordDrop: string | null;
}): string {
  const parts: string[] = [s.free ? 'Free dive' : s.banked.length === 0 ? 'No finds' : finds(s.banked.length)];
  if (s.shellsGained > 0) parts.push(`+${s.shellsGained} shells`);
  if (s.swordDrop) parts.push(`Sword: ${s.swordDrop}`);
  if (s.netFind) parts.push(`Net: ${shownFindName(s.netFind)}`);
  if (s.heartyFind) parts.push(`Meal: ${shownFindName(s.heartyFind)}`);
  if (!s.free) parts.push(`Powers ${s.powersToday}/${DIVECORE_POWERS_PER_DAY}`);
  if (s.powersConverted > 0) parts.push(`${s.powersConverted * POWER_OVERFLOW_SHELLS} shells for extra Powers`);
  return parts.join(' · ');
}

function bustNoticeBody(rescued: readonly string[]): string {
  return rescued.length > 0 ? `Pet saved ${summarizeNames(rescued)}. The rest sank.` : 'The haul sank. Your Basecore is safe.';
}

/** Honest copy for a token-shop refusal (why the buy didn't happen) — ≤ 10 words. */
function shopRefusalCopy(reason: ShopRefusal): string {
  switch (reason) {
    case 'coming_soon':
      return 'Not for sale yet.';
    case 'insufficient':
      return 'Not enough tokens. Claim or clear a wave.';
    case 'daily_cap':
      return 'Daily limit reached. Back tomorrow.';
    case 'weekly_cap':
      return 'Weekly limit reached. Back next week.';
    case 'tide_only':
      return 'Tide Pass only.';
    case 'pass_cap':
      return "That's the limit for this pass.";
    case 'dive_full':
      return 'Dive charges are already full.';
  }
}

const styles = StyleSheet.create({
  /** Street screens: each one is a GameScreen (src/play/stage-layout.tsx). */
  streetRoot: {
    flex: 1,
    backgroundColor: NEON.ink,
  },
  /** A list screen's stage: the scroll body fills the fixed stage region. */
  listScroll: { flex: 1 },
  listColumn: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
  /** Pet room + Dive: the whole screen, ink behind the safe area. */
  fullSafeArea: {
    flex: 1,
    backgroundColor: NEON.ink,
  },
  /** Holds the sub-screens; catches the left-edge back swipe. */
  edgeWrap: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  /** Side padding lives INSIDE the scroll content (not on the SafeAreaView):
   * a ScrollView clips to its own bounds, so the Defend map card, which breaks
   * out of this padding to sit near the screen edge, must still be inside the
   * ScrollView's box. */
  scrollContent: {
    paddingHorizontal: Spacing.four,
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
  devFabPanel: { gap: Spacing.two },
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
  /** Dev kit group header — a bordered row that expands its rows. */
  devKitSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    marginTop: Spacing.one,
  },
  /** Expanded Dev kit group body — its rows, indented under the header. */
  devKitSectionBody: {
    gap: Spacing.half,
    paddingTop: Spacing.half,
    paddingLeft: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
