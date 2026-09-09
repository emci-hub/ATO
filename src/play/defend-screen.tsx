/**
 * Defend — board + towers + Avatar + skill (Play steps 5a/5b/5c, GAME_SPEC §9,
 * §9b, §9d, §11 screen 5).
 *
 * One Grove Path with puff enemies walking it; six pads hold up to six towers
 * (archer / vine / crystal). Tap a pad to place/upgrade with scrap; a range
 * ring shows while a pad is selected. The Avatar (placeholder circle) is
 * draggable and auto-attacks the nearest enemy in range; one skill button
 * casts slow_pulse "Root Veil" (12s cooldown). Kills → scrap; leak = fail; a
 * clean wave = win (tokens + XP via `onWin`). No SakPix, no new tower types.
 *
 * The sim is local + transient (see `defend.ts`); only `highest_wave_cleared`,
 * `xp`, and `avatar_level` persist through the shared store.
 */
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
import {
  DEFEND_PADS,
  DEFEND_PATH,
  DEFEND_TICK_MS,
  SKILL_COOLDOWN_MS,
  SKILL_DESCRIPTION,
  SKILL_NAME,
  TOWER_DEFS,
  TOWER_MAX_LEVEL,
  castSlowPulse,
  createDefendLive,
  placeTower,
  puffPosition,
  retryDefendLive,
  stepDefendLive,
  towerUpgradeCost,
  upgradeTower,
  waveEnemyCount,
  type DefendLive,
  type Puff,
  type TowerKind,
} from '@/play/defend';
import {
  avatarLevelWavePower,
  bucketMultiplier,
  type DefendWinResult,
  type PlayView,
} from '@/play/playStore';
import { tipForWave } from '@/play/coach';

const PUFF_COLOR = '#F472B6';
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
 * sole owner of combat math.
 */
function diffPuffEvents(before: readonly Puff[], after: readonly Puff[]): HitEvent[] {
  const byId = new Map(after.map((puff) => [puff.id, puff]));
  const events: HitEvent[] = [];
  for (const old of before) {
    const now = byId.get(old.id);
    if (!now) {
      // Killed — the last visible chunk of its HP is the killing blow.
      const pos = puffPosition(old.dist);
      events.push({ x: pos.x, y: pos.y, damage: Math.round(old.hp), kill: true });
    } else if (now.hp < old.hp) {
      const damage = old.hp - now.hp;
      const pos = puffPosition(now.dist);
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

export function DefendScreen({
  view,
  reduceMotion,
  onWin,
  onSetWaveOne,
  onResetDailyClears,
  onSetClearsTodayFive,
  onGrantMilestoneWaveFive,
  onResetMilestones,
  onBackToGrove,
}: {
  view: PlayView;
  /** Reduce-motion → floaters render static (no rise/fade). */
  reduceMotion: boolean;
  onWin: (wave: number) => Promise<DefendWinResult | null>;
  onSetWaveOne: () => void;
  onResetDailyClears: () => void;
  onSetClearsTodayFive: () => void;
  onGrantMilestoneWaveFive: () => Promise<void>;
  onResetMilestones: () => void;
  onBackToGrove: () => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<DefendPhase>('setup');
  const [paused, setPaused] = useState(false);
  /** The live board. Always present so towers can be placed during SETUP
   * (spawns wait until Start); transitions rebuild it at the right times. */
  const [sim, setSim] = useState<DefendLive | null>(
    () => createDefendLive(view.highestWaveCleared + 1),
  );
  const [selectedPad, setSelectedPad] = useState<number | null>(null);
  const [godMode, setGodMode] = useState(false);
  const [coachHidden, setCoachHidden] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
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

  const nextWave = view.highestWaveCleared + 1;
  const displayedWave = sim?.wave ?? nextWave;

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

  // Equipped mult buckets, board-wide for towers + Avatar.
  const buckets = useMemo(
    () => ({
      wavePower: bucketMultiplier('wave_power', view.statSums),
      towerSpeed: bucketMultiplier('tower_speed', view.statSums),
      avatarLevel: view.avatarLevel,
    }),
    [view.statSums, view.avatarLevel],
  );
  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;

  const displayedWaveRef = useRef(1);
  displayedWaveRef.current = sim?.wave ?? view.highestWaveCleared + 1;

  /** Start the wave on the current board — placed towers + spent scrap carry
   * into the fight (spec §9: setup place → start). */
  const startWave = useCallback(() => {
    setSim((prev) => prev ?? createDefendLive(displayedWaveRef.current));
    setPhase('running');
    setPaused(false);
    setSelectedPad(null);
    prevPuffsRef.current = [];
    setFloaters([]);
  }, []);

  /** Rebuild a fresh board for `wave` and go back to setup (Next wave / dev). */
  const freshRun = useCallback((wave: number) => {
    setSim(createDefendLive(wave));
    setPhase('setup');
    setPaused(false);
    setSelectedPad(null);
    setWhyOpen(false);
    prevPuffsRef.current = [];
    setFloaters([]);
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
    const wave = simRef.current?.wave ?? nextWave;
    setPhase('won');
    setPaused(false);
    setSelectedPad(null);
    void onWin(wave).then((result) => {
      if (result) setLastWin(result);
    });
  }, [nextWave, onWin]);

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
      const events = diffPuffEvents(prevPuffsRef.current, step.state.puffs);
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

  const placeOnPad = (kind: TowerKind) => {
    if (selectedPad == null) return;
    setSim((prev) => (prev ? placeTower(prev, selectedPad, kind) ?? prev : prev));
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
  const scrap = sim?.scrap ?? 80;

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Pressable
            onPress={onBackToGrove}
            hitSlop={12}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ‹ Grove
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText type="subtitle">Defend</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.lede}>
          Protect the Grove Path. Drag your Avatar to the thick, and time Root Veil.
        </ThemedText>

        {/* HUD */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">Wave</ThemedText>
            <ThemedText type="subheading" themeColor="emphasis">
              {displayedWave}
            </ThemedText>
          </View>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">Scrap</ThemedText>
            <ThemedText type="subheading" themeColor="emphasis">
              {scrap}
            </ThemedText>
          </View>
          <View style={styles.statRow}>
            <ThemedText type="smallBold">Avatar · Lv {view.avatarLevel}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ×{levelBonus.toFixed(2)} power
            </ThemedText>
          </View>
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
          <View
            style={[styles.board, { backgroundColor: theme.backgroundSelected }]}
            onLayout={(event) => {
              boardSizeRef.current = event.nativeEvent.layout.width || 100;
            }}>
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Path
                d={pathD()}
                stroke={theme.textSecondary}
                strokeOpacity={0.3}
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {DEFEND_PADS.map((pad, index) => {
                const tower = sim?.towers.find((t) => t.pad === index);
                const selected = selectedPad === index;
                return (
                  <Circle
                    key={`pad-${index}`}
                    cx={pad.x}
                    cy={pad.y}
                    r={5.5}
                    fill={tower ? TOWER_COLORS[tower.kind] : theme.accent}
                    fillOpacity={tower ? 1 : 0.25}
                    stroke={selected ? theme.accent : 'none'}
                    strokeWidth={selected ? 1.4 : 0}
                    onPress={() => setSelectedPad(selected ? null : index)}
                  />
                );
              })}
              {selectedPad != null && (
                <Circle
                  cx={DEFEND_PADS[selectedPad].x}
                  cy={DEFEND_PADS[selectedPad].y}
                  r={selectedTower ? TOWER_DEFS[selectedTower.kind].range : 18}
                  fill="none"
                  stroke={theme.accent}
                  strokeOpacity={0.5}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              )}
              {sim?.towers.map((tower) => {
                const pad = DEFEND_PADS[tower.pad];
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
              {sim?.puffs.map((puff) => {
                const pos = puffPosition(puff.dist);
                const x = pos.x * 100;
                const y = pos.y * 100;
                const pct = Math.max(0, Math.min(1, puff.hp / puff.maxHp));
                const slowed = puff.slowMs > 0;
                return (
                  <G key={`puff-${puff.id}`}>
                    <Circle cx={x} cy={y} r={3.4} fill={PUFF_COLOR} />
                    <Circle cx={x} cy={y} r={3.4} fill={slowed ? theme.accentTertiary : 'none'} fillOpacity={0.5} />
                    <Rect x={x - 4} y={y - 7} width={8} height={1.6} fill="rgba(0,0,0,0.35)" rx={0.8} />
                    <Rect x={x - 4} y={y - 7} width={8 * pct} height={1.6} fill="#4ADE80" rx={0.8} />
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
                    Coach · wave {nextWave}
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
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">
                Wave {nextWave} · {waveEnemyCount(nextWave)} puffs
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Tap pads to place archers, vines, or crystals. Drag your Avatar near the path, then
                start.
              </ThemedText>
              <Pressable
                onPress={() => startWave()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: theme.accentFill },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  Start wave
                </ThemedText>
              </Pressable>
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
              Avatar Lv {view.avatarLevel} — cleared Wave {sim?.wave ?? nextWave}
            </ThemedText>
            {lastWin ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  +{lastWin.tokensGranted} tokens · +{lastWin.xpGranted} XP · Level{' '}
                  {view.avatarLevel} · {lastWin.clearsToday} clears today
                </ThemedText>
                {lastWin.halved ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.halvedNote}>
                    Half tokens today — come back tomorrow for full.
                  </ThemedText>
                ) : null}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                +50 tokens · +{10 + (sim?.wave ?? nextWave) * 2} XP
              </ThemedText>
            )}
            <Pressable
              onPress={() => freshRun((sim?.wave ?? nextWave) + 1)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.accentFill },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Next wave
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void shareDefendClear(sim?.wave ?? nextWave, view.avatarLevel)}
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
              One puff reached the exit — wave {sim?.wave ?? nextWave} ends. Retry the same wave with
              your towers kept.
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

        {PRE_LAUNCH_DEV ? (
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
              label="Reset skill CD"
              disabled={!sim}
              onPress={() => setSim((prev) => (prev ? { ...prev, skillCooldownMs: 0 } : prev))}
            />
            <DevRow
              label={godMode ? 'God mode (on)' : 'God mode'}
              onPress={() => setGodMode((value) => !value)}
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
              label="Set wave to 1"
              onPress={() => {
                onSetWaveOne();
                freshRun(1);
              }}
            />
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

/**
 * Share stub for the win glow card (§13): plain text (Avatar level + wave # +
 * "cleared Wave N"). Uses the Web Share API where present, else the native
 * React Native share sheet. Optional — rewards were already banked by the win.
 */
async function shareDefendClear(wave: number, level: number): Promise<void> {
  const line = `Avatar Lv ${level} — cleared Wave ${wave}`;
  const message = `Grove: ${line}.`;
  const fallback = async () => {
    try {
      await Share.share({ message, title: 'Grove' });
    } catch {
      // user dismissed the sheet — fine
    }
  };
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Grove', text: message });
    } catch {
      // AbortError (dismissed) or unavailable — fall back to the native sheet
      await fallback();
    }
    return;
  }
  await fallback();
}

/** SVG path data for the road (viewBox 100). */
function pathD(): string {
  const [first, ...rest] = DEFEND_PATH;
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
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
