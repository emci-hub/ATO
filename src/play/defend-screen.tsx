/**
 * Defend — board + towers + Avatar + skill + campaign (Play steps 5a–5c,
 * Phase B campaign; GAME_SPEC §9, §9b, §9d, §9e, §9h, §11 screen 5).
 *
 * Campaign (Phase B): the fight is either the campaign's next wave (Trial
 * 1–5 on the Grove Path map, then Main 1–10 on the Divecore Main map — full
 * tokens, advances the seat) or a replay of a cleared band (half tokens,
 * seat untouched). Clearing Main wave 10 conquers the cycle: `cycle_power`
 * rises and the seat resets to Main wave 1. Every run carries its map + cycle
 * power, so puffs get fatter/faster-with-power on later cycles.
 *
 * One board (whichever map the run is on): puff enemies walk the road; open
 * pads hold the towers (archer / vine / crystal), capped at six deployed per
 * run. Tap a pad to place/upgrade with scrap; a range ring shows while a pad is
 * selected. The
 * Avatar (placeholder circle) is draggable and auto-attacks the nearest enemy
 * in range; one skill button casts slow_pulse "Root Veil" (12s cooldown).
 * Kills → scrap; leak = fail; a clean wave = win (tokens + XP + campaign
 * advance via `onWin`). No SakPix, no new tower types.
 *
 * The sim is local + transient (see `defend.ts`); only the campaign seat,
 * rewards, and meta persist through the shared store.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Rect, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor, surfaceShadow } from '@/lib/theme/chrome';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { usePlayDevUnlocked } from '@/play/dev-lock';
import {
  AVATAR_RANGE,
  boundBossCapOnBoard,
  boundBossRange,
  boardLayoutOf,
  restoreBoardLayout,
  DEFEND_TICK_MS,
  HERO_TOWER_STATS,
  type DefendMap,
  MAX_TOWERS,
  towerCap,
  TOWER_DEFS,
  TOWER_MAX_LEVEL,
  castPetPounce,
  castSlowPulse,
  createDefendLive,
  creepDrawPosition,
  creepLaneHalf,
  creepRole,
  defendDifficulty,
  boundBossHeroId,
  heroCastSkill,
  heroTowerTarget,
  helperTarget,
  helperUnitId,
  isHeroBoundTower,
  placeTurfTeam,
  placeBoundBoss,
  placeTower,
  removeBoundBoss,
  retryDefendLive,
  stepDefendLive,
  puffHeading,
  puffPosition,
  towerTarget,
  towerUpgradeCost,
  upgradeTower,
  waveEnemyCount,
  type CreepRole,
  type DefendLive,
  type Puff,
  type TowerKind,
  type TurfHelperSpec,
} from '@/play/defend';
import { TurfTeamCard } from '@/play/turf-team-card';
import {
  HELPER_GET_UP_MS,
  HELPER_MOVE_SPEED,
  gradeRangeMult,
  helperFollowSpot,
  stepHelperToward,
  type TurfHelperPick,
} from '@/play/turf-team';
import { waveDefFor } from '@/play/director';
import { avatarDef } from '@/play/avatars';
import { allHeroes, heroById, heroName } from '@/play/heroes-data';
import { PlayFrame } from '@/play/play-frame';
import { HeroOwnSheet } from '@/play/hero-own-sheet';
import { NeonButton, NeonLabel, NeonPill, NEON_ROW_LINE } from '@/play/neon-ui';
import { GuideHost } from '@/play/guide-bubble';
import { GameScreen, computeStageFrame, useStageFrame } from '@/play/stage-layout';
import { PlaySheet } from '@/play/play-sheet';
import { NEON } from '@/play/neon-viper';
import { alertHaptic } from '@/play/street-feel';
import { STREET, STREET_FONT, streetUiOn } from '@/play/street-ui';
import {
  BOARD_SKIN,
  BOARD_SKIN_LABEL,
  bandUnitRole,
  directionalClipDrawable,
  artSkin,
  heroAvatarRole,
  isPathWalker,
  roleAnimFaceIndex,
  roleArtDrawable,
  roleFaceArtIndex,
  roleFootAt,
  roleWalkFaceIndex,
  skinAnimDrawable,
  skinAnimFaceIndex,
  skinAnimFrames,
  skinArtDrawable,
  skinDirIndex,
  skinDirs,
  skinDrawBox,
  skinFaceArtIndex,
  skinScale,
  skinTone,
  skinUnits,
  skinWalkDrawable,
  skinWalkDirIndex,
  skinWalkDirs,
  skinWalkFace,
  skinWalkFaceIndex,
  skinWalkFrames,
  resolveBoundHeroTowerKit,
  resolveTurfHelperKit,
  towerSkinRole,
  type ArtSkinId,
  type ClipDrawable,
  type SkinRole,
  type SkinRoleId,
  type BoardSkinId,
  type SkinWalkFace,
} from '@/play/skin';
import { boardSheet } from '@/art/art';
import { ClipImage, ClipSprite, sheetFrame } from '@/play/sheet-sprite';
import { TurfAmbient } from '@/play/turf-ambient';
import { BoardDecorTiles, StaticRoad, TurfBoardBase } from '@/play/turf-board-base';
import {
  LOSE_BEAT_MS,
  WAVE_CLEAR_MS,
  WIN_SPARK_MAX,
  beatFxFlags,
  leakReplayPath,
  portalPoint,
  sparkPoint,
  waveStartNotice,
  winBeatMs,
} from '@/play/turf-beat-fx-rules';
import { TurfCombatFx, useBoardShake, type TurfCombatFxHandle } from '@/play/turf-combat-fx';
import {
  FLOATER_JITTER_X,
  FLOATER_JITTER_Y,
  FLASH_COOLDOWN_MS,
  FLOATER_MERGE_MS,
  HIT_STOP_TIMER_MS,
  TOWER_FX,
  chipValue,
  nextChip,
  combatFxFlags,
  jitter,
  showHealthBar,
  type HpChip,
} from '@/play/turf-combat-fx-rules';
import {
  BOSS_DEATH_MS,
  BOSS_TELEGRAPHS,
  ENRAGE_WINDUP_MS,
  WAVE_CHIP_BOX,
  bossBar,
  bossFxFlags,
  enrageWarning,
  telegraphStart,
} from '@/play/turf-boss-fx-rules';
import { notify, useNoticePause } from '@/play/notify/notify';
import { usePlayMotion } from '@/play/play-motion';
import {
  CREEP_STILL_MS,
  creepClip,
} from '@/play/cast-kits';
import {
  castActorClipFrames,
  castActorCreate,
  castActorFaintFrame,
  castActorGetUpFrame,
  castActorWalkFrame,
  castActorFrame,
  castActorIdleSeed,
  castActorPathFrame,
  castActorStartOnce,
  type CastActor,
  type CastActorClip,
} from '@/play/cast-actor';
import { boardDecor, roadDecor } from '@/play/board-decor';
import { BOARD_MAPS, BOARD_ORDER, boardPathD, type BoardId } from '@/play/board-data';
import { NeonBoardChrome } from '@/play/neon-chrome';
import { BOUND_BOSS_MAX_STAR, bossBandFor, boundBossFragmentCost, defaultBoundBossId, getBoundBossDef, isUniqueDrop, previewDropTable, gearScore, recommendedGs, TAG_COLOR, TAG_ICON, TAG_LABEL, TYPE_MATCH_CYCLE, type DropPreviewRow, type TypeTag } from '@/play/engine';
import { formatItemStats, getItemDef, type ItemSlot } from '@/play/items';
import {
  AVATAR_STAR_MAX,
  DEFAULT_AVATAR_PARK,
  MAIN_WAVE_COUNT,
  TRIAL_WAVE_COUNT,
  avatarLevelWavePower,
  avatarParkFor,
  avatarStarWavePower,
  bucketMultiplier,
  campaignNextSeat,
  campaignPhaseLabel,
  dropTableForWave,
  planSkipToEven,
  replayBands,
  xpForClear,
  type AvatarParkMapId,
  type CampaignPhase,
  type DefendWinContext,
  type DefendWinMode,
  type DefendWinResult,
  type HeroBindReason,
  type HeroOffer,
  type HeroSetReason,
  type PlayView,
  type SkipRewardResult,
} from '@/play/playStore';
import { tipForWave } from '@/play/coach';
import { getTune, saveTune, setKnob } from '@/play/tune';
import {
  BENCH_MEASURE_MS,
  BENCH_SETTLE_MS,
  BENCH_STAGES,
  BenchPanel,
  FpsOverlay,
  StressFxLayer,
  benchReport,
  benchVerdict,
  nextStressFxLevel,
  useFpsMeter,
  useFxBenchmark,
  type BenchSendStatus,
  type StressFxLevel,
} from '@/play/dev-fx-stress';
import { sendPlayDevLog } from '@/play/dev-log';
import { stageMatchupDetail, stageMatchupFor, stageMatchupShort } from '@/play/legend-copy';
import { FxLayer, FX_LIFE_MS, FX_ULTIMATE_LIFE_MS, type FxEvent, type FxPoint } from '@/play/fx-layer';
import { defendBackStep, defendEdgeSwipe, type InnerBack } from '@/play/edge-back';
import { DevSlotFill } from '@/play/dev-slot';
import { FX_CAP, FX_QUALITY_LABEL, nextFxQuality, setFxQuality, useFxQuality } from '@/play/fx-quality';
import { TurfThemePicker } from '@/play/turf-theme-picker';
import { boardHasThemes, turfBoardArtId } from '@/play/turf-theme';
import { useTurfTheme } from '@/play/turf-theme-store';
import { kitRange, type KitHit } from '@/play/kit-combat';
import {
  KEPT_BOARD_MIN_SCRAP,
  getSavedLayout,
  layoutKey,
  setupBankFor,
  setupScrapFor,
  peekBankScrap,
  reloadBoardLayouts,
  saveBoardLayout,
  setBankScrap,
  takeBankScrap,
  useBoardLayoutsLoaded,
} from '@/play/board-layouts';
import { ELEMENT_COLOR, TOWER_KITS } from '@/play/kits';
import { swordRuntime } from '@/play/swords';
import { StatusIconRow, WeaknessDiamond } from '@/play/status-icon-row';
import { statusIconsFor } from '@/play/status-icons';
import { countOnce } from '@/play/play-counters';
import { TurfBuildCard, type TurfChoice } from '@/play/turf-build-card';
import { padTapRadiusUnits, turfBoardRect, turfBoardSide, wavePeekRect } from '@/play/turf-layout';
import { TurfButton, TurfCapsPill, TurfPauseButton, TurfResultCard, TurfWaveChip, TurfWavePeekCard, type TurfWavePeekRowView } from '@/play/turf-ui';
import { nextWavePeek, WAVE_PEEK_FIGURE, type PeekFigure } from '@/play/turf-wave-peek';
import { HELP_COLUMN } from '@/play/help/help-sheet';

/** Placeholder creep role tints (until per-role sprites land) — W1 only. */
const CREEP_ROLE_COLOR: Record<CreepRole, string> = {
  swarm: '#22D3EE', // cyan
  runner: '#F472B6', // pink
  tank: '#FB923C', // orange
  boss: '#A78BFA', // violet
};

/** Draw-size multiplier per creep role (display only, no sim impact): swarms
 * normal, runners slim, tanks fat so the three read at a glance. Bosses keep
 * their existing `puff.size` scaling. All ×1.25 so sprites read on a phone. */
const CREEP_DRAW_SCALE: Record<CreepRole, number> = {
  swarm: 1.25,
  runner: 1.125,
  tank: 1.69,
  boss: 1.25,
};

/**
 * Walk-clip cadence + display clock (H1.5 + K2, display only).
 *
 * `WALK_FRAMES_PER_PATH` = frames played across one full path traverse
 * (dist 0→1), before the per-role gait multiplier (see `walkFramesPerPath`).
 * Creeps' `dist` only updates on the 100ms sim tick, which would quantise the
 * gait to ~10fps and read as a glide, so a 50ms display tick (`WALK_TICK_MS`)
 * advances a per-creep frame phase using that creep's own measured dist/sec:
 * legs still track ground, slowed creeps cycle slower, and a halted creep stops
 * advancing its phase (`CREEP_STILL_MS`). Combat dt is untouched — the engine
 * still steps on `DEFEND_TICK_MS`.
 *
 * K2 reads that same measured rate as the creeps' stance signal: rate > 0 ⇒ the
 * walk cycle; rate === 0 (no progress for `CREEP_STILL_MS`) ⇒ the role's
 * `idle` breathing loop if the art authors one, else the last walk frame is
 * held exactly as before. There is ONE stall threshold — `CREEP_STILL_MS` in
 * cast-kits.ts, shared with `creepClip` and `scripts/check-creeps.ts`.
 */
const WALK_FRAMES_PER_PATH = 110;
const WALK_TICK_MS = 50;
/** Cap the rate-measurement window so a creep resuming after a long halt
 * doesn't divide by the whole stall. The first resuming sample is approximate
 * (it under-reads the rate); the next tick re-measures and corrects it. */
const WALK_RATE_MAX_MS = 250;

/** How long a killed creep's corpse stays on the board (ms): the `death`
 * one-shot (~0.63s at `CAST_ACTOR_FRAME_MS.path.death`) plus a short beat
 * holding its last frame, so the kill reads without the body lingering. Only
 * roles that author death art leave a corpse at all; the rest vanish on the
 * tick they die, exactly as before. */
const CREEP_CORPSE_MS = 1_100;

/**
 * Per-role gait multiplier on `WALK_FRAMES_PER_PATH` (display only).
 *
 * The phase tracks ground travelled, which is right for a minion but makes the
 * heavy boss bands look nearly frozen: they cross the board at 0.33× a puff's
 * path speed, so a ground-locked gait plays their clip at a crawl (the 12-frame
 * Archangel flight worked out to ~8.7s per cycle). Scaling the cadence per role
 * restores a readable cycle without touching engine move speed, HP or the walk
 * tick's clock.
 *
 * Only roles that actually author a walk clip need an entry. The three creeps
 * stay at the 1× ground-tracked gait; the semi band (`unit.tank_alt`) has no
 * walk clip at all, so it has no gait to scale and keeps its static rotation.
 */
const WALK_GAIT_MULT: Partial<Record<SkinRoleId, number>> = {
  'unit.boss_scout': 2.2, // Crimson Oni mini-scout
  'unit.final': 2.8, // Archangel Commander — Divine_Flight (primary)
};

/** Frames of walk clip per full path traverse for a role (see the constants). */
function walkFramesPerPath(role: SkinRoleId): number {
  return WALK_FRAMES_PER_PATH * (WALK_GAIT_MULT[role] ?? 1);
}

const AVATAR_COLOR = '#38BDF8';

/** Board paint — `neon` (procedural chrome) vs `grove-classic` (Craftpix field
 * tiles + cobble road). Paint only; geometry is untouched. `BOARD_SKIN`
 * (skin.ts) is still the SHIPPED default; the dev kit's Board section can
 * flip it for this session only (Board / Misc → Board skin), so both painted
 * options — both already fully bundled — can be checked without a build. */

/* -------------------------------------------------------------- game speed --- */
/** The sim clock multipliers a wave can run at. One multiplier drives the WHOLE
 * wave clock (`dtMs × speed`), so movement, cooldowns and the spawn schedule
 * all scale together — never spawn-only. */
export type GameSpeed = 1 | 2;
export const GAME_SPEEDS: readonly GameSpeed[] = [1, 2];

/** 1x / 2x sim-speed pills (Neon Viper chrome). Shown between waves (setup) and
 * in the live bottom HUD, so the clock can be retuned before or during a run. */
function SpeedControl({
  speed,
  onChange,
}: {
  speed: GameSpeed;
  onChange: (speed: GameSpeed) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.speedGroup,
        { backgroundColor: theme.backgroundElement, borderColor: controlBorderColor(theme) },
      ]}>
      {GAME_SPEEDS.map((value) => {
        const active = speed === value;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="button"
            accessibilityLabel={`${value}x wave speed`}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.speedPill,
              active && { backgroundColor: theme.accentFill },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              type="smallBold"
              style={[
                styles.speedText,
                { color: active ? theme.onAccent : theme.textSecondary },
              ]}>
              {`${value}x`}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------- boss warn --- */
/** Boss warn (§9m). `LEAD_MS` = how far before the boss steps in the warn is
 * raised. T6: it is a `notify()` in the NoticeLane (no in-stage banner), so the
 * lane's own timers decide how long it shows. Display only — the sim keeps
 * running underneath, so towers keep firing through it. */
const BOSS_WARN_LEAD_MS = 1500;

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
  /** Attacking element's colour (EFFECTS_PLAN: numbers stay readable, and are
   * the only feedback when Effects Quality is Off). Undefined = neutral. */
  color?: string;
  /** T5: the creep it belongs to, when it appeared and its running total — a
   * second hit on the same creep within FLOATER_MERGE_MS adds to this number. */
  puffId: number;
  bornAt: number;
  damage: number;
};

/** A per-tick hit the screen derived from puff HP deltas (never sent back). */
type HitEvent = {
  puffId: number;
  x: number; // board units 0..1
  y: number;
  damage: number;
  kill: boolean;
  color?: string;
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
  boardId: BoardId,
  colorById?: ReadonlyMap<number, string>,
): HitEvent[] {
  const map = BOARD_MAPS[boardId];
  const byId = new Map(after.map((puff) => [puff.id, puff]));
  const events: HitEvent[] = [];
  for (const old of before) {
    const now = byId.get(old.id);
    if (!now) {
      // Killed — the last visible chunk of its HP is the killing blow.
      const pos = creepDrawPosition(old, map, creepLaneHalfFor(old));
      events.push({ puffId: old.id, x: pos.x, y: pos.y, damage: Math.round(old.hp), kill: true, color: colorById?.get(old.id) });
    } else if (now.hp < old.hp) {
      const damage = old.hp - now.hp;
      const pos = creepDrawPosition(now, map, creepLaneHalfFor(now));
      events.push({ puffId: now.id, x: pos.x, y: pos.y, damage: Math.round(damage), kill: false, color: colorById?.get(now.id) });
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

/**
 * K2 — the corpses a tick's kills leave behind (display only). Same diff the
 * floaters use: a puff present before and absent after was killed (a leak
 * freezes the sim, so a puff never leaves the array any other way mid-run). The
 * corpse carries the pose the live sprite was last drawn in — the same role,
 * box, lane offset and sticky side profile — so the death one-shot plays where
 * the creep actually fell.
 *
 * A role whose art authors no `death` clip (`creepClip({ dead: true … })` →
 * null) leaves NO corpse: the engine's removal is still the whole tell, exactly
 * as before K2.
 */
function newCreepCorpses(
  before: readonly Puff[],
  after: readonly Puff[],
  boardId: BoardId,
  bandKind: string | undefined,
  faces: Readonly<Record<number, SkinWalkFace>>,
  bornAt: number,
): CreepCorpse[] {
  const map = BOARD_MAPS[boardId];
  const alive = new Set(after.map((puff) => puff.id));
  const corpses: CreepCorpse[] = [];
  for (const puff of before) {
    if (alive.has(puff.id)) continue;
    const role = puffUnitRole(puff, bandKind);
    const dead = creepClip({
      dead: true,
      rate: 0,
      frames: { death: skinAnimFrames(role, 'death') },
    });
    if (dead !== 'death') continue;
    const size = skinUnits(role, UNIT_BASE_UNITS) * puff.size * CREEP_DRAW_SCALE[creepRole(puff)];
    const pos = creepDrawPosition(puff, map, creepLaneHalf(size));
    corpses.push({
      id: puff.id,
      role,
      x: pos.x * 100,
      y: pos.y * 100,
      size,
      face: faces[puff.id] ?? 'e',
      bornAt,
    });
  }
  return corpses;
}

type DefendPhase = 'setup' | 'running' | 'won' | 'lost';

/** Per-creep walk frame phase (H1.5, display only): a fractional frame cursor
 * plus the dist/rate sample the walk tick uses to advance it. */
type WalkPhase = { dist: number; at: number; rate: number; phase: number };

/**
 * One killed creep's death one-shot (K2, display only). The engine removes a
 * puff the tick it dies — there is no corpse state in the sim — so the board
 * keeps its own short-lived copy of what it last drew: where the body fell, how
 * big it was, which side profile it was holding, and when it died. Only created
 * for a role whose art authors a `death` clip (`creepClip`), and dropped after
 * `CREEP_CORPSE_MS`.
 */
type CreepCorpse = {
  id: number;
  role: SkinRoleId;
  /** Board units (0..100) — already lane-offset, same point the live sprite used. */
  x: number;
  y: number;
  /** Drawn box edge, board units. */
  size: number;
  face: SkinWalkFace;
  bornAt: number;
};

/** A live shot FX (display only — damage is already applied by the engine). */
type Shot = {
  id: number;
  /** Current world position, board units (0..100). */
  x: number;
  y: number;
  /** Aim point, board units. */
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  /** Epoch ms the shot was fired (lifetime guard). */
  bornAt: number;
};

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

/** Concise spawn summary for the setup card, read from the wave director's
 * group table (e.g. "7 swarm", "4 swarm + 1 tank", "5 swarm + 1 boss").
 * Falls back to the §9 count when a wave has no authored table. */
function waveSpawnSummary(phase: CampaignPhase, wave: number): string {
  const def = waveDefFor(phase, wave);
  if (!def) return `${waveEnemyCount(wave, 1)} puffs`;
  return def.groups.map((group) => `${group.count} ${group.role}`).join(' + ');
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

/** Drops scan categories — derived from REAL data: `Uniques` is the drop
 * table's once-per-save flag, the rest are the item defs' own `core.slot`
 * (weapon / armor / cloak / trinket), and `Other` catches a dangling id with
 * no def. Nothing here is invented, and no weights/odds are touched. */
const DROPS_CATEGORY_ORDER = ['Uniques', 'Weapons', 'Armor', 'Cloaks', 'Trinkets', 'Other'] as const;
type DropsCategory = (typeof DROPS_CATEGORY_ORDER)[number];

const SLOT_CATEGORY: Record<ItemSlot, DropsCategory> = {
  weapon: 'Weapons',
  armor: 'Armor',
  cloak: 'Cloaks',
  trinket: 'Trinkets',
};

/** Which scan bucket a preview row belongs to (uniques win over their slot). */
function dropsCategoryFor(row: DropPreviewRow): DropsCategory {
  if (row.unique) return 'Uniques';
  const slot = getItemDef(row.id)?.core.slot;
  return slot ? SLOT_CATEGORY[slot] : 'Other';
}

/** Group preview rows into non-empty categories, in `DROPS_CATEGORY_ORDER`. */
function groupDrops(
  rows: readonly DropPreviewRow[],
): { category: DropsCategory; rows: DropPreviewRow[] }[] {
  const buckets = new Map<DropsCategory, DropPreviewRow[]>();
  for (const row of rows) {
    const category = dropsCategoryFor(row);
    const bucket = buckets.get(category);
    if (bucket) bucket.push(row);
    else buckets.set(category, [row]);
  }
  return DROPS_CATEGORY_ORDER.filter((category) => buckets.has(category)).map((category) => ({
    category,
    rows: buckets.get(category) ?? [],
  }));
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
  onJumpMain9,
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
  onSaveTurfHelpers,
  onSetAvatarHero,
  onBindHeroAsTower,
  onDismissHeroOffer,
  onDevOwnHero,
  onDevOwnAllHeroes,
  onDevSetAvatarHero,
  onDevClearHeroOffer,
  onDevClearOwnedHeroes,
  onOpenDress,
  onOpenSwords,
  onLeak,
  registerBack,
  onBackToGrove,
  shellTop = null,
  shellTabs = null,
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
  /** Dev kit only: park the seat at Main wave 9. */
  onJumpMain9: () => void;
  /** Dev kit only: park the seat at the Scout band (Main wave 5). */
  onJumpScout: () => void;
  /** Dev kit only: force one more Conquered cycle. */
  onForceConquered: () => void;
  /** Spend one Avatar star token → +1 star (§9h). */
  onSpendStarToken: () => Promise<boolean>;
  /** Dev kit only: grant one Avatar star token. */
  onGrantStarToken: () => Promise<void>;
  /** Dev kit only: set the cycle boss tint. */
  onSetCycleTint: (tint: TypeTag) => void;
  /** Dev kit only: park the seat at the Final band (Main wave 10). */
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
  /** P5 — save the Turf helper picks (pet + spot) after a pick, remove or move. */
  onSaveTurfHelpers: (picks: TurfHelperPick[]) => void;
  /** Slice A2 — set an owned Hero as the Avatar (auto-unbinds it if bound).
   * Null = it worked; otherwise the refusal the sheet shows. */
  onSetAvatarHero: (heroId: string) => Promise<HeroSetReason | null>;
  /** Slice A2 — bind an owned Hero as a Bound Boss tower (★1, cap 2). */
  onBindHeroAsTower: (heroId: string) => Promise<HeroBindReason | null>;
  /** Slice A2 — dismiss the queued hero-own offer (sheet's Later / Done). */
  onDismissHeroOffer: () => void;
  /** Dev kit only: own a hero without clearing its band (offer-sheet smoke). */
  onDevOwnHero: (heroId: string) => Promise<boolean>;
  /** Dev kit only: own every hero in `heroes.json` at once (no offer queued). */
  onDevOwnAllHeroes: () => Promise<boolean>;
  /** Dev kit only: set an Avatar hero, auto-owning it first (test speed). */
  onDevSetAvatarHero: (heroId: string) => Promise<boolean>;
  /** Dev kit only: drop a queued hero offer. */
  onDevClearHeroOffer: () => Promise<boolean>;
  /** Dev kit only: back to just the starter Hero (drops hero bindings too). */
  onDevClearOwnedHeroes: () => Promise<boolean>;
  /** Leave the sheet for the Dress Hero roster (A2.5). */
  onOpenDress: () => void;
  /** Element swords — mix, merge, equip. */
  onOpenSwords: () => void;
  /** A leak breaks the sword win streak. Called once per failed run. */
  onLeak: () => void;
  /** Back one level (edge-back.ts): the Play shell asks Defend first. */
  registerBack?: (inner: InnerBack | null) => void;
  onBackToGrove: () => void;
  /** Stage layout: the shell's resource bar and tab bar (setup); the wave swaps in its HUD + dock. */
  shellTop?: ReactNode;
  shellTabs?: ReactNode;
}) {
  const theme = useTheme();
  // Stage layout: ONE frame for setup and wave (the wave dock = setup dock + tab bar), read once.
  const setupFrame = useStageFrame('turf-setup');
  const waveFrame = useMemo(() => computeStageFrame('turf-wave', setupFrame.window, setupFrame.insets), [setupFrame]);
  /** The Setup sheet (wave card, drops, maps, replays, effects) — the board never scrolls. */
  const [setupOpen, setSetupOpen] = useState(false);
  /** Dev kit only: soft PIN gate (same session flag the hub uses). */
  const devUnlocked = usePlayDevUnlocked();
  const [phase, setPhase] = useState<DefendPhase>('setup');
  const [paused, setPaused] = useState(false);
  /** T2b: the next-wave preview card under the wave chip. */
  const [wavePeekOpen, setWavePeekOpen] = useState(false);
  /** Sim-clock multiplier (1x / 2x) — scales the whole wave clock together. */
  const [speed, setSpeed] = useState<GameSpeed>(1);
  /** A cleared-band wave picked for replay, or null → fight the campaign seat. */
  const [replayPick, setReplayPick] = useState<{ phase: CampaignPhase; wave: number } | null>(null);
  /** Board geometry for Main only (`ato` default | `neon-maze` parked). Trial
   * always runs `ato`; the Maps UI switches this on Main. */
  const [boardId, setBoardId] = useState<BoardId>('ato');
  /** T8 map theme (device-local pick in the Setup sheet): paint only, never rules or rewards. */
  const turfTheme = useTurfTheme();
  /** The live board. Always present so towers can be placed during SETUP
   * (spawns wait until Start); transitions rebuild it at the right times. */
  const [sim, setSim] = useState<DefendLive | null>(() =>
    createDefendLive(view.campaign.wave_in_phase, {
      mapId: view.campaign.phase,
      boardId: 'ato',
      cyclePower: view.cyclePower,
      tint: view.cycleTint,
    }),
  );
  const [selectedPad, setSelectedPad] = useState<number | null>(null);
  /** Mirrors `selectedPad` for the board tap handler (an empty-board tap closes an open build card). */
  const selectedPadRef = useRef<number | null>(null);
  selectedPadRef.current = selectedPad;
  /** God mode — starts from the §9c tune doc (BrokenOP turns it on). */
  const [godMode, setGodMode] = useState(() => getTune().godMode);
  /** Dev kit only: mirrors the tune doc's `devNoCaps` so the row re-renders. */
  const [noCaps, setNoCaps] = useState(() => getTune().devNoCaps);
  /** Dev kit only (EFFECTS_PLAN step 1): FPS readout + synthetic FX stress. */
  const [fpsMeterOn, setFpsMeterOn] = useState(false);
  const [stressFx, setStressFx] = useState<StressFxLevel>(0);
  const [stressTick, setStressTick] = useState(0);
  const commitCountRef = useRef(0);
  /** Separate counter for the auto FPS test so the live meter's 1s resets
   * never corrupt a benchmark stage. */
  const benchCommitRef = useRef(0);
  useEffect(() => {
    commitCountRef.current += 1;
    benchCommitRef.current += 1;
  });
  const fpsStats = useFpsMeter(fpsMeterOn, commitCountRef);
  useEffect(() => {
    if (stressFx === 0 || paused) return;
    const id = setInterval(() => setStressTick((n) => n + 1), FX_TICK_MS);
    return () => clearInterval(id);
  }, [stressFx, paused]);
  /** Dev kit only: queue 20 swarm creeps into the running wave, 250ms apart. */
  const devAddStressCreeps = useCallback(() => {
    setSim((prev) => {
      if (!prev) return prev;
      const extra = Array.from({ length: 20 }, (_, i) => ({
        tMs: prev.elapsedMs + i * 250,
        role: 'swarm' as const,
        rampFrac: 0,
        boss: null,
      }));
      const schedule = [...prev.schedule, ...extra].sort((a, b) => a.tMs - b.tMs);
      return { ...prev, schedule };
    });
  }, []);
  /** Dev kit only (FPS test): queue swarm creeps so the board heads toward
   * `target`, counting creeps already due in the next 2s so it never floods. */
  const benchInjectedRef = useRef(new WeakSet<object>());
  const devTopUpCreeps = useCallback((target: number) => {
    setSim((prev) => {
      if (!prev) return prev;
      const soon = prev.schedule.filter((e) => e.tMs <= prev.elapsedMs + 2_000).length;
      const need = target - prev.puffs.length - soon;
      if (need <= 0) return prev;
      const extra = Array.from({ length: need }, (_, i) => ({
        tMs: prev.elapsedMs + i * 120,
        role: 'swarm' as const,
        rampFrac: 0,
        boss: null,
      }));
      extra.forEach((event) => benchInjectedRef.current.add(event));
      const schedule = [...prev.schedule, ...extra].sort((a, b) => a.tMs - b.tMs);
      return { ...prev, schedule };
    });
  }, []);
  const [coachHidden, setCoachHidden] = useState(false);
  /** Dev-only, this session only — the shipped default is `BOARD_SKIN`
   * (skin.ts). Both options are already fully bundled art (see the Board
   * section's row below), so switching costs nothing to preview. */
  const [boardSkin, setBoardSkin] = useState<BoardSkinId>(BOARD_SKIN);
  /** Live-run coach starts collapsed on phones; one tap reveals the full tip. */
  const [runCoachOpen, setRunCoachOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  /** Type-match chart (§9f §9i "?") — open state on setup + live. */
  const [chartOpen, setChartOpen] = useState(false);
  /** Drops preview on setup — collapsed by default (one neon header row), tap
   * to expand the categorized list. Display only. */
  const [dropsOpen, setDropsOpen] = useState(false);
  /** Dev kit only: dump the current band's drop table inline. */
  const [dumpDropsOpen, setDumpDropsOpen] = useState(false);
  /** Dev kit only: dump GS + per-wave recommended (Phase D smoke aid). */
  const [gsDumpOpen, setGsDumpOpen] = useState(false);
  /** Dev kit only: which collapsible groups are expanded. All four start
   * collapsed — the kit is ~30 rows, so a tester opens just the group they need
   * instead of scrolling one flat list (the old single "Hero lab" toggle,
   * generalised). */
  const [devSections, setDevSections] = useState<Record<DevSectionId, boolean>>({
    heroes: false,
    campaign: false,
    gear: false,
    board: false,
  });
  const toggleDevSection = useCallback((id: DevSectionId) => {
    setDevSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  /** What the last win paid — shows the honest (possibly halved) tokens. */
  const [lastWin, setLastWin] = useState<DefendWinResult | null>(null);
  /** Slice A2 — the hero offer the sheet is showing (a local copy of the save's
   * queued offer, so the sheet survives the action that clears the queue). */
  const [heroSheetOffer, setHeroSheetOffer] = useState<HeroOffer | null>(null);
  /** Floating damage numbers, pooled to MAX_FLOATERS (display only). */
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const floaterSeq = useRef(0);
  /** Puff list from the previous running tick — diffed for floaters. */
  const prevPuffsRef = useRef<Puff[]>([]);
  /** Live shot FX (display only) + id source + a mutable fast-tick copy. */
  const [shots, setShots] = useState<Shot[]>([]);
  const shotsRef = useRef<Shot[]>([]);
  const shotSeq = useRef(0);
  /** Kit attack effects (EFFECTS_PLAN step 5) — display only, like shots. */
  const [fxEvents, setFxEvents] = useState<FxEvent[]>([]);
  const fxRef = useRef<FxEvent[]>([]);
  const fxSeq = useRef(0);
  const fxQuality = useFxQuality();
  const fxQualityRef = useRef(fxQuality);
  fxQualityRef.current = fxQuality;
  /** T5 combat effects: which of flash / shake / hit stop / pop / leak pulse play (Effects Quality + Motion). */
  const playMotion = usePlayMotion();
  const combatFlags = combatFxFlags(fxQuality, playMotion);
  const combatFlagsRef = useRef(combatFlags);
  combatFlagsRef.current = combatFlags;
  /** T6 boss effects: entrance sigil, telegraphs, death blast, boss flash / shake / hit stop (Effects Quality + Motion). */
  const bossFlags = bossFxFlags(fxQuality, playMotion);
  const bossFlagsRef = useRef(bossFlags);
  bossFlagsRef.current = bossFlags;
  /** T7 polish beats: wave-start portal, wave-clear close, win sparks, leak replay (Effects Quality + Motion). */
  const beatFlags = beatFxFlags(fxQuality, playMotion);
  const beatFlagsRef = useRef(beatFlags);
  beatFlagsRef.current = beatFlags;
  /** Reduce Motion / Motion Off: the T5 exit ring shows at full size and only fades (T7 motion audit). */
  const calmRef = useRef(false);
  calmRef.current = playMotion.vestibularSafe || playMotion.cosmeticsStill;
  /** Telegraph keys showing now (Bound Boss skills `skill-<id>`, enemy enrage `enrage-<id>`). */
  const telegraphsRef = useRef(new Set<string>());
  const combatFxRef = useRef<TurfCombatFxHandle>(null);
  const boardShake = useBoardShake();
  const shakeBoard = boardShake.shake;
  /** The sprite + box each creep was last drawn with (written by the board render; the hit flash copies it). */
  const creepDrawRef = useRef(new Map<number, { drawable: ClipDrawable; box: { x: number; y: number; size: number } }>());
  /** Health-bar chip trail per creep (the pale segment draining to the new HP). */
  const hpChipRef = useRef(new Map<number, HpChip>());
  /** When each creep last flashed (FLASH_COOLDOWN_MS: a DoT must not strobe it). */
  const flashAtRef = useRef(new Map<number, number>());
  /** Hit stop (≤ HIT_STOP_MS) after a kill by an ultimate: the sim interval pauses, nothing else does. */
  const [hitStop, setHitStop] = useState(false);
  /** T6/T7: the won / lost card waits for its beat (the boss blast, the clear + sparks, the leak replay) so it is seen.
   * Display only: the win and the loss are decided and paid on the same tick as before. */
  const [resultHoldMs, setResultHoldMs] = useState(0);
  const resultHold = resultHoldMs > 0;
  const holdResult = useCallback((ms: number) => setResultHoldMs((prev) => Math.max(prev, ms)), []);
  useEffect(() => {
    if (!resultHoldMs) return;
    const timer = setTimeout(() => setResultHoldMs(0), resultHoldMs);
    return () => clearTimeout(timer);
  }, [resultHoldMs]);
  /** Saved board layouts (per map): loaded flag, the Bound Bosses a layout may
   * put back (id → stars, refreshed every render), the scrap a running wave
   * started with (restored on Leave / a lost Retry), and a one-shot restore
   * guard. */
  // Re-read saved layouts from the device on mount (a previous account's
  // layouts may still be in memory after a sign-out). Runs during the first
  // render, before any restore effect reads them.
  useState(() => {
    void reloadBoardLayouts();
    return 0;
  });
  const layoutsLoaded = useBoardLayoutsLoaded();
  const allowedBossesRef = useRef<ReadonlyMap<string, number>>(new Map());
  const runStartScrapRef = useRef(0);
  const initialRestoreDoneRef = useRef(false);
  /** Placement preview (the first tap on a build choice arms it): the ring the choice
   * would have on the selected pad. Avatar aim: the Avatar's range ring under
   * the finger before release. Display only. */
  const [placePreview, setPlacePreview] = useState<{ range: number; color: string; pull: boolean } | null>(null);
  // The armed range ring belongs to one open card: a different pad or a closed card drops it.
  useEffect(() => {
    setPlacePreview(null);
  }, [selectedPad]);
  const [avatarAim, setAvatarAim] = useState<{ x: number; y: number } | null>(null);
  const avatarAimAtRef = useRef(0);
  /** Per-tower aim rotation (deg), keyed by tower id; kept between shots. */
  const towerFacingRef = useRef<Record<number, number>>({});
  /** Per-tower sticky E/W side profile (K1), keyed by tower id. Reused for the
   * clip kit's idle/attack art; `skinWalkFace` on the aim dx flips it toward the
   * shot and keeps the last face through a near-vertical aim. */
  const towerFaceRef = useRef<Record<number, SkinWalkFace>>({});
  /** Per-tower clip-player state (K1), keyed by tower id: the shared CastActor
   * (idle loop / attack / skill one-shots). Display only — combat/cooldowns
   * never touch it. */
  const towerAnimRef = useRef<Record<number, CastActor>>({});
  /** Bumped by the tower anim tick to force the re-render that advances tower
   * frames. The value is never read. */
  const [, setTowerAnimTick] = useState(0);
  /** Per-creep path facing (deg), keyed by puff id. Kept when a creep is nearly
   * stopped (degenerate heading) so the sprite never snaps to a default. This is
   * the TRUE path tangent (the runner's motion streak rides it); the sprite's
   * side profile comes from `puffWalkFaceRef`. */
  const puffFacingRef = useRef<Record<number, number>>({});
  /** Per-creep side profile for the humanoid path walkers, keyed by puff id and
   * defaulting to `'e'` on spawn. Sticky: a vertical lane keeps the last east/
   * west face (see `skinWalkFace`) so the sprite never snaps north/south and the
   * legs never freeze. Only read for `SKIN_PATH_WALKER_ROLES`; cleared with the
   * facing map on every restage so a new run never inherits the last pose. */
  const puffWalkFaceRef = useRef<Record<number, SkinWalkFace>>({});
  /** Per-creep walk frame phase (H1.5, display only), keyed by puff id: the
   * fractional frame cursor plus the dist/rate sample that advances it between
   * sim ticks. Rebuilt every walk tick, so ids that left the board drop out. */
  const walkPhaseRef = useRef<Record<number, WalkPhase>>({});
  /** Bumped by the walk tick purely to force the re-render that advances the
   * creep walk frames. The value is never read. */
  const [, setWalkFrameTick] = useState(0);
  /** K2 death one-shots: the bodies the board keeps drawing after the engine
   * has already removed their puff. Pruned by the walk tick (and by every run
   * reset), never sent back into the sim. */
  const [corpses, setCorpses] = useState<CreepCorpse[]>([]);
  // Streetwear art style: Turf War — pinned HUD + dock in the street shell (paint/layout only).
  const street = streetUiOn();
  // Read inside the game tick / hit callbacks without restarting them.
  const streetRef = useRef(street);
  streetRef.current = street;
  /** Mid-run leave confirmation (one tap to confirm, Cancel stays in the fight). */
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  /** One warn per wave run — the banner must not re-arm every tick. */
  const bossWarnedRef = useRef(false);
  /** True when the run was live (not paused) before the leave confirm opened, so
   * Cancel restores exactly that state. */
  const resumeAfterLeaveCancelRef = useRef(false);

  const phaseRef = useRef(phase);
  const pausedRef = useRef(paused);
  const simRef = useRef(sim);
  const godModeRef = useRef(godMode);
  /** Read inside the fixed-cadence tickers so a speed change never restarts
   * (and thus never gaps) the interval. */
  const speedRef = useRef(speed);
  phaseRef.current = phase;
  pausedRef.current = paused;
  simRef.current = sim;
  godModeRef.current = godMode;
  speedRef.current = speed;

  /** Dev kit only — one-tap FPS test (EFFECTS_PLAN step 1). God mode is forced
   * on for the run so leaks never end the wave, then restored; the test's
   * creeps are cleared at the end. */
  const benchGodModeRef = useRef(false);
  const bench = useFxBenchmark({
    commitCountRef: benchCommitRef,
    setFx: setStressFx,
    creepCount: () => simRef.current?.puffs.length ?? 0,
    topUpCreeps: devTopUpCreeps,
    onStart: () => {
      benchGodModeRef.current = godModeRef.current;
      setGodMode(true);
    },
    onEnd: () => {
      setGodMode(benchGodModeRef.current);
      setSim((prev) =>
        prev
          ? {
              ...prev,
              puffs: [],
              schedule: prev.schedule.filter((e) => !benchInjectedRef.current.has(e)),
            }
          : prev,
      );
    },
  });
  const benchRunning = bench.state.running;
  const cancelBench = bench.cancel;
  useEffect(() => {
    if (benchRunning && (paused || phase !== 'running')) cancelBench();
  }, [benchRunning, paused, phase, cancelBench]);
  /** Auto-send each finished run once (wave73 `play_dev_logs`). */
  const [benchSend, setBenchSend] = useState<BenchSendStatus>(null);
  const benchSentRef = useRef<unknown>(null);
  const benchResults = bench.state.results;
  useEffect(() => {
    if (benchRunning) {
      setBenchSend(null);
      return;
    }
    if (benchResults.length === 0 || benchSentRef.current === benchResults) return;
    benchSentRef.current = benchResults;
    setBenchSend('sending');
    void sendPlayDevLog('fps_test', {
      results: benchResults,
      verdict: benchVerdict(benchResults),
      complete: benchResults.length === BENCH_STAGES.length,
      settleMs: BENCH_SETTLE_MS,
      measureMs: BENCH_MEASURE_MS,
      speed: speedRef.current,
    }).then((ok) => setBenchSend(ok ? 'sent' : 'failed'));
  }, [benchRunning, benchResults]);

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
  /** One pay and one streak break per run. The tick can fire again before React leaves `running`. */
  const winPaidRef = useRef(false);
  const leakNotedRef = useRef(false);
  const claimKeyRef = useRef('');
  const onLeakRef = useRef(onLeak);
  onLeakRef.current = onLeak;

  const displayedWave = sim?.wave ?? fight.wave;
  /** The phase of the CURRENT board — the sim's run wins while one exists, so
   * the won/lost overlays keep labelling the run that just finished even after
   * the campaign seat has already moved on. */
  const labelPhase: CampaignPhase = sim?.mapId ?? fight.phase;
  /** The board geometry the CURRENT board draws — follows the sim so a finished
   * run never visually jumps boards before the player moves on. */
  const boardMap = BOARD_MAPS[sim?.boardId ?? 'ato'];
  /** Ground dressing (grass + props + pad markers). Pure + memoized. */
  const decor = useMemo(() => boardDecor(boardMap), [boardMap]);
  /** Creep positions (board units 0-100) for the ambient pigeons: read on demand from the sim ref, never held in state.
   * Stable per board, so the memoised ambient layer does not re-render on every sim tick. */
  const ambientCreeps = useCallback(
    () =>
      (simRef.current?.puffs ?? []).map((puff) => {
        const pos = puffPosition(puff.dist, boardMap);
        return { x: pos.x * 100, y: pos.y * 100 };
      }),
    [boardMap],
  );
  /** Cobble road stamps hugging the waypoint polyline (Craftpix Road5). */
  const roadStamps = useMemo(() => roadDecor(boardMap), [boardMap]);
  /** Thin dark underlay bed the stamps sit on, for edge contrast. */
  const roadD = useMemo(() => boardPathD(boardMap), [boardMap]);
  const underlayTone = skinTone('road.underlay') ?? '#7a5636';
  const underlayWidth = skinUnits('road.underlay', 11);

  /** Boss band of the chosen fight (null for a normal formula wave). */
  const band = bossBandFor(fight.phase, fight.wave);
  /** The chosen fight's stage element and what it means for the active Legend
   * (2026-09-28 — the one element-matchup rule; replaces the old "Type · Ember
   * +20% match" gear bonus). Shown before Start so the player can switch
   * Legend in Dress first. */
  const stageElement = waveDefFor(fight.phase, fight.wave)?.element ?? null;
  const stageMatchup = stageMatchupFor(stageElement, view.legendElement, view.avatarLevel);
  /** Drop table + honest preview rows for the chosen fight (§9i). */
  const dropTableId = dropTableForWave(fight.phase, fight.wave);
  const dropRows = previewDropTable(dropTableId, new Set(view.uniques));
  /** Drops preview is grouped for scan by real data (`groupDrops`): uniques
   * first, then the item slots, then Other. Display only — same rows, same
   * odds; the grouping never changes what can drop. */
  const dropGroups = groupDrops(dropRows);

  // Avatar position (board units 0..1) — smooth via shared values, engine via
  // ref. The park lives on the ACTIVE Avatar and is keyed by map id for BOTH
  // maps (Trial and Main share this one path); a missing/corrupt park spawns at
  // the same board MIDDLE and is persisted, so a map never restores the old
  // corner default. Swapping Avatars restores each one's own spot.
  const initialParkMap: AvatarParkMapId = view.campaign.phase;
  const initialPark = avatarParkFor(view.avatarPark, initialParkMap);
  const avatarX = useSharedValue(initialPark.x);
  const avatarY = useSharedValue(initialPark.y);
  const avatarPosRef = useRef({ x: initialPark.x * 100, y: initialPark.y * 100 }); // board units (0..100)
  /** Where the Avatar is walking to (board units 0..100), or null when idle. */
  const moveTargetRef = useRef<{ x: number; y: number } | null>(null);
  /** True while the walk loop is actually stepping (drives the walk clip). */
  const movingRef = useRef(false);
  /** Which way the Avatar faces (sticky E/W side profile for the 2-dir Corvus
   * art). Aim math uses `avatarPosRef`; the DRAW uses only this face. */
  const avatarFaceRef = useRef<SkinWalkFace>('e');
  /** Avatar clip player state — the shared CastActor (avatar mode: idle/walk
   * loops + attack/skill/hurt/dash one-shots). Driven by a display-only tick;
   * combat/cooldowns never touch it. Seeded with a live timestamp so a fresh
   * mount breathes idle from frame 0. */
  const avatarAnimRef = useRef<CastActor>(castActorCreate('avatar'));
  /** P5b — the Turf helper the board draws now (the pick in setup, the sim's unit in a wave); read by
   * the clip tick below. Its clip player lives in `towerAnimRef` under its negative id. */
  const helperDrawRef = useRef<HelperDraw[]>([]);
  /** P5b — the helper's feet (board units). Setup: the move loop walks it after the leader. Wave: the
   * sim owns it; every sim tick glides the shared values to the new spot on the UI thread (60 fps). */
  const helperPosRef = useRef({ x: initialPark.x * 100 - 6, y: initialPark.y * 100 });
  const helperX = useSharedValue(helperPosRef.current.x / 100);
  const helperY = useSharedValue(helperPosRef.current.y / 100);
  /** Setup only: the helper walked this move tick (the clip tick plays its walk loop). */
  const helperSetupMovingRef = useRef(false);
  const helperSetupFaceRef = useRef<SkinWalkFace>('e');
  /** Bumped by the avatar anim tick purely to force the re-render that advances
   * the Avatar frame. The value is never read. */
  const [, setAvatarAnimTick] = useState(0);

  /** The `unit.avatar` role for the hero set in Dress (`active_avatar_hero_id`).
   * Rebuilt only when the hero id changes; every Avatar draw/clip read below
   * resolves through this, so the board never hard-codes Corvus. */
  const art = artSkin();
  const avatarRole = useMemo(
    () => heroAvatarRole(view.activeAvatarHeroId),
    // `art` re-resolves the Avatar when the art style switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view.activeAvatarHeroId, art],
  );

  /** The veil the active hero casts (its `skills.json` row resolved through
   * `heroCastSkill`) — drives the skill button copy AND the cast numbers, so
   * the Avatar's skill follows the hero it fights as. */
  const activeSkill = useMemo(
    () => heroCastSkill(view.activeAvatarHeroId),
    [view.activeAvatarHeroId],
  );

  // Reset the clip player to idle the moment the active hero changes (Dress set
  // / hero sheet), so a stale frame from the previous hero never shows.
  useEffect(() => {
    const a = avatarAnimRef.current;
    a.clip = 'idle';
    a.clipStartAt = Date.now();
    a.onceEndAt = 0;
    a.lockUntil = 0;
    setAvatarAnimTick((n) => n + 1);
  }, [view.activeAvatarHeroId]);

  /** Start an Avatar clip (attack/skill/hurt/dash) if its priority allows it.
   * Returns false when the active hero does not author that clip (a null in
   * `heroes.json` or unbundled art), or when a higher-priority one-shot is
   * locked in — in which case nothing changes and the caller still does its
   * gameplay work. */
  const startAvatarOnce = useCallback((clip: AvatarOnce): boolean => {
    const started = castActorStartOnce(avatarAnimRef.current, clip, Date.now(), avatarRole);
    if (started) setAvatarAnimTick((n) => n + 1); // show frame 0 of the new clip immediately
    return started;
  }, [avatarRole]);

  /** Start a tower one-shot clip (`attack` when its shot FX fires, `skill` when
   * its auto-skill casts — K1/K1b) if the priority ladder allows it. Returns
   * false when the tower's skin authors no such clip (unbundled art), or when a
   * higher-priority one-shot is locked in — in which case nothing changes and
   * the caller still does its gameplay work (shots still apply damage). */
  const startTowerOnce = useCallback(
    (clip: TowerOnce, towerId: number, role: SkinRole): boolean => {
      const now = Date.now();
      const actor =
        towerAnimRef.current[towerId] ?? castActorCreate('tower', castActorIdleSeed(towerId, 'tower'));
      if (!castActorStartOnce(actor, clip, now, role)) return false;
      towerAnimRef.current[towerId] = actor;
      setTowerAnimTick((n) => n + 1); // show frame 0 of the new clip immediately
      return true;
    },
    [],
  );

  // Display-only tower clip tick (K1). Runs whenever the screen is visible so a
  // tower breathes idle on its pad in setup too; it retires a finished attack
  // one-shot back to idle and bumps a counter only when a tower frame changes
  // (a tower with no idle/attack art never bumps — it stays a static rotation).
  // A HERO bound as a tower (A6) rides the same tick + clip player, keyed by
  // its own id (ids are unique across towers AND bound bosses — one `nextId`).
  // While paused it slides the clip clocks forward with real time, matching the
  // Avatar so a one-shot never expires on a frozen board. Never touches engine
  // state.
  useEffect(() => {
    const lastFrameKey = new Map<number, string>();
    let lastTickAt = Date.now();
    const id = setInterval(() => {
      const current = simRef.current;
      const now = Date.now();
      if (pausedRef.current) {
        const dt = now - lastTickAt;
        // P5b helper: one-shots, a running faint / get-up and the walk loop slide with real time too.
        for (const h of helperDrawRef.current) {
          const s = towerAnimRef.current[h.id];
          if (s) {
            s.clipStartAt += dt;
            if (s.onceEndAt > 0) s.onceEndAt += dt;
          }
          if (helperKoAtRef.current[h.id] != null) helperKoAtRef.current[h.id] += dt;
          if (helperUpAtRef.current[h.id] != null) helperUpAtRef.current[h.id] += dt;
          if (helperWalkAtRef.current[h.id] != null) helperWalkAtRef.current[h.id] += dt;
        }
        for (const tower of current?.towers ?? []) {
          const s = towerAnimRef.current[tower.id];
          if (s) {
            s.clipStartAt += dt;
            if (s.onceEndAt > 0) s.onceEndAt += dt;
          }
        }
        for (const bb of current?.boundBosses ?? []) {
          const s = towerAnimRef.current[bb.id];
          if (s) {
            s.clipStartAt += dt;
            if (s.onceEndAt > 0) s.onceEndAt += dt;
          }
        }
        lastTickAt = now;
        return; // no bump → the frame renders frozen, matching the sim
      }
      lastTickAt = now;
      const helpers = helperDrawRef.current;
      if (!current || (current.towers.length === 0 && current.boundBosses.length === 0 && helpers.length === 0)) return;
      let changed = false;
      for (const h of helpers) {
        // The helper's frame key: faint (dazed) → get-up (faint reversed) → its one-shot / walk / idle.
        // Its POSITION never bumps a render here — the shared values move it on the UI thread.
        const pose = helperPose(
          h,
          now,
          towerAnimRef.current,
          helperKoAtRef.current,
          helperUpAtRef.current,
          helperWalkAtRef.current,
          HELPER_GET_UP_MS / Math.max(1, speedRef.current),
        );
        const key = `${pose.clip}:${pose.frame}`;
        if (lastFrameKey.get(h.id) !== key) {
          lastFrameKey.set(h.id, key);
          changed = true;
        }
      }
      for (const tower of current.towers) {
        const role = towerKitRole(tower.kind);
        const hasClips =
          castActorClipFrames('idle', role) > 0 ||
          castActorClipFrames('attack', role) > 0 ||
          castActorClipFrames('skill', role) > 0;
        if (!hasClips) continue; // static rotation — no clip to advance
        const prev = towerAnimRef.current[tower.id];
        const state: CastActor =
          prev ?? castActorCreate('tower', castActorIdleSeed(tower.id, 'tower'));
        if (state.onceEndAt > 0 && now >= state.onceEndAt) {
          state.clip = 'idle';
          state.clipStartAt = now;
          state.onceEndAt = 0;
        }
        towerAnimRef.current[tower.id] = state;
        const key = `${state.clip}:${castActorFrame(state, now, role)}`;
        if (lastFrameKey.get(tower.id) !== key) {
          lastFrameKey.set(tower.id, key);
          changed = true;
        }
      }
      for (const bb of current.boundBosses) {
        const heroId = boundBossHeroId(bb.bossId);
        if (!heroId) continue; // no hero art mapped — static placeholder only
        const role = resolveBoundHeroTowerKit(heroId);
        const hasClips =
          castActorClipFrames('idle', role) > 0 ||
          castActorClipFrames('attack', role) > 0 ||
          castActorClipFrames('skill', role) > 0;
        if (!hasClips) continue; // static rotation — no clip to advance
        const prev = towerAnimRef.current[bb.id];
        const state: CastActor =
          prev ?? castActorCreate('tower', castActorIdleSeed(bb.id, 'tower'));
        if (state.onceEndAt > 0 && now >= state.onceEndAt) {
          state.clip = 'idle';
          state.clipStartAt = now;
          state.onceEndAt = 0;
        }
        towerAnimRef.current[bb.id] = state;
        const key = `${state.clip}:${castActorFrame(state, now, role)}`;
        if (lastFrameKey.get(bb.id) !== key) {
          lastFrameKey.set(bb.id, key);
          changed = true;
        }
      }
      if (changed) setTowerAnimTick((n) => n + 1);
    }, AVATAR_ANIM_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Display-only Avatar clip tick. Runs whenever the screen is visible so idle
  // breathes in setup and on the results overlays too; it picks walk/idle from
  // `movingRef`, retires a finished one-shot, and bumps a counter so the Avatar
  // frame advances. A hero with no walk clip stays on idle while moving (sticky
  // idle). While paused it slides the clip's clock forward with real time
  // instead of rendering, which holds the exact frame the pause caught and
  // stops a one-shot from expiring on a frozen board. Never touches engine state.
  useEffect(() => {
    const hasWalk = (avatarRole.walk?.frames ?? 0) > 0;
    let lastTickAt = Date.now();
    let lastFrameKey = '';
    const id = setInterval(() => {
      const a = avatarAnimRef.current;
      const now = Date.now();
      if (pausedRef.current) {
        const dt = now - lastTickAt;
        a.clipStartAt += dt;
        if (a.onceEndAt > 0) a.onceEndAt += dt;
        if (a.lockUntil > 0) a.lockUntil += dt;
        lastTickAt = now;
        return; // no bump → the frame renders frozen, matching the sim
      }
      lastTickAt = now;
      if (a.onceEndAt > 0) {
        if (now >= a.onceEndAt) {
          // A finished skill leaves a short recovery tail so the next
          // auto-attack can't clip Root Veil's last frames.
          a.lockUntil = a.clip === 'skill' ? now + AVATAR_SKILL_RECOVER_MS : 0;
          a.clip = movingRef.current && hasWalk ? 'walk' : 'idle';
          a.clipStartAt = now;
          a.onceEndAt = 0;
        }
      } else {
        const want: CastActorClip = movingRef.current && hasWalk ? 'walk' : 'idle';
        if (a.clip !== want) {
          a.clip = want;
          a.clipStartAt = now;
        }
      }
      // Re-render only when the drawn frame actually changes: idle breathes at
      // 120ms/frame, so this is ~2.4× fewer full-board renders than bumping on
      // every tick. The clip name is part of the key so a clip swap (or the
      // idle↔walk hand-off) always repaints even if the frame index matches.
      const key = `${a.clip}:${castActorFrame(a, now, avatarRole)}`;
      if (key !== lastFrameKey) {
        lastFrameKey = key;
        setAvatarAnimTick((n) => n + 1);
      }
    }, AVATAR_ANIM_TICK_MS);
    return () => clearInterval(id);
  }, [avatarRole]);

  /** Measured board size. `boardSizeRef` is the JS-thread copy (tap math);
   * `boardSize` is the SHARED copy the avatar's animated style reads. */
  const boardSizeRef = useRef(100);
  const boardSize = useSharedValue(100);
  /** Which map the Avatar is currently parked on (guard: only re-park on a
   * Trial ↔ Main switch, never on every wave/rebuild). */
  const parkedMapRef = useRef<AvatarParkMapId | null>(initialParkMap);

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
      avatarPosRef.current = { x: park.x * 100, y: park.y * 100 };
      moveTargetRef.current = null;
      movingRef.current = false;
      parkedMapRef.current = mapId;
    },
    // avatarX/avatarY are stable shared-value handles (their `.value` writes
    // never change identity); view.avatarPark is the read.
    [view.avatarPark, onSaveAvatarPark, avatarX, avatarY],
  );

  /** Persist the Avatar's current spot as this board map's park (walk arrival).
   * Same path for Trial and Main. */
  const commitAvatarPark = useCallback(() => {
    const mapId = (simRef.current?.mapId ?? fightRef.current.phase) as AvatarParkMapId;
    onSaveAvatarPark(mapId, avatarPosRef.current.x / 100, avatarPosRef.current.y / 100);
  }, [onSaveAvatarPark]);

  // Equipped mult buckets, board-wide for towers + Avatar (gear matching the
  // active Legend is already raised inside the sums). P6: the sums are the
  // LEADER hero's gear (`leaderStatSums`), not whichever hero the Locker is
  // dressing. Avatar stars (§9h) fold into the same damage pass; the Legend's
  // element rides every Avatar and hero attack.
  const buckets = useMemo(
    () => ({
      wavePower: bucketMultiplier('wave_power', view.leaderStatSums),
      towerSpeed: bucketMultiplier('tower_speed', view.leaderStatSums),
      avatarLevel: view.avatarLevel,
      legendElement: view.legendElement,
      avatarStars: view.avatarStars,
      rebirthBonus: view.petRebirthBonus,
      sword: view.swords.equipped
        ? swordRuntime(view.swords.equipped.element, view.swords.equipped.tier)
        : null,
      leaderStars: view.turfTeam.leaderStars,
      leaderGrade: view.turfTeam.leaderGrade,
    }),
    [view.leaderStatSums, view.avatarLevel, view.avatarStars, view.legendElement, view.petRebirthBonus, view.swords.equipped, view.turfTeam.leaderStars, view.turfTeam.leaderGrade],
  );
  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;

  // P5b Turf team: the saved helper pick (the view drops a pet that can no longer help) and the
  // helper's display clocks — daze start, get-up start, walk-loop start (display only).
  const helperPicks = view.turfTeam.picks;
  /** P6: the helper's own gear, as the same soft-capped wave_power bucket the leader's gear uses; it
   * scales the helper's hits and skill only (×1 with no gear). */
  const helperGearPower = bucketMultiplier('wave_power', view.helperStatSums);
  const helperPicksRef = useRef(helperPicks);
  helperPicksRef.current = helperPicks;
  const helperKoAtRef = useRef<Record<number, number>>({});
  const helperUpAtRef = useRef<Record<number, number>>({});
  const helperWalkAtRef = useRef<Record<number, number>>({});
  /** The team going into a fight: the pick → its spec, standing at its follow spot beside the leader
   * on THIS board (off the road and pads). */
  const helperSpecsFor = useCallback(
    (map: DefendMap): TurfHelperSpec[] =>
      helperPicksRef.current.flatMap((pick, slot) => {
        const pet = view.turfTeam.candidates.find((c) => c.uid === pick.uid);
        if (!pet) return [];
        const spot = helperFollowSpot(map, avatarPosRef.current);
        return [{ slot, heroId: pet.heroId, x: spot.x, y: spot.y, stars: pet.stars, grade: pet.grade, gearPower: helperGearPower }];
      }),
    [view.turfTeam.candidates, helperGearPower],
  );
  /** Drop the helper's display clocks (a new fight / retry stands it up fresh). */
  const resetHelperClocks = useCallback(() => {
    helperKoAtRef.current = {};
    helperUpAtRef.current = {};
    helperWalkAtRef.current = {};
  }, []);

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

  /** A fresh board for a fight, with the player's saved layout for that map
   * put back for free (like Retry keeps towers) and any banked kill scrap paid
   * in. Stale entries are dropped by `restoreBoardLayout`. */
  const withSavedLayout = useCallback((state: DefendLive): DefendLive => {
    const key = layoutKey(state.mapId, state.boardId);
    const restored = restoreBoardLayout(state, getSavedLayout(key), allowedBossesRef.current);
    // Peek, not take: this board may be rebuilt before the wave starts; the
    // bank is consumed on the first setup edit or at wave start. A kept board
    // runs on its bank alone; start scrap is for empty boards.
    const keptBoard = restored.towers.length + restored.boundBosses.length > 0;
    return {
      ...restored,
      scrap: setupScrapFor({ keptBoard, startScrap: state.scrap, bank: peekBankScrap(key) }),
    };
  }, []);

  /** Save the board's layout for its map — setup edits only (pads are locked
   * while a wave runs). */
  const commitBoard = useCallback((next: DefendLive | null) => {
    if (!next || phaseRef.current !== 'setup') return;
    const key = layoutKey(next.mapId, next.boardId);
    const layout = boardLayoutOf(next);
    saveBoardLayout(key, layout);
    // The bank follows the unspent balance through setup, so leaving Defend or
    // rebuilding the board before the wave restores it exactly (never more).
    const kept = layout.towers.length + layout.bosses.length > 0;
    setBankScrap(key, setupBankFor({ keptBoard: kept, scrap: next.scrap, startScrap: getTune().startScrap }));
  }, []);

  // Scrap at the moment a wave starts running — Start wave, the lost-screen
  // Retry and the dev boss preview all enter 'running' — so a restage after a
  // loss or Leave returns exactly what the wave started with.
  useEffect(() => {
    if (phase === 'running') runStartScrapRef.current = simRef.current?.scrap ?? 0;
  }, [phase]);

  /** Bank a restaged board's scrap (after Leave or a loss), so leaving
   * Defend before the next setup edit restores exactly that amount. */
  const bankRestage = useCallback((board: DefendLive) => {
    const kept = board.towers.length + board.boundBosses.length > 0;
    setBankScrap(
      layoutKey(board.mapId, board.boardId),
      setupBankFor({ keptBoard: kept, scrap: board.scrap, startScrap: getTune().startScrap }),
    );
  }, []);

  // The first board is built before the saved layouts finish loading; put the
  // layout back once they land, if the player hasn't started building.
  useEffect(() => {
    if (!layoutsLoaded || initialRestoreDoneRef.current) return;
    initialRestoreDoneRef.current = true;
    const current = simRef.current;
    if (phaseRef.current !== 'setup' || !current) return;
    if (current.towers.length > 0 || current.boundBosses.length > 0) return;
    const restored = withSavedLayout(current);
    simRef.current = restored;
    setSim(restored);
  }, [layoutsLoaded, withSavedLayout]);

  /** Rebuild a fresh board for a fight and go back to setup. */
  const buildSetup = useCallback(
    (next: Fight) => {
      setReplayPick(next.mode === 'replay' ? { phase: next.phase, wave: next.wave } : null);
      // Default board on every (re)build — maze is a deliberate Maps-UI pick.
      setBoardId('ato');
      setSim(withSavedLayout(createDefendLive(next.wave, { mapId: next.phase, boardId: 'ato', cyclePower: view.cyclePower, tint: view.cycleTint })));
      ensureParked(next.phase);
      setPhase('setup');
      setPaused(false);
      setSelectedPad(null);
      setWhyOpen(false);
      prevPuffsRef.current = [];
      setFloaters([]);
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
      combatFxRef.current?.clear();
      telegraphsRef.current.clear();
    },
    [view.cyclePower, view.cycleTint, ensureParked, withSavedLayout],
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
      setBoardId('ato');
      setSim(withSavedLayout(createDefendLive(fight.wave, { mapId: fight.phase, boardId: 'ato', cyclePower: view.cyclePower, tint: view.cycleTint })));
      prevPuffsRef.current = [];
      setFloaters([]);
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
    }
    ensureParked(fight.phase);
    setSelectedPad(null);
    setWhyOpen(false);
    combatFxRef.current?.clear();
    telegraphsRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fightKey, view.cyclePower, view.cycleTint]);

  /** Maps UI: switch the Main board geometry (towers reset). Only reachable on
   * Main — Trial keeps the locked `ato` board. */
  const selectBoard = useCallback((next: BoardId) => {
    setBoardId(next);
    const f = fightRef.current;
    setSim(withSavedLayout(createDefendLive(f.wave, {
      mapId: f.phase,
      boardId: next,
      cyclePower: view.cyclePower,
      tint: view.cycleTint,
    })));
    setSelectedPad(null);
    prevPuffsRef.current = [];
    setFloaters([]);
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
  }, [view.cyclePower, view.cycleTint, withSavedLayout]);

  /** Start the wave on the current board — placed towers + spent scrap carry
   * into the fight (spec §9: setup place → start). */
  const startWave = useCallback(() => {
    countOnce('turf_wave_start');
    playedRef.current = fightRef.current;
    winPaidRef.current = false;
    leakNotedRef.current = false;
    claimKeyRef.current = `defend:${fightRef.current.phase}:${fightRef.current.wave}:${Date.now()}`;
    const starting = simRef.current;
    if (starting) takeBankScrap(layoutKey(starting.mapId, starting.boardId));
    // P5b: the helper goes on the board fresh for every fight, beside the leader.
    resetHelperClocks();
    setSim((prev) => {
      const base = prev ?? createDefendLive(fightRef.current.wave, {
        mapId: fightRef.current.phase,
        boardId: fightRef.current.phase === 'main' ? boardId : 'ato',
        cyclePower: view.cyclePower,
        tint: view.cycleTint,
      });
      return placeTurfTeam(base, helperSpecsFor(BOARD_MAPS[base.boardId] ?? BOARD_MAPS.ato), view.turfTeam.leaderGrade);
    });
    setPhase('running');
    setPaused(false);
    setSelectedPad(null);
    prevPuffsRef.current = [];
    setFloaters([]);
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
    combatFxRef.current?.clear();
    telegraphsRef.current.clear();
    bossWarnedRef.current = false; // re-arm the warn for this run
    setResultHoldMs(0);
    // T7 wave start (display only): the lane line + the cyan portal opening at the path start.
    if (streetRef.current) {
      const run = fightRef.current;
      const puffs = starting?.schedule.length ?? 0;
      if (puffs > 0) notify({ kind: 'notify', ...waveStartNotice(run.wave, campaignPhaseLabel(run.phase), puffs), dedupeKey: 'turf-wave-start' });
      const portalMode = beatFlagsRef.current.portal;
      const startPt = (BOARD_MAPS[starting?.boardId ?? 'ato'] ?? BOARD_MAPS.ato).path[0];
      if (portalMode && startPt) {
        const at = portalPoint(startPt);
        combatFxRef.current?.portal(at.x, at.y, portalMode, false);
      }
    }
  }, [view.cyclePower, view.cycleTint, view.turfTeam.leaderGrade, boardId, helperSpecsFor, resetHelperClocks]);

  /** Abandon a live run back to setup — no win rewards. The tower layout is
   * kept (same feel as Retry after a fail), so Start wave is instantly
   * re-playable with your placement intact. */
  const abandonRun = useCallback(() => {
    const current = simRef.current;
    if (current) {
      // Fresh board for the SAME fight carrying towers + Bound Bosses; scrap
      // returns to the run start (matches Retry semantics).
      // Same towers, and exactly the scrap you had when you pressed Start —
      // never a refill (Leave mid-wave must not mint scrap). Banked too, so
      // leaving Defend before the next edit keeps it.
      const fresh = { ...retryDefendLive(current), scrap: runStartScrapRef.current };
      bankRestage(fresh);
      simRef.current = fresh;
      setSim(fresh);
    }
    setPhase('setup');
    setPaused(false);
    setSelectedPad(null);
    setWhyOpen(false);
    prevPuffsRef.current = [];
    setFloaters([]);
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
    combatFxRef.current?.clear();
    telegraphsRef.current.clear();
    setLeaveConfirmOpen(false);
  }, [bankRestage]);

  /** Mid-run Leave — one confirmation, then `abandonRun` (the existing path:
   * towers kept, no win, no rewards, no fake leak). Opening the confirm freezes
   * the sim so a creep can't leak while the player reads it; Cancel restores
   * exactly the pre-confirm state. */
  const requestLeaveRun = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    resumeAfterLeaveCancelRef.current = !pausedRef.current;
    setPaused(true);
    setLeaveConfirmOpen(true);
  }, []);

  const cancelLeaveRun = useCallback(() => {
    setLeaveConfirmOpen(false);
    if (resumeAfterLeaveCancelRef.current) setPaused(false);
    resumeAfterLeaveCancelRef.current = false;
  }, []);

  // Back one level (2026-09-29): mid-wave, back never leaves silently — it
  // opens (or closes) the same Leave confirm as the button, and our edge swipe
  // is OFF while a wave runs (the board is near full width; edge drags stay
  // board drags — emci). Setup / result: back goes to the hub.
  useEffect(() => {
    if (!registerBack) return;
    registerBack({
      edgeSwipe: defendEdgeSwipe(phase),
      back: () => {
        if (setupOpen) {
          setSetupOpen(false);
          return true;
        }
        const step = defendBackStep(phase, leaveConfirmOpen);
        if (step === 'close-confirm') cancelLeaveRun();
        else if (step === 'request-leave') requestLeaveRun();
        return step !== 'hub';
      },
    });
    return () => registerBack(null);
  }, [registerBack, phase, leaveConfirmOpen, cancelLeaveRun, requestLeaveRun, setupOpen]);

  const confirmLeaveRun = useCallback(() => {
    resumeAfterLeaveCancelRef.current = false;
    abandonRun();
  }, [abandonRun]);

  /** Result-screen "Leave": STAY in Defend — back to SETUP on the SAME fight
   * (Start wave ready) with towers kept, exactly like Abandon. Never the Grove
   * hub (the ‹ Divecore back button leaves). A WON campaign wave restages as
   * its honest cleared-band replay — the seat already moved past it, so half
   * pay and no double-advance; a LOST wave keeps the campaign fight so Start
   * wave retries it at full reward. */
  const leaveResultsToSetup = useCallback((fromWon: boolean) => {
    const current = simRef.current;
    if (current) {
      const retried = retryDefendLive(current);
      // Won: the board runs on the banked balance (consumed at wave start).
      // Lost: back to the scrap the wave started with, floored at one tower so
      // a board that keeps losing is never stuck.
      const fresh = {
        ...retried,
        scrap: fromWon
          ? setupScrapFor({
              keptBoard: retried.towers.length + retried.boundBosses.length > 0,
              startScrap: retried.scrap,
              bank: peekBankScrap(layoutKey(retried.mapId, retried.boardId)),
            })
          : Math.max(runStartScrapRef.current, KEPT_BOARD_MIN_SCRAP),
      };
      if (!fromWon) bankRestage(fresh);
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
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
    combatFxRef.current?.clear();
    telegraphsRef.current.clear();
    hpChipRef.current.clear();
    flashAtRef.current.clear();
    creepDrawRef.current.clear();
  }, [bankRestage]);

  /** Push hit/kill floaters (capped + oldest dropped = pooled, no unbounded
   * growth under heavy fire). Board units → px via the measured board size.
   * T5: a hit on a creep whose number appeared < FLOATER_MERGE_MS ago adds to
   * that number (a kill turns it gold) instead of stacking a new one; a new
   * number gets a small fixed nudge from its id so neighbours don't overlap. */
  const spawnFloaters = useCallback((events: readonly HitEvent[]) => {
    const size = boardSizeRef.current || 100;
    const now = Date.now();
    setFloaters((prev) => {
      const next = [...prev];
      for (const event of events) {
        const at = next.findIndex((f) => f.puffId === event.puffId && now - f.bornAt < FLOATER_MERGE_MS);
        if (at >= 0) {
          const f = next[at]!;
          const damage = f.damage + event.damage;
          next[at] = { ...f, damage, label: formatHit(damage), kill: f.kill || event.kill, color: event.color ?? f.color };
          continue;
        }
        const id = ++floaterSeq.current;
        next.push({
          id,
          left: event.x * size - FLOATER_OFFSET_X + jitter(id, 1, FLOATER_JITTER_X),
          top: event.y * size - FLOATER_OFFSET_Y + jitter(id, 2, FLOATER_JITTER_Y),
          label: formatHit(event.damage),
          kill: event.kill,
          color: event.color,
          puffId: event.puffId,
          bornAt: now,
          damage: event.damage,
        });
      }
      return next.length > MAX_FLOATERS ? next.slice(next.length - MAX_FLOATERS) : next;
    });
  }, []);

  const dropFloater = useCallback((id: number) => {
    setFloaters((prev) => prev.filter((floater) => floater.id !== id));
  }, []);

  /** Fire one shot FX from a tower centre toward its aim point (display only —
   * the engine already applied the damage this tick). */
  const spawnShot = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001) return;
    const vx = (dx / dist) * SHOT_SPEED_UNITS_PER_SEC;
    const vy = (dy / dist) * SHOT_SPEED_UNITS_PER_SEC;
    const shot: Shot = {
      id: ++shotSeq.current,
      x: fromX,
      y: fromY,
      tx: toX,
      ty: toY,
      vx,
      vy,
      bornAt: Date.now(),
    };
    const next = [...shotsRef.current, shot];
    shotsRef.current = next;
    setShots(next);
  }, []);

  /** Draw one kit hit (EFFECTS_PLAN step 5). A neutral attack (the plain
   * Archer) keeps the old shot sprite; an elemental one becomes an effect.
   * Oldest effects drop first past the Effects Quality cap. */
  const spawnHitFx = useCallback(
    (hit: KitHit, pos: ReadonlyMap<number, FxPoint>) => {
      const primary = pos.get(hit.primaryId);
      if (!primary) return;
      // Streetwear: the Avatar's weapon hits always become an effect (a slash), even plain ones.
      const melee = streetRef.current && hit.source === 'avatar';
      // T5: in Streetwear the plain Archer tower fires its own dart + star (`archer/*`) instead of the Kenney shot.
      const archer = streetRef.current && hit.source === 'tower' && hit.element == null && !hit.ultimate && !melee;
      if (hit.element == null && !hit.ultimate && !melee && !archer) {
        spawnShot(hit.from.x, hit.from.y, primary.x, primary.y);
        return;
      }
      const ids =
        hit.behavior === 'chain'
          ? hit.puffIds
          : [hit.primaryId, ...hit.puffIds.filter((id) => id !== hit.primaryId && id !== hit.arcId)];
      const points = ids.map((id) => pos.get(id)).filter((p): p is FxPoint => p != null);
      const fx: FxEvent = {
        id: ++fxSeq.current,
        bornAt: Date.now(),
        lifeMs: hit.ultimate ? FX_ULTIMATE_LIFE_MS : FX_LIFE_MS,
        behavior: hit.behavior,
        element: hit.element,
        secondary: hit.secondary,
        ultimate: hit.ultimate,
        from: hit.from,
        points,
        arc: hit.arcId != null ? (pos.get(hit.arcId) ?? null) : null,
        radius: hit.radius,
        center: hit.centredOnSource ? hit.from : primary,
        centredOnSource: hit.centredOnSource,
        melee,
        skin: archer ? TOWER_FX.archer.shot.split('/')[0] : undefined,
      };
      const cap = FX_CAP[fxQualityRef.current];
      const merged = [...fxRef.current, fx];
      const next = merged.length > cap ? merged.slice(merged.length - cap) : merged;
      fxRef.current = next;
      setFxEvents(next);
    },
    [spawnShot],
  );

  // FX tick: advance shot projectiles toward their aim point and despawn on
  // reach (or after a short life). Runs faster than the 100ms sim tick so the
  // shots read as motion; touches nothing in the engine.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const id = setInterval(() => {
      const list = shotsRef.current;
      // Kit effects age out on the same fast tick (their shape is drawn from
      // their age, so a re-render each tick is what animates them).
      if (fxRef.current.length > 0) {
        const nowFx = Date.now();
        const liveFx = fxRef.current.filter((fx) => nowFx - fx.bornAt < fx.lifeMs);
        fxRef.current = liveFx;
        setFxEvents(liveFx);
      }
      if (list.length === 0) return;
      // Shots ride the same clock as the sim, so 2x keeps them ahead of the
      // faster creeps instead of trailing them. Display only.
      const dt = (FX_TICK_MS / 1000) * speedRef.current;
      const now = Date.now();
      const next: Shot[] = [];
      for (const shot of list) {
        if (now - shot.bornAt > SHOT_MAX_LIFE_MS) continue; // stale → despawn
        const x = shot.x + shot.vx * dt;
        const y = shot.y + shot.vy * dt;
        if (Math.hypot(shot.tx - x, shot.ty - y) <= SHOT_HIT_RADIUS) continue; // reached
        next.push({ ...shot, x, y });
      }
      shotsRef.current = next;
      setShots(next);
    }, FX_TICK_MS);
    return () => clearInterval(id);
  }, [phase, paused]);

  // Walk tick (H1.5, display only): creeps' legs. See `WALK_TICK_MS` — this
  // advances a per-creep frame phase from its own measured dist/sec and bumps a
  // counter to force the re-render. Touches no engine state: combat dt,
  // movement and cooldowns still step only on DEFEND_TICK_MS. K2 also ages out
  // finished death one-shots here, so a corpse leaves the board on the same
  // clock that animates it (before the "nothing to animate" bail, so a run whose
  // last creep has just died still clears its body).
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const id = setInterval(() => {
      const now = Date.now();
      setCorpses((prev) =>
        prev.length === 0 ? prev : prev.filter((corpse) => now - corpse.bornAt < CREEP_CORPSE_MS),
      );
      const current = simRef.current;
      if (!current || current.puffs.length === 0) return; // nothing to animate
      const dtSec = WALK_TICK_MS / 1000;
      const next: typeof walkPhaseRef.current = {};
      const bandKind = current.band?.kind;
      for (const puff of current.puffs) {
        // Same role mapping the board render uses, so the frame phase and the
        // gait multiplier always agree with the sprite actually drawn.
        const framesPerPath = walkFramesPerPath(puffUnitRole(puff, bandKind));
        let prev: WalkPhase | undefined = walkPhaseRef.current[puff.id];
        // A lower dist means this id was reused by a fresh run / respawn.
        if (prev && puff.dist < prev.dist) prev = undefined;
        if (!prev) {
          // Seed ground-aligned so a new creep doesn't snap to frame 0.
          next[puff.id] = {
            dist: puff.dist,
            at: now,
            rate: 0,
            phase: puff.dist * framesPerPath,
          };
          continue;
        }
        let rate = prev.rate;
        let at = prev.at;
        if (puff.dist !== prev.dist) {
          const elapsed = Math.max(1, Math.min(WALK_RATE_MAX_MS, now - prev.at)) / 1000;
          rate = (puff.dist - prev.dist) / elapsed;
          at = now;
        } else if (now - prev.at > CREEP_STILL_MS) {
          rate = 0; // halted — hold the frame (K2: the creep breathes instead)
        }
        next[puff.id] = {
          dist: puff.dist,
          at,
          rate,
          phase: prev.phase + rate * dtSec * framesPerPath,
        };
      }
      walkPhaseRef.current = next;
      setWalkFrameTick((n) => n + 1);
    }, WALK_TICK_MS);
    return () => clearInterval(id);
  }, [phase, paused]);

  // K2 corpse clock — the other half of the death one-shot (display only). The
  // walk tick above owns the corpse while the wave clock runs; this one covers
  // the stopped clock (won / lost / paused), where nothing else re-renders the
  // board. Without it the kill that ENDS a run would show a body frozen on its
  // first frame for the whole results screen, and never leave: its corpse is
  // created the same tick the run ends. Re-rendering the aging corpse is also
  // what advances its wall-clock death frames. Runs only while a body is on the
  // board (and not while the walk tick is already doing it), so a board with no
  // corpses costs nothing.
  useEffect(() => {
    if (corpses.length === 0) return;
    if (phase === 'running' && !paused) return; // the walk tick is already aging them
    const id = setInterval(() => {
      const now = Date.now();
      setCorpses((prev) => prev.filter((corpse) => now - corpse.bornAt < CREEP_CORPSE_MS));
    }, WALK_TICK_MS);
    return () => clearInterval(id);
  }, [corpses.length, phase, paused]);

  const winWave = useCallback(() => {
    if (winPaidRef.current) return;
    winPaidRef.current = true;
    const played = playedRef.current;
    // The whole scrap balance carries into this map's next setup (pads are
    // locked during a wave, so kill scrap had nothing to buy mid-run). SET, not
    // added: whatever was banked before this wave is already inside this
    // balance (it was paid into the board).
    const endState = simRef.current;
    if (endState) {
      setBankScrap(
        layoutKey(endState.mapId, endState.boardId),
        Math.max(endState.scrap, KEPT_BOARD_MIN_SCRAP),
      );
    }
    setPhase('won');
    setPaused(false);
    setSelectedPad(null);
    const claimKey = claimKeyRef.current || `defend:${played.phase}:${played.wave}:${played.mode}`;
    void onWin({ phase: played.phase, wave: played.wave, mode: played.mode, claimKey }).then((result) => {
      if (result) setLastWin(result);
    });
  }, [onWin]);

  // T5 hit stop: the sim ticker below is off while `hitStop` is set, then resumes on its own clock. Display only —
  // the engine still steps the same dt per tick, so no rule, timer or reward changes.
  useEffect(() => {
    if (!hitStop) return;
    const timer = setTimeout(() => setHitStop(false), HIT_STOP_TIMER_MS);
    return () => clearTimeout(timer);
  }, [hitStop]);

  // Sim ticker: running + not paused (+ not in a hit stop).
  useEffect(() => {
    if (phase !== 'running' || paused || hitStop) return;
    const id = setInterval(() => {
      const current = simRef.current;
      if (!current) return;
      const avatar = avatarPosRef.current;
      // §19 Avatar face/slash (display only). Read the target from the PRE-step
      // puffs: the engine may kill this very puff, and the post-step list would
      // drop the killing blow's facing/flash. A higher post-step cooldown means
      // the engine reset it — i.e. the Avatar attacked this tick.
      const aimed = nearestPuffDelta(current.puffs, avatar, BOARD_MAPS[current.boardId] ?? BOARD_MAPS.ato);
      // ONE sim clock: dtMs × speed drives elapsed (spawns), movement, tower /
      // Avatar / skill cooldowns and slow decay together — never spawn-only.
      const step = stepDefendLive(
        current,
        DEFEND_TICK_MS * speedRef.current,
        bucketsRef.current,
        avatar,
      );
      // Facing is owned by the walk loop (sticky E/W while moving); the ticker
      // turns toward the puff it just hit and plays the Pestilence Wave clip if
      // the clip ladder allows it. The damage/cooldown is already applied by
      // `stepDefendLive` above — a refused clip changes nothing but the art, so
      // a Root Veil cast keeps playing while the Avatar keeps hitting.
      if (step.state.avatarCooldownMs > current.avatarCooldownMs + 1 && aimed) {
        const aimLen = Math.max(1, Math.hypot(aimed.dx, aimed.dy));
        avatarFaceRef.current = skinWalkFace(aimed.dx / aimLen, avatarFaceRef.current);
        startAvatarOnce('attack');
      }
      // §19 entity presenter: towers turn toward their target every tick, and
      // the tick a tower actually fires (its cooldown was reset) spawns a shot
      // FX toward that same target. Display only — the engine already applied
      // the damage; nothing here changes combat math.
      const mapNow = BOARD_MAPS[current.boardId] ?? BOARD_MAPS.ato;
      for (const puff of step.state.puffs) {
        // Creeps face along the road: the path tangent at their progress. A
        // degenerate heading (nearly stopped / path corner case) keeps the last
        // facing so the sprite never snaps to a default.
        const head = puffHeading(puff.dist, mapNow);
        if (head) {
          puffFacingRef.current[puff.id] = facingDegrees(head.dx, head.dy);
          // Humanoid path walkers also track a sticky east/west side profile:
          // the tangent on a vertical lane carries no useful |dx|, so the sprite
          // keeps the face it was already showing instead of snapping to a
          // north/south rotation (which is what the 4-dir clips would pick).
          puffWalkFaceRef.current[puff.id] = skinWalkFace(
            head.dx,
            puffWalkFaceRef.current[puff.id] ?? 'e',
          );
        }
      }
      for (const tower of current.towers) {
        const target = towerTarget(tower, current.puffs, mapNow);
        const pad = mapNow.pads[tower.pad];
        if (!target) continue;
        // Same lane clamp the creep is drawn with, so the shot FX and the
        // tower's aim land on the sprite instead of beside it.
        const tpos = creepDrawPosition(target, mapNow, creepLaneHalfFor(target));
        const tx = tpos.x * 100;
        const ty = tpos.y * 100;
        towerFacingRef.current[tower.id] = aimDegrees(pad.x, pad.y, tx, ty);
        // K1 — sticky side profile toward the shot, reused for the clip kit's
        // idle/attack art. `skinWalkFace` on the normalized aim dx flips the
        // face east/west and keeps the last face through a near-vertical aim.
        const aimLen = Math.max(1, Math.hypot(tx - pad.x, ty - pad.y));
        towerFaceRef.current[tower.id] = skinWalkFace(
          (tx - pad.x) / aimLen,
          towerFaceRef.current[tower.id] ?? 'e',
        );
        const after = step.state.towers.find((t) => t.id === tower.id);
        const fired = after != null && after.cooldownMs > tower.cooldownMs + 1;
        if (fired) {
          startTowerOnce('attack', tower.id, towerKitRole(tower.kind));
        }
        // K1b — the auto-skill cast: the engine reset `skillCooldownMs`, so a
        // skill one-shot plays (if the skin authors it); the tower's face is
        // already set toward the target above. Skill outranks attack in the
        // clip ladder, so a same-tick shot keeps its FX but skips its clip.
        const skillCast = after != null && after.skillCooldownMs > tower.skillCooldownMs + 1;
        if (skillCast) {
          startTowerOnce('skill', tower.id, towerKitRole(tower.kind));
        }
      }
      // A6 — a hero bound as a tower (and a cycle boss mapped to a hero, e.g.
      // Ember Sovereign → Archangel): same shot FX + clip triggers as a tower,
      // but resolved through the hero's own tower kit (`resolveBoundHeroTowerKit`)
      // and targeted by `heroTowerTarget`. A cycle boss with no hero art mapped
      // keeps its placeholder and no FX.
      for (const bb of current.boundBosses) {
        const heroId = boundBossHeroId(bb.bossId);
        if (!heroId) continue;
        const kitRole = resolveBoundHeroTowerKit(heroId);
        const target = heroTowerTarget(bb, current.puffs, mapNow);
        const pad = mapNow.pads[bb.pad];
        if (!target) continue;
        const tpos = creepDrawPosition(target, mapNow, creepLaneHalfFor(target));
        const tx = tpos.x * 100;
        const ty = tpos.y * 100;
        const aimLen = Math.max(1, Math.hypot(tx - pad.x, ty - pad.y));
        towerFaceRef.current[bb.id] = skinWalkFace(
          (tx - pad.x) / aimLen,
          towerFaceRef.current[bb.id] ?? 'e',
        );
        const after = step.state.boundBosses.find((b) => b.id === bb.id);
        const fired = after != null && after.cooldownMs > bb.cooldownMs + 1;
        if (fired) {
          // Hero towers draw from the engine's kit hits; the cycle boss has
          // no kit, so it keeps the old shot sprite.
          if (!isHeroBoundTower(bb.bossId) && fxQualityRef.current !== 'off') {
            spawnShot(pad.x, pad.y, tx, ty);
          }
          startTowerOnce('attack', bb.id, kitRole);
        }
        const skillCast = after != null && after.skillCooldownMs > bb.skillCooldownMs + 1;
        if (skillCast) {
          startTowerOnce('skill', bb.id, kitRole);
        }
      }
      // P5b Turf helper: glide to the sim's new spot over one tick on the UI thread (no React render
      // for movement), face its target / its walk, attack / skill one-shots on the tick the engine fired,
      // and the daze: the faint starts the tick a boss swing landed, the get-up when it stands.
      for (const after of step.state.helpers) {
        const h = current.helpers.find((u) => u.id === after.id);
        const glide = { duration: DEFEND_TICK_MS, easing: Easing.linear };
        helperX.value = withTiming(after.x / 100, glide);
        helperY.value = withTiming(after.y / 100, glide);
        helperPosRef.current = { x: after.x, y: after.y };
        if (!h) continue;
        if (step.dazed.includes(after.id)) {
          helperKoAtRef.current[after.id] = Date.now();
          notify({ kind: 'notify', title: `${heroName(after.heroId)} is dazed`, body: 'Back in 4 s', dedupeKey: `turf-daze-${after.id}` });
          continue;
        }
        if (step.gotUp.includes(after.id)) helperUpAtRef.current[after.id] = Date.now();
        if (after.dazedMs > 0 || after.getUpMs > 0) continue;
        const kitRole = turfHelperRole(after.heroId);
        if (step.helperCasts.includes(after.id)) startTowerOnce('skill', after.id, kitRole);
        const target = helperTarget(after, current.puffs, mapNow);
        if (target) {
          const tpos = creepDrawPosition(target, mapNow, creepLaneHalfFor(target));
          const dx = tpos.x * 100 - after.x;
          towerFaceRef.current[after.id] = skinWalkFace(dx / Math.max(1, Math.abs(dx)), towerFaceRef.current[after.id] ?? 'e');
        } else if (after.moving) {
          towerFaceRef.current[after.id] = after.face;
        }
        if (after.cooldownMs > h.cooldownMs + 1) startTowerOnce('attack', after.id, kitRole);
      }
      // EFFECTS_PLAN step 5 — draw every kit hit the engine reported, from the
      // same lane-clamped positions the creeps are drawn at (a creep killed
      // this tick is only in the pre-step list). Effects Quality Off draws no
      // shots or effects; the coloured damage numbers below still show.
      const drawnPos = new Map<number, FxPoint>();
      for (const p of [...current.puffs, ...step.state.puffs]) {
        const pos = creepDrawPosition(p, mapNow, creepLaneHalfFor(p));
        drawnPos.set(p.id, { x: pos.x * 100, y: pos.y * 100 });
      }
      if (fxQualityRef.current !== 'off') {
        for (const hit of step.hits) spawnHitFx(hit, drawnPos);
        // A legendary helper's splash: its own element-coloured ring (display only, no hit stop).
        for (const hit of step.splashHits) spawnHitFx(hit, drawnPos);
      }
      // §9m boss warn: peek the remaining schedule and raise the warn ONCE, a
      // beat before the boss steps in (or the tick it lands, if the lead was
      // skipped by a big dt). Display only — the sim keeps running under it, so
      // towers still fire through the warning. T6: the words go to the
      // NoticeLane (same words as the old in-stage pill; no banner in the stage).
      // Copy: "BOSS INCOMING" — never "BOUND BOSS" (that names the player-owned
      // Bound Boss tower).
      const bandNow = step.state.band;
      if (bandNow && !bossWarnedRef.current) {
        const nextBoss = step.state.schedule.find((event) => event.role === 'boss');
        const imminent =
          nextBoss != null && nextBoss.tMs - step.state.elapsedMs <= BOSS_WARN_LEAD_MS;
        if (imminent || step.bossSpawned) {
          bossWarnedRef.current = true;
          notify({ kind: 'notify', title: 'BOSS INCOMING', body: `${bandNow.label} — ${bandNow.boss.name}`, dedupeKey: 'turf-boss-incoming', priority: 'high', important: true });
          if (streetRef.current) alertHaptic();
        }
      }
      // T6 boss effects (display only). The spawn point = the path start, kept a cell inside the board edge.
      const bossLayer = streetRef.current ? combatFxRef.current : null;
      const bossFlagsNow = bossFlagsRef.current;
      const start = mapNow.path[0];
      const edgeHalf = 100 / 32;
      const spawnX = Math.min(100 - edgeHalf, Math.max(2 * edgeHalf, (start?.x ?? 0) * 100));
      const spawnY = Math.min(100 - 2 * edgeHalf, Math.max(edgeHalf, (start?.y ?? 0) * 100));
      // Entrance: the sigil + light column at the spawn as the boss steps in.
      if (step.bossSpawned && bossLayer && bossFlagsNow.summon) bossLayer.summon(spawnX, spawnY, bossFlagsNow.summon);
      // Enemy enrage telegraph: the red sigil charges at the spawn (the runners come out there) once the boss nears
      // its enrage line; it fades after the enrage fires or the boss is gone (never before its wind-up showed).
      const telegraphMode = bossFlagsNow.telegraph;
      const liveEnrage = new Set<string>();
      for (const p of step.state.puffs) {
        if (p.kind !== 'boss') continue;
        const key = `enrage-${p.id}`;
        if (enrageWarning(p.hp, p.maxHp, p.burstHpPct, p.burstFired)) {
          liveEnrage.add(key);
          if (!telegraphsRef.current.has(key) && bossLayer) {
            telegraphsRef.current.add(key);
            bossLayer.telegraph(key, 'enrage', spawnX, spawnY, 0, ENRAGE_WINDUP_MS, telegraphMode);
          }
        }
      }
      // Bound Boss echo skills (cycle-boss defs; a HERO bound as a tower fights with its kit, T5): the telegraph
      // starts so its wind-up is ≥ 600 ms at 1x and 2x, and ends the tick the skill fires (its cooldown resets).
      const liveSkill = new Set<string>();
      for (const bb of step.state.boundBosses) {
        const def = isHeroBoundTower(bb.bossId) ? undefined : getBoundBossDef(bb.bossId);
        const pad = mapNow.pads[bb.pad];
        if (!def || !pad) continue;
        const key = `skill-${bb.id}`;
        const before = current.boundBosses.find((b) => b.id === bb.id);
        const cast = before != null && bb.skillCooldownMs > before.skillCooldownMs + 1;
        if (cast) continue;
        liveSkill.add(key);
        const windUp = telegraphStart(telegraphsRef.current.has(key), bb.skillCooldownMs, DEFEND_TICK_MS, speedRef.current);
        if (windUp != null && bossLayer) {
          telegraphsRef.current.add(key);
          bossLayer.telegraph(key, def.skill.skill_id, pad.x, pad.y, def.skill.radius, windUp, telegraphMode);
        }
      }
      for (const key of [...telegraphsRef.current]) {
        if (liveEnrage.has(key) || liveSkill.has(key)) continue;
        telegraphsRef.current.delete(key);
        combatFxRef.current?.endTelegraph(key);
      }
      // Display-only floaters: any puff that lost HP this tick, or vanished
      // (killed), gets a short damage number near it. No engine changes.
      const hitColor = new Map<number, string>();
      for (const d of step.dotHits) if (d.element) hitColor.set(d.puffId, ELEMENT_COLOR[d.element]);
      // A legendary helper's splash victims take its element colour first; a real hit on the same creep wins.
      for (const hit of step.splashHits) {
        if (!hit.element) continue;
        for (const pid of hit.puffIds) hitColor.set(pid, ELEMENT_COLOR[hit.element]);
      }
      for (const hit of step.hits) {
        if (!hit.element) continue;
        for (const pid of hit.puffIds) hitColor.set(pid, ELEMENT_COLOR[hit.element]);
      }
      const events = diffPuffEvents(
        prevPuffsRef.current,
        step.state.puffs,
        step.state.boardId,
        hitColor,
      );
      if (events.length > 0) spawnFloaters(events);
      const now = Date.now();
      // T5 combat effects (display only): a hit flash + a health-bar chip on every creep that lost HP, a death pop
      // for every creep that vanished (instead of its corpse, same 1.1 s), a hit stop when an ultimate killed one.
      const flags = combatFlagsRef.current;
      const fxLayer = streetRef.current ? combatFxRef.current : null;
      const before = new Map(prevPuffsRef.current.map((p) => [p.id, p]));
      const aliveIds = new Set(step.state.puffs.map((p) => p.id));
      for (const p of step.state.puffs) {
        const old = before.get(p.id);
        if (!old || p.hp >= old.hp) continue;
        const oldPct = Math.max(0, Math.min(1, old.hp / old.maxHp));
        const prevChip = hpChipRef.current.get(p.id);
        hpChipRef.current.set(p.id, nextChip(prevChip, chipValue(prevChip, oldPct, now), Math.max(0, Math.min(1, p.hp / p.maxHp)), now));
        const drawn = creepDrawRef.current.get(p.id);
        const lastFlash = flashAtRef.current.get(p.id) ?? -Infinity;
        if (flags.flash && fxLayer && drawn && now - lastFlash >= FLASH_COOLDOWN_MS) {
          flashAtRef.current.set(p.id, now);
          // T6: a boss flashes brighter and longer (BOSS_FLASH_MS); same allow rule and cooldown.
          fxLayer.flash(drawn.drawable, drawn.box, p.kind === 'boss');
        }
      }
      for (const id of [...hpChipRef.current.keys()]) if (!aliveIds.has(id)) hpChipRef.current.delete(id);
      for (const id of [...flashAtRef.current.keys()]) if (!aliveIds.has(id)) flashAtRef.current.delete(id);
      const popped = new Set<number>();
      let bossDied = false;
      for (const old of prevPuffsRef.current) {
        if (aliveIds.has(old.id)) continue;
        const drawn = creepDrawRef.current.get(old.id);
        if (!drawn) continue;
        const bodyX = drawn.box.x + drawn.box.size / 2;
        const bodyY = drawn.box.y + drawn.box.size * 0.55;
        // T6: a boss that died (not leaked) gets the boss blast instead of the pop (Off: its corpse, as before).
        if (old.kind === 'boss' && !step.leak) {
          bossDied = true;
          if (bossFlagsNow.death && fxLayer) {
            fxLayer.bossDeath(bodyX, bodyY, bossFlagsNow.death);
            popped.add(old.id);
          }
          continue;
        }
        if (flags.pop && fxLayer) {
          fxLayer.pop(bodyX, bodyY);
          popped.add(old.id);
        }
      }
      // T6 boss death: a small board shake (stage content only) + the 60 ms hit stop, when allowed.
      if (bossDied && streetRef.current) {
        if (bossFlagsNow.shake) shakeBoard('bossDeath');
        if (bossFlagsNow.hitStop) setHitStop(true);
      }
      // T7: the leaker (the creep furthest along the road on a leak tick — the engine may keep it in the list) keeps
      // its last drawn sprite for the replay.
      let leakDraw: { drawable: ClipDrawable; box: { x: number; y: number; size: number } } | undefined;
      if (step.leak) {
        let leaker: Puff | undefined;
        for (const old of [...prevPuffsRef.current, ...step.state.puffs]) if (!leaker || old.dist > leaker.dist) leaker = old;
        leakDraw = leaker ? creepDrawRef.current.get(leaker.id) : undefined;
      }
      for (const id of [...creepDrawRef.current.keys()]) if (!aliveIds.has(id)) creepDrawRef.current.delete(id);
      if (flags.hitStop && !step.leak) {
        const ultimateKill = step.hits.some((hit) => hit.ultimate && hit.puffIds.some((pid) => before.has(pid) && !aliveIds.has(pid)));
        if (ultimateKill) setHitStop(true);
      }
      // K2 death one-shots: the same vanished puffs, kept as corpses by the
      // board for a beat (the engine has already dropped them). Roles with no
      // death art leave nothing, so their removal stays the only tell. A creep
      // that got the T5 death pop leaves no corpse.
      const deadCreeps = newCreepCorpses(
        prevPuffsRef.current,
        step.state.puffs,
        step.state.boardId,
        step.state.band?.kind,
        puffWalkFaceRef.current,
        now,
      ).filter((corpse) => !popped.has(corpse.id));
      if (deadCreeps.length > 0) {
        setCorpses((prev) => [
          ...prev.filter((corpse) => now - corpse.bornAt < CREEP_CORPSE_MS),
          ...deadCreeps,
        ]);
      }
      prevPuffsRef.current = step.state.puffs;
      simRef.current = step.state;
      setSim(step.state);
      if (step.leak && !godModeRef.current) {
        // T5 leak hit: a red ring at the path end + a small board shake (stage content only). The run ends exactly as before.
        const exit = mapNow.path[mapNow.path.length - 1];
        // Centred in the exit cell (the path ends on the board edge; a ring there would be half clipped).
        // T7 lose beat: the leaker's ghost walks its last cells again, then the same ring (the replay draws it).
        const replayMode = beatFlagsRef.current.replay;
        if (fxLayer && replayMode) {
          fxLayer.leakReplay(leakReplayPath(mapNow.path), leakDraw?.drawable ?? null, leakDraw?.box.size ?? 8, replayMode);
          holdResult(LOSE_BEAT_MS);
        } else if (exit && fxLayer && flags.leakPulse) {
          const half = 100 / 32;
          fxLayer.leak(Math.min(100 - half, Math.max(half, exit.x * 100)), Math.min(100 - half, Math.max(half, exit.y * 100)), calmRef.current);
        }
        if (flags.shake && streetRef.current) shakeBoard();
        if (!leakNotedRef.current) {
          leakNotedRef.current = true;
          onLeakRef.current();
        }
        setPhase('lost');
        setPaused(false);
        setSelectedPad(null);
        for (const key of telegraphsRef.current) combatFxRef.current?.endTelegraph(key);
        telegraphsRef.current.clear();
        return;
      }
      if (step.done) {
        for (const key of telegraphsRef.current) combatFxRef.current?.endTelegraph(key);
        telegraphsRef.current.clear();
        // T6: the boss was the last one down — the won card waits for its blast (display only; the win is paid now).
        if (bossDied && bossFlagsNow.death && fxLayer) holdResult(BOSS_DEATH_MS);
        // T7 wave clear + win: the portal closes at the exit, sparks pop over every tower; the card waits for them.
        const beats = beatFlagsRef.current;
        if (fxLayer && beats.clear) {
          const exitPt = mapNow.path[mapNow.path.length - 1];
          if (exitPt) {
            const at = portalPoint(exitPt);
            fxLayer.portal(at.x, at.y, beats.clear, true);
            holdResult(WAVE_CLEAR_MS);
          }
        }
        if (fxLayer && beats.sparks) {
          const over = [...step.state.towers.map((t) => mapNow.pads[t.pad]), ...step.state.boundBosses.map((b) => mapNow.pads[b.pad])]
            .filter((pad): pad is NonNullable<typeof pad> => pad != null)
            .filter((_, i) => i % beats.sparkEvery === 0)
            .slice(0, WIN_SPARK_MAX)
            .map(sparkPoint);
          if (over.length > 0) {
            fxLayer.sparks(over, beats.sparks);
            holdResult(winBeatMs(over.length));
          }
        }
        winWave();
      }
    }, DEFEND_TICK_MS);
    return () => clearInterval(id);
  }, [phase, paused, hitStop, winWave, spawnFloaters, spawnHitFx, spawnShot, startAvatarOnce, startTowerOnce, shakeBoard, holdResult, helperX, helperY]);

  // Run fail → play the Avatar's HURT clip once (art only; the lost overlay is
  // already showing). Catches the leak path and the dev "force leak" button.
  useEffect(() => {
    if (phase === 'lost') startAvatarOnce('hurt');
  }, [phase, startAvatarOnce]);

  // Background → freeze the wave.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phaseRef.current === 'running' && !pausedRef.current) {
        setPaused(true);
      }
    });
    return () => sub.remove();
  }, []);

  // Slice A2 — the hero sheet is shown from a LOCAL copy of the queued offer,
  // not straight off `view.heroOffer`. Every action clears the save's queue
  // (that is what makes the offer one-shot), so rendering the sheet off the
  // queue directly would unmount it the instant the player acted — before it
  // could confirm what happened. The local copy is dropped only when the sheet
  // itself closes (Later / Done), and a NEW offer re-seeds it.
  useEffect(() => {
    if (view.heroOffer) setHeroSheetOffer(view.heroOffer);
  }, [view.heroOffer]);
  const closeHeroSheet = useCallback(() => {
    setHeroSheetOffer(null);
    onDismissHeroOffer();
  }, [onDismissHeroOffer]);

  /** Slice A2.5 — leave for the Dress Hero roster. The offer is dismissed on
   * the way out: the player is going to the surface that owns this choice, so
   * a re-run of the sheet on their return would be noise. */
  const openDressFromSheet = useCallback(() => {
    setHeroSheetOffer(null);
    onDismissHeroOffer();
    onOpenDress();
  }, [onDismissHeroOffer, onOpenDress]);

  const selectedTower =
    sim && selectedPad != null
      ? sim.towers.find((tower) => tower.pad === selectedPad) ?? null
      : null;
  const selectedBoundBoss =
    sim && selectedPad != null
      ? sim.boundBosses.find((bb) => bb.pad === selectedPad) ?? null
      : null;
  /** Range-ring look (EFFECTS_PLAN step 6): the selected attacker's element
   * colour (neutral / empty pad = accent); a Pull kit also gets a faint filled
   * core so its short reach reads as a zone. */
  const selectedKit = selectedTower
    ? TOWER_KITS[selectedTower.kind]
    : selectedBoundBoss
      ? (heroById(selectedBoundBoss.bossId)?.kit ?? null)
      : null;
  const selectedRing = {
    color: selectedKit?.element ? ELEMENT_COLOR[selectedKit.element] : theme.accent,
    pull: selectedKit?.behavior === 'pull',
  };
  /** Unlocked Bound Bosses (stars ≥ 1) the player can place — the cycle boss
   * (a `bound_bosses.json` def) AND any HERO bound as a tower (A6, `heroById`
   * resolves). A hero tower costs 40 scrap (step 6) and draws its own idle/attack/skill
   * clips via `resolveBoundHeroTowerKit`. */
  const unlockedBoundBosses = view.boundBosses.filter(
    (bb) => bb.unlocked && (getBoundBossDef(bb.id) != null || isHeroBoundTower(bb.id)),
  );
  allowedBossesRef.current = new Map(unlockedBoundBosses.map((bb) => [bb.id, bb.stars]));
  const boundBossCount = sim?.boundBosses.length ?? 0;
  /** Board tower cap reached — pads stay open but no more towers can deploy. */
  const atTowerCap = (sim?.towers.length ?? 0) >= towerCap();
  /** Tower count label — `n/6`, or just `n` under the dev "No caps" switch. */
  const towerCountLabel = Number.isFinite(towerCap())
    ? `${sim?.towers.length ?? 0}/${MAX_TOWERS}`
    : `${sim?.towers.length ?? 0}`;
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
    setPlacePreview(null);
    setSim((prev) => {
      const next = prev ? placeTower(prev, selectedPad, kind) ?? prev : prev;
      if (next !== prev) commitBoard(next);
      return next;
    });
  };

  const placeOnBoundBoss = (bossId: string, stars: number) => {
    if (selectedPad == null) return;
    const prev = simRef.current;
    if (!prev) return;
    const next = placeBoundBoss(prev, selectedPad, bossId, stars);
    if (!next) {
      setPlacePreview(null);
      return;
    }
    setPlacePreview(null);
    commitBoard(next);
    // A6 — seed the bound boss's clip player the moment it lands so its idle
    // loop breathes from frame 0 (hero tower OR a cycle boss mapped to a hero).
    if (boundBossHeroId(bossId)) {
      const placed = next.boundBosses.find((b) => b.pad === selectedPad && b.bossId === bossId);
      if (placed) {
        towerAnimRef.current[placed.id] = castActorCreate('tower', castActorIdleSeed(placed.id, 'tower'));
        towerFaceRef.current[placed.id] = 'e';
      }
    }
    simRef.current = next;
    setSim(next);
  };

  /** Sell / remove the selected Bound Boss: frees the pad, keeps the hero (or
   * cycle boss) OWNED + BOUND in playStore — the run's placed tower only. */
  const removeSelectedBoundBoss = () => {
    if (!selectedBoundBoss) return;
    setSim((prev) => {
      const next = prev ? removeBoundBoss(prev, selectedBoundBoss.id) ?? prev : prev;
      if (next !== prev) commitBoard(next);
      return next;
    });
  };

  /** Dev kit only (A6 smoke): place the first bound hero (or the cycle boss if
   * no hero is bound) on the next free pad, without hand-tapping a pad. No-op
   * when nothing is placeable or the board has no free pad. */
  const devPlaceBoundOnNextFreePad = () => {
    const current = simRef.current;
    if (!current) return;
    const candidate =
      unlockedBoundBosses.find((bb) => isHeroBoundTower(bb.id)) ?? unlockedBoundBosses[0];
    if (!candidate) return;
    const occupied = new Set([
      ...current.towers.map((t) => t.pad),
      ...current.boundBosses.map((b) => b.pad),
    ]);
    const pad = boardMap.pads.findIndex((_, index) => !occupied.has(index));
    if (pad < 0) return;
    const next = placeBoundBoss(current, pad, candidate.id, candidate.stars);
    if (next) {
      if (boundBossHeroId(candidate.id)) {
        const placed = next.boundBosses.find((b) => b.pad === pad && b.bossId === candidate.id);
        if (placed) {
          towerAnimRef.current[placed.id] = castActorCreate('tower', castActorIdleSeed(placed.id, 'tower'));
          towerFaceRef.current[placed.id] = 'e';
        }
      }
      commitBoard(next);
      simRef.current = next;
      setSim(next);
    }
  };

  /** Dev kit only: park the seat at the Final band and start the run with the
   * boss event due immediately (escort dropped) so the boss beat previews in
   * under a second instead of after the full escort stream. */
  const previewBossBeat = () => {
    onForceFinal();
    setReplayPick(null);
    const base = createDefendLive(MAIN_WAVE_COUNT, {
      mapId: 'main',
      boardId: 'ato',
      cyclePower: view.cyclePower,
      tint: view.cycleTint,
    });
    // Carry any placed board into the preview so the boss is fightable, and
    // collapse the schedule to just the boss event, due on the next tick.
    const bossEvents = base.schedule.filter((event) => event.role === 'boss').map(
      (event) => ({ ...event, tMs: 0 }),
    );
    const current = simRef.current;
    resetHelperClocks();
    const preview: DefendLive = placeTurfTeam(
      {
        ...base,
        towers: current?.towers ?? [],
        boundBosses: current?.boundBosses ?? [],
        scrap: current?.scrap ?? base.scrap,
        schedule: bossEvents,
        elapsedMs: 0,
        puffs: [],
      },
      helperSpecsFor(BOARD_MAPS.ato),
      view.turfTeam.leaderGrade,
    );
    simRef.current = preview;
    setSim(preview);
    ensureParked('main');
    winPaidRef.current = false;
    leakNotedRef.current = false;
    claimKeyRef.current = `defend:main:${preview.wave}:preview:${Date.now()}`;
    setPhase('running');
    setPaused(false);
    setSelectedPad(null);
    prevPuffsRef.current = [];
    setFloaters([]);
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
    combatFxRef.current?.clear();
    telegraphsRef.current.clear();
    bossWarnedRef.current = false; // re-arm the warn for this preview run
  };

  const upgradeSelected = () => {
    if (!selectedTower) return;
    setSim((prev) => {
      const next = prev ? upgradeTower(prev, selectedTower.id) ?? prev : prev;
      if (next !== prev) commitBoard(next);
      return next;
    });
  };

  const castSkill = () => {
    const current = simRef.current;
    if (!current) return;
    const avatar = avatarPosRef.current;
    const next = castSlowPulse(current, avatar, activeSkill);
    if (next) {
      simRef.current = next;
      setSim(next);
      // Art only — the veil numbers are already applied by castSlowPulse.
      // skill (4) outranks attack (3), so this correctly cuts an attack clip.
      startAvatarOnce('skill');
    }
  };

  /** Pet pounce (v20): once per wave, foes near the Avatar. Not spent when
   * none are in reach (the engine refuses). */
  const castPounce = () => {
    const current = simRef.current;
    if (!current) return;
    const cast = castPetPounce(
      current,
      avatarPosRef.current,
      view.pet.pounceBase,
      view.pet.aura ?? view.legendElement,
    );
    if (!cast) return;
    if (fxQualityRef.current !== 'off') {
      const mapNow = BOARD_MAPS[current.boardId] ?? BOARD_MAPS.ato;
      const drawnPos = new Map<number, FxPoint>();
      for (const p of current.puffs) {
        const pos = creepDrawPosition(p, mapNow, creepLaneHalfFor(p));
        drawnPos.set(p.id, { x: pos.x * 100, y: pos.y * 100 });
      }
      spawnHitFx(cast.hit, drawnPos);
    }
    simRef.current = cast.state;
    setSim(cast.state);
  };
  const pounceAvailable = view.pet.pounceBase > 0;
  // v26 Pumped (Train Gold): ×N waves left, or a "Maxed aura" when the cap
  // leaves it nothing to add (then it glows and spends no uses).
  const pumpedOn = view.pet.buffs.pumped > 0 && pounceAvailable;
  const pumpedLabel = !pumpedOn
    ? ''
    : view.pet.pumped.maxed
      ? ' · ✨ Maxed aura'
      : ` · 💪 Pumped ×${view.pet.buffs.pumped}`;
  // P5: a rare on the team adds a spare pounce for the fight.
  const pounceReady = pounceAvailable && sim != null && (!sim.petPounceUsed || sim.petPounceSpare > 0);

  /** P5b — put a pet in the helper slot (it follows the leader) or empty it. The save keeps the v33
   * pick shape; the spot written is just where it stands now (unused — it always follows). */
  const pickHelper = (uid: number | null) => {
    if (uid == null) {
      onSaveTurfHelpers([]);
      return;
    }
    const spot = helperFollowSpot(boardMap, avatarPosRef.current);
    helperPosRef.current = spot;
    helperX.value = spot.x / 100;
    helperY.value = spot.y / 100;
    onSaveTurfHelpers([{ uid, x: spot.x, y: spot.y }]);
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

  /**
   * Click-to-move: walk the Avatar toward `moveTargetRef` at a fixed board
   * speed; on arrival, snap exactly onto the target, stop, and persist the park
   * (the same store the old drag wrote). Runs in setup AND live, and freezes
   * while paused. Facing is a sticky E/W side profile (the Corvus art is 2-dir);
   * the walk clip carries the motion.
   */
  useEffect(() => {
    // P5b — in SETUP the helper walks after the leader on this same tick (its follow spot, off the road),
    // writing its shared values like the leader's; in a wave the sim owns it (see the sim ticker).
    const stepSetupHelper = () => {
      if (phaseRef.current !== 'setup' || pausedRef.current || helperPicksRef.current.length === 0) {
        helperSetupMovingRef.current = false;
        return;
      }
      const cur = helperPosRef.current;
      const goal = helperFollowSpot(boardMap, avatarPosRef.current);
      const next = stepHelperToward(cur, goal, HELPER_MOVE_SPEED, MOVE_TICK_MS);
      helperSetupMovingRef.current = next.moved > 0.01;
      if (!helperSetupMovingRef.current) return;
      helperSetupFaceRef.current = skinWalkFace(next.x - cur.x, helperSetupFaceRef.current);
      helperPosRef.current = { x: next.x, y: next.y };
      helperX.value = next.x / 100;
      helperY.value = next.y / 100;
    };
    const id = setInterval(() => {
      stepSetupHelper();
      const target = moveTargetRef.current;
      if (!target || pausedRef.current) {
        if (movingRef.current) {
          movingRef.current = false;
        }
        return;
      }
      const cur = avatarPosRef.current;
      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      const dist = Math.hypot(dx, dy);
      const stepLen = AVATAR_WALK_UNITS_PER_SEC * (MOVE_TICK_MS / 1000);
      if (dist <= stepLen) {
        // Arrived: land exactly on the target, idle, persist the new park.
        avatarPosRef.current = { x: target.x, y: target.y };
        avatarX.value = target.x / 100;
        avatarY.value = target.y / 100;
        moveTargetRef.current = null;
        movingRef.current = false;
        commitAvatarPark();
        return;
      }
      const nx = cur.x + (dx / dist) * stepLen;
      const ny = cur.y + (dy / dist) * stepLen;
      avatarPosRef.current = { x: nx, y: ny };
      avatarX.value = nx / 100;
      avatarY.value = ny / 100;
      // Sticky E/W side profile: follow the sign of dx, keep the last face
      // through a near-vertical step.
      avatarFaceRef.current = skinWalkFace(dx / dist, avatarFaceRef.current);
      movingRef.current = true;
    }, MOVE_TICK_MS);
    return () => clearInterval(id);
  }, [
    commitAvatarPark,
    avatarX,
    avatarY,
    boardMap,
    helperX,
    helperY,
  ]);

  /**
   * One tap on the board. Pads win (they open the tower UI, the old `onPress`);
   * an empty-board tap sets a walk target. HUD / tower panels live OUTSIDE the
   * board view, so their taps never reach here.
   */
  const handleBoardTap = useCallback(
    (locationX: number, locationY: number) => {
      const size = boardSizeRef.current || 100;
      const bx = (locationX / size) * 100;
      const by = (locationY / size) * 100;
      let hit: number | null = null;
      let bestDist = Infinity;
      const padRadius = padTapRadiusUnits(size);
      boardMap.pads.forEach((pad, index) => {
        const d = Math.hypot(pad.x - bx, pad.y - by);
        if (d <= padRadius && d < bestDist) {
          bestDist = d;
          hit = index;
        }
      });
      // Pads only take taps in SETUP (emci, 2026-09-26): once a wave runs (and
      // on the result screens), every board tap moves the Avatar, so a move
      // that lands near a pad can never open it by accident.
      if (hit != null && phaseRef.current === 'setup') {
        setSelectedPad((prev) => (prev === hit ? null : hit));
        return;
      }
      // An open build card closes on an empty-board tap (and that tap does not also walk the Avatar).
      if (selectedPadRef.current != null && phaseRef.current === 'setup') {
        setPlacePreview(null);
        setSelectedPad(null);
        return;
      }
      const target = {
        x: Math.max(0, Math.min(100, bx)),
        y: Math.max(0, Math.min(100, by)),
      };
      moveTargetRef.current = target;
      // Shadow Dash: a short burst clip for the first beat of the move, turned
      // toward the destination.
      const ddx = target.x - avatarPosRef.current.x;
      const ddy = target.y - avatarPosRef.current.y;
      avatarFaceRef.current = skinWalkFace(
        ddx / Math.max(1, Math.hypot(ddx, ddy)),
        avatarFaceRef.current,
      );
      // Refused while a skill/hurt is locked in (dash is lower priority) — the
      // walk itself is unaffected, only the burst clip is skipped.
      startAvatarOnce('dash');
    },
    [boardMap, startAvatarOnce],
  );

  /** Avatar range preview under the finger (before release). Skipped for a
   * press that will open a pad (setup only), throttled to ~20/s so a drag
   * doesn't re-render the board on every touch event. */
  const aimAvatarPreview = useCallback(
    (locationX: number, locationY: number, first: boolean) => {
      const now = Date.now();
      if (!first && now - avatarAimAtRef.current < 50) return;
      avatarAimAtRef.current = now;
      const size = boardSizeRef.current || 100;
      const bx = Math.max(0, Math.min(100, (locationX / size) * 100));
      const by = Math.max(0, Math.min(100, (locationY / size) * 100));
      if (phaseRef.current === 'setup') {
        const padRadius = padTapRadiusUnits(size);
        const onPad = boardMap.pads.some((pad) => Math.hypot(pad.x - bx, pad.y - by) <= padRadius);
        if (onPad) {
          setAvatarAim(null);
          return;
        }
      }
      setAvatarAim({ x: bx, y: by });
    },
    [boardMap],
  );

  const avatarFootAt = roleFootAt(avatarRole);
  const equippedSword = view.swords.equipped;
  const swordFx = equippedSword ? swordRuntime(equippedSword.element, equippedSword.tier) : null;
  const auraRadius = swordFx?.auraRadius ?? 0;
  const swordAuraStyle = useAnimatedStyle(() => {
    const size = boardSize.value || 100;
    const diameter = (auraRadius / 100) * size * 2;
    return {
      width: diameter,
      height: diameter,
      borderRadius: diameter / 2,
      left: avatarX.value * size - diameter / 2,
      top: avatarY.value * size - diameter / 2,
    };
  }, [auraRadius]);
  const avatarStyle = useAnimatedStyle(() => {
    // Read the SHARED board size (reactive) so the sprite scales with the board.
    // The box is feet-pivoted (`avatarFootAt`) so the Avatar's feet land on the
    // Avatar point instead of floating a quarter-box above it.
    const size = boardSize.value || 100;
    const box = Math.max(AVATAR_MIN_PX, size * AVATAR_ART_FRAC);
    return {
      width: box,
      height: box,
      left: avatarX.value * size - box / 2,
      top: avatarY.value * size - box * avatarFootAt,
    };
  }, [avatarFootAt]);

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

  // A3 Avatar: the ACTIVE hero's cast role (idle loop / walk / attack / skill /
  // hurt / dash clips, sticky E/W) resolved via `avatarRole`. The frame comes
  // from the shared CastActor (`castActorFrame` — same math the anim tick
  // uses); the face is the sticky side profile. Fails back to the static
  // rotation when a clip frame (or the whole clip) isn't authored.
  // P5b: who the board draws as the helper right now — the pick in setup (walking after the leader in
  // the move loop), the sim's unit in a wave. Its position is drawn from the shared values, not this.
  const helperDraw: HelperDraw[] =
    phase === 'setup'
      ? helperPicks.flatMap((pick, slot) => {
          const pet = view.turfTeam.candidates.find((c) => c.uid === pick.uid);
          if (!pet) return [];
          const at = helperPosRef.current;
          return [{
            id: helperUnitId(slot),
            slot,
            heroId: pet.heroId,
            x: at.x,
            y: at.y,
            dazed: false,
            gettingUp: false,
            moving: helperSetupMovingRef.current,
            face: helperSetupFaceRef.current,
          }];
        })
      : (sim?.helpers ?? []).map((h) => ({
          id: h.id,
          slot: h.slot,
          heroId: h.heroId,
          x: h.x,
          y: h.y,
          dazed: h.dazedMs > 0,
          gettingUp: h.getUpMs > 0,
          moving: h.moving,
          face: towerFaceRef.current[h.id] ?? h.face,
        }));
  helperDrawRef.current = helperDraw;
  const helperNow = helperDraw[0] ?? null;
  const helperRoleNow = helperNow ? turfHelperRole(helperNow.heroId) : null;
  const helperDrawable: ClipDrawable | undefined =
    helperNow && helperRoleNow
      ? helperPoseDrawable(
          helperNow,
          helperRoleNow,
          helperPose(
            helperNow,
            Date.now(),
            towerAnimRef.current,
            helperKoAtRef.current,
            helperUpAtRef.current,
            helperWalkAtRef.current,
            HELPER_GET_UP_MS / Math.max(1, speedRef.current),
          ),
        ) ?? roleArtDrawable(helperRoleNow, roleFaceArtIndex(helperRoleNow, helperNow.face))
      : undefined;
  const helperFootAt = roleFootAt(helperRoleNow ?? undefined);
  const helperBoxUnits = helperRoleNow
    ? Math.min(helperRoleNow.units ?? HELPER_DRAW_UNITS, HELPER_DRAW_UNITS) * TOWER_DRAW_SCALE
    : HELPER_DRAW_UNITS * TOWER_DRAW_SCALE;
  const helperStyle = useAnimatedStyle(() => {
    const size = boardSize.value || 100;
    const box = (helperBoxUnits / 100) * size;
    return {
      width: box,
      height: box,
      left: helperX.value * size - box / 2,
      top: helperY.value * size - box * helperFootAt,
    };
  }, [helperBoxUnits, helperFootAt]);

  const avatarAnim = avatarAnimRef.current;
  const avatarFrame = castActorFrame(avatarAnim, Date.now(), avatarRole);
  const avatarFace = avatarFaceRef.current;
  const avatarDrawable: ClipDrawable | undefined =
    castActorFrameDrawable(avatarAnim, avatarFace, avatarFrame, avatarRole) ??
    roleArtDrawable(avatarRole, roleFaceArtIndex(avatarRole, avatarFace));

  /** Drops card — one shared block, collapsed by default to a single neon
   * header row. On Main it renders just above Maps; Trial keeps its previous
   * slot so that setup order is unchanged. Rows are grouped for scan by real
   * data (uniques + item slots); nothing here changes odds or drop math. */
  const dropsCard = (
    <ThemedView type="backgroundElement" style={styles.card}>
      <Pressable
        onPress={() => setDropsOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: dropsOpen }}
        accessibilityLabel={dropsOpen ? 'Collapse drops' : 'Expand drops'}
        style={({ pressed }) => [styles.dropsHeaderRow, pressed && styles.pressed]}>
        <NeonLabel style={styles.dropsTitle}>Drops</NeonLabel>
        <View style={styles.dropsHeaderRight}>
          <NeonPill label={`${dropRows.length}`} />
          <MaterialCommunityIcons
            name={dropsOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.accent}
          />
        </View>
      </Pressable>
      {dropsOpen ? (
        <>
          {band && (band.kind === 'final' || cycleBossDef) ? (
            <View style={styles.dropsGroup}>
              <NeonLabel>Boss</NeonLabel>
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
            </View>
          ) : null}
          {dropGroups.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              No drops listed for this wave.
            </ThemedText>
          ) : (
            dropGroups.map((group) => (
              <View key={group.category} style={styles.dropsGroup}>
                <NeonLabel>{group.category}</NeonLabel>
                {group.rows.map((row, index) => (
                  <View key={row.id}>
                    {index > 0 ? <View style={styles.dropsHairline} /> : null}
                    <DropRowView
                      row={row}
                      ownedCount={view.ownedCounts[row.id] ?? 0}
                      ownedStar={view.ownedStars[row.id] ?? 0}
                    />
                  </View>
                ))}
              </View>
            ))
          )}
        </>
      ) : null}
    </ThemedView>
  );

  const live = phase === 'running';
  useEffect(() => {
    if (!live) setWavePeekOpen(false);
  }, [live]);

  // The board: square, fills the stage width, centred; same size and spot in setup and wave (turf-layout.ts).
  const boardSide = turfBoardSide(setupFrame.stage);
  // Pause menu (Resume · Leave): open while the wave is paused, hidden under the Leave confirm.
  const pauseMenuOpen = live && paused && !leaveConfirmOpen;

  /** Lost → Retry: the same wave, towers kept (unchanged logic, moved out of the JSX). */
  const retryLostRun = () => {
    if (!sim) return;
    setSim(() => {
      const fresh = {
        ...retryDefendLive(sim),
        scrap: Math.max(runStartScrapRef.current, KEPT_BOARD_MIN_SCRAP),
      };
      bankRestage(fresh);
      return fresh;
    });
    winPaidRef.current = false;
    leakNotedRef.current = false;
    resetHelperClocks(); // the retry stands the helper back up (retryDefendLive)
    claimKeyRef.current = `defend:${playedRef.current.phase}:${playedRef.current.wave}:retry:${Date.now()}`;
    setPhase('running');
    setPaused(false);
    setSelectedPad(null);
    prevPuffsRef.current = [];
    setFloaters([]);
    shotsRef.current = [];
    puffFacingRef.current = {};
    puffWalkFaceRef.current = {};
    setCorpses([]);
    setShots([]);
    combatFxRef.current?.clear();
    telegraphsRef.current.clear();
  };

  const closePadCard = () => {
    setPlacePreview(null);
    setSelectedPad(null);
  };

  /** The build card at the tapped pad (T2): build choices, the tower's upgrade, or the bound tower's Remove. */
  const padCard = (() => {
    if (selectedPad == null || !boardMap.pads[selectedPad]) return null;
    const pad = boardMap.pads[selectedPad];
    const common = {
      stage: { width: setupFrame.stage.width, height: setupFrame.stage.height, x: setupFrame.stage.x },
      stageTop: setupFrame.notice.height,
      pad,
      onClose: closePadCard,
      onPreviewEnd: () => setPlacePreview(null),
    };
    if (selectedTower) {
      const cost = selectedTower.level < TOWER_MAX_LEVEL ? towerUpgradeCost(selectedTower) : null;
      return (
        <TurfBuildCard
          key={`tower-${selectedPad}-${selectedTower.level}`}
          {...common}
          mode="tower"
          title={TOWER_DEFS[selectedTower.kind].name}
          level={selectedTower.level}
          maxLevel={TOWER_MAX_LEVEL}
          upgradeCost={cost}
          affordable={cost != null && scrap >= cost}
          onUpgrade={upgradeSelected}
        />
      );
    }
    if (selectedBoundBoss) {
      const hero = isHeroBoundTower(selectedBoundBoss.bossId);
      const bossDef = getBoundBossDef(selectedBoundBoss.bossId);
      const info = hero
        ? 'Bound hero tower — auto-attacks and casts its skill on cooldown. Remove frees the pad and keeps the hero bound.'
        : boundBossHeroId(selectedBoundBoss.bossId)
          ? `${heroName(boundBossHeroId(selectedBoundBoss.bossId)!)} kit — auto-attacks and casts its skill on cooldown. Remove frees the pad and keeps the boss bound.`
          : `Bound Boss — fixed on the pad, stars only (no scrap upgrade). ${bossDef?.skill.name}: ${bossDef?.skill.description}`;
      return (
        <TurfBuildCard
          key={`boss-${selectedPad}`}
          {...common}
          mode="boss"
          title={hero ? heroName(selectedBoundBoss.bossId) : `${bossDef?.name ?? 'Bound Boss'} ★${selectedBoundBoss.stars}`}
          info={info}
          onRemove={removeSelectedBoundBoss}
        />
      );
    }
    const choices: TurfChoice[] = (Object.keys(TOWER_DEFS) as TowerKind[]).map((kind) => {
      const def = TOWER_DEFS[kind];
      return {
        key: kind,
        name: def.name,
        detail: atTowerCap ? `max ${MAX_TOWERS}` : `${def.placeCost} scrap`,
        affordable: scrap >= def.placeCost && !atTowerCap,
        onArm: () => {
          const kit = TOWER_KITS[kind];
          setPlacePreview({
            range: def.range,
            color: kit.element ? ELEMENT_COLOR[kit.element] : theme.accent,
            pull: false,
          });
        },
        onBuy: () => placeOnPad(kind),
      };
    });
    for (const bb of unlockedBoundBosses) {
      const def = getBoundBossDef(bb.id);
      const hero = isHeroBoundTower(bb.id);
      const placeCost = hero ? HERO_TOWER_STATS.placeCost : def?.place_cost ?? 0;
      const atCap = boundBossCount >= boundBossCapOnBoard();
      choices.push({
        key: `boss-${bb.id}`,
        name: hero ? heroName(bb.id) : def?.name ?? bb.id,
        detail: `${hero ? `${placeCost} scrap` : `★${bb.stars} · ${placeCost} scrap`}${atCap ? ' · max 2' : ''}`,
        affordable: scrap >= placeCost && !atCap,
        onArm: () => {
          const heroKit = heroById(bb.id)?.kit;
          setPlacePreview({
            range: heroKit ? kitRange(heroKit, Math.max(1, Math.min(3, bb.stars))) : (def?.range ?? 18),
            color: heroKit ? ELEMENT_COLOR[heroKit.element] : theme.accent,
            pull: heroKit?.behavior === 'pull',
          });
        },
        onBuy: () => placeOnBoundBoss(bb.id, bb.stars),
      });
    }
    return (
      <TurfBuildCard
        key={`build-${selectedPad}`}
        {...common}
        mode="build"
        title={`Build a tower${atTowerCap ? ` · ${MAX_TOWERS}/${MAX_TOWERS} deployed` : ` · ${towerCountLabel}`}`}
        choices={choices}
      />
    );
  })();

  /** Won / lost result cards (copy and buttons as before; one primary button low on the card). */
  const resultCard = (() => {
    if (phase === 'won') {
      const played = playedRef.current;
      const lines = [`Avatar Lv ${view.avatarLevel} · ${view.lifetimeWavesCleared} waves cleared lifetime`];
      let badge: string | undefined;
      if (lastWin) {
        lines.push(
          `+${lastWin.tokensGranted} tokens · +${lastWin.shellsGranted} shells · +${lastWin.xpGranted} XP${
            lastWin.swordDrop ? ` · ${lastWin.swordDrop}` : ''
          }${lastWin.milestoneLook ? ` · ${ordinal(lastWin.milestoneLook.count)} clear — found a Rare Look!` : ''}`,
        );
        if (lastWin.catchupXp) badge = '×2.5 EXP · Trial catch-up';
        if (lastWin.dropItems.length > 0) {
          lines.push(
            `${dropLabelFor(played.phase, played.wave)} ${lastWin.dropItems
              .map((id) => {
                const name = getItemDef(id)?.core.name ?? id;
                const unique = isUniqueDrop(dropTableForWave(played.phase, played.wave), id);
                return unique ? `${name} (Unique)` : name;
              })
              .join(', ')}`,
          );
        }
        if (lastWin.starTokenGranted) lines.push('Final drop: Avatar star');
        if (lastWin.bossFragment) {
          lines.push(
            lastWin.bossFragment.starred
              ? `${lastWin.bossFragment.name} bound ★${lastWin.bossFragment.stars}!`
              : `Boss fragment · ${lastWin.bossFragment.frags}/${lastWin.bossFragment.nextCost ?? '—'}`,
          );
        }
        if (lastWin.conquered) {
          lines.push(`Conquered! Enemies now scale ×${lastWin.cyclePower.toFixed(2)}. Next cycle starts at Main wave 1.`);
        } else if (lastWin.replayHalf) {
          lines.push('Half-token replay — your campaign seat is exactly where you left it.');
        } else if (lastWin.halved) {
          lines.push('Half tokens today — come back tomorrow for full.');
        }
      } else {
        lines.push(
          played.mode === 'replay'
            ? `Half-token replay — +${Math.floor(getTune().tokenClearBase / 2)} tokens · +${Math.floor(
                xpForClear(sim?.wave ?? fight.wave) / 2,
              )} XP`
            : `+${getTune().tokenClearBase} tokens · +${xpForClear(sim?.wave ?? fight.wave)} XP`,
        );
      }
      const replay = played.mode === 'replay';
      return (
        <TurfResultCard
          title={
            lastWin?.conquered
              ? `Cycle ${lastWin.conqueredCycles} conquered — Main cleared!`
              : replay
                ? `Cleared ${campaignPhaseLabel(played.phase)} wave ${played.wave} (replay)`
                : `Cleared ${fightTitle(played)}`
          }
          lines={lines}
          badge={badge}
          actions={[
            ...(replay ? [{ label: 'Back to campaign', onPress: () => buildSetup(campaignFight) }] : []),
            {
              label: 'Share this clear',
              onPress: () => void shareDefendClear(played.wave, view.avatarLevel),
              accessibilityLabel: 'Share this clear',
            },
            {
              label: 'Leave — back to Call wave',
              onPress: () => leaveResultsToSetup(true),
              accessibilityLabel: 'Leave to Defend setup',
            },
          ]}
          primary={
            replay
              ? { label: 'Farm again', onPress: () => buildSetup(played) }
              : {
                  label: lastWin?.conquered ? 'Next cycle · Main wave 1' : `Next · ${fightTitle(campaignFight)}`,
                  onPress: () => buildSetup(campaignFight),
                }
          }
        />
      );
    }
    if (phase === 'lost') {
      return (
        <TurfResultCard
          title="The path was breached."
          lines={[`One puff reached the exit — ${fightTitle(playedRef.current)} ends. Retry the same wave with your towers kept.`]}
          actions={[
            {
              label: 'Leave — back to Call wave',
              onPress: () => leaveResultsToSetup(false),
              accessibilityLabel: 'Leave to Defend setup',
            },
          ]}
          primary={{ label: 'Retry', onPress: retryLostRun }}
        />
      );
    }
    return null;
  })();

  const floatCards =
    padCard || resultCard ? (
      <>
        {padCard ? (
          <>
            {/* Outside tap: the stage strips above and below the board close the card (the board's own empty tap does too). */}
            {[0, 1].map((i) => {
              const band = turfBoardRect(setupFrame.stage).y;
              return (
                <Pressable
                  key={`band-${i}`}
                  onPress={closePadCard}
                  accessible={false}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: band,
                    top: setupFrame.notice.height + (i === 0 ? 0 : setupFrame.stage.height - band),
                  }}
                />
              );
            })}
            {padCard}
          </>
        ) : null}
        {resultCard && !resultHold ? (
          <View
            style={[
              styles.turfFloatPanel,
              { bottom: (live ? waveFrame : setupFrame).dock.height + 8, maxHeight: setupFrame.stage.height * 0.75 },
            ]}>
            <ScrollView contentContainerStyle={styles.turfFloatScroll}>{resultCard}</ScrollView>
          </View>
        ) : null}
      </>
    ) : null;

  // The baked street board for this map (Streetwear only; play-art-pack packSwBoards).
  // T8: the picked map theme paints the same board (falls back to the plain board if a theme is not packed).
  const themedArtId = turfBoardArtId(boardMap.id, turfTheme);
  const boardArtId = boardSheet(themedArtId) ? themedArtId : boardMap.id;
  const streetBoardKey = street ? boardSheet(boardArtId) : undefined;
  const streetBoard = streetBoardKey ? sheetFrame(streetBoardKey, 'img') : undefined;
  // T6 boss bar: while a boss is alive the wave chip's box shows its name over a thin bar (same box, same size).
  const liveBoss = live && street ? bossBar(sim?.puffs ?? [], sim?.band?.boss.name) : null;
  const liveBossChip = liveBoss ? chipValue(hpChipRef.current.get(liveBoss.id), liveBoss.pct, Date.now()) : 0;
  // T2b next-wave preview: creep counts from the wave director (no new data), shown only while the wave chip is.
  // Replays do not advance the campaign seat, so the preview is for campaign runs only.
  const wavePeek = live && street && !liveBoss && fight.mode !== 'replay' ? nextWavePeek(labelPhase, displayedWave, { trial: TRIAL_WAVE_COUNT, main: MAIN_WAVE_COUNT }) : null;
  const wavePeekShown = wavePeekOpen && wavePeek != null && !paused;
  // T9: notices wait while the next-wave card is open (they were drawing under it).
  useNoticePause(wavePeekShown);
  // A boss bar or a pause hides the card; closing it too keeps it from popping back open on its own.
  const wavePeekHidden = liveBoss != null || paused;
  useEffect(() => {
    if (wavePeekHidden) setWavePeekOpen(false);
  }, [wavePeekHidden]);

  const wavePeekCard = (() => {
    if (!wavePeekShown || !wavePeek) return null;
    const rect = wavePeekRect(setupFrame.stage);
    const rows: TurfWavePeekRowView[] = wavePeek.rows.map((row) => ({
      key: row.role,
      count: row.count,
      name: row.role,
      color: CREEP_ROLE_COLOR[row.role],
      shape: row.role === 'swarm' ? 'dot' : row.role === 'runner' ? 'slim' : row.role === 'boss' ? 'gem' : 'block',
      boss: row.role === 'boss',
      ...wavePeekArt(row.role, wavePeek.phase, wavePeek.wave),
    }));
    return (
      <>
        {/* Outside tap: the strip the card sits in (NoticeLane + the empty stage margin above the board) closes it; the board stays live. */}
        <Pressable
          onPress={() => setWavePeekOpen(false)}
          accessible={false}
          style={{ position: 'absolute', left: 0, right: HELP_COLUMN, top: 0, height: setupFrame.notice.height + turfBoardRect(setupFrame.stage).y }}
        />
        <TurfWavePeekCard
          title={`Next · ${wavePeek.phaseChanged ? `${campaignPhaseLabel(wavePeek.phase)} ` : ''}wave ${wavePeek.wave}`}
          tag={wavePeek.element ? `Stage · ${TAG_LABEL[wavePeek.element as TypeTag]}` : undefined}
          rows={rows}
          width={rect.width}
          top={rect.y}
          left={rect.x}
          onClose={() => setWavePeekOpen(false)}
        />
      </>
    );
  })();

  return (
    <View style={styles.turfRoot}>
      <GameScreen
        // Stage layout (emci 2026-10-14): one stage for setup and wave — the board sits right
        // centred in the stage in both and never moves (no scroll, no jump on start or pause).
        frame={live ? waveFrame : setupFrame}
        help={live ? 'turf-wave' : 'turf-setup'}
        topBar={
          live && street ? (
            <View style={styles.streetHud}>
              {liveBoss ? (
                <View
                  style={[styles.streetWave, styles.bossBarBox]}
                  accessible
                  accessibilityLabel={`${liveBoss.name}, ${Math.round(liveBoss.pct * 100)} percent health`}>
                  <Text style={styles.bossBarName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {liveBoss.name}
                  </Text>
                  <View style={styles.bossBarTrack}>
                    {liveBossChip > liveBoss.pct ? <View style={[styles.bossBarChip, { width: `${liveBossChip * 100}%` }]} /> : null}
                    <View style={[styles.bossBarFill, { width: `${liveBoss.pct * 100}%` }]} />
                    {liveBoss.enrageAt != null ? <View style={[styles.bossBarTick, { left: `${liveBoss.enrageAt * 100}%` }]} /> : null}
                  </View>
                </View>
              ) : (
                <TurfWaveChip
                  label={`${campaignPhaseLabel(labelPhase)} wave ${displayedWave}`}
                  open={wavePeekShown}
                  disabled={wavePeek == null}
                  width={WAVE_CHIP_BOX.width}
                  height={WAVE_CHIP_BOX.height}
                  onPress={() => setWavePeekOpen((value) => !value)}
                />
              )}
              <TurfCapsPill scrap={scrap} />
              <TurfPauseButton paused={paused} onPress={() => setPaused((value) => !value)} />
            </View>
            
          ) : (
            shellTop
          )
        }
        tabBar={live ? null : shellTabs}
        background={NEON.ink}
        notice={
          <View style={styles.turfLane}>
            {live ? (
              paused ? (
                <View style={styles.coachLine}>
                              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                                Paused — the wave is frozen.
                              </ThemedText>
                            </View>
              ) : (
                <Pressable
                            onPress={() => setRunCoachOpen((value) => !value)}
                            disabled={coachHidden || paused}
                            accessibilityRole="button"
                            accessibilityLabel={runCoachOpen ? 'Hide coach tip' : 'Show coach tip'}
                            accessibilityElementsHidden={paused}
                            importantForAccessibility={paused ? 'no-hide-descendants' : 'auto'}
                            style={styles.coachLine}>
                            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText} numberOfLines={2}>
                              {/* The open tip wins over the sword aura line (audit F02: it was unreachable). */}
                              {runCoachOpen && !coachHidden
                                ? `Coach: ${coach.tip}`
                                : swordFx
                                  ? `Aura: ${swordFx.name} — ${swordFx.auraLabel}.`
                                  : coachHidden
                                    ? `Towers fire on their own — drag your Avatar and time ${activeSkill.name}.`
                                    : 'Coach tip ›'}
                            </ThemedText>
                          </Pressable>
              )
            ) : phase === 'setup' && !coachHidden ? (
              <Pressable
                onPress={() => setCoachHidden(true)}
                accessibilityRole="button"
                accessibilityLabel={`Coach: ${coach.tip} Tap to hide.`}
                style={styles.coachLine}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText} numberOfLines={2}>
                  {`Coach: ${coach.tip}`}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        }
        stage={
          <View style={styles.turfStage}>
            {/* T5: the leak shake moves this board box (stage content) only — never a region. */}
            <Animated.View style={[{ width: boardSide, height: boardSide, alignSelf: 'center' }, boardShake.style]}>
              <View
                style={[styles.board, { backgroundColor: theme.backgroundSelected }]}
                onLayout={(event) => {
                  const width = event.nativeEvent.layout.width || 100;
                  boardSizeRef.current = width;
                  boardSize.value = width;
                }}
                // Click-to-move: one tap on the board walks the Avatar, unless the
                // tap lands on a pad (that opens the tower UI instead). HUD and the
                // tower panels sit outside this view, so their taps never land here.
                // The board is not in a ScrollView (Phase 1 stage), so a drag
                // stays here and walks the Avatar.
                onStartShouldSetResponder={() => true}
                onResponderTerminationRequest={() => true}
                onResponderGrant={(event) =>
                  aimAvatarPreview(event.nativeEvent.locationX, event.nativeEvent.locationY, true)
                }
                onResponderMove={(event) =>
                  aimAvatarPreview(event.nativeEvent.locationX, event.nativeEvent.locationY, false)
                }
                onResponderTerminate={() => setAvatarAim(null)}
                onResponderRelease={(event) => {
                  setAvatarAim(null);
                  handleBoardTap(event.nativeEvent.locationX, event.nativeEvent.locationY);
                }}>
                {/* Terrain + prop garnish (§19 — active skin): grass floor, prop
                    garnish, and pad markers. Background only, behind every gameplay
                    layer (zIndex 0). `anchor: 'center'` tiles (pads, props) sit ON
                    the world point; grid tiles tile from their top-left.
                    pointerEvents none — taps fall through to the board's own tap
                    handler (click-to-move / pad select). */}
                {/* Craftpix field tiles (grass + props + pad markers) are the
                    `grove-classic` board skin only. The default `neon` chrome paints
                    its own void/corridor/brackets in the gameplay SVG below, so the
                    field tiles are bypassed entirely. */}
                {/* T7 perf: a memo layer (static during a wave — never re-renders on the 100 ms tick). */}
                {boardSkin === 'neon' ? null : <BoardDecorTiles decor={decor} skin={`${boardSkin}:${street}`} />}
                {/* Gameplay layer — path, pads, towers, Bound Bosses, enemies.
                    Sits ABOVE the tiles (zIndex 1 > 0) so gameplay always reads on
                    top of the scroll art. pointerEvents none: gameplay is pure art
                    now, and every tap belongs to the board view underneath
                    (click-to-move / pad select). */}
                <View style={styles.boardArt} pointerEvents="none">
                {street && streetBoard && streetBoardKey ? (
                  <>
                    {/* Streetwear Turf War: the baked street board (asphalt roads, sidewalks, manhole pads,
                     * props) as ONE image UNDER the ambient layer, which sits under the units' <Svg> (T4).
                     * Paint only — the path, pads and taps still come from board-data. */}
                    {/* T7 perf: a memo layer (the board image never re-renders on the 100 ms tick). */}
                    <TurfBoardBase sheetKey={streetBoardKey} />
                    <TurfAmbient mapId={boardArtId} boardSide={boardSide} getCreeps={ambientCreeps} running={live && !paused} />
                  </>
                ) : null}
                <Svg width="100%" height="100%" viewBox="0 0 100 100">
                  {street && streetBoard ? null : boardSkin === 'neon' ? (
                    /* Neon chrome — void/wall, ATO ghost, glowing path corridor and
                     * magenta pad brackets. Painted FIRST so every gameplay layer
                     * (pad rings, towers, enemies, shots) sits on top of it, and the
                     * ghost stays under the corridor. Pure code/SVG, no PNGs. */
                    <NeonBoardChrome map={boardMap} ghostColor={theme.accent} />
                  ) : (
                    /* ATO ghost + road underlay + cobble stamps (T7 perf: a memo layer, static during a wave). */
                    <StaticRoad roadD={roadD} stamps={roadStamps} tone={underlayTone} width={underlayWidth} ghostColor={theme.accent} skin={`${boardSkin}:${street}`} />
                  )}
                  {/* Pads draw NOTHING extra here — the neon chrome's magenta
                   * L-brackets + P-label are the whole read (no solid candy disc,
                   * no base ring). A selected pad is signalled by its dashed range
                   * ring below. */}
                  {selectedPad != null && boardMap.pads[selectedPad] ? (
                    <Circle
                      cx={boardMap.pads[selectedPad].x}
                      cy={boardMap.pads[selectedPad].y}
                      r={
                        selectedTower
                          ? TOWER_DEFS[selectedTower.kind].range
                          : selectedBoundBoss
                            ? boundBossRange(selectedBoundBoss)
                            : 18
                      }
                      fill={selectedRing.pull ? selectedRing.color : 'none'}
                      fillOpacity={0.07}
                      stroke={selectedRing.color}
                      strokeOpacity={0.6}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  ) : null}
                  {/* Placement preview: tap a build option once to see its
                   * ring on the pad; tap again to build. */}
                  {placePreview && selectedPad != null && boardMap.pads[selectedPad] ? (
                    <Circle
                      cx={boardMap.pads[selectedPad].x}
                      cy={boardMap.pads[selectedPad].y}
                      r={placePreview.range}
                      fill={placePreview.color}
                      fillOpacity={placePreview.pull ? 0.16 : 0.1}
                      stroke={placePreview.color}
                      strokeOpacity={0.9}
                      strokeWidth={0.8}
                      strokeDasharray="1.5 1.5"
                    />
                  ) : null}
                  {/* Avatar aim preview: its range ring under the finger. */}
                  {avatarAim ? (
                    <G>
                      <Circle
                        cx={avatarAim.x}
                        cy={avatarAim.y}
                        r={AVATAR_RANGE * gradeRangeMult(view.turfTeam.leaderGrade)}
                        fill={theme.accent}
                        fillOpacity={0.08}
                        stroke={theme.accent}
                        strokeOpacity={0.8}
                        strokeWidth={0.7}
                        strokeDasharray="1.5 1.5"
                      />
                      <Circle cx={avatarAim.x} cy={avatarAim.y} r={1} fill={theme.accent} fillOpacity={0.9} />
                    </G>
                  ) : null}
                  {/* §19 tower sprites (skin roles). Visual level is SCALE ONLY
                   * (Lv1 0.70 · Lv2 0.85 · Lv3 1.0) — no number badges. Each tower
                   * is rotated toward its current target around its own centre —
                   * unless its clip kit is bundled, in which case it plays a sticky
                   * E/W idle loop + attack one-shot (K1) with no rotate. */}
                  {sim?.towers.map((tower) => {
                    const pad = boardMap.pads[tower.pad];
                    const role = TOWER_ROLE[tower.kind];
                    const kitRole = towerKitRole(tower.kind);
                    const dirs = skinDirs(role);
                    const deg = towerFacingRef.current[tower.id] ?? 0;
                    const heading = headingVectorFromDeg(deg);
                    const face = towerFaceRef.current[tower.id] ?? 'e';
                    const hasClips =
                      castActorClipFrames('idle', kitRole) > 0 ||
                      castActorClipFrames('attack', kitRole) > 0 ||
                      castActorClipFrames('skill', kitRole) > 0;

                    let drawable: ClipDrawable | undefined;
                    let transform: string | undefined;
                    if (hasClips) {
                      // Stationary humanoid: the breathing idle loop, or the attack
                      // one-shot while firing. Side-profile art → sticky E/W face,
                      // never rotated.
                      const anim: CastActor =
                        towerAnimRef.current[tower.id] ??
                        castActorCreate('tower', castActorIdleSeed(tower.id, 'tower'));
                      const frame = castActorFrame(anim, Date.now(), kitRole);
                      drawable =
                        castActorFrameDrawable(anim, face, frame, kitRole) ??
                        roleArtDrawable(kitRole, roleFaceArtIndex(kitRole, face));
                      transform = undefined;
                    } else {
                      // No clip art yet — keep the static 8-dir rotation.
                      const dirIndex = skinDirIndex(role, heading.dx, heading.dy);
                      drawable = skinArtDrawable(role, dirIndex);
                      transform = dirs > 1 ? undefined : `rotate(${deg} ${pad.x} ${pad.y})`;
                    }
                    if (!drawable) return null;
                    const size =
                      skinUnits(role, TOWER_PAD_UNITS) * skinScale(role, tower.level) * TOWER_DRAW_SCALE;
                    const box = skinDrawBox(role, pad.x, pad.y, size);
                    return (
                      <G key={`tower-art-${tower.id}`}>
                        <G transform={transform}>
                          <ClipSprite drawable={drawable} x={box.x} y={box.y} size={box.size} />
                        </G>
                        {/* Level pips (T2, replaces the role letter): one dot per level at the
                         * sprite's top-right — outside the rotate group so they never spin.
                         * Anchored to the visible art corner, not the padded box corner. */}
                        {Array.from({ length: tower.level }, (_, pip) => (
                          <Circle
                            key={`pip-${tower.id}-${pip}`}
                            cx={box.x + box.size * TOWER_BADGE_X_FRAC - pip * TOWER_PIP_STEP}
                            cy={box.y + box.size * TOWER_BADGE_Y_FRAC}
                            r={TOWER_PIP_R}
                            fill={TOWER_MARKER_COLOR}
                            stroke="#0D0D0F"
                            strokeWidth={0.4}
                          />
                        ))}
                      </G>
                    );
                  })}
                  {/* §19 Bound Boss: a cycle boss with no hero art mapped keeps the
                   * heavy Final unit placeholder; a HERO bound as a tower AND a
                   * cycle boss mapped to a hero (Ember Sovereign → Archangel) draw
                   * that hero's idle/attack/skill clips through the same tower clip
                   * kit the towers use, on a sticky E/W side profile. */}
                  {sim?.boundBosses.map((bb) => {
                    const pad = boardMap.pads[bb.pad];
                    const heroId = boundBossHeroId(bb.bossId);
                    if (heroId) {
                      const kitRole = resolveBoundHeroTowerKit(heroId);
                      const face = towerFaceRef.current[bb.id] ?? 'e';
                      const hasClips =
                        castActorClipFrames('idle', kitRole) > 0 ||
                        castActorClipFrames('attack', kitRole) > 0 ||
                        castActorClipFrames('skill', kitRole) > 0;
                      if (__DEV__ && !hasClips) {
                        // A6 — a bound boss that resolved no clips draws a static
                        // rotation. Fail loudly in dev so an un-bundled hero (or a
                        // broken resolve) is never a silent freeze.
                        console.warn(
                          `[A6] bound boss "${bb.bossId}" (→ ${heroId}) resolved no idle/attack/skill clips — ` +
                            `falling back to its static rotation. Is its hero art bundled?`,
                        );
                      }
                      let drawable: ClipDrawable | undefined;
                      if (hasClips) {
                        const anim: CastActor =
                          towerAnimRef.current[bb.id] ??
                          castActorCreate('tower', castActorIdleSeed(bb.id, 'tower'));
                        const frame = castActorFrame(anim, Date.now(), kitRole);
                        drawable = castActorFrameDrawable(anim, face, frame, kitRole);
                      }
                      if (!drawable) {
                        drawable = roleArtDrawable(kitRole, roleFaceArtIndex(kitRole, face));
                      }
                      if (!drawable) return null;
                      // A6 — a bound boss is tower-sized, not hero-sized: cap the
                      // hero's natural `units` so it reads on a pad next to towers.
                      const size = Math.min(kitRole.units ?? TOWER_PAD_UNITS, 16) * TOWER_DRAW_SCALE;
                      const footAt = roleFootAt(kitRole);
                      const box = { x: pad.x - size / 2, y: pad.y - size * footAt, size };
                      return (
                        <ClipSprite
                          key={`bb-hero-art-${bb.id}`}
                          drawable={drawable}
                          x={box.x}
                          y={box.y}
                          size={box.size}
                        />
                      );
                    }
                    const role: SkinRoleId = 'unit.final';
                    const drawable = skinArtDrawable(role);
                    if (!drawable) return null;
                    const box = skinDrawBox(role, pad.x, pad.y, 11);
                    return (
                      <ClipSprite
                        key={`bb-art-${bb.id}`}
                        drawable={drawable}
                        x={box.x}
                        y={box.y}
                        size={box.size}
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
                        {isHeroBoundTower(bb.bossId) ? heroName(bb.bossId) : '★' + bb.stars}
                      </SvgText>
                    );
                  })}
                  {/* K2 death one-shots (display only) — the creeps killed this
                   * beat, drawn UNDER the living swarm. The engine removed them the
                   * tick they died, so the board replays their `death` clip from its
                   * own copy of the pose it last drew (same role / box / lane / side
                   * profile) and holds the last frame for a short beat. A role with
                   * no death art never becomes a corpse, so its kill still reads as
                   * the instant removal it was before K2. */}
                  {corpses.map((corpse) => {
                    const deathFrames = skinAnimFrames(corpse.role, 'death');
                    const drawable = skinAnimDrawable(
                      corpse.role,
                      'death',
                      skinAnimFaceIndex(corpse.role, 'death', corpse.face),
                      castActorPathFrame('death', Date.now(), corpse.bornAt, 0, deathFrames),
                    );
                    if (!drawable) return null;
                    const box = skinDrawBox(corpse.role, corpse.x, corpse.y, corpse.size);
                    return (
                      <ClipSprite
                        key={`corpse-${corpse.id}`}
                        drawable={drawable}
                        x={box.x}
                        y={box.y}
                        size={box.size}
                      />
                    );
                  })}
                  {sim?.puffs.map((puff) => {
                    const pct = Math.max(0, Math.min(1, puff.hp / puff.maxHp));
                    // Status icons above the health bar (stun, DoT with stack
                    // count, slow, shred) — none when the creep is unaffected.
                    const statusIcons = statusIconsFor(puff);
                    // §19 board cast (skin roles): runners = fast unit, bosses =
                    // tanks/heavy by band, tanks = the heavy soak unit, normal
                    // puffs = the puff unit.
                    const creep = creepRole(puff);
                    const tintColor = CREEP_ROLE_COLOR[creep];
                    const drawScale = CREEP_DRAW_SCALE[creep];
                    const radius = 3.4 * puff.size * drawScale;
                    const spriteRole = puffUnitRole(puff, band?.kind);
                    // Lane offset is capped from the drawn WIDTH before the sprite
                    // exists: a creep's art is wider than its path point, so a wide
                    // unit (Knight / Archangel) rides the centreline instead of
                    // clipping the neon wall. Feet stay on the path either way —
                    // this is a lateral shift, never a change of route.
                    const spriteSize = skinUnits(spriteRole, UNIT_BASE_UNITS) * puff.size * drawScale;
                    const pos = creepDrawPosition(puff, boardMap, creepLaneHalf(spriteSize));
                    const x = pos.x * 100;
                    const y = pos.y * 100;
                    const facingDeg = puffFacingRef.current[puff.id] ?? 0;
                    const heading = headingVectorFromDeg(facingDeg);
                    // Humanoid path walkers (creeps + Oni + Archangel) render as side
                    // profiles: the sticky east/west face is the ONLY facing they use,
                    // and it never rotates into the path tangent. Every other creep
                    // role keeps the 8-dir heading bucket (the semi's kenney
                    // `unit.tank_alt` has no side-profile art).
                    const pathWalker = isPathWalker(spriteRole);
                    const walkFace = puffWalkFaceRef.current[puff.id] ?? 'e';
                    const spriteDirs = skinDirs(spriteRole);
                    const sprite = skinArtDrawable(
                      spriteRole,
                      pathWalker
                        ? skinFaceArtIndex(spriteRole, walkFace)
                        : skinDirIndex(spriteRole, heading.dx, heading.dy),
                    );
                    // H1.5 creep walk clips: while the role authors one, play its
                    // directional frames. The frame comes from the walk tick's
                    // per-creep phase (ground-tracking, smooth at WALK_TICK_MS);
                    // otherwise keep the static rotation. Towers author no `walk`
                    // and stay as-is. A path walker always plays an east/west row
                    // (2-dir clip: its own side; 4-dir clip: the E/W rows only, N/S
                    // rows unused at runtime), so a vertical lane keeps the legs
                    // cycling instead of freezing on SKIN_WALK_NO_DIR.
                    const walkDirs = skinWalkDirs(spriteRole);
                    const walkFrames = skinWalkFrames(spriteRole);
                    const walkPhase =
                      walkPhaseRef.current[puff.id]?.phase ??
                      puff.dist * walkFramesPerPath(spriteRole);
                    const walkDirIndex = pathWalker
                      ? skinWalkFaceIndex(spriteRole, walkFace)
                      : skinWalkDirIndex(spriteRole, heading.dx, heading.dy);
                    const walkSprite =
                      walkDirs > 0 && walkFrames > 1
                        ? skinWalkDrawable(spriteRole, walkDirIndex, Math.floor(walkPhase))
                        : undefined;
                    // K2 path-walker stance: the same stall window the walk tick
                    // just used decides the clip — moving ⇒ the walk cycle above,
                    // stopped for CREEP_STILL_MS ⇒ the role's breathing `idle` loop
                    // at its own wall-clock cadence (the walk cursor is deliberately
                    // frozen while stalled, so it cannot drive the loop). The stall
                    // is read from how long ago this creep last advanced, NOT from
                    // the tick's rate flag: a creep the tick has only just seeded has
                    // no measured rate yet, and reading that as "stopped" would make
                    // every spawn breathe before it walks. A role with no idle art
                    // keeps holding its walk frame, and a role with no walk art
                    // keeps the static rotation — both bosses author both slots
                    // now, so every path walker breathes when stalled.
                    const phaseEntry = walkPhaseRef.current[puff.id];
                    const creepMoving =
                      phaseEntry == null || Date.now() - phaseEntry.at <= CREEP_STILL_MS;
                    const idleFrames = skinAnimFrames(spriteRole, 'idle');
                    const stance =
                      pathWalker && walkDirs > 0
                        ? creepClip({
                            dead: false,
                            rate: creepMoving ? 1 : 0,
                            frames: { walk: walkFrames, idle: idleFrames },
                          })
                        : null;
                    const idleSprite =
                      stance === 'idle'
                        ? skinAnimDrawable(
                            spriteRole,
                            'idle',
                            skinAnimFaceIndex(spriteRole, 'idle', walkFace),
                            castActorPathFrame('idle', Date.now(), 0, puff.id, idleFrames),
                          )
                        : undefined;
                    const spriteDrawable = idleSprite ?? walkSprite ?? sprite;
                    // Feet-pivoted sprites rise above the path point, so the body
                    // chrome (ring / bar / badge) anchors to the draw box, not the
                    // path point.
                    const box = skinDrawBox(spriteRole, x, y, spriteSize);
                    const hasSprite = spriteDrawable != null;
                    const bodyCy = hasSprite ? box.y + spriteSize / 2 : y;
                    const barWidth = 8 * puff.size * drawScale;
                    // Up-facing single-sprite roles face along the road (path
                    // tangent), same convention as the towers; a degenerate heading
                    // keeps the last known facing. Path walkers are side-profile art
                    // with a sticky L/R face, so they stay at 0° — no SVG rotate.
                    // (`spriteDirs > 1` alone already gives them 0° today; the
                    // `pathWalker` guard makes "never rotate a cast walker" hold even
                    // if a walker role ever resolved to a single-sprite skin.)
                    const spriteTransform =
                      pathWalker || spriteDirs > 1
                        ? undefined
                        : `rotate(${facingDeg} ${x} ${bodyCy})`;
                    // Boss band badge (display only): M = scout mini-boss, B = boss.
                    const bossBadge =
                      puff.kind === 'boss' ? (band?.kind === 'scout_mini' ? 'M' : 'B') : null;
                    const barTop = hasSprite ? box.y - 2.8 : y - radius - 4;
                    // T5: the hit flash copies this exact sprite + box (unrotated art only).
                    if (spriteDrawable && !spriteTransform) creepDrawRef.current.set(puff.id, { drawable: spriteDrawable, box });
                    // T5 (Streetwear): the bar shows only once hurt, with a pale chip draining to the new HP.
                    const barShown = !street || showHealthBar(puff.hp, puff.maxHp);
                    const chip = street ? chipValue(hpChipRef.current.get(puff.id), pct, Date.now()) : pct;
                    // Icons shrink with the bar so a full row of 4 never outgrows it.
                    const ICON_SIZE = Math.min(2.4, barWidth / 4.6);
                    const iconRowY = barTop - ICON_SIZE / 2 - 0.5;
                    return (
                      <G key={`puff-${puff.id}`}>
                        {/* T6 enrage telegraph (part 2): a still red glow under a boss nearing its enrage line. A static
                         * shape, redrawn with the board like the health bar — no animation inside this SVG. */}
                        {street && puff.kind === 'boss' && enrageWarning(puff.hp, puff.maxHp, puff.burstHpPct, puff.burstFired) ? (
                          <Ellipse cx={x} cy={y} rx={spriteSize * 0.34} ry={spriteSize * 0.12} fill={BOSS_TELEGRAPHS.enrage.color} opacity={0.4} />
                        ) : null}
                        <G transform={spriteTransform}>
                          {spriteDrawable ? (
                            <ClipSprite drawable={spriteDrawable} x={box.x} y={box.y} size={box.size} />
                          ) : (
                            <Circle cx={x} cy={y} r={radius} fill={tintColor} />
                          )}
                        </G>
                        {barShown ? (
                          <>
                            <Rect
                              x={x - barWidth / 2}
                              y={barTop}
                              width={barWidth}
                              height={1.6}
                              fill="rgba(0,0,0,0.35)"
                              rx={0.8}
                            />
                            {chip > pct ? (
                              <Rect
                                x={x - barWidth / 2}
                                y={barTop}
                                width={barWidth * chip}
                                height={1.6}
                                fill="#FFEBD6"
                                rx={0.8}
                              />
                            ) : null}
                            <Rect
                              x={x - barWidth / 2}
                              y={barTop}
                              width={barWidth * pct}
                              height={1.6}
                              fill="#4ADE80"
                              rx={0.8}
                            />
                          </>
                        ) : null}
                        {puff.tint ? (
                          <WeaknessDiamond
                            x={x - barWidth / 2 - 1.3}
                            y={barTop + 0.8}
                            size={1.9}
                            color={TAG_COLOR[puff.tint]}
                          />
                        ) : null}
                        <StatusIconRow icons={statusIcons} cx={x} cy={iconRowY} size={ICON_SIZE} />
                        {bossBadge ? (
                          <SvgText
                            x={x}
                            y={barTop - 2 - (statusIcons.length > 0 ? ICON_SIZE + 0.6 : 0)}
                            fontSize={4.5}
                            fontFamily="SpaceMono_700Bold"
                            fill="#FFFFFF"
                            textAnchor="middle"
                            opacity={0.95}>
                            {bossBadge}
                          </SvgText>
                        ) : null}
                      </G>
                    );
                  })}
                  {/* §19 shot FX (display only) — one Kenney shot sprite per fired
                   * round, flying from the tower centre to its target's centre. */}
                  {shots.map((shot) => {
                    const role: SkinRoleId = 'fx.shot';
                    const drawable = skinArtDrawable(role);
                    if (!drawable) return null;
                    const box = skinDrawBox(role, shot.x, shot.y, skinUnits(role, 4.5) * SHOT_DRAW_SCALE);
                    // Point the round along its velocity (same up-facing convention).
                    const deg = facingDegrees(shot.vx, shot.vy);
                    return (
                      <G key={`shot-${shot.id}`} transform={`rotate(${deg} ${shot.x} ${shot.y})`}>
                        <ClipSprite drawable={drawable} x={box.x} y={box.y} size={box.size} />
                      </G>
                    );
                  })}
                  {/* EFFECTS_PLAN step 5 — kit attack effects (Full / Minimal). */}
                  <FxLayer events={fxEvents} now={Date.now()} quality={fxQuality} />
                  {/* Dev kit only — synthetic FX stress (EFFECTS_PLAN step 1):
                      tower/boss pads → live creeps, display only. */}
                  {stressFx > 0 ? (
                    <StressFxLayer
                      count={stressFx}
                      tick={stressTick}
                      from={[
                        ...(sim?.towers ?? []).map((t) => boardMap.pads[t.pad]),
                        ...(sim?.boundBosses ?? []).map((b) => boardMap.pads[b.pad]),
                      ].filter((p) => p != null)}
                      to={(sim?.puffs ?? []).map((p) => creepDrawPosition(p, boardMap))}
                    />
                  ) : null}
                </Svg>
                {/* T5 combat effects (hit flash, death pop, leak ring): ABOVE the units <Svg>, not in it — each effect
                 * runs once on its own Reanimated clock and only this layer re-renders for it. */}
                {street ? <TurfCombatFx ref={combatFxRef} boardSide={boardSide} /> : null}
                </View>
                {fpsMeterOn ? <FpsOverlay stats={fpsStats} fxCount={stressFx} /> : null}

                {phase === 'running' && swordFx ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.swordAura, swordAuraStyle, { borderColor: swordFx.color, backgroundColor: swordFx.color }]}
                  />
                ) : null}
                {/* Walking Avatar overlay (§19 cast Corvus). The frame cycles
                    idle/walk and one-shots attack/skill/hurt/dash; the art is 2-dir
                    (sticky E/W), so no rotate is applied. pointerEvents none so
                    board taps pass through to the board's move handler. zIndex 10
                    keeps it above the tiles AND the gameplay SVG. */}
                <Animated.View
                  style={[styles.avatar, avatarStyle]}
                  pointerEvents="none">
                  <View
                    style={styles.avatarArt}
                    pointerEvents="none">
                    {avatarDrawable ? (
                      <ClipImage drawable={avatarDrawable} />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: avatarColor }]} />
                    )}
                  </View>
                </Animated.View>
                {/* P5b Turf helper: drawn like the leader — an overlay whose position rides shared values
                    (setup: the move loop; wave: one linear glide per sim tick on the UI thread), so walking
                    never re-renders the screen. Idle / walk / attack / skill, dazed → faint held and
                    dimmed, getting up → the faint reversed. Below the leader. */}
                {helperDrawable && helperNow ? (
                  <Animated.View
                    style={[styles.helper, helperStyle, helperNow.dazed || helperNow.gettingUp ? styles.helperDazed : null]}
                    pointerEvents="none">
                    <View style={styles.avatarArt} pointerEvents="none">
                      <ClipImage drawable={helperDrawable} />
                    </View>
                  </Animated.View>
                ) : null}

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
            </Animated.View>
            {/* Dev kit only — the FX stress controls sit right under the board so
                the FPS readout stays on screen while they're tapped (EFFECTS_PLAN
                step 1). Same actions as the Board / Misc rows. */}
            {PRE_LAUNCH_DEV && devUnlocked ? (
              <View style={styles.devStrip}>
                <View style={styles.devStripCell}>
                  <DevRow
                    label={fpsMeterOn ? 'FPS: on' : 'FPS: off'}
                    onPress={() => setFpsMeterOn((on) => !on)}
                  />
                </View>
                <View style={styles.devStripCell}>
                  <DevRow
                    label={`FX: ${stressFx === 0 ? 'off' : stressFx}`}
                    onPress={() => setStressFx((level) => nextStressFxLevel(level))}
                  />
                </View>
                <View style={styles.devStripCell}>
                  <DevRow
                    label="+20 creeps"
                    disabled={phase !== 'running' || !sim}
                    onPress={devAddStressCreeps}
                  />
                </View>
              </View>
            ) : null}
            {PRE_LAUNCH_DEV && devUnlocked ? (
              <View style={styles.devStripFull}>
                <DevRow
                  label={
                    bench.state.running
                      ? 'FPS test running…'
                      : phase === 'running'
                        ? 'Run FPS test (30s)'
                        : 'Run FPS test — start a wave first'
                  }
                  disabled={bench.state.running || phase !== 'running' || paused}
                  onPress={bench.start}
                />
                <BenchPanel
                  state={bench.state}
                  sendStatus={benchSend}
                  onCancel={bench.cancel}
                  onShare={() => {
                    void Share.share({ message: benchReport(bench.state.results) });
                  }}
                  onClose={bench.clear}
                />
              </View>
            ) : null}
          </View>
        }
        dock={
          live ? (
            <View style={[styles.turfDock, { paddingBottom: Math.max(setupFrame.insets.bottom, 8) }]}>
              <TurfButton
                label={`Cast · ${activeSkill.name}`}
                icon="flash"
                detail={skillReady ? 'Ready' : `${skillSeconds}s`}
                state={skillReady ? 'ready' : 'cooling'}
                progress={(sim?.skillCooldownMs ?? 0) / Math.max(1, getTune().skillCooldownMs)}
                primary={skillReady}
                onPress={castSkill}
                accessibilityLabel={
                  skillReady ? `Cast ${activeSkill.name}` : `Skill ${activeSkill.name} cooling, ${skillSeconds} seconds`
                }
                style={styles.streetSkill}
              />
              <View style={styles.streetDockRow}>
                {pounceAvailable ? (
                  <TurfButton
                    label={`Pounce${pumpedLabel ?? ''}`}
                    icon="paw"
                    detail={pounceReady ? 'Ready' : 'Used'}
                    state={pounceReady ? (pumpedOn ? 'selected' : 'ready') : 'used'}
                    onPress={castPounce}
                    accessibilityLabel={pounceReady ? 'Pet pounce' : 'Pet pounce used'}
                    style={styles.streetGrow}
                  />
                ) : null}
                {GAME_SPEEDS.map((value) => (
                  <TurfButton
                    key={value}
                    label={`${value}×`}
                    icon={value === 1 ? 'play' : 'fast-forward'}
                    state={speed === value ? 'selected' : 'ready'}
                    primary={speed === value}
                    onPress={() => setSpeed(value)}
                    accessibilityLabel={`Speed ${value} times`}
                    style={styles.streetSpeed}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={[styles.turfSetupDock, phase !== 'setup' && styles.streetReserved]}>
              <NeonButton
                label="Setup ▲"
                variant="secondary"
                onPress={() => setSetupOpen(true)}
                accessibilityLabel="Setup: wave, drops, replays and effects"
                style={styles.turfSetupButton}
              />
              <View style={styles.turfCallSlot}>
                <Pressable
                  onPress={startWave}
                  accessibilityRole="button"
                  accessibilityLabel={fight.mode === 'replay' ? 'Call replay' : 'Call wave'}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.callButton,
                    {
                      backgroundColor: theme.accentFill,
                      borderColor: controlBorderColor(theme),
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={[styles.callLabel, { color: theme.onAccent }]}>
                    {fight.mode === 'replay' ? 'CALL REPLAY' : 'CALL WAVE'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )
        }
        float={
          pauseMenuOpen ? (
            <View style={[styles.turfPauseWrap, { height: waveFrame.stage.height + waveFrame.notice.height }]} pointerEvents="box-none">
              <View
                style={[styles.turfPauseCard, { backgroundColor: theme.backgroundElement, borderColor: controlBorderColor(theme) }]}
                accessibilityViewIsModal>
                <ThemedText type="subheading">Paused</ThemedText>
                <NeonButton label="Resume" variant="primary" onPress={() => setPaused(false)} accessibilityLabel="Resume wave" style={styles.turfPauseButton} />
                <NeonButton label="Leave" variant="secondary" onPress={requestLeaveRun} accessibilityLabel="Leave run" style={styles.turfPauseButton} />
              </View>
            </View>
          ) : (
            <>
              {/* Newbie guide (finish step 5): only on the setup board, never during a run, a result or an open Setup sheet.
                  Drawn first so a build card or the wave peek sits on top of it. */}
              <GuideHost
                screen="turf"
                view={view}
                active={phase === 'setup' && !setupOpen && !live}
                bottom={setupFrame.dock.height + 8}
                sideInset={12}
              />
              {floatCards}
              {wavePeekCard}
            </>
          )
        }
        modal={
          <PlaySheet open={setupOpen && !live} title="Setup" onClose={() => setSetupOpen(false)} reduceMotion={reduceMotion}>
            <View style={styles.turfSheet}>
              <ThemedText themeColor="textSecondary">
                Protect your street. Drag your Avatar to the thick, and time Root Veil.
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.boardCardLabel}>
                          {boardMap.name}
                          {cycleNote ? ` · ${cycleNote}` : ''}
                          {fight.mode === 'replay' ? ' · replay (half tokens)' : ''}
                        </ThemedText>
              {phase === 'setup' ? (
                <TurfTeamCard
                  leaderHeroId={view.activeAvatarHeroId}
                  leaderFromPet={view.leaderFromPet}
                  leaderGrade={view.turfTeam.leaderGrade}
                  leaderCopies={view.pet.heroes[view.activeAvatarHeroId]?.copies ?? 0}
                  leaderShiny={view.leaderFromPet && view.pet.state.shiny}
                  candidates={view.turfTeam.candidates}
                  picks={helperPicks}
                  onPick={pickHelper}
                />
              ) : null}
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
                      : 'Campaign climb — Trial 1–5, then Main 1–10. Clear Main 10 to Conquer a cycle.'}
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
                    {stageElement ? (
                      <MaterialCommunityIcons
                        name={TAG_ICON[stageElement]}
                        size={14}
                        color={TAG_COLOR[stageElement]}
                      />
                    ) : null}
                    <ThemedText type="smallBold">
                      Stage · {stageElement ? TAG_LABEL[stageElement] : 'Neutral'}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setChartOpen((open) => !open)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Stage element matchup"
                    style={({ pressed }) => [pressed && styles.pressed]}>
                    <ThemedText
                      type="smallBold"
                      themeColor={
                        stageMatchup.kind === 'favoured'
                          ? 'emphasis'
                          : 'textSecondary'
                      }>
                      {stageMatchupShort(stageMatchup)}
                    </ThemedText>
                  </Pressable>
                </View>
                {chartOpen ? (
                  <ThemedView type="backgroundElement" style={styles.chartCard}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {stageMatchupDetail(stageMatchup)}
                    </ThemedText>
                  </ThemedView>
                ) : null}
                {phase !== 'running' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {activeSkill.name}: {activeSkill.description} ({getTune().skillCooldownMs / 1000}s cooldown)
                  </ThemedText>
                ) : null}
              </PlayFrame>
              {phase === 'setup' && coach.why ? (
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
              {phase === 'setup' ? (
                <>
                  {/* Fight card — campaign next or the chosen replay. */}
                  <ThemedView type="backgroundElement" style={styles.card}>
                    <View style={styles.statRow}>
                      <ThemedText type="smallBold">{fightTitle(fight)}</ThemedText>
                      <ThemedText type="subheading" themeColor="emphasis">
                        {waveSpawnSummary(fight.phase, fight.wave)}
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
                            ? `The campaign climb — ${cycleNote}. Place towers, then call the wave.`
                            : 'The campaign climb — Trial teaches the path, Main is the real deal. Place towers, then call the wave.'}
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
                    <SpeedControl speed={speed} onChange={setSpeed} />
                  </ThemedView>

                  {/* Drops sits just above Maps (Main setup only, collapsed). */}
                  {fight.phase === 'main' ? dropsCard : null}

                  {/* Maps (§ — board picker, Main only): the locked ATO default vs the
                      parked Neon Maze prototype. Trial never shows this, and players never see it:
                      the picker is a dev tool (Divecore finish step 1, emci 2026-10-18). */}
                  {fight.phase === 'main' && PRE_LAUNCH_DEV && devUnlocked ? (
                    <ThemedView type="backgroundElement" style={styles.card}>
                      <View style={styles.statRow}>
                        <ThemedText type="smallBold">Maps</ThemedText>
                        <ThemedText type="code" themeColor="textSecondary">
                          {BOARD_MAPS[boardId].name}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        ATO is the locked default. Neon Maze is the parked letter-maze
                        prototype — pick it to playtest that board.
                      </ThemedText>
                      <View style={styles.mapList}>
                        {BOARD_ORDER.map((id) => {
                          const board = BOARD_MAPS[id];
                          const active = boardId === id;
                          return (
                            <Pressable
                              key={id}
                              onPress={() => selectBoard(id)}
                              accessibilityRole="button"
                              accessibilityLabel={`Select ${board.name}`}
                              style={({ pressed }) => [
                                styles.mapCard,
                                { borderColor: active ? theme.accent : theme.border },
                                active && { backgroundColor: theme.backgroundSelected },
                                pressed && styles.pressed,
                              ]}>
                              <ThemedText type="smallBold" themeColor={active ? 'emphasis' : undefined}>
                                {board.name}
                              </ThemedText>
                              <ThemedText type="code" themeColor="textSecondary">
                                {id === 'ato' ? 'Locked path · default' : 'Letter maze · parked'}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                      {/* T8: map themes paint the ATO board only (Neon Maze keeps its own look). */}
                      {boardHasThemes(boardId) ? <TurfThemePicker /> : null}
                    </ThemedView>
                  ) : (
                    // T8: Trial has no board picker, so the theme row gets its own card.
                    <ThemedView type="backgroundElement" style={styles.card}>
                      <TurfThemePicker />
                    </ThemedView>
                  )}

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

                  {/* Drops — Trial keeps its previous slot here (setup order
                      unchanged); Main renders the same collapsed card above Maps. */}
                  {fight.phase !== 'main' ? dropsCard : null}

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

              {/* Effects Quality (EFFECTS_PLAN step 5): Full → Minimal → Off. Off
                  keeps the element-coloured damage numbers. */}
              <Pressable
                onPress={() => setFxQuality(nextFxQuality(fxQuality))}
                accessibilityRole="button"
                accessibilityLabel={`Effects: ${FX_QUALITY_LABEL[fxQuality]}. Tap to change.`}
                style={({ pressed }) => [styles.fxQualityRow, pressed && styles.pressed]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {`Effects: ${FX_QUALITY_LABEL[fxQuality]}`}
                </ThemedText>
              </Pressable>
              {phase === 'running' && !street ? (
                <ThemedView type="backgroundElement" style={styles.bottomHud}>
                  <Pressable
                    onPress={castSkill}
                    disabled={!skillReady}
                    accessibilityRole="button"
                    accessibilityLabel={
                      skillReady
                        ? `Cast ${activeSkill.name}`
                        : `Skill ${activeSkill.name} cooling, ${skillSeconds} seconds`
                    }
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
                      numberOfLines={1}
                      style={{ color: skillReady ? theme.onAccent : theme.textSecondary }}>
                      {skillReady ? `Cast · ${activeSkill.name}` : `${activeSkill.name} · ${skillSeconds}s`}
                    </ThemedText>
                  </Pressable>
                  {pounceAvailable ? (
                    <Pressable
                      onPress={castPounce}
                      disabled={!pounceReady}
                      accessibilityRole="button"
                      accessibilityLabel={
                        pounceReady
                          ? 'Pet pounce, once this wave, hits foes near your Avatar'
                          : 'Pet pounce used this wave'
                      }
                      style={({ pressed }) => [
                        styles.hudButton,
                        styles.bottomHudPounce,
                        { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
                        // v26: an active Pumped (or its Maxed aura) glows gold.
                        pumpedOn && styles.pounceGold,
                        pressed && pounceReady && styles.pressed,
                      ]}>
                      <ThemedText
                        type="smallBold"
                        numberOfLines={1}
                        themeColor={pounceReady ? undefined : 'textSecondary'}>
                        {pounceReady ? 'Pet pounce · once this wave' : 'Pet pounce · used this wave'}
                        {pumpedLabel}
                      </ThemedText>
                    </Pressable>
                  ) : null}
                  <View style={styles.bottomHudRow}>
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
                    <SpeedControl speed={speed} onChange={setSpeed} />
                  </View>
                </ThemedView>
              ) : null}

            </View>
          </PlaySheet>
        }
      />
      {/* The Defend dev kit is built here (it acts on the live board) but SHOWS in
          the floating DEV kit — DevSlotFill hands it over and renders nothing. */}
      {PRE_LAUNCH_DEV && devUnlocked ? (
        <DevSlotFill>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Dev kit · defend only
          </ThemedText>
          {/* Four collapsible groups, ALL collapsed on entry (the kit is ~30
              rows). Every row that was in the flat list is still here, in the
              same form — only the grouping changed. */}
          <DevSection
            id="heroes"
            title="Heroes"
            open={devSections.heroes}
            onToggle={toggleDevSection}>
            {/* Whole-roster actions first, then ONE compact row per hero
                (Own · Avatar · Bind) instead of the same 16 heroes listed
                three times over in three separate blocks — the flat
                48-row version was unreadable while testing (emci,
                2026-09-22). The bind chip is disabled, not hidden, for the
                active Avatar, so its own refusal reads as "can't, because
                it's your Avatar" rather than the row just being absent. */}
            <DevRow label="Own all heroes" onPress={() => void onDevOwnAllHeroes()} />
            <DevRow label="Clear hero offer" onPress={() => void onDevClearHeroOffer()} />
            <DevRow
              label="Clear owned heroes (→ Corvus)"
              onPress={() => void onDevClearOwnedHeroes()}
            />
            <DevRow
              label="Place bound on next free pad"
              onPress={devPlaceBoundOnNextFreePad}
            />
            {allHeroes().map((hero) => (
              <HeroDevRow
                key={hero.id}
                name={hero.name}
                isActiveAvatar={hero.id === view.activeAvatarHeroId}
                onOwn={() => void onDevOwnHero(hero.id)}
                onSetAvatar={() => void onDevSetAvatarHero(hero.id)}
                onBind={() => {
                  void onBindHeroAsTower(hero.id).then((reason) => {
                    if (reason && __DEV__) {
                      console.warn(`[dev] bind ${hero.id} refused: ${reason}`);
                    }
                  });
                }}
              />
            ))}
          </DevSection>

          <DevSection
            id="campaign"
            title="Campaign"
            open={devSections.campaign}
            onToggle={toggleDevSection}>
            <DevRow label="Win wave" disabled={phase !== 'running'} onPress={() => winWave()} />
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
              label="Reset campaign to Trial wave 1"
              onPress={() => {
                onResetCampaign();
                buildSetup({ phase: 'trial', wave: 1, mode: 'campaign' });
              }}
            />
            <DevRow
              label="Jump to Main wave 9"
              onPress={() => {
                onJumpMain9();
                buildSetup({ phase: 'main', wave: 9, mode: 'campaign' });
              }}
            />
            <DevRow
              label="Jump to Scout (Main wave 5)"
              onPress={() => {
                onJumpScout();
                buildSetup({ phase: 'main', wave: 5, mode: 'campaign' });
              }}
            />
            <DevRow
              label="Jump to Final (Main wave 10)"
              onPress={() => {
                onForceFinal();
                buildSetup({ phase: 'main', wave: 10, mode: 'campaign' });
              }}
            />
            <DevRow label="Preview boss beat (Final)" disabled={!sim} onPress={previewBossBeat} />
            <DevRow
              label="Force Conquered +1"
              onPress={() => {
                onForceConquered();
                buildSetup({ phase: 'main', wave: 1, mode: 'campaign' });
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
          </DevSection>

          <DevSection
            id="gear"
            title="Gear / Stars"
            open={devSections.gear}
            onToggle={toggleDevSection}>
            <DevRow
              label="Set GS high (overgear)"
              onPress={() => {
                onDevOvergear();
                setLastWin(null);
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
          </DevSection>

          <DevSection
            id="board"
            title="Board / Misc"
            open={devSections.board}
            onToggle={toggleDevSection}>
            <DevRow
              label="+40 scrap"
              disabled={!sim}
              onPress={() => setSim((prev) => (prev ? { ...prev, scrap: prev.scrap + 40 } : prev))}
            />
            <DevRow
              label="Clear all towers"
              disabled={!sim || sim.towers.length === 0}
              onPress={() =>
                setSim((prev) => {
                  const next = prev ? { ...prev, towers: [] } : prev;
                  commitBoard(next);
                  return next;
                })
              }
            />
            <DevRow
              label="Clear Bound Bosses"
              disabled={!sim || sim.boundBosses.length === 0}
              onPress={() =>
                setSim((prev) => {
                  const next = prev ? { ...prev, boundBosses: [] } : prev;
                  commitBoard(next);
                  return next;
                })
              }
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
              label={noCaps ? 'No caps (on)' : 'No caps: towers / bosses / heroes'}
              onPress={() => {
                const next = !noCaps;
                setKnob('devNoCaps', next); // tune doc — survives restarts
                void saveTune();
                setNoCaps(next);
              }}
            />
            <DevRow
              label={`Board skin: ${BOARD_SKIN_LABEL[boardSkin]} (tap to switch)`}
              onPress={() =>
                setBoardSkin((skin) => (skin === 'neon' ? 'grove-classic' : 'neon'))
              }
            />
            <DevRow
              label={coachHidden ? 'Show coach' : 'Coach on'}
              onPress={() => setCoachHidden((hidden) => !hidden)}
            />
            {/* EFFECTS_PLAN step 1 — measure before building any effect. */}
            <DevRow
              label={fpsMeterOn ? 'FPS meter (on)' : 'FPS meter'}
              onPress={() => setFpsMeterOn((on) => !on)}
            />
            <DevRow
              label={`Stress effects: ${stressFx === 0 ? 'off' : stressFx} (tap to cycle)`}
              onPress={() => setStressFx((level) => nextStressFxLevel(level))}
            />
            <DevRow
              label="Stress wave: +20 creeps now"
              disabled={phase !== 'running' || !sim}
              onPress={devAddStressCreeps}
            />
          </DevSection>
        </ThemedView>
        </DevSlotFill>
      ) : null}

      {/* Mid-run leave confirm — a blocking Neon Viper overlay (same chrome as
          CALL WAVE / the 1x·2x control). Cancel resumes the exact pre-confirm
          state; Leave calls the existing `abandonRun` (no win, no rewards). */}
      {phase === 'running' && leaveConfirmOpen ? (
        <View style={styles.leaveConfirmWrap}>
          <View
            style={[
              styles.leaveConfirmCard,
              surfaceShadow(theme, reduceMotion),
              {
                backgroundColor: theme.backgroundElement,
                borderColor: controlBorderColor(theme),
              },
            ]}>
            <ThemedText
              type="codeBold"
              style={[styles.bossWarnTitle, { color: theme.accentSecondary }]}>
              LEAVE RUN?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Progress this wave is lost.
            </ThemedText>
            <View style={styles.leaveConfirmRow}>
              <Pressable
                onPress={cancelLeaveRun}
                accessibilityRole="button"
                accessibilityLabel="Keep fighting"
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.leaveConfirmButton,
                  {
                    backgroundColor: theme.backgroundSelected,
                    borderColor: controlBorderColor(theme),
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  CANCEL
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmLeaveRun}
                accessibilityRole="button"
                accessibilityLabel="Leave run"
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.leaveConfirmButton,
                  {
                    backgroundColor: theme.accentFill,
                    borderColor: controlBorderColor(theme),
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  LEAVE
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Slice A2 — the one-shot "Hero owned" offer (Final → Archangel, Scout →
          Oni). The SAVE's `hero_offer` queue is what fires it exactly once; the
          sheet then owns a local copy so its confirmation survives the action
          that clears the queue. Actions call the store's setters, which own the
          exclusivity + cap rules; the sheet only reports refusals. */}
      {heroSheetOffer ? (
        <HeroOwnSheet
          key={heroSheetOffer.hero_id}
          offer={heroSheetOffer}
          isActiveAvatar={view.activeAvatarHeroId === heroSheetOffer.hero_id}
          leaderFromPet={view.leaderFromPet}
          onSetAvatar={() => onSetAvatarHero(heroSheetOffer.hero_id)}
          onBind={() => onBindHeroAsTower(heroSheetOffer.hero_id)}
          onDismiss={closeHeroSheet}
          onOpenDress={openDressFromSheet}
        />
      ) : null}
    </View>
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

/** One hero's dev actions as a single scannable row: the name, then three
 * small chips (Own · Avatar · Bind) instead of three separate full-width
 * `DevRow`s scattered across three passes over the same 16 heroes. The Bind
 * chip is DISABLED, not omitted, for the active Avatar — `onBindHeroAsTower`
 * itself refuses that hero, and a missing chip reads as broken where a
 * disabled one reads as "not this one." */
function HeroDevRow({
  name,
  isActiveAvatar,
  onOwn,
  onSetAvatar,
  onBind,
}: {
  name: string;
  isActiveAvatar: boolean;
  onOwn: () => void;
  onSetAvatar: () => void;
  onBind: () => void;
}) {
  const theme = useTheme();
  const chip = (label: string, onPress: () => void, disabled?: boolean) => (
    <Pressable
      key={label}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${name}`}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.devHeroChip,
        { backgroundColor: theme.backgroundElement, borderColor: controlBorderColor(theme) },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText type="small" themeColor={disabled ? 'textSecondary' : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
  return (
    <View style={styles.devHeroRow}>
      <ThemedText type="small" style={styles.devHeroName} numberOfLines={1}>
        {name}
      </ThemedText>
      {chip('Own', onOwn)}
      {chip('Avatar', onSetAvatar)}
      {chip('Bind', onBind, isActiveAvatar)}
    </View>
  );
}

/** The collapsible groups the Defend Dev kit folds into. */
type DevSectionId = 'heroes' | 'campaign' | 'gear' | 'board';

/**
 * One collapsible Dev kit group — a header row that expands its `DevRow`s. The
 * kit grew to ~30 actions, so the flat list became four groups, ALL collapsed on
 * entry; opening one is a single tap on its header (same tap-to-expand shape the
 * old one-off "Hero lab" toggle used). Dev-only by construction: the card this
 * renders inside is `PRE_LAUNCH_DEV` + unlock gated by its parent.
 */
function DevSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: DevSectionId;
  title: string;
  open: boolean;
  onToggle: (id: DevSectionId) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <>
      <Pressable
        onPress={() => onToggle(id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? `Collapse ${title}` : `Expand ${title}`}
        style={({ pressed }) => [
          styles.devSectionHeader,
          { backgroundColor: theme.backgroundSelected, borderColor: controlBorderColor(theme) },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" themeColor="emphasis">
          {title}
        </ThemedText>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.accent}
        />
      </Pressable>
      {open ? <View style={styles.devSectionBody}>{children}</View> : null}
    </>
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
          kill ? styles.floaterKill : { color: floater.color ?? theme.text },
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
        kill ? styles.floaterKill : { color: floater.color ?? theme.text },
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
 * inside its 244px frame).
 */
const AVATAR_ART_FRAC = 0.275;
/** Floor for the art box, px (small boards). */
const AVATAR_MIN_PX = 70;

/* ---------------------------------------------------- CastActor clip player --- */
/** The Avatar's one-shot clips — `walk`/`idle` loops are set by the anim tick,
 * these are the preemptable one-shots. The shared `CastActor` ladder / frame /
 * startOnce helpers live in `src/play/cast-actor.ts`. */
type AvatarOnce = 'dash' | 'attack' | 'skill' | 'hurt';
/** A pad tower's one-shot clips (its `idle` is the loop). */
type TowerOnce = 'attack' | 'skill';

/** Recovery tail after a skill one-shot ends, during which the auto-attack clip
 * is also refused — the cast's last frames would otherwise be clipped. Damage
 * and cooldowns are untouched; this is the CLIP only. */
const AVATAR_SKILL_RECOVER_MS = 150;
/** Avatar anim tick (ms) — just drives the frame re-render; the frame itself is
 * time-derived so a dropped tick never desyncs. */
const AVATAR_ANIM_TICK_MS = 50;

/** Drawable for one frame of a CastActor clip, resolved at the sticky E/W
 * face — a packed sheet crop when the hero's clip is converted, else the
 * legacy per-frame PNG (see `directionalClipDrawable`). `walk` reads the
 * role's locomotion clip; the rest read `anims`. Undefined when the clip
 * isn't authored at all — callers fall back to the static rotation art. */
/** P5 — the helper draws a touch smaller than a hero tower so the leader stays the biggest hero. */
const HELPER_DRAW_UNITS = 14;

/** P5b — the helper as the board draws it this render. */
type HelperDraw = {
  id: number;
  slot: number;
  heroId: string;
  x: number;
  y: number;
  dazed: boolean;
  gettingUp: boolean;
  moving: boolean;
  face: SkinWalkFace;
};
/** P5b — which clip + frame the helper shows: faint (dazed) → get-up (faint reversed) → its one-shot,
 * else walk while moving, else idle. Retires a finished one-shot back to idle (the tower rule). */
type HelperPose = { clip: 'faint' | 'getup' | 'walk' | 'actor'; frame: number; actor?: CastActor };
function helperPose(
  h: HelperDraw,
  now: number,
  actors: Record<number, CastActor>,
  koAt: Record<number, number>,
  upAt: Record<number, number>,
  walkAt: Record<number, number>,
  /** The sim's get-up time in real ms at this game speed (0.6 s at 1x, 0.3 s at 2x). */
  getUpRealMs: number,
): HelperPose {
  const role = turfHelperRole(h.heroId);
  if (h.dazed) return { clip: 'faint', frame: castActorFaintFrame(now, koAt[h.id] ?? now - 10_000, role) };
  if (h.gettingUp) {
    return { clip: 'getup', frame: castActorGetUpFrame(now, upAt[h.id] ?? now - 10_000, getUpRealMs, role) };
  }
  const actor = actors[h.id] ?? castActorCreate('tower', castActorIdleSeed(-h.id, 'tower'));
  if (actor.onceEndAt > 0 && now >= actor.onceEndAt) {
    actor.clip = 'idle';
    actor.clipStartAt = now;
    actor.onceEndAt = 0;
  }
  actors[h.id] = actor;
  if (actor.clip === 'idle' && h.moving && castActorClipFrames('walk', role) > 0) {
    const at = walkAt[h.id] ?? now;
    walkAt[h.id] = at;
    return { clip: 'walk', frame: castActorWalkFrame(now, at, role) };
  }
  delete walkAt[h.id];
  return { clip: 'actor', frame: castActorFrame(actor, now, role), actor };
}
/** P5b — the drawable for a helper pose at its face. */
function helperPoseDrawable(h: HelperDraw, role: SkinRole, pose: HelperPose): ClipDrawable | undefined {
  if (pose.clip === 'faint' || pose.clip === 'getup') {
    return directionalClipDrawable(role.anims?.faint, roleAnimFaceIndex(role, 'faint', h.face), pose.frame);
  }
  if (pose.clip === 'walk') return directionalClipDrawable(role.walk, roleWalkFaceIndex(role, h.face), pose.frame);
  return pose.actor ? castActorFrameDrawable(pose.actor, h.face, pose.frame, role) : undefined;
}

/** P5 — one draw role per Turf helper hero, built once per art skin (the board reads it every frame). */
const TURF_HELPER_ROLES = new Map<string, SkinRole>();
function turfHelperRole(heroId: string): SkinRole {
  const key = `${artSkin()}:${heroId}`;
  let role = TURF_HELPER_ROLES.get(key);
  if (!role) {
    role = resolveTurfHelperKit(heroId);
    TURF_HELPER_ROLES.set(key, role);
  }
  return role;
}

function castActorFrameDrawable(
  actor: CastActor,
  face: SkinWalkFace,
  frame: number,
  role: SkinRole,
): ClipDrawable | undefined {
  return actor.clip === 'walk'
    ? directionalClipDrawable(role.walk, roleWalkFaceIndex(role, face), frame)
    : directionalClipDrawable(
        role.anims?.[actor.clip],
        roleAnimFaceIndex(role, actor.clip, face),
        frame,
      );
}

/* ------------------------------------------------------- click-to-move --- */
/** Walk speed, board units (0..100) per second. */
const AVATAR_WALK_UNITS_PER_SEC = 42;
/** Walk loop cadence (ms) — 30fps. */
const MOVE_TICK_MS = 33;

/* ---------------------------------------------------- entity presenter v0 --- */

/** Which skin role draws each tower job (art only — math unchanged). */
const TOWER_ROLE: Record<TowerKind, SkinRoleId> = {
  archer: 'tower.archer',
  vine: 'tower.vine',
  crystal: 'tower.crystal',
};

/** Tower draw roles with the clip kit resolved: the static rotation role PLUS
 * the tower skin's idle/attack `anims` when its art is bundled. Used by the
 * clip player + renderer; `TOWER_ROLE` above stays the metadata/static-art id.
 * Cached per art skin (PlaySettings.artSkin), so switching styles re-resolves. */
const TOWER_KIT_CACHE = new Map<ArtSkinId, Record<TowerKind, SkinRole>>();
function towerKitRole(kind: TowerKind): SkinRole {
  const art = artSkin();
  let roles = TOWER_KIT_CACHE.get(art);
  if (!roles) {
    roles = { archer: towerSkinRole('archer'), vine: towerSkinRole('vine'), crystal: towerSkinRole('crystal') };
    TOWER_KIT_CACHE.set(art, roles);
  }
  return roles[kind];
}

/** Fallback tower box, board units, when a role omits `units`. */
const TOWER_PAD_UNITS = 17;
/** Display-only ×1.25 on every tower / bound-boss box (skin packs set their own
 * `units`, so the fallback alone doesn't grow them). Feet stay on the pad via
 * `skinDrawBox`; tap/range radii are untouched. */
const TOWER_DRAW_SCALE = 1.25;
/** Display-only ×2.5 on the tower shot. The Kenney shot image is a 16px dot in
 * a 64px square (three-quarters empty), so at its skin size of 4.5 units the
 * visible dot measured ~3pt on an iPhone board — too small to see. This makes
 * the dot ~2.8 board units (~8pt). The centre-pivot box keeps it on its flight
 * line; damage, speed and hit radius are untouched. */
const SHOT_DRAW_SCALE = 2.5;
/** Fallback enemy box at `puff.size === 1` when a role omits `units`. */
const UNIT_BASE_UNITS = 20;

/**
 * Board-unit width of a creep's drawn sprite box — the input the lane clamp
 * needs. Mirrors the render's `spriteSize` from `puff.kind` / `puff.size` /
 * role draw scale so every presenter that anchors to a creep (damage floaters,
 * the Avatar's facing aid) lands on the sprite rather than beside it.
 *
 * A boss resolves to its band role in the render; here it resolves to the
 * `unit.puff` box. That only matters through the clamp, and boss art sits wide
 * enough that both routes land at ~0, so the difference is under 0.1 board
 * units — well below visibility.
 */
function creepBoxUnits(puff: Puff): number {
  const role: SkinRoleId =
    puff.kind === 'runner' ? 'unit.runner' : puff.kind === 'tank' ? 'unit.tank' : 'unit.puff';
  return skinUnits(role, UNIT_BASE_UNITS) * puff.size * CREEP_DRAW_SCALE[creepRole(puff)];
}

/** Lateral lane half-spread for a creep, so every presenter uses the same
 * capped offset the render draws with. Display only. */
function creepLaneHalfFor(puff: Puff): number {
  return creepLaneHalf(creepBoxUnits(puff));
}

/**
 * Skin role a puff is drawn with — the one mapping the board render and the
 * walk tick both use, so the sprite, its walk clip and its gait multiplier can
 * never disagree. Bosses resolve by band (scout mini + scout boss = the Crimson
 * Oni `unit.boss_scout`, final = the Archangel `unit.final`); the three creeps
 * map one-to-one.
 */
/** Next-wave card icon: the role's own board sprite facing south (the boss = that seat's boss band). */
function wavePeekArt(role: CreepRole, phase: CampaignPhase, wave: number): { art?: ClipDrawable; figure?: PeekFigure } {
  const unit: SkinRoleId =
    role === 'boss' ? bandUnitRole(bossBandFor(phase, wave)?.kind ?? '') : role === 'runner' ? 'unit.runner' : role === 'tank' ? 'unit.tank' : 'unit.puff';
  const figure: PeekFigure | undefined = (WAVE_PEEK_FIGURE as Partial<Record<string, PeekFigure>>)[unit];
  return figure ? { art: skinArtDrawable(unit, skinDirIndex(unit, 0, 1)), figure } : {};
}

function puffUnitRole(puff: Puff, bandKind: string | undefined): SkinRoleId {
  if (puff.kind === 'boss') return bandUnitRole(bandKind ?? '');
  if (puff.kind === 'runner') return 'unit.runner';
  if (puff.kind === 'tank') return 'unit.tank';
  return 'unit.puff';
}

/** Level pips drawn at the tower's top-right. Neon cyan matches the board chrome's pad labels. */
const TOWER_MARKER_COLOR = '#00EAFF';
/** Level pip: radius and centre-to-centre step (board units; 1 unit ≈ 4 pt). */
const TOWER_PIP_R = 1;
const TOWER_PIP_STEP = 2.8;
/** Cast tower art fills the middle ~50% of its square canvas (same padding the
 * `footAt` field compensates for), so the VISIBLE sprite's top-right corner sits
 * at 0.75 across / 0.25 down the drawn box. Anchor the badge there — the padded
 * box corner would leave the pips floating right of the art. */
const TOWER_BADGE_X_FRAC = 0.75;
const TOWER_BADGE_Y_FRAC = 0.25;

/** Shot FX: speed in board units/sec and the "reached target" radius. */
const SHOT_SPEED_UNITS_PER_SEC = 95;
const SHOT_HIT_RADIUS = 2.5;
const SHOT_MAX_LIFE_MS = 900;
/** The FX tick is faster than the 100ms sim tick so shots read as motion. */
const FX_TICK_MS = 33;

/**
 * Sprite base facing offset, degrees. Kenney TD tiles are authored facing UP
 * (north = -90° in atan2 space); bump this single constant if a future pack
 * faces a different way. Towers, creeps, the Avatar and shots all add it.
 */
const ART_BASE_FACING_DEG = 90;

/** Rotation (deg) for an up-facing sprite from a direction vector. */
function facingDegrees(dx: number, dy: number): number {
  return (Math.atan2(dy, dx) * 180) / Math.PI + ART_BASE_FACING_DEG;
}

/** World-space rotation (deg) from a point toward a target. */
function aimDegrees(cx: number, cy: number, tx: number, ty: number): number {
  return facingDegrees(tx - cx, ty - cy);
}

/** Recover the heading vector (east = +x) from a stored up-facing `deg`, so a
 * `dirs > 1` role can bucket its per-direction sprite via `skinDirIndex`. */
function headingVectorFromDeg(deg: number): { dx: number; dy: number } {
  const rad = ((deg - ART_BASE_FACING_DEG) * Math.PI) / 180;
  return { dx: Math.cos(rad), dy: Math.sin(rad) };
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
    const pos = creepDrawPosition(puff, map, creepLaneHalfFor(puff));
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
  // Streetwear art style (Turf War).
  streetHidden: { display: 'none' },
  // Fixed regions: hidden but still holding its space (the paused coach line).
  streetReserved: { opacity: 0, pointerEvents: 'none' },
  // Stage layout: the coach / pause line lives in the NoticeLane (one fixed region).
  coachLine: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  turfRoot: { flex: 1, backgroundColor: NEON.ink },
  turfLane: { flex: 1 },
  // The stage: the board only, centred in it (turf-layout.ts).
  turfStage: { flex: 1, alignItems: 'stretch', justifyContent: 'center' },
  turfPauseWrap: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  turfPauseCard: { width: 280, borderRadius: 6, borderWidth: 2, padding: 16, gap: 12, alignItems: 'stretch' },
  turfPauseButton: { minHeight: 48 },
  turfDock: { flex: 1, paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  turfSetupDock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  turfSetupButton: { minWidth: 112 },
  turfCallSlot: { flex: 1 },
  turfFloatPanel: { position: 'absolute', left: 8, right: 8 },
  turfFloatScroll: { gap: 8 },
  turfSheet: { gap: 16 },
  streetHud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: 8,
  },
  // T6: one fixed box for the wave chip AND the boss bar (WAVE_CHIP_BOX), so the top bar never re-lays out.
  streetWave: { width: WAVE_CHIP_BOX.width, height: WAVE_CHIP_BOX.height, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  bossBarBox: { alignItems: 'stretch', gap: 3, backgroundColor: '#181228', borderColor: STREET.mustard, borderWidth: 2, borderRadius: 4, paddingHorizontal: 8 },
  bossBarName: { fontFamily: STREET_FONT.bold, fontSize: 12, color: '#FFD6FB', textTransform: 'uppercase' },
  bossBarTrack: { height: 6, backgroundColor: '#3C2846', overflow: 'hidden' },
  bossBarChip: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#FFD6FB' },
  bossBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#EF4444' },
  bossBarTick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: '#FFFFFF' },
  streetSkill: { minHeight: 52 },
  streetDockRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  streetGrow: { flex: 1 },
  streetSpeed: { minWidth: 52, minHeight: 48 },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    // No side padding: Defend renders inside the Play shell, which already
    // pads 24 per side (this used to double it).
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  dropsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  dropsTitle: {
    textTransform: 'none',
  },
  dropsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dropsGroup: {
    gap: Spacing.one,
  },
  dropsHairline: {
    height: 1,
    backgroundColor: NEON_ROW_LINE,
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
  /** The map card breaks out of the Play shell's 24pt side padding to sit
   * 8pt from the screen edges, with a slim inner padding, so the board uses
   * nearly the full width. Text cards keep their width. */
  boardCard: {
    marginHorizontal: -(Spacing.four - Spacing.two),
    paddingHorizontal: Spacing.one,
  },
  boardCardLabel: {
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
  fxQualityRow: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  devStrip: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  devStripCell: {
    flex: 1,
  },
  devStripFull: {
    marginTop: Spacing.one,
  },
  boardArt: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    elevation: 1,
  },
  pausedBox: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  swordAura: {
    position: 'absolute',
    borderWidth: 3,
    opacity: 0.28,
    zIndex: 4,
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
  /** The visible art, centered inside the touch box. */
  /** P5b helper overlay — same layer as the leader, one step below it. */
  helper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9,
  },
  helperDazed: {
    opacity: 0.55,
  },
  avatarArt: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  /** §9m live bottom HUD card: Skill bar on top, Pause · Speed · Leave below. */
  bottomHud: {
    gap: Spacing.two,
    borderRadius: Spacing.four,
    padding: Spacing.two,
  },
  bottomHudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  bottomHudPause: {
    paddingHorizontal: Spacing.four,
  },
  /** Full-width primary Skill bar — never shares a row, so it can't sliver. */
  bottomHudSkill: {
    alignSelf: 'stretch',
    minHeight: 52,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Pet pounce row (v20) — its own row under the Skill bar. */
  bottomHudPounce: {
    alignSelf: 'stretch',
    minHeight: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** v26 Pumped / Maxed aura: a gold glow on the pounce row (static — the
   * shadow never animates, so Effects Low needs nothing extra). */
  pounceGold: {
    borderColor: '#FFD700',
    borderWidth: 2,
    shadowColor: '#FFD700',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  /** Pink Space Mono eyebrow on the boss warn banner. */
  bossWarnTitle: {
    fontSize: 13,
    letterSpacing: 2,
  },
  /** Mid-run leave confirm — blocking overlay above everything (board + HUD). */
  leaveConfirmWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    backgroundColor: 'rgba(3, 6, 13, 0.6)',
  },
  leaveConfirmCard: {
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.four,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    maxWidth: 320,
  },
  leaveConfirmRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  leaveConfirmButton: {
    minWidth: 96,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  /** Between-wave call row: CALL WAVE pill (flex) + the 1x/2x speed control. */
  callRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  callButton: {
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
  },
  callLabel: {
    letterSpacing: 1,
  },
  /** Neon Viper speed control — cyan-framed segmented 1x / 2x pills. */
  speedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  speedPill: {
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  speedText: {
    letterSpacing: 0.5,
  },
  hudButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
  },
  /** One hero's dev actions: name + 3 chips, one row (HeroDevRow). */
  devHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  devHeroName: {
    flex: 1,
  },
  devHeroChip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  /** Dev kit group header — a bordered row that expands its rows (DevSection). */
  devSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  /** Expanded Dev kit group body — its DevRows, tighter than the card gap. */
  devSectionBody: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  centerText: {
    textAlign: 'center',
  },
  /** Maps picker — stacked board cards (Main only). */
  mapList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  mapCard: {
    gap: Spacing.half,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
