/**
 * Dive buttons (2026-09-30) — what the control strip under the scene shows,
 * as pure data, so `check:dive-fx` can hold that EVERY state has a real,
 * non-empty label. The % on a Deeper button is always `run.bustPct[path]`
 * (the exact chance the store rolls against) — this module never computes it.
 *
 *   before a dive     DIVE · 1 CHARGE
 *   out of charges    NO CHARGES · NEXT IN 7M (greyed) + FREE DIVE · SHELLS + MOOD
 *   during a dive     DEEPER · SAFER 20% · DEEPER · RICHER 36% · SURFACE
 *   at max depth      SURFACE
 */
export type DiveButtonId = 'dive' | 'no_charges' | 'free' | 'deeper_safe' | 'deeper_rich' | 'surface';
export type DiveButton = {
  id: DiveButtonId;
  label: string;
  enabled: boolean;
  tone: 'primary' | 'secondary' | 'muted';
  /** Buttons sharing a row sit side by side. */
  row: number;
};

export type DiveButtonInput = {
  active: boolean;
  canDeeper: boolean;
  /** The exact shown % per path (null when no Deeper is on offer). */
  bustPct: { safe: number; rich: number } | null;
  charges: number;
  /** ms until the next charge (null = unknown / full). */
  nextChargeInMs: number | null;
};

function minutesLabel(ms: number | null): string {
  if (ms == null) return 'SOON';
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}H ${m % 60}M` : `${m}M`;
}

export function diveButtons(input: DiveButtonInput): DiveButton[] {
  if (input.active) {
    const out: DiveButton[] = [];
    if (input.canDeeper && input.bustPct) {
      out.push({ id: 'deeper_safe', label: `DEEPER · SAFER ${input.bustPct.safe}%`, enabled: true, tone: 'secondary', row: 0 });
      out.push({ id: 'deeper_rich', label: `DEEPER · RICHER ${input.bustPct.rich}%`, enabled: true, tone: 'secondary', row: 0 });
    }
    out.push({ id: 'surface', label: 'SURFACE', enabled: true, tone: 'primary', row: 1 });
    return out;
  }
  if (input.charges >= 1) return [{ id: 'dive', label: 'DIVE · 1 CHARGE', enabled: true, tone: 'primary', row: 0 }];
  return [
    { id: 'no_charges', label: `NO CHARGES · NEXT IN ${minutesLabel(input.nextChargeInMs)}`, enabled: false, tone: 'muted', row: 0 },
    { id: 'free', label: 'FREE DIVE · SHELLS + MOOD', enabled: true, tone: 'secondary', row: 1 },
  ];
}
