/**
 * First-time coach tips (Divecore Phase 4, emci 2026-10-14) — pure.
 *
 * Replaces the blocking five-card tutorial. Five short tips, shown one at a time on the Hideout as
 * a pulsing ring + a few words, in this order: warm the egg · Feed · Underground (the hatch spot) ·
 * the Turf War tab · holo finishes (Info). A tip never blocks input and never resizes a region; any touch marks it seen
 * (the touch still reaches whatever was tapped). Seen flags live in `play_settings.tipsSeen`.
 */
import { COACH_TIPS, type CoachTipId } from '@/play/play-settings';

export const TIP_MAX_WORDS = 6;

export type TipAnchorId = 'egg' | 'feed' | 'hatch' | 'turf' | 'info';

export type CoachTipDef = { id: CoachTipId; text: string; anchor: TipAnchorId };

export const COACH_TIP_DEFS: Record<CoachTipId, CoachTipDef> = {
  warm: { id: 'warm', text: 'Tap the egg to warm it', anchor: 'egg' },
  feed: { id: 'feed', text: 'Feed keeps your pet happy', anchor: 'feed' },
  dive: { id: 'dive', text: 'Ride the hatch to Underground', anchor: 'hatch' },
  turf: { id: 'turf', text: 'Turf War: defend your street', anchor: 'turf' },
  // A pet shows holo only once a finish is applied (Info > Style); nothing else says so.
  holo: { id: 'holo', text: 'Holo finish: Info, then Style', anchor: 'info' },
};

/** What the Hideout knows when it asks for a tip. */
export type TipContext = {
  /** The Hideout is the screen showing, and nothing (sheet, game, Settings, reveal) is open over it. */
  idle: boolean;
  /** The pet is still an egg. */
  egg: boolean;
  /** An egg has been picked (while picking, the room shows the picker, not the egg). */
  eggPicked: boolean;
};

function eligible(id: CoachTipId, ctx: TipContext): boolean {
  if (!ctx.idle) return false;
  if (id === 'warm') return ctx.egg && ctx.eggPicked;
  // While it is an egg, Feed is not available yet and the room spots are hidden.
  return !ctx.egg;
}

/** The one tip to show now: the first unseen one, in order, whose screen state allows it. */
export function pickCoachTip(seen: Record<CoachTipId, boolean>, ctx: TipContext): CoachTipDef | null {
  for (const id of COACH_TIPS) {
    if (!seen[id] && eligible(id, ctx)) return COACH_TIP_DEFS[id];
  }
  return null;
}

export function markTipSeen(seen: Record<CoachTipId, boolean>, id: CoachTipId): Record<CoachTipId, boolean> {
  return seen[id] ? seen : { ...seen, [id]: true };
}

/** "Replay tips": every tip unseen again (the old tutorial flag stays true so nothing blocks). */
export function replayTipsPatch(): { tutorialSeen: true; tipsSeen: Record<CoachTipId, boolean> } {
  return { tutorialSeen: true, tipsSeen: { warm: false, feed: false, dive: false, turf: false, holo: false } };
}

export function allTipsSeen(seen: Record<CoachTipId, boolean>): boolean {
  return COACH_TIPS.every((id) => seen[id]);
}

/** Where the ring and text go, from the anchor's rect and the layer's size (pure, so it is testable). */
export type Rect = { x: number; y: number; width: number; height: number };

export function tipPlacement(anchor: Rect, layer: { width: number; height: number }, textW: number, textH: number) {
  const gap = 8;
  const cx = anchor.x + anchor.width / 2;
  const left = Math.max(8, Math.min(layer.width - textW - 8, cx - textW / 2));
  // Prefer above the anchor; below when there is no room (the Turf tab sits at the bottom, so above).
  const above = anchor.y - gap - textH;
  const below = anchor.y + anchor.height + gap;
  const top = above >= 8 ? above : Math.min(layer.height - textH - 8, below);
  return { left, top };
}
