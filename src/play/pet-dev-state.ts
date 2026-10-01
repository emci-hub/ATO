/**
 * Pet room dev toggles (dev builds only) — a tiny external store so the Pet
 * dev panel can live OUTSIDE the Pet screen (in the floating DEV kit) and still
 * drive the room: forced status, forced night, the Shiny look, and "say a line".
 * Session-only; nothing here is saved.
 */
import { useSyncExternalStore } from 'react';

import { getShinyLook, setShinyLook, type ShinyLook } from '@/play/pet-looks';
import { PET_STATUSES, type PetStatus } from '@/play/pet-status';
import type { PetTalkSituation } from '@/play/pet-talk';

export type DevNight = 'auto' | 'on' | 'off';
export type PetDevRoom = {
  status: PetStatus | null;
  night: DevNight;
  shinyLook: ShinyLook;
  /** A "say this" request; `nonce` changes on every press. */
  say: { situation: PetTalkSituation; nonce: number } | null;
};

let state: PetDevRoom = { status: null, night: 'auto', shinyLook: getShinyLook(), say: null };
const listeners = new Set<() => void>();

function set(next: Partial<PetDevRoom>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const get = () => state;

export function usePetDevRoom(): PetDevRoom {
  return useSyncExternalStore(subscribe, get, get);
}

/** real → each status in turn → real. */
export function nextDevStatus(cur: PetStatus | null): PetStatus | null {
  const i = cur == null ? -1 : PET_STATUSES.indexOf(cur);
  return i + 1 >= PET_STATUSES.length ? null : PET_STATUSES[i + 1];
}

export function nextDevNight(n: DevNight): DevNight {
  return n === 'auto' ? 'on' : n === 'on' ? 'off' : 'auto';
}

export function nextShinyLook(l: ShinyLook): ShinyLook {
  return l === 'auto' ? 'blend' : l === 'blend' ? 'wash' : 'auto';
}

export function cycleDevStatus(): void {
  set({ status: nextDevStatus(state.status) });
}

export function cycleDevNight(): void {
  set({ night: nextDevNight(state.night) });
}

export function cycleShinyLook(): void {
  const next = nextShinyLook(state.shinyLook);
  setShinyLook(next);
  set({ shinyLook: next });
}

export function requestDevSay(situation: PetTalkSituation): void {
  set({ say: { situation, nonce: (state.say?.nonce ?? 0) + 1 } });
}
