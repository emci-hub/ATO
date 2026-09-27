/**
 * Saved board layouts — the player's tower setup per map, restored when they
 * come back (emci, 2026-09-26).
 *
 * Kept in its OWN AsyncStorage key, never inside `PlayStoreDoc`: the main save
 * is meta-only (heroes, gear, tokens, unlocks, campaign seat) and stays that
 * way, so a malformed layout can never corrupt progress — the worst case is an
 * empty board. Keyed per campaign phase + board (`trial:ato`, `main:ato`,
 * `main:neon-maze`).
 *
 * Each entry also carries a scrap bank: the WHOLE scrap balance left at the end
 * of a won wave carries into that map's next setup (pads lock while a wave
 * runs, so kill scrap would otherwise have nothing to buy). A kept board gets
 * ONLY that bank — fresh start scrap is for empty boards (emci, 2026-09-27:
 * the gentler rule, so a kept board grows from what the player earns instead
 * of +start scrap every wave). See `setupScrapFor`.
 *
 * The key lives under `ato.*`, so sign-out / delete-account clears it with
 * the rest of the account's local data (correct: it is account progress).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { BoardLayout, DefendMapId, TowerKind } from '@/play/defend';

export const BOARD_LAYOUTS_KEY = 'ato.play.layouts.v1';

const TOWER_KINDS: readonly TowerKind[] = ['archer', 'vine', 'crystal'];

export type SavedLayout = BoardLayout & { bankScrap: number };

type LayoutsDoc = { version: 1; layouts: Record<string, SavedLayout> };

export function layoutKey(phase: DefendMapId, boardId: string): string {
  return `${phase}:${boardId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** After a WAVE RESULT (a win, or a real loss), a kept board never restarts
 * below one cheapest tower's worth of scrap, so a board that keeps losing can
 * always build its way out instead of being stuck forever. Applied ONLY where
 * a wave result is written (win bank, lost restage) — never on a rebuild, or
 * spending to 0 and re-entering Defend would mint free scrap. */
export const KEPT_BOARD_MIN_SCRAP = 40;

/** Scrap a setup board starts with: an empty board gets the tune's start
 * scrap (+ any bank); a kept board runs on its bank exactly. */
export function setupScrapFor(opts: { keptBoard: boolean; startScrap: number; bank: number }): number {
  const bank = Math.max(0, Math.floor(opts.bank));
  return opts.keptBoard ? bank : opts.startScrap + bank;
}

/** What a setup edit banks: a kept board banks its unspent balance; an emptied
 * board banks only what is above the start scrap it will be given again, so a
 * rebuild restores the exact balance either way. */
export function setupBankFor(opts: { keptBoard: boolean; scrap: number; startScrap: number }): number {
  return opts.keptBoard ? Math.max(0, opts.scrap) : Math.max(0, opts.scrap - opts.startScrap);
}

/** Parse one saved layout, dropping every malformed entry (never throws). */
export function parseLayout(raw: unknown): SavedLayout | null {
  if (!isRecord(raw)) return null;
  const towers: SavedLayout['towers'] = [];
  if (Array.isArray(raw.towers)) {
    for (const t of raw.towers) {
      if (!isRecord(t)) continue;
      const pad = num(t.pad);
      const level = num(t.level);
      const kind = typeof t.kind === 'string' ? (t.kind as TowerKind) : null;
      if (pad == null || level == null || !kind || !TOWER_KINDS.includes(kind)) continue;
      towers.push({ pad, kind, level });
    }
  }
  const bosses: SavedLayout['bosses'] = [];
  if (Array.isArray(raw.bosses)) {
    for (const b of raw.bosses) {
      if (!isRecord(b)) continue;
      const pad = num(b.pad);
      if (pad == null || typeof b.bossId !== 'string' || b.bossId.length === 0) continue;
      bosses.push({ pad, bossId: b.bossId });
    }
  }
  const bank = num(raw.bankScrap);
  return { towers, bosses, bankScrap: bank != null && bank > 0 ? Math.floor(bank) : 0 };
}

/** Parse the whole doc; anything unreadable becomes an empty doc. */
export function parseLayoutsDoc(raw: unknown): LayoutsDoc {
  const doc: LayoutsDoc = { version: 1, layouts: {} };
  if (!isRecord(raw) || !isRecord(raw.layouts)) return doc;
  for (const [key, value] of Object.entries(raw.layouts)) {
    const layout = parseLayout(value);
    if (layout) doc.layouts[key] = layout;
  }
  return doc;
}

let doc: LayoutsDoc = { version: 1, layouts: {} };
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function persist(): void {
  AsyncStorage.setItem(BOARD_LAYOUTS_KEY, JSON.stringify(doc)).catch(() => {
    // Best effort — a failed save only means the board isn't remembered.
  });
}

/** Forget the in-memory copy and read the device again. The Defend screen
 * calls this on mount, so layouts written by a previous account in the same
 * app session (sign-out clears the key, not this module) are never reused. */
export function reloadBoardLayouts(): Promise<void> {
  loaded = false;
  loading = null;
  doc = { version: 1, layouts: {} };
  for (const listener of listeners) listener();
  return loadBoardLayouts();
}

/** Load once (idempotent). Callers never block on it; `useBoardLayoutsLoaded`
 * re-renders when it lands. */
export function loadBoardLayouts(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(BOARD_LAYOUTS_KEY);
      if (raw) doc = parseLayoutsDoc(JSON.parse(raw));
    } catch {
      doc = { version: 1, layouts: {} };
    }
    loaded = true;
    for (const listener of listeners) listener();
  })();
  return loading;
}

export function boardLayoutsLoaded(): boolean {
  return loaded;
}

export function getSavedLayout(key: string): SavedLayout | null {
  return doc.layouts[key] ?? null;
}

/** Save a board's layout, keeping that map's bank. No-op until loaded (an
 * early save would overwrite the stored layout with an empty board). */
export function saveBoardLayout(key: string, layout: BoardLayout): void {
  if (!loaded) return;
  const bankScrap = doc.layouts[key]?.bankScrap ?? 0;
  doc = { ...doc, layouts: { ...doc.layouts, [key]: { ...layout, bankScrap } } };
  persist();
}

/** Set a map's bank: the balance at the end of a won wave, or the unspent
 * balance after a setup edit (so a rebuild before the wave keeps it). */
export function setBankScrap(key: string, amount: number): void {
  if (!loaded) return;
  const current = doc.layouts[key] ?? { towers: [], bosses: [], bankScrap: 0 };
  const bankScrap = amount > 0 ? Math.floor(amount) : 0;
  if (current.bankScrap === bankScrap && doc.layouts[key]) return;
  doc = { ...doc, layouts: { ...doc.layouts, [key]: { ...current, bankScrap } } };
  persist();
}

/** A map's banked scrap without clearing it — a board built before the wave
 * starts may be rebuilt (seat update, board switch, leaving Defend), so the
 * bank tracks the unspent balance through setup and is only CONSUMED when the
 * wave starts (`takeBankScrap`). */
export function peekBankScrap(key: string): number {
  if (!loaded) return 0;
  return doc.layouts[key]?.bankScrap ?? 0;
}

/** Pay out (and clear) a map's bank. */
export function takeBankScrap(key: string): number {
  const current = doc.layouts[key];
  if (!loaded || !current || current.bankScrap <= 0) return 0;
  doc = { ...doc, layouts: { ...doc.layouts, [key]: { ...current, bankScrap: 0 } } };
  persist();
  return current.bankScrap;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void loadBoardLayouts();
  return () => {
    listeners.delete(listener);
  };
}

/** True once the saved layouts have been read from the device. */
export function useBoardLayoutsLoaded(): boolean {
  return useSyncExternalStore(subscribe, boardLayoutsLoaded, boardLayoutsLoaded);
}
