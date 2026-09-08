/**
 * Defend — board skeleton (Play step 5a, GAME_SPEC §9, §11 screen 5).
 *
 * One Grove Path (SVG polyline) with puff placeholders walking it. Leak at the
 * exit ends the wave (fail); a clean wave is a win — real wins need towers
 * (5b), so this step's only win source is the Dev kit. The wave fought is
 * `highest_wave_cleared + 1`; Retry replays the same wave with an empty board;
 * Pause freezes the sim; leaving discards the run (scrap is not spent yet, and
 * towers do not exist yet — pads stay empty as specced). No Supabase.
 *
 * The sim is local + transient (see `defend.ts`); only `highest_wave_cleared`
 * persists through the shared store via `onRecordClear` / `onSetWaveOne`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import {
  DEFEND_PATH,
  DEFEND_TICK_MS,
  createDefendLive,
  puffPosition,
  stepDefendLive,
  waveEnemyCount,
  type DefendLive,
} from '@/play/defend';
import { DEFEND_START_SCRAP, type PlayView } from '@/play/playStore';

/** Puff placeholder pink — puff_pink. */
const PUFF_COLOR = '#F472B6';

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

  const phaseRef = useRef(phase);
  const pausedRef = useRef(paused);
  const simRef = useRef(sim);
  phaseRef.current = phase;
  pausedRef.current = paused;
  simRef.current = sim;

  const nextWave = view.highestWaveCleared + 1;
  const displayedWave = sim?.wave ?? nextWave;

  /** Start a run for `wave` (fresh sim; empty board — no towers this step). */
  const startWave = useCallback((wave: number) => {
    setSim(createDefendLive(wave));
    setPhase('running');
    setPaused(false);
  }, []);

  /** Real-clear path — only reachable via the Dev kit this step. */
  const winWave = useCallback(() => {
    const wave = simRef.current?.wave ?? nextWave;
    setPhase('won');
    setPaused(false);
    onRecordClear(wave); // fires-and-forgets the persist; view updates after
  }, [nextWave, onRecordClear]);

  // Sim ticker: only while running and not paused.
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const id = setInterval(() => {
      const current = simRef.current;
      if (!current) return;
      const step = stepDefendLive(current, DEFEND_TICK_MS);
      simRef.current = step.state;
      setSim(step.state);
      if (step.leak) {
        setPhase('lost');
        setPaused(false);
        return;
      }
      if (step.done) {
        // Natural clear (arrives with towers in 5b). Persist the highest.
        winWave();
      }
    }, DEFEND_TICK_MS);
    return () => clearInterval(id);
  }, [phase, paused, winWave]);

  // App in the background → freeze the wave (GAME_SPEC §9 pause/background).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phaseRef.current === 'running' && !pausedRef.current) {
        setPaused(true);
      }
    });
    return () => sub.remove();
  }, []);

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

        {/* HUD: wave, scrap, pause */}
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
              {DEFEND_START_SCRAP}
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
              {/* Spawn + exit markers */}
              <Circle cx={2} cy={20} r={2.4} fill={theme.accentTertiary} />
              <Circle cx={98} cy={60} r={3} fill={theme.accent} />
              {(sim?.puffs ?? []).map((puff) => {
                const pos = puffPosition(puff.dist);
                return <Circle key={puff.id} cx={pos.x * 100} cy={pos.y * 100} r={3.4} fill={PUFF_COLOR} />;
              })}
            </Svg>
          </View>
          {paused && phase === 'running' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Paused — the wave is frozen.
            </ThemedText>
          ) : null}
        </ThemedView>

        {/* Status / actions */}
        {phase === 'setup' ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">
              Wave {nextWave} · {waveEnemyCount(nextWave)} puffs
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Towers come in a later step — for now the path runs on its own. Puffs that reach
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
            Puffs are on the path — Pause freezes the wave.
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
              One puff reached the exit — wave {sim?.wave ?? nextWave} ends. Retry the same wave;
              the board is empty again.
            </ThemedText>
            <Pressable
              onPress={() => sim && startWave(sim.wave)}
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
              }}
            />
            <DevRow
              label="Set wave to 1"
              onPress={() => {
                onSetWaveOne();
                setSim(null);
                setPhase('setup');
                setPaused(false);
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
