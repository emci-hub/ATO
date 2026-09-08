/**
 * Defend — board + towers (Play steps 5a/5b, GAME_SPEC §9, §9b, §11 screen 5).
 *
 * One Grove Path with puff enemies walking it; six pads hold up to six towers
 * (archer / vine / crystal). Tap a pad to place (or upgrade an existing tower)
 * with scrap; a range ring shows while a pad is selected and hides when idle.
 * Towers auto-fire into range; kills grant scrap; leak = fail; a clean wave is
 * a win. No hero drag / skill yet (5c). No Supabase.
 *
 * The sim is local + transient (see `defend.ts`); only `highest_wave_cleared`
 * persists through the shared store via `onRecordClear`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
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
  TOWER_DEFS,
  TOWER_MAX_LEVEL,
  createDefendLive,
  placeTower,
  puffPosition,
  retryDefendLive,
  stepDefendLive,
  towerUpgradeCost,
  upgradeTower,
  waveEnemyCount,
  type DefendLive,
  type TowerKind,
} from '@/play/defend';
import { bucketMultiplier, type PlayView } from '@/play/playStore';

const PUFF_COLOR = '#F472B6';
const TOWER_COLORS: Record<TowerKind, string> = {
  archer: '#34D399',
  vine: '#A3E635',
  crystal: '#A78BFA',
};

type DefendPhase = 'setup' | 'running' | 'won' | 'lost';

export function DefendScreen({
  view,
  onRecordClear,
  onSetWaveOne,
  onBackToGrove,
}: {
  view: PlayView;
  onRecordClear: (wave: number) => void;
  onSetWaveOne: () => void;
  onBackToGrove: () => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<DefendPhase>('setup');
  const [paused, setPaused] = useState(false);
  const [sim, setSim] = useState<DefendLive | null>(null);
  const [selectedPad, setSelectedPad] = useState<number | null>(null);

  const phaseRef = useRef(phase);
  const pausedRef = useRef(paused);
  const simRef = useRef(sim);
  phaseRef.current = phase;
  pausedRef.current = paused;
  simRef.current = sim;

  const nextWave = view.highestWaveCleared + 1;
  const displayedWave = sim?.wave ?? nextWave;

  // Equipped mult buckets, board-wide for towers (GAME_SPEC §9b).
  const buckets = useMemo(
    () => ({
      wavePower: bucketMultiplier('wave_power', view.statSums),
      towerSpeed: bucketMultiplier('tower_speed', view.statSums),
    }),
    [view.statSums],
  );
  const bucketsRef = useRef(buckets);
  bucketsRef.current = buckets;

  const startWave = useCallback((wave: number) => {
    setSim(createDefendLive(wave));
    setPhase('running');
    setPaused(false);
    setSelectedPad(null);
  }, []);

  const winWave = useCallback(() => {
    const wave = simRef.current?.wave ?? nextWave;
    setPhase('won');
    setPaused(false);
    setSelectedPad(null);
    onRecordClear(wave);
  }, [nextWave, onRecordClear]);

  // Sim ticker: running + not paused.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const id = setInterval(() => {
      const current = simRef.current;
      if (!current) return;
      const step = stepDefendLive(current, DEFEND_TICK_MS, bucketsRef.current);
      simRef.current = step.state;
      setSim(step.state);
      if (step.leak) {
        setPhase('lost');
        setPaused(false);
        setSelectedPad(null);
        return;
      }
      if (step.done) winWave();
    }, DEFEND_TICK_MS);
    return () => clearInterval(id);
  }, [phase, paused, winWave]);

  // Background → freeze the wave (GAME_SPEC §9 pause/background).
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

  const scrap = sim?.scrap ?? 80;

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
          Protect the Grove Path. One leak and the wave ends.
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
          {phase === 'running' ? (
            <Pressable
              onPress={() => setPaused((value) => !value)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.hudButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">{paused ? 'Resume' : 'Pause'}</ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>

        {/* Board */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={[styles.board, { backgroundColor: theme.backgroundSelected }]}>
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
              {/* Pads (tap targets). Selected pad shows a range ring. */}
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
              {/* Range ring for the selected pad. */}
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
              {/* Tower levels */}
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
              {/* Enemies with HP bars. */}
              {sim?.puffs.map((puff) => {
                const pos = puffPosition(puff.dist);
                const x = pos.x * 100;
                const y = pos.y * 100;
                const pct = Math.max(0, Math.min(1, puff.hp / puff.maxHp));
                return (
                  <G key={`puff-${puff.id}`}>
                    <Circle cx={x} cy={y} r={3.4} fill={PUFF_COLOR} />
                    <Rect x={x - 4} y={y - 7} width={8} height={1.6} fill="rgba(0,0,0,0.35)" rx={0.8} />
                    <Rect x={x - 4} y={y - 7} width={8 * pct} height={1.6} fill="#4ADE80" rx={0.8} />
                  </G>
                );
              })}
            </Svg>
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
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              Wave {nextWave} · {waveEnemyCount(nextWave)} puffs
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tap pads to place archers (fast), vines (slow), or crystals (heavy). Puffs that reach
              the exit end the wave.
            </ThemedText>
            <Pressable
              onPress={() => startWave(nextWave)}
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
        ) : null}

        {phase === 'running' && !paused ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Towers fire on their own — Pause freezes the wave.
          </ThemedText>
        ) : null}

        {phase === 'won' ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">Wave {sim?.wave ?? nextWave} cleared</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              The path is safe. Next wave is ready when you are.
            </ThemedText>
            <Pressable
              onPress={() => {
                setSim(null);
                setPhase('setup');
                setSelectedPad(null);
              }}
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
              label="Set wave to 1"
              onPress={() => {
                onSetWaveOne();
                setSim(null);
                setPhase('setup');
                setPaused(false);
                setSelectedPad(null);
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
