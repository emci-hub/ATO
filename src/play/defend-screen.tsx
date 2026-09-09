/**
 * Defend — board + towers + Avatar + skill + campaign (Play steps 5a–5c,
 * Phase B campaign; GAME_SPEC §9, §9b, §9d, §9e, §9h, §11 screen 5).
 *
 * Campaign (Phase B): the fight is either the campaign's next wave (Trial
 * 1–5 on the Grove Path map, then Main 1–20 on the Divecore Main map — full
 * tokens, advances the seat) or a replay of a cleared band (half tokens,
 * seat untouched). Clearing Main wave 20 conquers the cycle: `cycle_power`
 * rises and the seat resets to Main wave 1. Every run carries its map + cycle
 * power, so puffs get fatter/faster-with-power on later cycles.
 *
 * One board (whichever map the run is on): puff enemies walk the road; six
 * pads hold up to six towers (archer / vine / crystal). Tap a pad to
 * place/upgrade with scrap; a range ring shows while a pad is selected. The
 * Avatar (placeholder circle) is draggable and auto-attacks the nearest enemy
 * in range; one skill button casts slow_pulse "Root Veil" (12s cooldown).
 * Kills → scrap; leak = fail; a clean wave = win (tokens + XP + campaign
 * advance via `onWin`). No SakPix, no new tower types.
 *
 * The sim is local + transient (see `defend.ts`); only the campaign seat,
 * rewards, and meta persist through the shared store.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, Share, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import {
  BOUND_BOSS_MAX_ON_BOARD,
  DEFEND_MAPS,
  DEFEND_TICK_MS,
  SKILL_COOLDOWN_MS,
  SKILL_DESCRIPTION,
  SKILL_NAME,
  TOWER_DEFS,
  TOWER_MAX_LEVEL,
  castSlowPulse,
  createDefendLive,
  defendDifficulty,
  placeBoundBoss,
  placeTower,
  puffPosition,
  retryDefendLive,
  stepDefendLive,
  towerUpgradeCost,
  upgradeTower,
  waveEnemyCount,
  type DefendMapId,
  type DefendLive,
  type Puff,
  type TowerKind,
} from '@/play/defend';
import { BOUND_BOSS_MAX_STAR, bossBandFor, boundBossFragmentCost, defaultBoundBossId, getBoundBossDef, isUniqueDrop, previewDropTable, gearScore, recommendedGs, TAG_COLOR, TAG_ICON, TAG_LABEL, TYPE_MATCH_CYCLE, typeMatchBonus, type TypeTag } from '@/play/engine';
import { getItemDef } from '@/play/items';
import {
  AVATAR_STAR_MAX,
  avatarLevelWavePower,
  avatarStarWavePower,
  bucketMultiplier,
  campaignNextSeat,
  campaignPhaseLabel,
  dropTableForWave,
  hasTypeMatch,
  planSkipToEven,
  replayBands,
  xpForClear,
  type CampaignPhase,
  type DefendWinContext,
  type DefendWinMode,
  type DefendWinResult,
  type PlayView,
  type SkipRewardResult,
} from '@/play/playStore';
import { tipForWave } from '@/play/coach';
import { getTune, saveTune, setKnob } from '@/play/tune';

const PUFF_COLOR = '#F472B6';
const RUNNER_COLOR = '#FBBF24';
const AVATAR_COLOR = '#38BDF8';
const TOWER_COLORS: Record<TowerKind, string> = {
  archer: '#34D399',
  vine: '#A3E635',
  crystal: '#A78BFA',
};

/* ---- floating hit numbers (display only) -------------------------------- */
/** On-screen floater cap — more than this and oldest are dropped (pooled). */
const MAX_FLOATERS = 8;
/** Rise distance (px) + fade timing for the cheap opacity/translateY pop. */
const FLOAT_RISE_PX = 14;
const FLOAT_MS = 700;
const FLOAT_STATIC_MS = 500; // reduce-motion: hold still, then clear
/** Center-ish the small text over the puff. */
const FLOATER_OFFSET_X = 14;
const FLOATER_OFFSET_Y = 22;

type Floater = {
  id: number;
  /** px position inside the board (top-left of the text box). */
  left: number;
  top: number;
  label: string;
  kill: boolean;
};

/** A per-tick hit the screen derived from puff HP deltas (never sent back). */
type HitEvent = {
  x: number; // board units 0..1
  y: number;
  damage: number;
  kill: boolean;
};

/**
 * Pure diff of two puff arrays → hit events. Any puff that lost HP got a hit;
 * any puff that vanished was killed (a leak freezes the sim, so a puff never
 * leaves the array any other way mid-run). Display only — the engine is the
 * sole owner of combat math. Floaters sit on the run's own map.
 */
function diffPuffEvents(
  before: readonly Puff[],
  after: readonly Puff[],
  mapId: DefendMapId,
): HitEvent[] {
  const map = DEFEND_MAPS[mapId];
  const byId = new Map(after.map((puff) => [puff.id, puff]));
  const events: HitEvent[] = [];
  for (const old of before) {
    const now = byId.get(old.id);
    if (!now) {
      // Killed — the last visible chunk of its HP is the killing blow.
      const pos = puffPosition(old.dist, map);
      events.push({ x: pos.x, y: pos.y, damage: Math.round(old.hp), kill: true });
    } else if (now.hp < old.hp) {
      const damage = old.hp - now.hp;
      const pos = puffPosition(now.dist, map);
      events.push({ x: pos.x, y: pos.y, damage: Math.round(damage), kill: false });
    }
  }
  return events;
}

/** Short damage label — K/M when big (no shared ATO helper existed). */
function formatHit(damage: number): string {
  const n = Math.round(damage);
  if (n < 1_000) return String(n);
  const oneDecimal = (value: number) =>
    value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
  if (n < 1_000_000) return `${oneDecimal(n / 1_000)}K`;
  return `${oneDecimal(n / 1_000_000)}M`;
}

type DefendPhase = 'setup' | 'running' | 'won' | 'lost';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** One fight on the board: which phase/map, which display wave, and whether
 * it is the campaign's next wave (`campaign`) or a cleared band replay
 * (`replay` — half tokens, seat untouched). */
type Fight = {
  phase: CampaignPhase;
  wave: number;
  mode: DefendWinMode;
};

/** The campaign's next wave (the seat) as a fight. */
function campaignFightOf(view: PlayView): Fight {
  return {
    phase: view.campaign.phase,
    wave: view.campaign.wave_in_phase,
    mode: 'campaign',
  };
}

function fightTitle(fight: Fight): string {
  const phase = campaignPhaseLabel(fight.phase);
  return fight.mode === 'replay'
    ? `Replay ${phase} wave ${fight.wave}`
    : `${phase} wave ${fight.wave}`;
}

/** Results drop label from a boss band (§9k copy): normal waves keep "Found:",
 * boss bands name their drop. */
function dropLabelFor(phase: CampaignPhase, wave: number): string {
  const band = bossBandFor(phase, wave);
  if (!band) return 'Found:';
  switch (band.kind) {
    case 'scout_mini':
      return 'Mini-boss drop:';
    case 'scout':
      return 'Boss drop:';
    case 'semi':
      return 'Semi-boss drop:';
    case 'final':
      return 'Final drop:';
  }
}

export function DefendScreen({
  view,
  reduceMotion,
  onWin,
  onResetDailyClears,
  onSetClearsTodayFive,
  onGrantMilestoneWaveFive,
  onResetMilestones,
  onResetCampaign,
  onJumpMain19,
  onForceConquered,
  onSpendStarToken,
  onGrantStarToken,
  onSetCycleTint,
  onForceFinal,
  onResetAvatarStarCycle,
  onSkipToEven,
  onDevOvergear,
  onDevForceSkipOffer,
  onBackToGrove,
}: {
  view: PlayView;
  /** Reduce-motion → floaters render static (no rise/fade). */
  reduceMotion: boolean;
  onWin: (ctx: DefendWinContext) => Promise<DefendWinResult | null>;
  onResetDailyClears: () => void;
  onSetClearsTodayFive: () => void;
  onGrantMilestoneWaveFive: () => Promise<void>;
  onResetMilestones: () => void;
  /** Dev kit only: reset the campaign to a fresh Trial wave 1. */
  onResetCampaign: () => void;
  /** Dev kit only: park the seat at Main wave 19. */
  onJumpMain19: () => void;
  /** Dev kit only: force one more Conquered cycle. */
  onForceConquered: () => void;
  /** Spend one Avatar star token → +1 star (§9h). */
  onSpendStarToken: () => Promise<boolean>;
  /** Dev kit only: grant one Avatar star token. */
  onGrantStarToken: () => Promise<void>;
  /** Dev kit only: set the cycle boss tint. */
  onSetCycleTint: (tint: TypeTag) => void;
  /** Dev kit only: park the seat at the Final band (Main wave 20). */
  onForceFinal: () => void;
  /** Dev kit only: reset Avatar-star cycle flags. */
  onResetAvatarStarCycle: () => void;
  /** Skip-to-even (§9j): fast-forward trivial normal waves at reduced pay.
   * The parent toasts the summary; the seat advance re-renders this screen. */
  onSkipToEven: () => Promise<SkipRewardResult | null>;
  /** Dev kit only: overgear (level + ★5 + ★5 Powers) so GS is huge. */
  onDevOvergear: () => void;
  /** Dev kit only: overgear + reset to Trial wave 1 (forces the skip offer). */
  onDevForceSkipOffer: () => void;
  onBackToGrove: () => void;
}) {
  const theme = useTheme();
  /** Dev kit only: soft PIN gate (same session flag the hub uses). */
  const devUnlocked = usePlayDevUnlocked();
  const [phase, setPhase] = useState<DefendPhase>('setup');
  const [paused, setPaused] = useState(false);
  /** A cleared-band wave picked for replay, or null → fight the campaign seat. */
  const [replayPick, setReplayPick] = useState<{ phase: CampaignPhase; wave: number } | null>(null);
  /** The live board. Always present so towers can be placed during SETUP
   * (spawns wait until Start); transitions rebuild it at the right times. */
  const [sim, setSim] = useState<DefendLive | null>(() =>
    createDefendLive(view.campaign.wave_in_phase, {
      mapId: view.campaign.phase,
      cyclePower: view.cyclePower,
      tint: view.cycleTint,
    }),
  );
  const [selectedPad, setSelectedPad] = useState<number | null>(null);
  /** God mode — starts from the §9c tune doc (BrokenOP turns it on). */
  const [godMode, setGodMode] = useState(() => getTune().godMode);
  const [coachHidden, setCoachHidden] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  /** Type-match chart (§9f §9i "?") — open state on setup + live. */
  const [chartOpen, setChartOpen] = useState(false);
  /** Dev kit only: dump the current band's drop table inline. */
  const [dumpDropsOpen, setDumpDropsOpen] = useState(false);
  /** Dev kit only: dump GS + per-wave recommended (Phase D smoke aid). */
  const [gsDumpOpen, setGsDumpOpen] = useState(false);
  /** What the last win paid — shows the honest (possibly halved) tokens. */
  const [lastWin, setLastWin] = useState<DefendWinResult | null>(null);
  /** Floating damage numbers, pooled to MAX_FLOATERS (display only). */
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floaterSeq = useRef(0);
  /** Puff list from the previous running tick — diffed for floaters. */
  const prevPuffsRef = useRef<Puff[]>([]);

  const phaseRef = useRef(phase);
  const pausedRef = useRef(paused);
  const simRef = useRef(sim);
  const godModeRef = useRef(godMode);
  phaseRef.current = phase;
  pausedRef.current = paused;
  simRef.current = sim;
  godModeRef.current = godMode;

  // What this screen is fighting right now. The replay pick overrides the
  // campaign seat; the seat drives the default.
  const campaignFight: Fight = campaignFightOf(view);
  const fight: Fight = replayPick
    ? { phase: replayPick.phase, wave: replayPick.wave, mode: 'replay' }
    : campaignFight;
  const fightRef = useRef<Fight>(fight);
  fightRef.current = fight;
  /** The fight that started the CURRENT run (won overlay actions key off it). */
  const playedRef = useRef<Fight>(fight);

  const displayedWave = sim?.wave ?? fight.wave;
  const mapId = fight.phase; // a phase names its own map ('trial' | 'main')
  /** The phase of the CURRENT board — the sim's run wins while one exists, so
   * the won/lost overlays keep labelling the run that just finished even after
   * the campaign seat has already moved on. */
  const labelPhase: CampaignPhase = sim?.mapId ?? fight.phase;
  /** The map the CURRENT board draws — follows the sim so a finished run never
   * visually jumps maps before the player moves on. */
  const boardMap = DEFEND_MAPS[sim?.mapId ?? mapId];

  /** Boss band of the chosen fight (null for a normal formula wave). */
  const band = bossBandFor(fight.phase, fight.wave);
  /** Soft type match vs the cycle tint (§9f) — board-wide +20% on a match. */
  const typeMatchActive = hasTypeMatch(view.equipped, view.cycleTint);
  const typeMatchPct = Math.round(typeMatchBonus(typeMatchActive) * 100);
  /** Drop table + honest preview rows for the chosen fight (§9i). */
  const dropTableId = dropTableForWave(fight.phase, fight.wave);
  const dropRows = previewDropTable(dropTableId, new Set(view.uniques));

  // Avatar position (board units 0..1) — smooth via shared values, engine via ref.
  const avatarX = useSharedValue(0.5);
  const avatarY = useSharedValue(0.4);
  const startX = useSharedValue(0.5);
  const startY = useSharedValue(0.4);
  const avatarPosRef = useRef({ x: 50, y: 40 }); // board units (0..100)
  const boardSizeRef = useRef(100);

  const setAvatarPosRef = useCallback((x: number, y: number) => {
    avatarPosRef.current = { x, y };
  }, []);

  // Equipped mult buckets, board-wide for towers + Avatar. Type match (§9f)
  // and Avatar stars (§9h) fold into the same damage pass.
  const buckets = useMemo(
    () => ({
      wavePower: bucketMultiplier('wave_power', view.statSums),
      towerSpeed: bucketMultiplier('tower_speed', view.statSums),
      avatarLevel: view.avatarLevel,
      typeMatch: typeMatchActive ? typeMatchBonus(true) : 0,
      avatarStars: view.avatarStars,
    }),
    [view.statSums, view.avatarLevel, view.avatarStars, typeMatchActive],
  );
  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;

  // Gear Score (§9j / §18 lock): soft-capped wave_power bucket × Avatar level
  // × Avatar stars. Type match is combat only and never enters GS.
  const gs = useMemo(
    () => gearScore(buckets.wavePower, view.avatarLevel, view.avatarStars),
    [buckets.wavePower, view.avatarLevel, view.avatarStars],
  );
  /** recommended_GS for the campaign seat wave (null on replays). */
  const seatRec = fight.mode === 'campaign'
    ? recommendedGs(fight.phase, fight.wave, view.cyclePower)
    : null;
  /** What a Skip batch from the seat would fast-forward (campaign only). */
  const skipPlan = useMemo(
    () =>
      fight.mode === 'campaign'
        ? planSkipToEven(view.campaign, gs, view.cyclePower)
        : null,
    [fight.mode, view.campaign, gs, view.cyclePower],
  );
  /** Last wave the skip would fast-forward (null → no offer). */
  const skipLast =
    skipPlan && skipPlan.steps.length > 0
      ? skipPlan.steps[skipPlan.steps.length - 1]
      : null;
  /** The wave the skip stops at, read as "wave wants ~Y" text for the offer. */
  const skipStopRec =
    skipPlan && skipPlan.steps.length > 0
      ? recommendedGs(skipPlan.toSeat.phase, skipPlan.toSeat.wave_in_phase, view.cyclePower)
      : null;
  const skipStopName =
    skipPlan && skipPlan.stopReason === 'boss'
      ? bossBandFor(skipPlan.toSeat.phase, skipPlan.toSeat.wave_in_phase)?.label ??
        `wave ${skipPlan.toSeat.wave_in_phase}`
      : skipPlan
        ? `wave ${skipPlan.toSeat.wave_in_phase}`
        : null;

  /** Dev kit only: one line per upcoming wave from the seat — its recommended
   * GS, boss-band marks, and where the current Skip plan would stop. */
  const gsDumpLines = useMemo(() => {
    const lines: string[] = [
      `GS ${gs} · cycle power ×${view.cyclePower.toFixed(2)} · seat ${campaignPhaseLabel(view.campaign.phase)} ${view.campaign.wave_in_phase}`,
    ];
    let cursor = view.campaign;
    let guard = 0;
    while (cursor && guard++ < 18) {
      const band = bossBandFor(cursor.phase, cursor.wave_in_phase);
      const rec = recommendedGs(cursor.phase, cursor.wave_in_phase, view.cyclePower);
      const stop =
        skipPlan &&
        skipPlan.steps.length > 0 &&
        cursor.phase === skipPlan.toSeat.phase &&
        cursor.wave_in_phase === skipPlan.toSeat.wave_in_phase
          ? '  ◆ skip stops'
          : '';
      lines.push(
        `${campaignPhaseLabel(cursor.phase)} w${cursor.wave_in_phase} ~${rec}${band ? '  boss' : ''}${stop}`,
      );
      const next = campaignNextSeat(cursor);
      if (!next || (skipPlan && cursor.phase === skipPlan.toSeat.phase && cursor.wave_in_phase === skipPlan.toSeat.wave_in_phase)) break;
      cursor = next;
    }
    return lines;
  }, [gs, skipPlan, view.campaign, view.cyclePower]);

  /** Rebuild a fresh board for a fight and go back to setup. */
  const buildSetup = useCallback(
    (next: Fight) => {
      setReplayPick(next.mode === 'replay' ? { phase: next.phase, wave: next.wave } : null);
      setSim(createDefendLive(next.wave, { mapId: next.phase, cyclePower: view.cyclePower, tint: view.cycleTint }));
      setPhase('setup');
      setPaused(false);
      setSelectedPad(null);
      setWhyOpen(false);
      prevPuffsRef.current = [];
      setFloaters([]);
    },
    [view.cyclePower, view.cycleTint],
  );

  /** When the chosen fight changes while on SETUP (seat advanced after a win,
   * a dev jump, a replay pick), resync the board. Runs on mount too. */
  const fightKey = `${fight.phase}:${fight.wave}:${fight.mode}`;
  useEffect(() => {
    if (phase !== 'setup') return;
    setSim(createDefendLive(fight.wave, { mapId: fight.phase, cyclePower: view.cyclePower, tint: view.cycleTint }));
    setSelectedPad(null);
    setWhyOpen(false);
    prevPuffsRef.current = [];
    setFloaters([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fightKey, view.cyclePower, view.cycleTint]);

  /** Start the wave on the current board — placed towers + spent scrap carry
   * into the fight (spec §9: setup place → start). */
  const startWave = useCallback(() => {
    playedRef.current = fightRef.current;
    setSim((prev) => prev ?? createDefendLive(fightRef.current.wave, {
      mapId: fightRef.current.phase,
      cyclePower: view.cyclePower,
      tint: view.cycleTint,
    }));
    setPhase('running');
    setPaused(false);
    setSelectedPad(null);
    prevPuffsRef.current = [];
    setFloaters([]);
  }, [view.cyclePower, view.cycleTint]);

  /** Push hit/kill floaters (capped + oldest dropped = pooled, no unbounded
   * growth under heavy fire). Board units → px via the measured board size. */
  const spawnFloaters = useCallback((events: readonly HitEvent[]) => {
    const size = boardSizeRef.current || 100;
    const created: Floater[] = events.map((event) => ({
      id: ++floaterSeq.current,
      left: event.x * size - FLOATER_OFFSET_X,
      top: event.y * size - FLOATER_OFFSET_Y,
      label: formatHit(event.damage),
      kill: event.kill,
    }));
    setFloaters((prev) => {
      const merged = [...prev, ...created];
      return merged.length > MAX_FLOATERS ? merged.slice(merged.length - MAX_FLOATERS) : merged;
    });
  }, []);

  const dropFloater = useCallback((id: number) => {
    setFloaters((prev) => prev.filter((floater) => floater.id !== id));
  }, []);

  const winWave = useCallback(() => {
    const played = playedRef.current;
    setPhase('won');
    setPaused(false);
    setSelectedPad(null);
    void onWin({ phase: played.phase, wave: played.wave, mode: played.mode }).then((result) => {
      if (result) setLastWin(result);
    });
  }, [onWin]);

  // Sim ticker: running + not paused.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const id = setInterval(() => {
      const current = simRef.current;
      if (!current) return;
      const avatar = avatarPosRef.current;
      const step = stepDefendLive(current, DEFEND_TICK_MS, bucketsRef.current, avatar);
      // Display-only floaters: any puff that lost HP this tick, or vanished
      // (killed), gets a short damage number near it. No engine changes.
      const events = diffPuffEvents(prevPuffsRef.current, step.state.puffs, step.state.mapId);
      if (events.length > 0) spawnFloaters(events);
      prevPuffsRef.current = step.state.puffs;
      simRef.current = step.state;
      setSim(step.state);
      if (step.leak && !godModeRef.current) {
        setPhase('lost');
        setPaused(false);
        setSelectedPad(null);
        return;
      }
      if (step.done) winWave();
    }, DEFEND_TICK_MS);
    return () => clearInterval(id);
  }, [phase, paused, winWave, spawnFloaters]);

  // Background → freeze the wave.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phaseRef.current === 'running' && !pausedRef.current) {
        setPaused(true);
      }
    });
    return () => sub.remove();
  }, []);

  const selectedTower =
    sim && selectedPad != null
      ? sim.towers.find((tower) => tower.pad === selectedPad) ?? null
      : null;
  const selectedBoundBoss =
    sim && selectedPad != null
      ? sim.boundBosses.find((bb) => bb.pad === selectedPad) ?? null
      : null;
  /** Unlocked Bound Bosses (stars ≥ 1) the player can place. */
  const unlockedBoundBosses = view.boundBosses.filter((bb) => bb.unlocked);
  const boundBossCount = sim?.boundBosses.length ?? 0;
  /** The cycle's boss family (one until pack 2) for the fragment preview. */
  const cycleBossId = defaultBoundBossId();
  const cycleBossDef = cycleBossId ? getBoundBossDef(cycleBossId) : undefined;
  const cycleBossRecord = view.boundBosses.find((bb) => bb.id === cycleBossId);
  const cycleBossStars = cycleBossRecord?.stars ?? 0;
  const cycleBossFrags = cycleBossRecord?.frags ?? 0;
  const cycleBossNextCost =
    cycleBossDef && cycleBossStars < BOUND_BOSS_MAX_STAR
      ? boundBossFragmentCost(cycleBossDef, cycleBossStars)
      : null;

  const placeOnPad = (kind: TowerKind) => {
    if (selectedPad == null) return;
    setSim((prev) => (prev ? placeTower(prev, selectedPad, kind) ?? prev : prev));
  };

  const placeOnBoundBoss = (bossId: string, stars: number) => {
    if (selectedPad == null) return;
    setSim((prev) => (prev ? placeBoundBoss(prev, selectedPad, bossId, stars) ?? prev : prev));
  };

  const upgradeSelected = () => {
    if (!selectedTower) return;
    setSim((prev) =>
      prev ? upgradeTower(prev, selectedTower.id) ?? prev : prev,
    );
  };

  const castSkill = () => {
    const current = simRef.current;
    if (!current) return;
    const avatar = avatarPosRef.current;
    const next = castSlowPulse(current, avatar);
    if (next) {
      simRef.current = next;
      setSim(next);
    }
  };

  const skillReady = (sim?.skillCooldownMs ?? 0) <= 0;
  const skillSeconds = Math.ceil((sim?.skillCooldownMs ?? 0) / 1000);
  const scrap = sim?.scrap ?? getTune().startScrap;

  // Coach tip (pure): read the current wave, scrap, and what's on the pads.
  const towerCounts = useMemo(() => {
    const counts = { archer: 0, vine: 0, crystal: 0 };
    for (const tower of sim?.towers ?? []) counts[tower.kind] += 1;
    return counts;
  }, [sim?.towers]);
  const coach = tipForWave(displayedWave, scrap, towerCounts);

  // Drag gesture for the Avatar (mirrors scenario-card.tsx Pan pattern).
  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = avatarX.value;
      startY.value = avatarY.value;
    })
    .onUpdate((event) => {
      const size = boardSizeRef.current || 100;
      const nx = clamp01(startX.value + event.translationX / size);
      const ny = clamp01(startY.value + event.translationY / size);
      avatarX.value = nx;
      avatarY.value = ny;
      runOnJS(setAvatarPosRef)(nx * 100, ny * 100);
    });

  const avatarStyle = useAnimatedStyle(() => ({
    left: avatarX.value * (boardSizeRef.current || 100) - AVATAR_RADIUS_PX,
    top: avatarY.value * (boardSizeRef.current || 100) - AVATAR_RADIUS_PX,
  }));

  const levelBonus = avatarLevelWavePower(view.avatarLevel);
  const bands = replayBands(view);
  const cycleNote =
    view.conqueredCycles > 0
      ? `Cycle ${view.conqueredCycles} — foes scale ×${view.cyclePower.toFixed(2)}`
      : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Pressable
            onPress={onBackToGrove}
            hitSlop={12}
            style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                ‹ Divecore
              </ThemedText>
          </Pressable>
        </View>

        <ThemedText type="subtitle">Defend</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lede}>
          Protect the Basecore Path. Drag your Avatar to the thick, and time Root Veil.
        </ThemedText>

        {/* HUD */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">
              {campaignPhaseLabel(labelPhase)} wave {displayedWave}
            </ThemedText>
            <ThemedText type="subheading" themeColor="emphasis">
              {defendDifficulty(displayedWave)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {fight.mode === 'replay'
              ? 'Replay of a cleared band — pays half tokens, your campaign seat stays put.'
              : cycleNote
                ? `Campaign climb — ${cycleNote}.`
                : 'Campaign climb — Trial 1–5, then Main 1–20. Clear Main 20 to Conquer a cycle.'}
          </ThemedText>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">Scrap</ThemedText>
            <ThemedText type="subheading" themeColor="emphasis">
              {scrap}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Run scrap — spend to place and upgrade towers, earn by defeating foes, resets each
            run. You start with enough for about two towers.
          </ThemedText>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">Avatar · Lv {view.avatarLevel}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ×{levelBonus.toFixed(2)} power
            </ThemedText>
          </View>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">
              Avatar ★{view.avatarStars}/{AVATAR_STAR_MAX}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ×{avatarStarWavePower(view.avatarStars).toFixed(2)} power
            </ThemedText>
          </View>
          {view.avatarStarTokens > 0 && view.avatarStars < AVATAR_STAR_MAX ? (
            <Pressable
              onPress={() => void onSpendStarToken()}
              accessibilityRole="button"
              accessibilityLabel="Spend Avatar star token"
              style={({ pressed }) => [
                styles.hudButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">
                Spend star token → ★{view.avatarStars + 1} (+
                {Math.round(getTune().avatarStarWavePowerStep * 100)}% power)
              </ThemedText>
            </Pressable>
          ) : null}
          <View style={styles.statRow}>
            <View style={styles.typeMatchRow}>
              <MaterialCommunityIcons
                name={TAG_ICON[view.cycleTint]}
                size={14}
                color={TAG_COLOR[view.cycleTint]}
              />
              <ThemedText type="smallBold">
                Type · {TAG_LABEL[view.cycleTint]}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setChartOpen((open) => !open)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Type match chart"
              style={({ pressed }) => [pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor={typeMatchActive ? 'emphasis' : 'textSecondary'}>
                {typeMatchActive ? `+${typeMatchPct}% match` : 'no match'}
              </ThemedText>
            </Pressable>
          </View>
          {chartOpen ? (
            <TypeMatchChart tint={view.cycleTint} matched={typeMatchActive} matchPct={typeMatchPct} />
          ) : null}
          {phase === 'running' ? (
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => setPaused((value) => !value)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.hudButton,
                  styles.flex1,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold">{paused ? 'Resume' : 'Pause'}</ThemedText>
              </Pressable>
              <Pressable
                onPress={castSkill}
                disabled={!skillReady}
                accessibilityRole="button"
                accessibilityLabel={SKILL_NAME}
                style={({ pressed }) => [
                  styles.hudButton,
                  styles.flex1,
                  {
                    backgroundColor: skillReady ? theme.accentFill : theme.backgroundSelected,
                  },
                  pressed && skillReady && styles.pressed,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: skillReady ? theme.onAccent : theme.textSecondary }}>
                  {skillReady ? SKILL_NAME : `${SKILL_NAME} · ${skillSeconds}s`}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {SKILL_NAME}: {SKILL_DESCRIPTION} ({SKILL_COOLDOWN_MS / 1000}s cooldown)
            </ThemedText>
          )}
        </ThemedView>

        {/* Board */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {boardMap.name}
            {cycleNote ? ` · ${cycleNote}` : ''}
            {fight.mode === 'replay' ? ' · replay (half tokens)' : ''}
          </ThemedText>
          <View
            style={[styles.board, { backgroundColor: theme.backgroundSelected }]}
            onLayout={(event) => {
              boardSizeRef.current = event.nativeEvent.layout.width || 100;
            }}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Path
                d={pathD(boardMap.path)}
                stroke={theme.textSecondary}
                strokeOpacity={0.3}
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {boardMap.pads.map((pad, index) => {
                const tower = sim?.towers.find((t) => t.pad === index);
                const boundBoss = sim?.boundBosses.find((b) => b.pad === index);
                const selected = selectedPad === index;
                const occupied = tower != null || boundBoss != null;
                const fillColor = boundBoss
                  ? TAG_COLOR[getBoundBossDef(boundBoss.bossId)?.tint ?? view.cycleTint]
                  : tower
                    ? TOWER_COLORS[tower.kind]
                    : theme.accent;
                return (
                  <Circle
                    key={`pad-${index}`}
                    cx={pad.x}
                    cy={pad.y}
                    r={5.5}
                    fill={fillColor}
                    fillOpacity={occupied ? 1 : 0.25}
                    stroke={selected ? theme.accent : 'none'}
                    strokeWidth={selected ? 1.4 : 0}
                    onPress={() => setSelectedPad(selected ? null : index)}
                  />
                );
              })}
              {selectedPad != null && boardMap.pads[selectedPad] ? (
                <Circle
                  cx={boardMap.pads[selectedPad].x}
                  cy={boardMap.pads[selectedPad].y}
                  r={
                    selectedTower
                      ? TOWER_DEFS[selectedTower.kind].range
                      : selectedBoundBoss
                        ? getBoundBossDef(selectedBoundBoss.bossId)?.range ?? 18
                        : 18
                  }
                  fill="none"
                  stroke={theme.accent}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              ) : null}
              {sim?.towers.map((tower) => {
                const pad = boardMap.pads[tower.pad];
                return (
                  <SvgText
                    key={`tower-${tower.id}`}
                    x={pad.x}
                    y={pad.y + 1.4}
                    fontSize={4.2}
                    fontWeight="bold"
                    fill="#FFFFFF"
                    textAnchor="middle">
                    {tower.level}
                  </SvgText>
                );
              })}
              {sim?.boundBosses.map((bb) => {
                const pad = boardMap.pads[bb.pad];
                return (
                  <SvgText
                    key={`bb-${bb.id}`}
                    x={pad.x}
                    y={pad.y + 1.4}
                    fontSize={4.2}
                    fontWeight="bold"
                    fill="#FFFFFF"
                    textAnchor="middle">
                    {'★' + bb.stars}
                  </SvgText>
                );
              })}
              {sim?.puffs.map((puff) => {
                const pos = puffPosition(puff.dist, boardMap);
                const x = pos.x * 100;
                const y = pos.y * 100;
                const pct = Math.max(0, Math.min(1, puff.hp / puff.maxHp));
                const slowed = puff.slowMs > 0;
                const radius = 3.4 * puff.size;
                const fill =
                  puff.kind === 'boss'
                    ? puff.tint
                      ? TAG_COLOR[puff.tint]
                      : PUFF_COLOR
                    : puff.kind === 'runner'
                      ? RUNNER_COLOR
                      : PUFF_COLOR;
                const barWidth = 8 * puff.size;
                return (
                  <G key={`puff-${puff.id}`}>
                    <Circle cx={x} cy={y} r={radius} fill={fill} />
                    {puff.kind === 'boss' ? (
                      <Circle
                        cx={x}
                        cy={y}
                        r={radius}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={0.6}
                        strokeOpacity={0.7}
                      />
                    ) : null}
                    <Circle cx={x} cy={y} r={radius} fill={slowed ? theme.accentTertiary : 'none'} fillOpacity={0.5} />
                    <Rect x={x - barWidth / 2} y={y - radius - 4} width={barWidth} height={1.6} fill="rgba(0,0,0,0.35)" rx={0.8} />
                    <Rect x={x - barWidth / 2} y={y - radius - 4} width={barWidth * pct} height={1.6} fill="#4ADE80" rx={0.8} />
                  </G>
                );
              })}
            </Svg>

            {/* Draggable Avatar overlay */}
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.avatar, avatarStyle, { backgroundColor: AVATAR_COLOR }]} />
            </GestureDetector>

            {/* Floating damage numbers (display only, pooled) */}
            {floaters.map((floater) => (
              <HitFloater
                key={floater.id}
                floater={floater}
                kill={floater.kill}
                reduceMotion={reduceMotion}
                onDone={() => dropFloater(floater.id)}
              />
            ))}
          </View>
          {paused && phase === 'running' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Paused — the wave is frozen.
            </ThemedText>
          ) : null}
        </ThemedView>

        {/* Pad action panel */}
        {selectedPad != null ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            {selectedTower ? (
              <>
                <ThemedText type="smallBold">
                  {TOWER_DEFS[selectedTower.kind].name} · level {selectedTower.level}/{TOWER_MAX_LEVEL}
                </ThemedText>
                {selectedTower.level < TOWER_MAX_LEVEL ? (
                  <Pressable
                    onPress={upgradeSelected}
                    disabled={scrap < towerUpgradeCost(selectedTower)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.primaryButton,
                      {
                        backgroundColor:
                          scrap >= towerUpgradeCost(selectedTower)
                            ? theme.accentFill
                            : theme.backgroundSelected,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={{
                        color:
                          scrap >= towerUpgradeCost(selectedTower)
                            ? theme.onAccent
                            : theme.textSecondary,
                      }}>
                      Upgrade · {towerUpgradeCost(selectedTower)} scrap
                    </ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    Fully upgraded.
                  </ThemedText>
                )}
              </>
            ) : selectedBoundBoss ? (
              <>
                <ThemedText type="smallBold">
                  {getBoundBossDef(selectedBoundBoss.bossId)?.name ?? 'Bound Boss'} · ★
                  {selectedBoundBoss.stars}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Bound Boss — fixed on the pad, stars only (no scrap upgrade).{' '}
                  {getBoundBossDef(selectedBoundBoss.bossId)?.skill.name}:{' '}
                  {getBoundBossDef(selectedBoundBoss.bossId)?.skill.description}
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText type="smallBold">Build a tower</ThemedText>
                {(Object.keys(TOWER_DEFS) as TowerKind[]).map((kind) => {
                  const def = TOWER_DEFS[kind];
                  const affordable = scrap >= def.placeCost;
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => placeOnPad(kind)}
                      disabled={!affordable}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.hudButton,
                        { backgroundColor: affordable ? theme.backgroundSelected : theme.backgroundElement },
                        pressed && affordable && styles.pressed,
                      ]}>
                      <ThemedText
                        type="smallBold"
                        themeColor={affordable ? undefined : 'textSecondary'}>
                        {def.name} · {def.placeCost} scrap
                      </ThemedText>
                    </Pressable>
                  );
                })}
                {unlockedBoundBosses.length > 0 ? (
                  <>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Bound Boss
                    </ThemedText>
                    {unlockedBoundBosses.map((bb) => {
                      const def = getBoundBossDef(bb.id);
                      const affordable = def != null && scrap >= def.place_cost;
                      const atCap = boundBossCount >= BOUND_BOSS_MAX_ON_BOARD;
                      return (
                        <Pressable
                          key={bb.id}
                          onPress={() => placeOnBoundBoss(bb.id, bb.stars)}
                          disabled={!affordable || atCap}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.hudButton,
                            {
                              backgroundColor:
                                affordable && !atCap
                                  ? theme.backgroundSelected
                                  : theme.backgroundElement,
                            },
                            pressed && affordable && !atCap && styles.pressed,
                          ]}>
                          <ThemedText
                            type="smallBold"
                            themeColor={affordable && !atCap ? undefined : 'textSecondary'}>
                            {def?.name ?? bb.id} ★{bb.stars} · {def?.place_cost ?? 0} scrap
                            {atCap ? ' · max 2' : ''}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </>
                ) : null}
              </>
            )}
            <Pressable
              onPress={() => setSelectedPad(null)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.hudButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Done
              </ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {/* Status / actions */}
        {phase === 'setup' ? (
          <>
            {!coachHidden ? (
              <ThemedView type="backgroundElement" style={styles.coachCard}>
                <View style={styles.coachHeader}>
                  <ThemedText type="smallBold" themeColor="emphasis">
                    Coach · {fightTitle(fight)}
                  </ThemedText>
                  <Pressable
                    onPress={() => setCoachHidden(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Hide coach"
                    style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedText type="code" themeColor="textSecondary">
                      Hide
                    </ThemedText>
                  </Pressable>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {coach.tip}
                </ThemedText>
                {coach.why ? (
                  <Pressable
                    onPress={() => setWhyOpen((open) => !open)}
                    accessibilityRole="button"
                    style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedText type="code" themeColor="textSecondary">
                      {whyOpen ? 'Why? (hide)' : 'Why?'}
                    </ThemedText>
                  </Pressable>
                ) : null}
                {whyOpen && coach.why ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.whyText}>
                    {coach.why}
                  </ThemedText>
                ) : null}
              </ThemedView>
            ) : null}

            {/* Fight card — campaign next or the chosen replay. */}
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.statRow}>
                <ThemedText type="smallBold">{fightTitle(fight)}</ThemedText>
                <ThemedText type="subheading" themeColor="emphasis">
                  {band
                    ? `${band.boss.count} boss + ${band.runners} runners`
                    : `${waveEnemyCount(fight.wave, view.cyclePower)} puffs`}
                </ThemedText>
              </View>
              {band ? (
                <View style={styles.bandRow}>
                  <MaterialCommunityIcons
                    name={TAG_ICON[view.cycleTint]}
                    size={14}
                    color={TAG_COLOR[view.cycleTint]}
                  />
                  <ThemedText type="smallBold">
                    {band.label} — {band.boss.name}
                  </ThemedText>
                  <ThemedText type="code" themeColor="textSecondary">
                    {TAG_LABEL[view.cycleTint]}
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {band?.story
                  ? band.story
                  : fight.mode === 'replay'
                    ? 'Half-token replay — tap a cleared wave below, or head back to the campaign.'
                    : cycleNote
                      ? `The campaign climb — ${cycleNote}. Place towers, then start.`
                      : 'The campaign climb — Trial teaches the path, Main is the real deal. Place towers, then start.'}
              </ThemedText>
              {fight.mode === 'replay' ? (
                <Pressable
                  onPress={() => buildSetup(campaignFight)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.hudButton, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Back to campaign
                  </ThemedText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={startWave}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accentFill },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {fight.mode === 'replay' ? 'Start replay' : 'Start wave'}
                </ThemedText>
              </Pressable>
            </ThemedView>

            {/* Gear score + Skip-to-even (§9j / §18 D) — campaign only. */}
            {fight.mode === 'campaign' ? (
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.statRow}>
                  <ThemedText type="smallBold">Your GS</ThemedText>
                  <ThemedText type="subheading" themeColor="emphasis">
                    {gs}
                  </ThemedText>
                </View>
                <View style={styles.statRow}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Wave wants
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ~{seatRec}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Gear score reads your soft-capped equipped power, Avatar level, and stars.
                  Type match is combat only — it never counts toward GS.
                </ThemedText>
                {skipPlan && skipPlan.steps.length > 0 && skipLast ? (
                  <View style={[styles.skipBox, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="smallBold" themeColor="emphasis">
                      Your GS {gs} — skip ahead?
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      The next {skipPlan.steps.length}{' '}
                      {skipPlan.steps.length === 1 ? 'normal wave' : 'normal waves'} — up to{' '}
                      {campaignPhaseLabel(skipLast.phase)} wave {skipLast.wave_in_phase} — want ~
                      {recommendedGs(skipLast.phase, skipLast.wave_in_phase, view.cyclePower)} or
                      less. Skipping pays ~{Math.round(getTune().skipPayFraction * 100)}% tokens
                      and XP plus one small commons-only crate — never uniques, boss drops, or
                      Avatar stars. Skip stops at {skipStopName} (wants ~{skipStopRec}); farm bands
                      stay open after.
                    </ThemedText>
                    <Pressable
                      onPress={() => void onSkipToEven()}
                      accessibilityRole="button"
                      accessibilityLabel="Skip ahead"
                      style={({ pressed }) => [
                        styles.primaryButton,
                        { backgroundColor: theme.accentFill },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                        Skip ahead · {skipPlan.steps.length}{' '}
                        {skipPlan.steps.length === 1 ? 'wave' : 'waves'}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </ThemedView>
            ) : null}

            {/* Drop preview — honest "what can drop" for this wave/band (§9i). */}
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.statRow}>
                <ThemedText type="smallBold">What can drop</ThemedText>
                {band?.kind === 'final' ? (
                  <ThemedText type="code" themeColor="emphasis">
                    + Avatar star {Math.round(getTune().avatarStarDropPct * 100)}%
                  </ThemedText>
                ) : null}
              </View>
              {band?.kind === 'final' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {view.avatarStarRolledCycle
                    ? 'Avatar star token · already rolled this cycle'
                    : `Avatar star token · ${Math.round(getTune().avatarStarDropPct * 100)}% drop · pity on the ${getTune().avatarStarPityClears}rd Final this cycle (${view.finalClearsThisCycle}/${getTune().avatarStarPityClears} so far)`}
                </ThemedText>
              ) : null}
              {band && cycleBossDef ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {cycleBossStars >= BOUND_BOSS_MAX_STAR
                    ? `Boss fragment · ${cycleBossDef.name} ★${cycleBossStars} (max)`
                    : `Boss fragment · ${cycleBossFrags}/${cycleBossNextCost ?? '—'}${
                        cycleBossStars > 0 ? ` · ★${cycleBossStars}` : ''
                      }`}
                </ThemedText>
              ) : null}
              {dropRows.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No drops listed for this wave.
                </ThemedText>
              ) : (
                dropRows.map((row) => {
                  const def = getItemDef(row.id);
                  const name = def?.core.name ?? row.id;
                  const slot = def?.core.slot ?? 'item';
                  const rarity = def ? capitalize(def.core.rarity) : '';
                  return (
                    <View key={row.id} style={styles.dropRow}>
                      <View style={styles.dropRowLeft}>
                        <ThemedText type="smallBold">{name}</ThemedText>
                        <ThemedText type="code" themeColor="textSecondary">
                          {rarity} · {slot}
                        </ThemedText>
                      </View>
                      <ThemedText
                        type="code"
                        themeColor={row.owned ? 'textSecondary' : row.unique ? 'emphasis' : undefined}>
                        {row.owned
                          ? "Owned — won't drop again"
                          : row.unique
                            ? 'Unique'
                            : 'Can grind — still drops'}
                      </ThemedText>
                    </View>
                  );
                })
              )}
            </ThemedView>

            {/* Band picker — replay any cleared band at half tokens (§9h). */}
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Cleared bands · replay at half tokens</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Replays pay half tokens and never move your campaign seat or daily-clear cap.
              </ThemedText>
              {bands.map((band) => {
                return (
                  <View key={band.phase} style={styles.bandBlock}>
                    <View style={styles.statRow}>
                      <ThemedText type="smallBold">
                        {campaignPhaseLabel(band.phase)} waves {band.firstWave}–{band.lastWave}
                      </ThemedText>
                      {band.unlocked ? (
                        <ThemedText type="code" themeColor="emphasis">
                          half
                        </ThemedText>
                      ) : (
                        <ThemedText type="code" themeColor="textSecondary">
                          locked
                        </ThemedText>
                      )}
                    </View>
                    {band.unlocked ? (
                      <View style={styles.chipRow}>
                        {Array.from({ length: band.clearedThrough }, (_, index) => index + 1).map(
                          (wave) => {
                            const active =
                              replayPick != null &&
                              replayPick.phase === band.phase &&
                              replayPick.wave === wave;
                            return (
                              <Pressable
                                key={`${band.phase}-${wave}`}
                                onPress={() =>
                                  buildSetup({ phase: band.phase, wave, mode: 'replay' })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={`Replay ${band.label} wave ${wave}`}
                                style={({ pressed }) => [
                                  styles.chip,
                                  {
                                    backgroundColor: active
                                      ? theme.accentFill
                                      : theme.backgroundSelected,
                                  },
                                  pressed && styles.pressed,
                                ]}>
                                <ThemedText
                                  type="smallBold"
                                  style={{ color: active ? theme.onAccent : theme.textSecondary }}>
                                  {wave}
                                </ThemedText>
                              </Pressable>
                            );
                          },
                        )}
                      </View>
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        {band.phase === 'trial'
                          ? 'Clear the Trial run to open its replays.'
                          : 'Reach Main to open its replays.'}
                      </ThemedText>
                    )}
                  </View>
                );
              })}
            </ThemedView>
          </>
        ) : null}

        {phase === 'running' && !paused ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            {coachHidden
              ? `Towers fire on their own — drag your Avatar and time ${SKILL_NAME}.`
              : `Coach: ${coach.tip}`}
          </ThemedText>
        ) : null}

        {phase === 'won' ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              {lastWin?.conquered
                ? `Cycle ${lastWin.conqueredCycles} conquered — Main cleared!`
                : playedRef.current.mode === 'replay'
                  ? `Cleared ${campaignPhaseLabel(playedRef.current.phase)} wave ${playedRef.current.wave} (replay)`
                  : `Cleared ${fightTitle(playedRef.current)}`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Avatar Lv {view.avatarLevel} · {view.lifetimeWavesCleared} waves cleared lifetime
            </ThemedText>
            {lastWin ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  +{lastWin.tokensGranted} tokens · +{lastWin.xpGranted} XP
                  {lastWin.milestoneLook
                    ? ` · ${ordinal(lastWin.milestoneLook.count)} clear — found a Rare Look!`
                    : ''}
                </ThemedText>
                {lastWin.dropItems.length > 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {dropLabelFor(playedRef.current.phase, playedRef.current.wave)}{' '}
                    {lastWin.dropItems
                      .map((id) => {
                        const name = getItemDef(id)?.core.name ?? id;
                        const unique = isUniqueDrop(
                          dropTableForWave(playedRef.current.phase, playedRef.current.wave),
                          id,
                        );
                        return unique ? `${name} (Unique)` : name;
                      })
                      .join(', ')}
                  </ThemedText>
                ) : null}
                {lastWin.starTokenGranted ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Final drop: Avatar star
                  </ThemedText>
                ) : null}
                {lastWin.bossFragment ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {lastWin.bossFragment.starred
                      ? `${lastWin.bossFragment.name} bound ★${lastWin.bossFragment.stars}!`
                      : `Boss fragment · ${lastWin.bossFragment.frags}/${lastWin.bossFragment.nextCost ?? '—'}`}
                  </ThemedText>
                ) : null}
                {lastWin.conquered ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.conqueredNote}>
                    Conquered! Enemies now scale ×{lastWin.cyclePower.toFixed(2)}. Next cycle
                    starts at Main wave 1.
                  </ThemedText>
                ) : lastWin.replayHalf ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.halvedNote}>
                    Half-token replay — your campaign seat is exactly where you left it.
                  </ThemedText>
                ) : lastWin.halved ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.halvedNote}>
                    Half tokens today — come back tomorrow for full.
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {playedRef.current.mode === 'replay'
                  ? `Half-token replay — +${Math.floor(getTune().tokenClearBase / 2)} tokens · +${Math.floor(
                      xpForClear(sim?.wave ?? fight.wave) / 2,
                    )} XP`
                  : `+${getTune().tokenClearBase} tokens · +${xpForClear(sim?.wave ?? fight.wave)} XP`}
              </ThemedText>
            )}
            {playedRef.current.mode === 'replay' ? (
              <>
                <Pressable
                  onPress={() => buildSetup(playedRef.current)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.accentFill },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                    Farm again
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => buildSetup(campaignFight)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.hudButton,
                    { backgroundColor: theme.backgroundSelected },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Back to campaign
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => buildSetup(campaignFight)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accentFill },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {lastWin?.conquered
                    ? 'Next cycle · Main wave 1'
                    : `Next · ${fightTitle(campaignFight)}`}
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => void shareDefendClear(playedRef.current.wave, view.avatarLevel)}
              accessibilityRole="button"
              accessibilityLabel="Share this clear"
              style={({ pressed }) => [
                styles.hudButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Share this clear</ThemedText>
            </Pressable>
            <Pressable
              onPress={onBackToGrove}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.hudButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Leave</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {phase === 'lost' ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">The path was breached.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              One puff reached the exit — {fightTitle(playedRef.current)} ends. Retry the same
              wave with your towers kept.
            </ThemedText>
            <Pressable
              onPress={() => {
                if (sim) {
                  setSim(retryDefendLive(sim));
                  setPhase('running');
                  setPaused(false);
                  setSelectedPad(null);
                  prevPuffsRef.current = [];
                  setFloaters([]);
                }
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.accentFill },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Retry
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onBackToGrove}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.hudButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Leave</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {PRE_LAUNCH_DEV && devUnlocked ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Dev kit · defend only
            </ThemedText>
            <DevRow
              label="Win wave"
              disabled={phase !== 'running'}
              onPress={() => winWave()}
            />
            <DevRow
              label="Force leak / fail"
              disabled={phase !== 'running'}
              onPress={() => {
                setPhase('lost');
                setPaused(false);
                setSelectedPad(null);
              }}
            />
            <DevRow
              label="+40 scrap"
              disabled={!sim}
              onPress={() => setSim((prev) => (prev ? { ...prev, scrap: prev.scrap + 40 } : prev))}
            />
            <DevRow
              label="Clear all towers"
              disabled={!sim || sim.towers.length === 0}
              onPress={() => setSim((prev) => (prev ? { ...prev, towers: [] } : prev))}
            />
            <DevRow
              label="Clear Bound Bosses"
              disabled={!sim || sim.boundBosses.length === 0}
              onPress={() => setSim((prev) => (prev ? { ...prev, boundBosses: [] } : prev))}
            />
            <DevRow
              label="Reset skill CD"
              disabled={!sim}
              onPress={() => setSim((prev) => (prev ? { ...prev, skillCooldownMs: 0 } : prev))}
            />
            <DevRow
              label={godMode ? 'God mode (on)' : 'God mode'}
              onPress={() => {
                setGodMode((value) => {
                  const next = !value;
                  setKnob('godMode', next); // tune doc — applies on re-entry too
                  void saveTune();
                  return next;
                });
              }}
            />
            <DevRow
              label={coachHidden ? 'Show coach' : 'Coach on'}
              onPress={() => setCoachHidden((hidden) => !hidden)}
            />
            <DevRow
              label="Reset daily clear count"
              disabled={!sim}
              onPress={() => {
                onResetDailyClears();
                setLastWin(null);
              }}
            />
            <DevRow
              label="Set clears today to 5"
              disabled={!sim}
              onPress={() => {
                onSetClearsTodayFive();
                setLastWin(null);
              }}
            />
            <DevRow
              label="Grant wave-5 milestone"
              disabled={!sim}
              onPress={() => {
                void onGrantMilestoneWaveFive();
              }}
            />
            <DevRow
              label="Reset milestones"
              disabled={!sim}
              onPress={() => {
                onResetMilestones();
              }}
            />
            <DevRow
              label="Reset campaign to Trial wave 1"
              onPress={() => {
                onResetCampaign();
                buildSetup({ phase: 'trial', wave: 1, mode: 'campaign' });
              }}
            />
            <DevRow
              label="Jump to Main wave 19"
              onPress={() => {
                onJumpMain19();
                buildSetup({ phase: 'main', wave: 19, mode: 'campaign' });
              }}
            />
            <DevRow
              label="Force Conquered +1"
              onPress={() => {
                onForceConquered();
                buildSetup({ phase: 'main', wave: 1, mode: 'campaign' });
              }}
            />
            <DevRow
              label="Jump to Final (Main wave 20)"
              onPress={() => {
                onForceFinal();
                buildSetup({ phase: 'main', wave: 20, mode: 'campaign' });
              }}
            />
            <DevRow label="Grant star token" onPress={() => void onGrantStarToken()} />
            <DevRow label="Spend star token" onPress={() => void onSpendStarToken()} />
            <DevRow
              label={`Cycle tint → next (${TAG_LABEL[view.cycleTint]})`}
              onPress={() => {
                const idx = TYPE_MATCH_CYCLE.indexOf(view.cycleTint);
                const next = TYPE_MATCH_CYCLE[(idx + 1) % TYPE_MATCH_CYCLE.length];
                onSetCycleTint(next);
              }}
            />
            <DevRow
              label="Reset Avatar-star cycle"
              onPress={() => {
                onResetAvatarStarCycle();
                setLastWin(null);
              }}
            />
            <DevRow
              label="Set GS high (overgear)"
              onPress={() => {
                onDevOvergear();
                setLastWin(null);
              }}
            />
            <DevRow
              label="Force skip offer (overgear → Trial 1)"
              onPress={() => {
                onDevForceSkipOffer();
                buildSetup({ phase: 'trial', wave: 1, mode: 'campaign' });
              }}
            />
            <DevRow
              label={gsDumpOpen ? 'Hide GS vs recommended' : 'Dump GS vs recommended'}
              onPress={() => setGsDumpOpen((open) => !open)}
            />
            {gsDumpOpen ? (
              <ThemedText type="code" themeColor="textSecondary">
                {gsDumpLines.join('\n')}
              </ThemedText>
            ) : null}
            <DevRow
              label={dumpDropsOpen ? 'Hide band drop table' : 'Dump drops for band'}
              onPress={() => setDumpDropsOpen((open) => !open)}
            />
            {dumpDropsOpen ? (
              <ThemedText type="code" themeColor="textSecondary">
                {dropTableId}: {dropRows.length} rows
                {dropRows.map((row) => `\n  ${row.id}${row.unique ? ' (unique)' : ''}`).join('')}
              </ThemedText>
            ) : null}
          </ThemedView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

function DevRow({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.hudButton,
        { backgroundColor: theme.backgroundSelected },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText type="smallBold" themeColor={disabled ? 'textSecondary' : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Type-match chart (§9f §9i "?"): Tide → Ember → Root → Spark cycle + the
 * match rule. Display only — the combat rule is match-or-nothing. */
function TypeMatchChart({
  tint,
  matched,
  matchPct,
}: {
  tint: TypeTag;
  matched: boolean;
  matchPct: number;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.chartCard}>
      <View style={styles.chartRow}>
        {TYPE_MATCH_CYCLE.map((tag, index) => (
          <View key={tag} style={styles.chartItem}>
            <View
              style={[
                styles.chartDot,
                { backgroundColor: TAG_COLOR[tag], borderColor: theme.background },
              ]}>
              {tag === tint ? <View style={styles.chartDotActive} /> : null}
            </View>
            <ThemedText type="code" themeColor={tag === tint ? 'emphasis' : 'textSecondary'}>
              {TAG_LABEL[tag]}
            </ThemedText>
            {index < TYPE_MATCH_CYCLE.length - 1 ? (
              <ThemedText type="code" themeColor="textSecondary">
                →
              </ThemedText>
            ) : null}
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {matched
          ? `Match = +${matchPct}% board power.`
          : 'Equip a matching Power for +20% board power. Mismatch is neutral.'}
      </ThemedText>
    </ThemedView>
  );
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** One floating damage number. Rises + fades (cheap opacity/translateY) unless
 * reduce-motion — then it holds still for a beat and clears. */
function HitFloater({
  floater,
  kill,
  reduceMotion,
  onDone,
}: {
  floater: Floater;
  kill: boolean;
  reduceMotion: boolean;
  onDone: () => void;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(onDone, FLOAT_STATIC_MS);
      return () => clearTimeout(timer);
    }
    progress.value = withTiming(1, { duration: FLOAT_MS });
    const timer = setTimeout(onDone, FLOAT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animated = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -FLOAT_RISE_PX * progress.value }],
  }));

  if (reduceMotion) {
    return (
      <ThemedText
        type="code"
        style={[
          styles.floater,
          kill ? styles.floaterKill : { color: theme.text },
          { left: floater.left, top: floater.top },
        ]}>
        {floater.label}
      </ThemedText>
    );
  }
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.floater,
        kill ? styles.floaterKill : { color: theme.text },
        { left: floater.left, top: floater.top },
        animated,
      ]}>
      {floater.label}
    </Animated.Text>
  );
}

const AVATAR_RADIUS_PX = 9;

/** 1st/2nd/3rd… for the lifetime-clear milestone copy. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  if (rem10 === 1) return `${n}st`;
  if (rem10 === 2) return `${n}nd`;
  if (rem10 === 3) return `${n}rd`;
  return `${n}th`;
}

/**
 * Share stub for the win glow card (§13): plain text (Avatar level + wave # +
 * "cleared Wave N"). Uses the Web Share API where present, else the native
 * React Native share sheet. Optional — rewards were already banked by the win.
 */
async function shareDefendClear(wave: number, level: number): Promise<void> {
  const line = `Avatar Lv ${level} — cleared Wave ${wave}`;
  const message = `Divecore: ${line}.`;
  const fallback = async () => {
    try {
      await Share.share({ message, title: 'Divecore' });
    } catch {
      // user dismissed the sheet — fine
    }
  };
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Divecore', text: message });
    } catch {
      // AbortError (dismissed) or unavailable — fall back to the native sheet
      await fallback();
    }
    return;
  }
  await fallback();
}

/** SVG path data for a map's road (viewBox 100). */
function pathD(path: readonly { x: number; y: number }[]): string {
  const [first, ...rest] = path;
  const parts = [`M ${first.x * 100} ${first.y * 100}`];
  for (const point of rest) parts.push(`L ${point.x * 100} ${point.y * 100}`);
  return parts.join(' ');
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
  coachCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'stretch',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whyText: {
    marginTop: Spacing.one,
  },
  halvedNote: {
    color: undefined,
    fontStyle: 'italic',
  },
  conqueredNote: {
    color: undefined,
    fontStyle: 'italic',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  typeMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  skipBox: {
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  dropRowLeft: {
    flex: 1,
    gap: Spacing.half,
  },
  chartCard: {
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.two,
    alignItems: 'stretch',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  chartDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartDotActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  bandBlock: {
    gap: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    minWidth: 34,
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  board: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  avatar: {
    position: 'absolute',
    width: AVATAR_RADIUS_PX * 2,
    height: AVATAR_RADIUS_PX * 2,
    borderRadius: AVATAR_RADIUS_PX,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  floater: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    zIndex: 5,
  },
  floaterKill: {
    color: '#FBBF24', // gold — reads as a kill on both light and dark boards
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex1: {
    flex: 1,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  hudButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
