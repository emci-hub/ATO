/**
 * Static crisis card copy (plan: crisis spec). Never AI-generated — this is the
 * fixed copy shown when a message is crisis-flagged, before any router call.
 * 988 in Canada supports call AND text, 24/7/365, in English and French.
 */

/** Sage's gentle one-liner — edit freely, this is draft copy. */
export const CRISIS_INTRO = 'That sounds really heavy to be carrying.';

export const CRISIS_BODY =
  "This isn't something Sage can help with directly — Sage is a coach, not emergency support.";

export interface CrisisAction {
  icon: string;
  label: string;
}

export const CRISIS_ACTIONS: CrisisAction[] = [
  { icon: '📞', label: 'Call 988 (Suicide Crisis Helpline)' },
  { icon: '💬', label: 'Text 988' },
];

export const CRISIS_NOTE = 'These are independent services, not part of ATO.';

export const CRISIS_DISMISS = "I'm okay, keep going";
