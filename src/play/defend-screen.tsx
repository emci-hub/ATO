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
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, Share, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Image as SvgImage, Rect, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import {
  AVATAR_RANGE,
  BOUND_BOSS_MAX_ON_BOARD,
  DEFEND_MAPS,
  DEFEND_TICK_MS,
  type DefendMap,
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
  type DefendLive,
  type DefendMapId,
  type Puff,
  type SpawnStage,
  type TowerKind,
} from '@/play/defend';
import { avatarDef } from '@/play/avatars';
import { PlayFrame } from '@/play/play-frame';
import {
  ENEMY_CAST,
  PUFF_ART,
  avatarSprite,
  dir8FromDelta,
  enemyArtSource,
  tdTile,
  towerArtSource,
  type Dir8,
  type EnemyRole,
} from '@/play/art';
import { boardDecor } from '@/play/board-decor';
import { BOUND_BOSS_MAX_STAR, bossBandFor, boundBossFragmentCost, defaultBoundBossId, getBoundBossDef, isUniqueDrop, previewDropTable, gearScore, recommendedGs, TAG_COLOR, TAG_ICON, TAG_LABEL, TYPE_MATCH_CYCLE, typeMatchBonus, type DropPreviewRow, type TypeTag } from '@/play/engine';
import { formatItemStats, getItemDef } from '@/play/items';
import {
  AVATAR_STAR_MAX,
  DEFAULT_AVATAR_PARK,
  MAIN_WAVE_COUNT,
  avatarLevelWavePower,
  avatarParkFor,
  avatarStarWavePower,
  bucketMultiplier,
  campaignNextSeat,
  campaignPhaseLabel,
  dropTableForWave,
  hasTypeMatch,
  planSkipToEven,
  replayBands,
  xpForClear,
  type AvatarParkMapId,
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

/** One "What can drop" row (§9i §9m): name + rarity + short star-scaled stats
 * (scaled to the star tier you already own across every Avatar, base ★0 when
 * you don't), honest state right. Uniques are once-per-save; farmables show
 * how many copies you hold. */
function DropRowView({
  row,
  ownedCount,
  ownedStar,
}: {
  row: DropPreviewRow;
  ownedCount: number;
  ownedStar: number;
}) {
  const def = getItemDef(row.id);
  const name = def?.core.name ?? row.id;
  const starMark = ownedStar > 0 ? ` ★${ownedStar}` : '';
  const stats = def ? formatItemStats(def, ownedStar) : null;
  const meta = def
    ? `${capitalize(def.core.rarity)} ${capitalize(def.core.kind)}${stats ? ` · ${stats}` : ''}`
    : '';
  const label = row.owned
    ? "Owned — won't drop again"
    : row.unique
      ? 'Unique'
      : ownedCount > 0
        ? `Owned ×${ownedCount}`
        : 'Can grind — still drops';
  return (
    <View style={styles.dropRow}>
      <View style={styles.dropRowLeft}>
        <ThemedText type="smallBold">
          {name}
          {starMark}
        </ThemedText>
        {meta ? (
          <ThemedText type="code" themeColor="textSecondary">
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText
        type="code"
        themeColor={row.owned ? 'textSecondary' : row.unique ? 'emphasis' : undefined}>
        {label}
      </ThemedText>
    </View>
  );
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
  onJumpScout,
  onForceConquered,
  onSpendStarToken,
  onGrantStarToken,
  onSetCycleTint,
  onForceFinal,
  onResetAvatarStarCycle,
  onSkipToEven,
  onDevOvergear,
  onDevForceSkipOffer,
  onSaveAvatarPark,
  onAvatarDragStateChange,
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
  /** Dev kit only: park the seat at the Scout band (Main wave 9). */
  onJumpScout: () => void;
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
  /** Avatar drag ended → persist the park for this Defend map (v15). */
  onSaveAvatarPark: (mapId: AvatarParkMapId, x: number, y: number) => void;
  /** Avatar drag started/ended → the parent freezes the page ScrollView while
   * a drag is in flight so the pan can't be stolen by the scroll view. */
  onAvatarDragStateChange?: (dragging: boolean) => void;
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
  /** §9m boss / mini-boss alert banner shown while the boss steps in. */
  const [bossAlert, setBossAlert] = useState<{ label: string; name: string } | null>(null);
  /** Spawn stage from the previous running tick — diffed for the alert. */
  const prevStageRef = useRef<SpawnStage>('minions');

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
  /** Static Scribble Dungeons tile dressing for this map (§19). Pure + memoized. */
  const decor = useMemo(() => boardDecor(boardMap), [boardMap]);

  /** Boss band of the chosen fight (null for a normal formula wave). */
  const band = bossBandFor(fight.phase, fight.wave);
  /** Soft type match vs the cycle tint (§9f) — board-wide +20% on a match. */
  const typeMatchActive = hasTypeMatch(view.equipped, view.cycleTint);
  const typeMatchPct = Math.round(typeMatchBonus(typeMatchActive) * 100);
  /** Drop table + honest preview rows for the chosen fight (§9i). */
  const dropTableId = dropTableForWave(fight.phase, fight.wave);
  const dropRows = previewDropTable(dropTableId, new Set(view.uniques));
  /** On a boss band the preview groups uniques under "Boss drops" and the
   * repeatable pool under "Band drops" (§9m); normal waves keep one list. */
  const bossRows = band ? dropRows.filter((row) => row.unique) : [];
  const bandRows = band ? dropRows.filter((row) => !row.unique) : [];

  // Avatar position (board units 0..1) — smooth via shared values, engine via
  // ref. The park lives on the ACTIVE Avatar and is keyed by map id for BOTH
  // maps (Trial and Main share this one path); a missing/corrupt park spawns at
  // the same board MIDDLE and is persisted, so a map never restores the old
  // corner default. Swapping Avatars restores each one's own spot.
  const initialParkMap: AvatarParkMapId = view.campaign.phase;
  const initialPark = avatarParkFor(view.avatarPark, initialParkMap);
  const avatarX = useSharedValue(initialPark.x);
  const avatarY = useSharedValue(initialPark.y);
  const startX = useSharedValue(initialPark.x);
  const startY = useSharedValue(initialPark.y);
  const avatarPosRef = useRef({ x: initialPark.x * 100, y: initialPark.y * 100 }); // board units (0..100)
  /** Which way the Avatar faces (8-way) — idles toward the nearest foe. */
  const avatarFacingRef = useRef<Dir8>('south');
  /** Timestamp of the last Avatar auto-attack (drives the Iron_Slash flash). */
  const avatarAttackAtRef = useRef(0);
  /** Measured board size. `boardSizeRef` is the JS-thread copy (gesture math);
   * `boardSize` is the SHARED copy the avatar's animated style reads — a plain
   * ref is not reactive, so reading it in the worklet left the Avatar stuck at
   * `park × 100px` until the first drag (the "weird spot"). */
  const boardSizeRef = useRef(100);
  const boardSize = useSharedValue(100);
  /** Which map the Avatar is currently parked on (guard: only re-park on a
   * Trial ↔ Main switch, never on every wave/rebuild). */
  const parkedMapRef = useRef<AvatarParkMapId | null>(initialParkMap);

  const setAvatarPosRef = useCallback((x: number, y: number) => {
    avatarPosRef.current = { x, y };
  }, []);

  /** Park the Avatar for a map — its saved spot (this Avatar's own), else the
   * shared board MIDDLE. First visit / missing / corrupt park is persisted as
   * MIDDLE so the map can never regenerate a start or fall back to the old
   * corner. Runs once per map (guard below), so a same-map rebuild never snaps
   * the Avatar off where the player left it. */
  const ensureParked = useCallback(
    (mapId: AvatarParkMapId) => {
      if (view.avatarPark[mapId] == null) {
        onSaveAvatarPark(mapId, DEFAULT_AVATAR_PARK.x, DEFAULT_AVATAR_PARK.y);
      }
      if (parkedMapRef.current === mapId) return;
      const park = avatarParkFor(view.avatarPark, mapId);
      avatarX.value = park.x;
      avatarY.value = park.y;
      startX.value = park.x;
      startY.value = park.y;
      avatarPosRef.current = { x: park.x * 100, y: park.y * 100 };
      parkedMapRef.current = mapId;
    },
    // avatarX/avatarY/startX/startY are stable shared-value handles (their
    // `.value` writes never change identity); view.avatarPark is the read.
    [view.avatarPark, onSaveAvatarPark, avatarX, avatarY, startX, startY],
  );

  /** Persist the Avatar's current spot as this board map's park (drag end).
   * Same path for Trial and Main. */
  const commitAvatarPark = useCallback(() => {
    const mapId = (simRef.current?.mapId ?? fightRef.current.phase) as AvatarParkMapId;
    onSaveAvatarPark(mapId, avatarPosRef.current.x / 100, avatarPosRef.current.y / 100);
  }, [onSaveAvatarPark]);

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
      ensureParked(next.phase);
      setPhase('setup');
      setPaused(false);
      setSelectedPad(null);
      setWhyOpen(false);
      prevPuffsRef.current = [];
      setFloaters([]);
      prevStageRef.current = 'minions';
      setBossAlert(null);
    },
    [view.cyclePower, view.cycleTint, ensureParked],
  );

  /** When the chosen fight changes while on SETUP (seat advanced after a win,
   * a dev jump, a replay pick), resync the board. Runs on mount too. When the
   * board ALREADY sits on that fight's wave/map (e.g. the post-win "Leave"
   * restage keeps your towers on the same wave), it stays untouched — only
   * the park is re-checked so a Trial ↔ Main switch never re-snaps mid-board. */
  const fightKey = `${fight.phase}:${fight.wave}:${fight.mode}`;
  useEffect(() => {
    if (phase !== 'setup') return;
    const current = simRef.current;
    if (!(current && current.wave === fight.wave && current.mapId === fight.phase)) {
      setSim(createDefendLive(fight.wave, { mapId: fight.phase, cyclePower: view.cyclePower, tint: view.cycleTint }));
      prevPuffsRef.current = [];
      setFloaters([]);
      prevStageRef.current = 'minions';
    }
    ensureParked(fight.phase);
    setSelectedPad(null);
    setWhyOpen(false);
    setBossAlert(null);
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
    prevStageRef.current = 'minions';
    setBossAlert(null);
  }, [view.cyclePower, view.cycleTint]);

  /** Abandon a live run back to setup — no win rewards. The tower layout is
   * kept (same feel as Retry after a fail), so Start wave is instantly
   * re-playable with your placement intact. */
  const abandonRun = useCallback(() => {
    const current = simRef.current;
    if (current) {
      // Fresh board for the SAME fight carrying towers + Bound Bosses; scrap
      // returns to the run start (matches Retry semantics).
      const fresh = retryDefendLive(current);
      simRef.current = fresh;
      setSim(fresh);
    }
    setPhase('setup');
    setPaused(false);
    setSelectedPad(null);
    setWhyOpen(false);
    prevPuffsRef.current = [];
    setFloaters([]);
    prevStageRef.current = 'minions';
    setBossAlert(null);
  }, []);

  /** Result-screen "Leave": STAY in Defend — back to SETUP on the SAME fight
   * (Start wave ready) with towers kept, exactly like Abandon. Never the Grove
   * hub (the ‹ Divecore back button leaves). A WON campaign wave restages as
   * its honest cleared-band replay — the seat already moved past it, so half
   * pay and no double-advance; a LOST wave keeps the campaign fight so Start
   * wave retries it at full reward. */
  const leaveResultsToSetup = useCallback((fromWon: boolean) => {
    const current = simRef.current;
    if (current) {
      const fresh = retryDefendLive(current);
      simRef.current = fresh;
      setSim(fresh);
    }
    const played = playedRef.current;
    if (fromWon) {
      // The wave is cleared — replay of the same wave (band replay, half pay).
      setReplayPick({ phase: played.phase, wave: played.wave });
    } else if (played.mode === 'replay') {
      setReplayPick({ phase: played.phase, wave: played.wave });
    } else {
      setReplayPick(null); // campaign fight — the seat still points at it
    }
    setPhase('setup');
    setPaused(false);
    setSelectedPad(null);
    setWhyOpen(false);
    prevPuffsRef.current = [];
    setFloaters([]);
    prevStageRef.current = 'minions';
    setBossAlert(null);
  }, []);

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
      // §19 Avatar face/slash (display only). Read the target from the PRE-step
      // puffs: the engine may kill this very puff, and the post-step list would
      // drop the killing blow's facing/flash. A higher post-step cooldown means
      // the engine reset it — i.e. the Avatar attacked this tick.
      const aimed = nearestPuffDelta(current.puffs, avatar, DEFEND_MAPS[current.mapId]);
      const step = stepDefendLive(current, DEFEND_TICK_MS, bucketsRef.current, avatar);
      if (aimed) avatarFacingRef.current = dir8FromDelta(aimed.dx, aimed.dy);
      if (step.state.avatarCooldownMs > current.avatarCooldownMs + 1 && aimed) {
        avatarAttackAtRef.current = Date.now();
      }
      // §9m boss alert: banner the breath → boss step (the boss spawns last).
      const bandNow = step.state.band;
      if (
        bandNow &&
        prevStageRef.current === 'breath' &&
        step.state.spawnStage === 'boss'
      ) {
        setBossAlert({
          label: bandNow.kind === 'scout_mini' ? 'Mini-boss alert' : 'Boss alert',
          name: bandNow.boss.name,
        });
      }
      prevStageRef.current = step.state.spawnStage;
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
        setBossAlert(null);
        return;
      }
      if (step.done) {
        setBossAlert(null);
        winWave();
      }
    }, DEFEND_TICK_MS);
    return () => clearInterval(id);
  }, [phase, paused, winWave, spawnFloaters]);

  // The alert is a banner — auto-dismiss after a short beat.
  useEffect(() => {
    if (!bossAlert) return;
    const timer = setTimeout(() => setBossAlert(null), 1600);
    return () => clearTimeout(timer);
  }, [bossAlert]);

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

  /** Dev kit only: park the seat at the Final band and start the run already
   * in the §9m breath, so the alert → boss beat previews in under a second
   * instead of after the full runner phase. */
  const previewBossBeat = () => {
    onForceFinal();
    setReplayPick(null);
    const base = createDefendLive(MAIN_WAVE_COUNT, {
      mapId: 'main',
      cyclePower: view.cyclePower,
      tint: view.cycleTint,
    });
    // Carry any placed board into the preview so the boss is fightable.
    const current = simRef.current;
    const preview: DefendLive = {
      ...base,
      towers: current?.towers ?? [],
      boundBosses: current?.boundBosses ?? [],
      scrap: current?.scrap ?? base.scrap,
      pendingSpawns: 0,
      puffs: [],
      bossesRemaining: base.band ? base.band.boss.count : 1,
      spawnStage: 'breath',
      breathMs: 800,
    };
    simRef.current = preview;
    setSim(preview);
    ensureParked('main');
    setPhase('running');
    setPaused(false);
    setSelectedPad(null);
    prevPuffsRef.current = [];
    setFloaters([]);
    prevStageRef.current = 'breath';
    setBossAlert(null);
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
    // Freeze the page ScrollView the instant a drag can start (touch down on
    // the Avatar), so the pan is never stolen by the scroll view. Released on
    // finalize even when the gesture is cancelled, so scroll can never stick.
    .onBegin(() => {
      if (onAvatarDragStateChange) runOnJS(onAvatarDragStateChange)(true);
    })
    .onStart(() => {
      startX.value = avatarX.value;
      startY.value = avatarY.value;
    })
    .onUpdate((event) => {
      // Shared board size (worklet-safe) so drag math matches the rendered
      // position — a plain ref could capture a stale 100px board.
      const size = boardSize.value || 100;
      const nx = clamp01(startX.value + event.translationX / size);
      const ny = clamp01(startY.value + event.translationY / size);
      avatarX.value = nx;
      avatarY.value = ny;
      runOnJS(setAvatarPosRef)(nx * 100, ny * 100);
    })
    .onEnd(() => {
      // Persist the park (v15) so the next setup restores this same spot.
      runOnJS(commitAvatarPark)();
    })
    .onFinalize(() => {
      if (onAvatarDragStateChange) runOnJS(onAvatarDragStateChange)(false);
    });

  const avatarStyle = useAnimatedStyle(() => {
    // Read the SHARED board size (reactive) so the sprite scales with the board
    // and stays centered on the Avatar point.
    const size = boardSize.value || 100;
    const box = Math.max(AVATAR_MIN_PX, size * AVATAR_ART_FRAC);
    return {
      width: box,
      height: box,
      left: avatarX.value * size - box / 2,
      top: avatarY.value * size - box / 2,
    };
  });

  const levelBonus = avatarLevelWavePower(view.avatarLevel);
  /** Active Avatar's identity — the board draws + names the one you picked in
   * Dress (one drag; park per Avatar). */
  const activeAvatarDef = avatarDef(view.activeAvatarId);
  const avatarColor = activeAvatarDef?.color ?? AVATAR_COLOR;
  const bands = replayBands(view);
  const cycleNote =
    view.conqueredCycles > 0
      ? `Cycle ${view.conqueredCycles} — foes scale ×${view.cyclePower.toFixed(2)}`
      : null;

  // §19 Avatar: one Kenney TD soldier sprite, ROTATED toward the nearest foe
  // (the pack has no per-direction sheets). The attack reads as a short
  // tint/flash (below).
  const avatarFacing = avatarFacingRef.current;
  const avatarFacingDeg = dir8Degrees(avatarFacing);
  const nowMs = Date.now();
  const attackElapsed = nowMs - avatarAttackAtRef.current;
  const avatarAttacking = attackElapsed < AVATAR_ATTACK_MS;
  const avatarFrameSource = avatarSprite();

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
        <PlayFrame style={styles.card}>
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
            <ThemedText type="smallBold">
              {activeAvatarDef?.name ?? 'Avatar'} · Lv {view.avatarLevel}
            </ThemedText>
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
          {phase !== 'running' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {SKILL_NAME}: {SKILL_DESCRIPTION} ({SKILL_COOLDOWN_MS / 1000}s cooldown)
            </ThemedText>
          ) : null}
        </PlayFrame>

        {/* Coach — top of Defend setup, right under the wave-title block, so a
         * newbie reads the tip before placing/starting. Still dismissible. */}
        {phase === 'setup' && !coachHidden ? (
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

        {/* Board */}
        <PlayFrame style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {boardMap.name}
            {cycleNote ? ` · ${cycleNote}` : ''}
            {fight.mode === 'replay' ? ' · replay (half tokens)' : ''}
          </ThemedText>
          <View
            style={[styles.board, { backgroundColor: theme.backgroundSelected }]}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width || 100;
              boardSizeRef.current = width;
              boardSize.value = width;
            }}>
            {/* Kenney Tower Defense terrain (§19) — grass floor + path + pad
                markers, background only, behind every gameplay layer (zIndex 0).
                pointerEvents none so taps fall through to the pads on the SVG
                above. */}
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.boardTiles]}>
              {decor.map((tile, index) => {
                const source = tdTile(tile.key);
                if (!source) return null;
                return (
                  <Image
                    key={`tile-${index}`}
                    source={source}
                    contentFit="fill"
                    style={{
                      position: 'absolute',
                      left: `${tile.x}%`,
                      top: `${tile.y}%`,
                      width: `${tile.size}%`,
                      height: `${tile.size}%`,
                      transform: [{ rotate: `${tile.rotate}deg` }],
                    }}
                  />
                );
              })}
            </View>
            {/* Gameplay layer — path, pads, towers, Bound Bosses, enemies.
                Sits ABOVE the tiles (zIndex 1 > 0) so gameplay always reads on
                top of the scroll art. box-none so the wrapper itself never
                swallows a touch aimed at the Avatar; the SVG inside still
                receives the pad taps. */}
            <View style={styles.boardArt} pointerEvents="box-none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
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
              {/* §19 tower sprites: Kenney TD art per job. Visual level is
               * SCALE ONLY (Lv1 0.70 · Lv2 0.85 · Lv3 1.0) — no number badges. */}
              {sim?.towers.map((tower) => {
                const pad = boardMap.pads[tower.pad];
                const source = towerArtSource(tower.kind);
                if (!source) return null;
                const size = TOWER_PAD_UNITS * towerLevelScale(tower.level);
                return (
                  <SvgImage
                    key={`tower-art-${tower.id}`}
                    href={source}
                    x={pad.x - size / 2}
                    y={pad.y - size / 2}
                    width={size}
                    height={size}
                  />
                );
              })}
              {/* §19 Bound Boss carries the heavy Final sprite. */}
              {sim?.boundBosses.map((bb) => {
                const pad = boardMap.pads[bb.pad];
                const source = enemyArtSource(ENEMY_CAST.final);
                if (!source) return null;
                return (
                  <SvgImage
                    key={`bb-art-${bb.id}`}
                    href={source}
                    x={pad.x - 5.5}
                    y={pad.y - 5.5}
                    width={11}
                    height={11}
                  />
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
                // §19 board cast (Kenney TD): runners = fast unit, bosses =
                // tanks/heavy by band, normal puffs = the puff unit.
                const sprite =
                  puff.kind === 'boss'
                    ? enemyArtSource(bossEnemyRole(band?.kind ?? ''))
                    : puff.kind === 'runner'
                      ? enemyArtSource(ENEMY_CAST.runner)
                      : PUFF_ART;
                const spriteSize = radius * 4.4;
                const barWidth = 8 * puff.size;
                return (
                  <G key={`puff-${puff.id}`}>
                    {sprite ? (
                      <SvgImage
                        href={sprite}
                        x={x - spriteSize / 2}
                        y={y - spriteSize / 2}
                        width={spriteSize}
                        height={spriteSize}
                      />
                    ) : (
                      <Circle cx={x} cy={y} r={radius} fill={fill} />
                    )}
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
            </View>

            {/* Draggable Avatar overlay (§19 Kenney TD soldier, rotated toward
                the nearest foe). zIndex 10 keeps it above the tiles AND the
                gameplay SVG so it is always grabbable. */}
            <GestureDetector gesture={pan}>
              <Animated.View
                style={[styles.avatar, avatarStyle]}
                hitSlop={AVATAR_HIT_SLOP}>
                {avatarAttacking ? (
                  <View
                    style={[styles.avatarFlash, { borderColor: avatarColor }]}
                    pointerEvents="none"
                  />
                ) : null}
                <View
                  style={[styles.avatarArt, { transform: [{ rotate: `${avatarFacingDeg}deg` }] }]}
                  pointerEvents="none">
                  {avatarFrameSource ? (
                    <Image source={avatarFrameSource} contentFit="contain" style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: avatarColor }]} />
                  )}
                </View>
              </Animated.View>
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

            {/* §9m boss alert banner — shows as the boss steps in (display only). */}
            {bossAlert ? (
              <View pointerEvents="none" style={styles.bossAlertWrap}>
                <View
                  style={[
                    styles.bossAlertPill,
                    { backgroundColor: theme.backgroundSelected, borderColor: theme.accent },
                  ]}>
                  <ThemedText type="subheading" themeColor="emphasis">
                    {bossAlert.label}
                  </ThemedText>
                  {bossAlert.name ? (
                    <ThemedText type="code" themeColor="textSecondary">
                      {bossAlert.name}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
          {paused && phase === 'running' ? (
            <View style={styles.pausedBox}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                Paused — the wave is frozen.
              </ThemedText>
              <Pressable
                onPress={abandonRun}
                accessibilityRole="button"
                accessibilityLabel="Abandon run"
                style={({ pressed }) => [
                  styles.hudButton,
                  { backgroundColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Abandon run — back to Start, no rewards · towers kept
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </PlayFrame>

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

            {/* Drop preview — honest "what can drop" for this wave/band (§9i §9m). */}
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">What can drop</ThemedText>
              {band ? (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Boss drops
                  </ThemedText>
                  {band.kind === 'final' ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {view.avatarStarRolledCycle
                        ? `Avatar star token · ${Math.round(getTune().avatarStarDropPct * 100)}% · already rolled this cycle`
                        : `Avatar star token · ${Math.round(getTune().avatarStarDropPct * 100)}% drop · pity on the ${getTune().avatarStarPityClears}rd Final this cycle (${view.finalClearsThisCycle}/${getTune().avatarStarPityClears} so far)`}
                    </ThemedText>
                  ) : null}
                  {cycleBossDef ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {cycleBossStars >= BOUND_BOSS_MAX_STAR
                        ? `Boss fragment · ${cycleBossDef.name} ★${cycleBossStars} (max)`
                        : `Boss fragment · ${cycleBossFrags}/${cycleBossNextCost ?? '—'}${
                            cycleBossStars > 0 ? ` · ★${cycleBossStars}` : ''
                          }`}
                    </ThemedText>
                  ) : null}
                  {bossRows.length === 0
                    ? null
                    : bossRows.map((row) => (
                        <DropRowView
                          key={row.id}
                          row={row}
                          ownedCount={view.ownedCounts[row.id] ?? 0}
                          ownedStar={view.ownedStars[row.id] ?? 0}
                        />
                      ))}
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Band drops
                  </ThemedText>
                  {bandRows.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      No repeatable drops on this band.
                    </ThemedText>
                  ) : (
                    bandRows.map((row) => (
                      <DropRowView
                        key={row.id}
                        row={row}
                        ownedCount={view.ownedCounts[row.id] ?? 0}
                        ownedStar={view.ownedStars[row.id] ?? 0}
                      />
                    ))
                  )}
                </>
              ) : dropRows.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No drops listed for this wave.
                </ThemedText>
              ) : (
                dropRows.map((row) => (
                  <DropRowView
                    key={row.id}
                    row={row}
                    ownedCount={view.ownedCounts[row.id] ?? 0}
                    ownedStar={view.ownedStars[row.id] ?? 0}
                  />
                ))
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
            {sim?.spawnStage === 'breath'
              ? 'Minions cleared — something big stirs beyond the path…'
              : coachHidden
                ? `Towers fire on their own — drag your Avatar and time ${SKILL_NAME}.`
                : `Coach: ${coach.tip}`}
          </ThemedText>
        ) : null}

        {/* §9m live bottom HUD — Pause · gap · Skill (ONE button; Bound Bosses
         * stay auto). Shown only while a run is live; setup never casts. */}
        {phase === 'running' ? (
          <ThemedView type="backgroundElement" style={styles.bottomHud}>
            <Pressable
              onPress={() => setPaused((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={paused ? 'Resume wave' : 'Pause wave'}
              style={({ pressed }) => [
                styles.hudButton,
                styles.bottomHudPause,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{paused ? 'Resume' : 'Pause'}</ThemedText>
            </Pressable>
            <Pressable
              onPress={castSkill}
              disabled={!skillReady}
              accessibilityRole="button"
              accessibilityLabel={`Skill ${SKILL_NAME}`}
              style={({ pressed }) => [
                styles.hudButton,
                styles.bottomHudSkill,
                {
                  backgroundColor: skillReady ? theme.accentFill : theme.backgroundSelected,
                },
                pressed && skillReady && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: skillReady ? theme.onAccent : theme.textSecondary }}>
                {skillReady ? `Skill: ${SKILL_NAME}` : `Skill: ${SKILL_NAME} · ${skillSeconds}s`}
              </ThemedText>
            </Pressable>
          </ThemedView>
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
                {lastWin.catchupXp ? (
                  <View
                    style={[
                      styles.xpBadge,
                      { backgroundColor: theme.backgroundSelected },
                    ]}>
                    <ThemedText type="code" themeColor="emphasis">
                      ×2.5 EXP · Trial catch-up
                    </ThemedText>
                  </View>
                ) : null}
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
              onPress={() => leaveResultsToSetup(true)}
              accessibilityRole="button"
              accessibilityLabel="Leave to Defend setup"
              style={({ pressed }) => [
                styles.hudButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Leave — back to Start wave</ThemedText>
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
                  prevStageRef.current = 'minions';
                  setBossAlert(null);
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
              onPress={() => leaveResultsToSetup(false)}
              accessibilityRole="button"
              accessibilityLabel="Leave to Defend setup"
              style={({ pressed }) => [
                styles.hudButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Leave — back to Start wave</ThemedText>
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
              label="Jump to Scout (Main wave 9)"
              onPress={() => {
                onJumpScout();
                buildSetup({ phase: 'main', wave: 9, mode: 'campaign' });
              }}
            />
            <DevRow
              label="Preview boss beat (Final)"
              disabled={!sim}
              onPress={previewBossBeat}
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

/**
 * Visible Avatar size as a fraction of the measured board width (§19 cast lock:
 * the Legends sprites read bigger than the old Masterpiece art, which was tiny
 * inside its 244px frame). The art box IS the touch target, so a bigger sprite
 * is also an easier grab.
 */
const AVATAR_ART_FRAC = 0.22;
/** Floor for the art/hit box, px (small boards / thumb reach). */
const AVATAR_MIN_PX = 56;
/** Extra slop around the hit box (thumb-friendly without growing the visual). */
const AVATAR_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
/** Attack flash length (ms) — tuned to the Avatar's 0.7s cooldown. */
const AVATAR_ATTACK_MS = 700;

/** 8-way facing → rotation degrees for a single top-down sprite (east = 0). */
const DIR8_DEGREES: Record<Dir8, number> = {
  east: 0,
  'south-east': 45,
  south: 90,
  'south-west': 135,
  west: 180,
  'north-west': 225,
  north: 270,
  'north-east': 315,
};

export function dir8Degrees(dir: Dir8): number {
  return DIR8_DEGREES[dir];
}

/** Base tower sprite size on the pad, board units (64px art scaled to fit). */
const TOWER_PAD_UNITS = 13;

/** Visual tower level → scale (§19: Lv1 0.70 · Lv2 0.85 · Lv3 1.0). */
export function towerLevelScale(level: number): number {
  if (level <= 1) return 0.7;
  if (level === 2) return 0.85;
  return 1;
}

/** Which Kenney TD unit plays each boss band (§19 board cast). */
function bossEnemyRole(kind: string): EnemyRole {
  switch (kind) {
    case 'final':
      return ENEMY_CAST.final;
    case 'semi':
      return ENEMY_CAST.semi;
    case 'scout':
      return ENEMY_CAST.scoutBoss;
    case 'scout_mini':
      return ENEMY_CAST.scoutMini;
    default:
      return ENEMY_CAST.final;
  }
}

/** Delta from the Avatar to the nearest puff in attack range (facing aid). */
function nearestPuffDelta(
  puffs: readonly Puff[],
  avatar: { x: number; y: number },
  map: DefendMap,
): { dx: number; dy: number } | null {
  let best: { dx: number; dy: number } | null = null;
  let bestDist = Infinity;
  for (const puff of puffs) {
    const pos = puffPosition(puff.dist, map);
    const dx = pos.x * 100 - avatar.x;
    const dy = pos.y * 100 - avatar.y;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = { dx, dy };
    }
  }
  return bestDist <= AVATAR_RANGE ? best : null;
}

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
  /** ×2.5 EXP badge on the results XP line while Trial catch-up applied. */
  xpBadge: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
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
  /** Scribble tile dressing — bottom layer (background only). */
  boardTiles: {
    zIndex: 0,
    elevation: 0,
  },
  /** Gameplay SVG (path · pads · towers · enemies) — above the tiles. */
  boardArt: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
  },
  pausedBox: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  avatar: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // Size + position come from `avatarStyle` (board-proportional).
    // Above the tiles (0) and the gameplay SVG (1) so it stays draggable.
    // zIndex only (no elevation) so the character art keeps no shadow.
    zIndex: 10,
  },
  /** Attack tell — a short ring pulse (the pack has no slash sheet). */
  avatarFlash: {
    position: 'absolute',
    width: '135%',
    height: '135%',
    borderRadius: 999,
    borderWidth: 3,
  },
  /** The visible art, centered inside the touch box. */
  avatarArt: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
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
    // Display-only damage text: above the tiles + gameplay art so it is never
    // buried under the board (font is tiny, so this is cheap).
    zIndex: 12,
  },
  floaterKill: {
    color: '#FBBF24', // gold — reads as a kill on both light and dark boards
    fontSize: 14,
  },
  /** §9m live bottom HUD bar: Pause · gap · Skill (left → right). */
  bottomHud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    borderRadius: Spacing.four,
    padding: Spacing.two,
  },
  bottomHudPause: {
    paddingHorizontal: Spacing.four,
  },
  bottomHudSkill: {
    flex: 1,
  },
  /** §9m boss alert banner — centered over the board while the boss steps in.
   * Top overlay layer (above tiles, gameplay art, and the Avatar). */
  bossAlertWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  bossAlertPill: {
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
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
