/**
 * Next-wave preview (step T2b) — pure, no React Native (check:turf-war-layout runs it in Node).
 * Reads the wave director's group table; no new data. The seat order is the campaign's own:
 * Trial 1..5 → Main 1..10 → Main 1 again (a new cycle).
 */
import { waveDefFor, type SpawnRole } from '@/play/director';

export type WavePeekPhase = 'trial' | 'main';

/** Row order in the card: the same order the roster is named everywhere else. */
export const WAVE_PEEK_ROLE_ORDER: readonly SpawnRole[] = ['swarm', 'runner', 'tank', 'boss'];

export type WavePeekRow = { role: SpawnRole; count: number };

export type WavePeek = {
  phase: WavePeekPhase;
  wave: number;
  /** True when the next wave is in a different phase than the current one (the card names the phase). */
  phaseChanged: boolean;
  rows: WavePeekRow[];
  total: number;
  element: string | null;
};

/** The wave that follows (phase, wave) in the campaign order. */
export function nextWaveSeat(
  phase: WavePeekPhase,
  wave: number,
  counts: { trial: number; main: number },
): { phase: WavePeekPhase; wave: number } {
  if (wave < counts[phase]) return { phase, wave: wave + 1 };
  return { phase: 'main', wave: 1 };
}

/** Creep counts per role for the next wave, or null when the director has no table for it. */
export function nextWavePeek(
  phase: WavePeekPhase,
  wave: number,
  counts: { trial: number; main: number },
): WavePeek | null {
  const seat = nextWaveSeat(phase, wave, counts);
  const def = waveDefFor(seat.phase, seat.wave);
  if (!def) return null;
  const byRole = new Map<SpawnRole, number>();
  for (const group of def.groups) byRole.set(group.role, (byRole.get(group.role) ?? 0) + group.count);
  const rows = WAVE_PEEK_ROLE_ORDER.filter((role) => byRole.has(role)).map((role) => ({ role, count: byRole.get(role)! }));
  return {
    phase: seat.phase,
    wave: seat.wave,
    phaseChanged: seat.phase !== phase,
    rows,
    total: rows.reduce((sum, row) => sum + row.count, 0),
    element: def.element ?? null,
  };
}
