/**
 * Dive FX level (overhaul, 2026-09-29) — how much the Dive scene draws.
 *
 *   full — everything.
 *   low  — the cut list, in order, for phones that stutter: no fish, one
 *          parallax layer, fewer bubbles and no bubble trail, no light rays,
 *          a still vignette instead of the heartbeat pulse.
 *
 * Effects Quality "Minimal"/"Off" (the existing Play setting) means low; the
 * Dev tab in the Pet room can force low to compare. In-memory only.
 */
import { useEffect, useState } from 'react';

import { useFxQuality } from '@/play/fx-quality';

export type DiveFxLevel = 'full' | 'low';

let devLow = false;
const listeners = new Set<(low: boolean) => void>();

export function setDiveFxDevLow(low: boolean): void {
  devLow = low;
  listeners.forEach((fn) => fn(low));
}

export function getDiveFxDevLow(): boolean {
  return devLow;
}

export function useDiveFxLevel(): DiveFxLevel {
  const quality = useFxQuality();
  const [low, setLow] = useState(devLow);
  useEffect(() => {
    listeners.add(setLow);
    return () => {
      listeners.delete(setLow);
    };
  }, []);
  return low || quality !== 'full' ? 'low' : 'full';
}
