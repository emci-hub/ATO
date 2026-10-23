/**
 * Legend history for the 64 names.
 *
 * The scoring change can move someone off the name they already had. That
 * happens once: the old name is archived as a past form, and later passes
 * use the hysteresis letters so a wobble does not flip it again. If the
 * score later matches an archived name, that row is restored.
 *
 * Only an exact computed code (all six name traits high or low) is stored.
 * A borderline title, and a tap that picks one of the two nearest names,
 * never enters the collection. There is no parameter for a picked code.
 *
 * The reveal is a flag plus one line. The animation belongs to the later
 * Legends redesign; it should read `LegendReveal` and then clear it.
 */
import { CORE_AXES, MODIFIER_AXES } from '@/lib/legends64/classify';
import type { LockedPoles } from '@/lib/legends64/identity';

export const LEGEND_ID_RE = /^[HL]{3}-[HL]{3}$/;

export const LEGEND_SHARPER_NOTE = 'Your read got sharper.';
export const LEGEND_PAST_FORM_LABEL = 'A past form';
export const LEGEND_GROWN_OUT_LINE = "You've grown out of this.";
/** Shown in place of the reveal animation until the Legends redesign. */
export const LEGEND_RESTORED_LINE = 'This name fits again.';

export interface LegendForm {
  legendId: string;
  firstEarnedAt: string;
  archivedAt: string | null;
  restoredAt: string | null;
}

export interface LegendHistory {
  forms: LegendForm[];
  /** True after the one-time scoring migration. Later passes keep hysteresis. */
  migrated: boolean;
}

/** The hook the later reveal animation replaces. No motion lives here. */
export interface LegendReveal {
  kind: 'restored';
  legendId: string;
}

export type LegendHistoryEvent =
  | { kind: 'sharper'; legendId: string }
  | { kind: 'restored'; legendId: string }
  | { kind: 'earned'; legendId: string };

export function emptyLegendHistory(): LegendHistory {
  return { forms: [], migrated: false };
}

/** The 64-code when every name trait is high or low. Middle and unknown are not a code. */
export function exactLegendId(poles: LockedPoles): string | null {
  const letters = [...CORE_AXES, ...MODIFIER_AXES].map((axis) => poles[axis]);
  if (!letters.every((letter) => letter === 'H' || letter === 'L')) return null;
  return `${letters.slice(0, 3).join('')}-${letters.slice(3).join('')}`;
}

/** Every legend this account's own scores have produced. Order is earn order. */
export function collectedLegendIds(history: LegendHistory): readonly string[] {
  return history.forms.map((row) => row.legendId);
}

export function activeLegendId(history: LegendHistory): string | null {
  return history.forms.find((row) => row.archivedAt == null)?.legendId ?? null;
}

export function archivedLegendForms(history: LegendHistory): readonly LegendForm[] {
  return history.forms.filter((row) => row.archivedAt != null);
}

export function parseLegendHistory(raw: unknown): LegendHistory {
  if (!raw || typeof raw !== 'object') return emptyLegendHistory();
  const obj = raw as { forms?: unknown; migrated?: unknown };
  const forms: LegendForm[] = [];
  if (Array.isArray(obj.forms)) {
    for (const row of obj.forms) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      if (typeof item.legendId !== 'string' || !LEGEND_ID_RE.test(item.legendId)) continue;
      if (typeof item.firstEarnedAt !== 'string' || item.firstEarnedAt.length === 0) continue;
      forms.push({
        legendId: item.legendId,
        firstEarnedAt: item.firstEarnedAt,
        archivedAt: typeof item.archivedAt === 'string' ? item.archivedAt : null,
        restoredAt: typeof item.restoredAt === 'string' ? item.restoredAt : null,
      });
    }
  }
  return { forms, migrated: obj.migrated === true };
}

function archiveId(forms: readonly LegendForm[], legendId: string, nowIso: string): LegendForm[] {
  const existing = forms.find((row) => row.legendId === legendId);
  if (!existing) {
    return [...forms, { legendId, firstEarnedAt: nowIso, archivedAt: nowIso, restoredAt: null }];
  }
  return forms.map((row) =>
    row.legendId === legendId ? { ...row, archivedAt: row.archivedAt ?? nowIso } : row,
  );
}

function makeCurrent(
  forms: readonly LegendForm[],
  legendId: string,
  nowIso: string,
): { forms: LegendForm[]; restored: boolean } {
  const existing = forms.find((row) => row.legendId === legendId);
  const restored = existing?.archivedAt != null;
  const closed = forms.map((row) => {
    if (row.legendId === legendId) return row;
    return row.archivedAt == null ? { ...row, archivedAt: nowIso } : row;
  });
  if (!existing) {
    return {
      forms: [...closed, { legendId, firstEarnedAt: nowIso, archivedAt: null, restoredAt: null }],
      restored: false,
    };
  }
  return {
    restored,
    forms: closed.map((row) =>
      row.legendId === legendId
        ? { ...row, archivedAt: null, restoredAt: restored ? nowIso : row.restoredAt }
        : row,
    ),
  };
}

/**
 * Apply the new reading to the history.
 *
 * Before `migrated`, the previous poles are the name they already had and
 * the next poles are a fresh classification (no hysteresis). That comparison
 * runs once. After it, a middle reading changes nothing, so the name cannot
 * flap in and out of the archive while a trait sits between 45% and 55%.
 */
export function reconcileLegendForms(input: {
  history: LegendHistory;
  previousPoles: LockedPoles;
  nextPoles: LockedPoles;
  nowIso: string;
}): { history: LegendHistory; event: LegendHistoryEvent | null } {
  const nextId = exactLegendId(input.nextPoles);
  if (!input.history.migrated) {
    const oldId = exactLegendId(input.previousPoles);
    let forms = input.history.forms.map((row) => ({ ...row }));
    let event: LegendHistoryEvent | null = null;
    if (oldId && oldId !== nextId) {
      forms = archiveId(forms, oldId, input.nowIso);
      event = { kind: 'sharper', legendId: oldId };
    }
    if (nextId) {
      forms = makeCurrent(forms, nextId, input.nowIso).forms;
      if (!event && oldId == null) event = { kind: 'earned', legendId: nextId };
    }
    return { history: { forms, migrated: true }, event };
  }
  if (nextId == null || activeLegendId(input.history) === nextId) {
    return { history: input.history, event: null };
  }
  const current = makeCurrent(input.history.forms, nextId, input.nowIso);
  return {
    history: { forms: current.forms, migrated: true },
    event: current.restored ? { kind: 'restored', legendId: nextId } : { kind: 'earned', legendId: nextId },
  };
}
