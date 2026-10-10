import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { BackHandler, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { hasTended } from '@/play/coach';
import { NEON, shopUnlocked, type HubDestination } from '@/play/neon-viper';
import { usePixelFonts } from '@/play/pixel-ui';
import { skippedHubPulse } from '@/play/play-settings';
import { PlayThemeProvider } from '@/play/play-theme';
import { PlayBanner } from '@/play/play-banner';
import {
  EMPTY_BANNERS,
  bannerEvents,
  currentBanner,
  dismissBanner,
  enqueueBanner,
  type Banner,
  type BannerQueue,
  type BannerWatch,
} from '@/play/play-banner-queue';
import { SaveDumpRow } from '@/play/dev-dump';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import { DevUnlockRow } from '@/play/dev-unlock-row';
import { DiveScreen, type DiveDeeperResult, type DiveSurfaceSummary } from '@/play/dive-screen';
import { DIVECORE_POWERS_PER_DAY, POWER_OVERFLOW_SHELLS, findName, type DivePath } from '@/play/dive-loot';
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

type PlayToast =
  | { kind: 'claim'; result: ClaimResult }
  | { kind: 'find'; foundName: string }
  | {
      kind: 'surface';
      itemIds: string[];
      petMood: boolean;
      shells: number;
      free: boolean;
      netFind: string | null;
      /** v26 — the Hearty meal's find, Powers past today's ceiling, and the
       * Powers-today count after this surface. */
      heartyFind: string | null;
      powersConverted: number;
      powersToday: number;
      swordDrop: string | null;
    }
  | { kind: 'bust'; rescued: string[]; petMood: boolean }
  | { kind: 'message'; title: string; body: string };

/** v25: every Play notice goes through one queued floating banner. */
type BannerAction = PlayToast | { kind: 'banner'; banner: Omit<Banner, 'id'> } | { kind: 'dismiss'; id: number };

function bannerReducer(q: BannerQueue, action: BannerAction): BannerQueue {
  if (action.kind === 'dismiss') return dismissBanner(q, action.id);
  return enqueueBanner(q, action.kind === 'banner' ? action.banner : toastBanner(action));
}

export default function PlayScreen() {
  usePixelFonts();
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
  // v25: `setToast` queues a floating banner (a stable reducer dispatch).
  const [banners, setToast] = useReducer(bannerReducer, EMPTY_BANNERS);
  const banner = currentBanner(banners);
  /** A banner tapped through to the Journal (Pet → Info → Journal), until used. */
  const [openJournal, setOpenJournal] = useState(false);
  const journalOpened = useCallback(() => setOpenJournal(false), []);
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
  const handleFreeDive = useCallback(async (): Promise<boolean> => beginFreeDive(), [beginFreeDive]);

  /** Expedition return (v21): announce it once per return, wherever you are
   * in Play (the save remembers it was shown). On the Pet screen the note
   * itself is the announcement. The note stays there until dismissed. */
  const expeditionNote = view?.pet.expeditionNote ?? null;
  const expeditionNoteFresh = view?.pet.expeditionNoteFresh ?? false;
  useEffect(() => {
    if (!expeditionNote || !expeditionNoteFresh) return;
    if (mode !== 'pet') {
      setToast({
        kind: 'banner',
        banner: {
          title: 'Your pet is back',
          body: `It brought back ${findName(expeditionNote)} — it’s waiting for you.`,
          target: 'pet',
        },
      });
    }
    commit((doc) => markExpeditionToasted(doc));
  }, [commit, expeditionNote, expeditionNoteFresh, mode]);

  /** v25: hatch / reveal / milestone-ready news → banners (see bannerEvents). */
  const watchRef = useRef<BannerWatch | null>(null);
  const watchStage = view?.pet.state.stage ?? null;
  const watchOdds = view?.pet.oddsOpen ?? false;
  const watchReady = view ? view.milestones.filter((m) => m.done && !m.claimed).length : 0;
  const watchStreakYmd = view?.pet.streak.ymd ?? null;
  const watchStreakDay = view?.pet.streak.last ?? null;
  useEffect(() => {
    if (watchStage == null) return;
    const next: BannerWatch = {
      stage: watchStage,
      oddsOpen: watchOdds,
      milestonesReady: watchReady,
      streakYmd: watchStreakYmd,
      streakDay: watchStreakDay,
    };
    for (const b of bannerEvents(watchRef.current, next, mode === 'pet')) setToast({ kind: 'banner', banner: b });
    watchRef.current = next;
  }, [mode, watchOdds, watchReady, watchStage, watchStreakDay, watchStreakYmd]);

  /** Surface: returns what the Dive scene counts up (finds + shells). */
  const handleSurface = useCallback(async (): Promise<DiveSurfaceSummary | null> => {
    const surfaced = await surfaceRun();
    if (!surfaced) return null;
    setToast({
      kind: 'surface',
      itemIds: surfaced.banked,
      petMood: surfaced.petCared,
      shells: surfaced.shellsGained,
      free: surfaced.free,
      netFind: surfaced.netFind,
      heartyFind: surfaced.heartyFind,
      powersConverted: surfaced.powersConverted,
      powersToday: surfaced.powersToday,
      swordDrop: surfaced.swordDrop,
    });
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
        setToast({
          kind: 'message',
          title: 'Odds updated',
          body: `Your pet changed, so this path is now ${outcome.bustPct}%. Nothing was rolled — check it and tap again.`,
        });
        return { outcome: 'changed', rescued: [] };
      }
      if (forceBustArmed) setForceBustArmed(false); // one-shot arm consumed
      if (outcome?.busted) {
        setToast({ kind: 'bust', rescued: outcome.rescued, petMood: outcome.petCared });
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
        setToast({
          kind: 'message',
          title: 'Clear milestone',
          body: `${result.milestoneLook.count} lifetime clears — found ${name}.`,
        });
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
        if (result.shellsInstead > 0) {
          parts.push(`${result.shellsInstead} shells (Powers for today were full)`);
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

  return (
    <PlayThemeProvider>
      {/* Forced ink chrome is dark regardless of the app-wide mode. */}
      <StatusBar style="light" />
      {/* The phone's own swipe-back leaves Play — only from the hub. */}
      <Stack.Screen options={{ gestureEnabled: mode === 'grove' && !hubOverlayOpen }} />
      {mode === 'grove' ? (
        <SafeAreaView style={styles.hubSafeArea}>
          <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
            <CommandHub
              diveActive={view?.diveRun.active ?? false}
              devUnlocked={devUnlocked}
              scrap={view?.tokens ?? null}
              wave={view?.campaign.wave_in_phase ?? 1}
              onTile={(to: HubDestination) => {
                if (to === 'shop' && !shopUnlocked(devUnlocked)) return;
                if (view) {
                  const pulse = skippedHubPulse({
                    loopFork: view.settings.loopFork,
                    loopOtherSeen: view.settings.loopOtherSeen,
                    didDive: view.stats.dives > 0 || view.stats.surfaces > 0,
                    didDefend: view.lifetimeWavesCleared > 0,
                  });
                  commit((doc) => {
                    const patch: Partial<typeof doc.play_settings> = {};
                    if (pulse && to === pulse) patch.loopOtherSeen = true;
                    if (to === 'dress' && !doc.play_settings.dressTeaseSeen) patch.dressTeaseSeen = true;
                    if (to === 'defend' && doc.play_settings.loopFork == null && hasTended(view.pet.state)) {
                      patch.loopFork = 'defend';
                    }
                    return Object.keys(patch).length ? setPlaySettings(doc, patch) : null;
                  });
                }
                setMode(to);
              }}
              pulse={
                view
                  ? skippedHubPulse({
                      loopFork: view.settings.loopFork,
                      loopOtherSeen: view.settings.loopOtherSeen,
                      didDive: view.stats.dives > 0 || view.stats.surfaces > 0,
                      didDefend: view.lifetimeWavesCleared > 0,
                    })
                  : null
              }
              reduceMotion={reduceMotion}
              onSettings={() => setHubSettingsOpen(true)}>
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
            </CommandHub>
          </ScrollView>
        </SafeAreaView>
      ) : (
        <View style={styles.edgeWrap} {...edgeSwipe.panHandlers}>
          {(mode === 'dive' || mode === 'pet') && view ? (
            // Pet room + Dive own the whole screen (overhaul, 2026-09-29):
            // no scroll view; the banner floats over every mode (below).
            <SafeAreaView style={styles.fullSafeArea}>
              {mode === 'dive' ? (
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
              ) : (
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
                  onGoDefend={() => setMode('defend')}
                  onGoDress={() => setMode('dress')}
                  onReplayTutorial={() => setTutorialReplay(true)}
                  openJournal={openJournal}
                  onJournalOpened={journalOpened}
                  openGuide={openGuide}
                  onGuideOpened={guideOpened}
                  onBanner={(b) => setToast({ kind: 'banner', banner: { ...b, target: null } })}
                />
              )}
            </SafeAreaView>
          ) : (
          <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
              <ScrollView contentContainerStyle={styles.scrollContent}>
                {mode === 'dress' && view ? (
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
                  />
                ) : mode === 'shop' && view && shopUnlocked(devUnlocked) ? (
                  <ShopScreen
                    view={view}
                    onBuyToken={handleBuyShopRow}
                    onBackToDivecore={() => setMode('grove')}
                  />
                ) : mode === 'about' ? (
                  <AboutScreen
                    onBackToDivecore={() => setMode('grove')}
                    onOpenGuide={() => {
                      setMode('pet');
                      setOpenGuide(true);
                    }}
                    onReplayTips={() => setTutorialReplay(true)}
                  />
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
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </ThemedView>
          )}
        </View>
      )}
      {banner ? (
        <PlayBanner
          key={banner.id}
          banner={banner}
          reduceMotion={reduceMotion}
          onDismiss={(id) => setToast({ kind: 'dismiss', id })}
          onTap={(b) => {
            setToast({ kind: 'dismiss', id: b.id });
            if (b.target === 'dive') setMode('dive');
            else if (b.target === 'pet') setMode('pet');
            else if (b.target === 'journal') {
              setMode('pet');
              setOpenJournal(true);
            }
          }}
        />
      ) : null}
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

/** Names for a haul, capped at 3 so a long claim/bank stays readable. */
/** A Play result / message → the floating banner (no tap target). */
function toastBanner(toast: PlayToast): Omit<Banner, 'id'> {
  return {
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
            ? (toast.free
                ? `Free dive: +${toast.shells} shells. Sightings are in your pet’s Logbook.${toast.swordDrop ? ` Sword: ${toast.swordDrop}.` : ''}`
                : `Brought up ${summarizeNames(toast.itemIds)}.${toast.netFind ? ` The Net caught ${findName(toast.netFind)}.` : ''}${toast.heartyFind ? ` Hearty meal: +${findName(toast.heartyFind)}.` : ''}${toast.swordDrop ? ` Sword: ${toast.swordDrop}.` : ''} Powers today: ${toast.powersToday}/${DIVECORE_POWERS_PER_DAY}${toast.powersConverted > 0 ? ` — ${toast.powersConverted} more became ${toast.powersConverted * POWER_OVERFLOW_SHELLS} shells` : ''}.${toast.shells > 0 ? ` +${toast.shells} shells.` : ''}`) +
              (toast.petMood ? ' Your pet loved it (+2 mood).' : '')
            : toast.kind === 'bust'
              ? (toast.rescued.length > 0
                  ? `Your pet saved ${summarizeNames(toast.rescued)} — the rest of the haul is lost.`
                  : 'This haul is lost — the charge was already spent. Your Basecore is untouched.') +
                (toast.petMood ? ' Your pet still had fun (+1 mood).' : '')
              : toast.body,
    target: null,
  };
}

function summarizeNames(itemIds: readonly string[]): string {
  const shown = Math.min(itemIds.length, 3);
  const names = itemIds
    .slice(0, shown)
    .map((id) => findName(id))
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
    case 'weekly_cap':
      return 'Weekly limit reached — come back next week.';
    case 'tide_only':
      return 'Tide Pass only.';
    case 'pass_cap':
      return "That's the limit for this pass.";
    case 'dive_full':
      return 'Dive charges are already full — nothing to add.';
  }
}

const styles = StyleSheet.create({
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
