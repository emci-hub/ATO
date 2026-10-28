/**
 * Almanac slots (PHASE-11a). Pure.
 *
 * Slots: {name} {axis} {axisPct} {pairAxis} {pairPct} {peerFrac} {streak}
 * {pickShare} {lastPick} {eventName} {daysInto}. A missing slot switches the
 * card to its `alt`; a card with no usable `alt` is dropped. After the fill the
 * text must pass the framework fence and stay within 120 characters.
 * `{streak}` reads the Home glow (`streakWithRest`): no new streak (red team C3).
 */
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import type { ClearLean } from '@/lib/daily-line/pick';
import { streakWithRest } from '@/lib/home-path';
import type { TraitAxis, TraitLean } from '@/lib/traits';
import { matchingFrameworkTerms } from '@/lib/voice/framework-fence';

import type { AlmanacCard, AlmanacContext, AlmanacLeanKey } from './types';

export const ALMANAC_SLOTS = [
  'name',
  'axis',
  'axisPct',
  'pairAxis',
  'pairPct',
  'peerFrac',
  'streak',
  'pickShare',
  'lastPick',
  'eventName',
  'daysInto',
] as const;
export type AlmanacSlot = (typeof ALMANAC_SLOTS)[number];

export const ALMANAC_MAX_CHARS = 120;

const SLOT_RE = /\{([A-Za-z]+)\}/g;
const KNOWN = new Set<string>(ALMANAC_SLOTS);

export function slotsIn(text: string): string[] {
  return [...text.matchAll(SLOT_RE)].map((m) => m[1] ?? '');
}

function splitKey(key: AlmanacLeanKey): { axis: TraitAxis; lean: TraitLean } {
  const i = key.indexOf(':');
  return { axis: key.slice(0, i) as TraitAxis, lean: key.slice(i + 1) as TraitLean };
}

/** "Adventurous" and 78: the pole the reader leans to, and how far toward it. */
function poleAndPct(lean: ClearLean): { pole: string; pct: string } {
  const toward = 0.5 + lean.strength;
  return { pole: AXIS_POLE_NAME[lean.axis][lean.lean], pct: String(Math.round(toward * 100)) };
}

/**
 * Slot values for one card. Axis slots use the card's own keys first, else the
 * reader's strongest leans. Values that do not exist are left out (never "0").
 */
export function slotValues(card: AlmanacCard, ctx: AlmanacContext): Partial<Record<AlmanacSlot, string>> {
  const out: Partial<Record<AlmanacSlot, string>> = {};
  const name = ctx.name?.trim();
  if (name) out.name = name;

  const byStrength = [...ctx.leans].sort((a, b) => b.strength - a.strength || a.axis.localeCompare(b.axis));
  const fromCard = (card.axes ?? [])
    .map(splitKey)
    .map(({ axis, lean }) => ctx.leans.find((l) => l.axis === axis && l.lean === lean))
    .filter((l): l is ClearLean => !!l);
  const ordered = [...fromCard, ...byStrength.filter((l) => !fromCard.includes(l))];
  const first = ordered[0];
  const second = ordered[1];
  if (first) {
    const { pole, pct } = poleAndPct(first);
    out.axis = pole;
    out.axisPct = pct;
  }
  if (second) {
    const { pole, pct } = poleAndPct(second);
    out.pairAxis = pole;
    out.pairPct = pct;
  }

  if (ctx.openedYmds && ctx.openedYmds.length > 0) {
    const { streak } = streakWithRest(ctx.openedYmds, ctx.ymd);
    if (streak > 0) out.streak = String(streak);
  }

  const events = ctx.calendar?.events ?? [];
  const event = (card.event ? events.find((e) => e.event === card.event) : undefined) ?? events[0];
  if (event?.name) out.eventName = event.name;
  if (event && typeof event.daysInto === 'number' && Number.isFinite(event.daysInto)) {
    out.daysInto = String(event.daysInto);
  }

  for (const key of ['peerFrac', 'pickShare', 'lastPick'] as const) {
    const value = ctx.extras?.[key]?.trim();
    if (value) out[key] = value;
  }
  return out;
}

/** Fill one template. Null when any slot is unknown or has no value. */
export function fillTemplate(template: string, values: Partial<Record<AlmanacSlot, string>>): string | null {
  let missing = false;
  const text = template.replace(SLOT_RE, (_all, slot: string) => {
    const value = KNOWN.has(slot) ? values[slot as AlmanacSlot] : undefined;
    if (value === undefined) {
      missing = true;
      return '';
    }
    return value;
  });
  return missing ? null : text;
}

/** True when filled text may be shown: framework fence clean and within length. */
export function filledTextOk(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= ALMANAC_MAX_CHARS && matchingFrameworkTerms(trimmed).length === 0;
}

export interface FilledCard {
  text: string;
  usedAlt: boolean;
}

/** Fill a card: text first, then `alt`. Null = the card is dropped for this reader today. */
export function fillCard(card: AlmanacCard, ctx: AlmanacContext): FilledCard | null {
  const values = slotValues(card, ctx);
  const main = fillTemplate(card.text, values);
  if (main !== null && filledTextOk(main)) return { text: main.trim(), usedAlt: false };
  if (card.alt) {
    const alt = fillTemplate(card.alt, values);
    if (alt !== null && filledTextOk(alt)) return { text: alt.trim(), usedAlt: true };
  }
  return null;
}
