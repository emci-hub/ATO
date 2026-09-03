/**
 * Static crisis card copy (plan: crisis spec). Never AI-generated — this is the
 * fixed copy shown when a message is crisis-flagged, before any router call.
 *
 * Confirmed numbers: US and Canada only (call or text 988). Any other region
 * uses the honest fallback — do not add a hotline here without it being
 * explicitly confirmed first.
 */

import type { CrisisRegion } from '@/lib/crisis/region';

/** Sage's gentle one-liner — edit freely, this is draft copy. */
export const CRISIS_INTRO = 'That sounds really heavy to be carrying.';

export const CRISIS_BODY =
  "This isn't something Sage can help with directly — Sage is a coach, not emergency support.";

export interface CrisisAction {
  icon: string;
  label: string;
  /** tel:/sms: link for the same static, already-confirmed number below — never generated, never guessed. */
  href: string;
}

/** Specified US service name. Do not rewrite. */
export const CRISIS_SERVICE_US = '988 Suicide & Crisis Lifeline';

/** Specified Canada service name. Do not rewrite. */
export const CRISIS_SERVICE_CA = '988 Suicide Crisis Helpline';

/** Specified fallback when the region is unconfirmed. Do not rewrite. */
export const CRISIS_FALLBACK =
  "We don't have a local crisis line confirmed for your region yet. If you're in immediate danger, contact local emergency services.";

export const CRISIS_NOTE = 'These are independent services, not part of ATO.';

export const CRISIS_DISMISS = "I'm okay, keep going";

export function crisisActionsFor(region: CrisisRegion): CrisisAction[] {
  if (region === 'US') {
    return [
      { icon: '📞', label: `Call 988 (${CRISIS_SERVICE_US})`, href: 'tel:988' },
      { icon: '💬', label: 'Text 988', href: 'sms:988' },
    ];
  }
  if (region === 'CA') {
    return [
      { icon: '📞', label: `Call 988 (${CRISIS_SERVICE_CA})`, href: 'tel:988' },
      { icon: '💬', label: 'Text 988', href: 'sms:988' },
    ];
  }
  return [];
}

export function crisisCardContent(region: CrisisRegion): {
  intro: string;
  body: string;
  actions: CrisisAction[];
  fallback: string | null;
  note: string | null;
  dismiss: string;
} {
  const actions = crisisActionsFor(region);
  const confirmed = actions.length > 0;
  return {
    intro: CRISIS_INTRO,
    body: CRISIS_BODY,
    actions,
    fallback: confirmed ? null : CRISIS_FALLBACK,
    note: confirmed ? CRISIS_NOTE : null,
    dismiss: CRISIS_DISMISS,
  };
}
