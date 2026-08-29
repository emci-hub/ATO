import { TRAIT_AXES } from '@/lib/traits';
import { selectLibraryEntries, type SelectLibraryOpts } from '@/lib/voice/library';
import type { CheckHistory, VoiceMe } from '@/lib/voice/types';

export type DevTraceSurface = 'sage' | 'explore' | 'dawn' | 'talk';

/** Extensible section registry. A new generating surface adds a row here — no new viewer. */
export const TRACE_SECTIONS = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'talk', label: 'Talk' },
  { id: 'explore', label: 'Explore' },
] as const;

export type TraceSectionId = (typeof TRACE_SECTIONS)[number]['id'];
export type TraceSection = (typeof TRACE_SECTIONS)[number];

export const TRACE_STEP_TYPES = ['context_gather', 'model_call', 'guard_check', 'output'] as const;
export type DevTraceStepType = (typeof TRACE_STEP_TYPES)[number];

export const TRACE_STEP_STATUSES = ['ok', 'flagged', 'failed'] as const;
export type DevTraceStepStatus = (typeof TRACE_STEP_STATUSES)[number];

export interface DevTraceStep {
  step_order: number;
  step_type: DevTraceStepType;
  label: string;
  input_summary: string;
  output_summary: string;
  status: DevTraceStepStatus;
  timestamp: string;
}

export interface DevTraceSession {
  active: boolean;
  expiresAt: string | null;
  remaining: number;
}

export interface DevTraceEvent {
  id: string;
  createdAt: string;
  surface: DevTraceSurface;
  libraryLines: unknown;
  traitSignals: unknown;
  rawBefore: string | null;
  rawAfter: string | null;
  guardFired: string | null;
  steps: DevTraceStep[];
}

export interface DevTraceRecordInput {
  surface: DevTraceSurface;
  libraryLines: unknown;
  traitSignals: unknown;
  rawBefore: string | null;
  rawAfter: string | null;
  guardFired: string | null;
  steps?: DevTraceStep[];
}

export type TraceStepDraft = {
  step_type: DevTraceStepType;
  label: string;
  input_summary: string;
  output_summary: string;
  status: DevTraceStepStatus;
  timestamp?: string;
};

export function clipTraceText(value: string | null | undefined, max = 280): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '—';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`;
}

export function appendTraceStep(steps: DevTraceStep[], draft: TraceStepDraft): DevTraceStep {
  const step: DevTraceStep = {
    step_order: steps.length + 1,
    step_type: draft.step_type,
    label: draft.label,
    input_summary: clipTraceText(draft.input_summary, 480),
    output_summary: clipTraceText(draft.output_summary, 480),
    status: draft.status,
    timestamp: draft.timestamp ?? new Date().toISOString(),
  };
  steps.push(step);
  return step;
}

export function isDevTraceStepType(value: unknown): value is DevTraceStepType {
  return typeof value === 'string' && (TRACE_STEP_TYPES as readonly string[]).includes(value);
}

export function isDevTraceStepStatus(value: unknown): value is DevTraceStepStatus {
  return typeof value === 'string' && (TRACE_STEP_STATUSES as readonly string[]).includes(value);
}

export function parseDevTraceSteps(raw: unknown): DevTraceStep[] {
  if (!Array.isArray(raw)) return [];
  const out: DevTraceStep[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    if (!isDevTraceStepType(rec.step_type) || !isDevTraceStepStatus(rec.status)) continue;
    const order = Number(rec.step_order);
    out.push({
      step_order: Number.isFinite(order) ? order : out.length + 1,
      step_type: rec.step_type,
      label: typeof rec.label === 'string' ? rec.label : rec.step_type,
      input_summary: typeof rec.input_summary === 'string' ? rec.input_summary : '',
      output_summary: typeof rec.output_summary === 'string' ? rec.output_summary : '',
      status: rec.status,
      timestamp: typeof rec.timestamp === 'string' ? rec.timestamp : '',
    });
  }
  return out.sort((a, b) => a.step_order - b.step_order);
}

export function summarizeMe(me: VoiceMe): string {
  const traits = Object.keys(traitSignalsFromMe(me));
  const facts = me.facts?.length ?? 0;
  return clipTraceText(
    [
      `name=${me.name}`,
      `talk_style=${me.talk_style}`,
      `preset=${me.voice_preset ?? 'close_friend'}`,
      `knocks=${me.knocks_you_off || '—'}`,
      `facts=${facts}`,
      `traits=${traits.length ? traits.join(',') : 'none'}`,
    ].join(' · '),
  );
}

export function summarizeChecks(history: CheckHistory[], limit = 7): string {
  const recent = history.slice(-limit);
  if (recent.length === 0) return 'no recent checks';
  return clipTraceText(
    recent
      .map((row) => {
        const read = row.read ? ` "${clipTraceText(row.read, 48)}"` : '';
        return `d${row.day}:${row.status}${read}`;
      })
      .join('; '),
  );
}

export function summarizeLibrary(lines: Array<{ id: string }>): string {
  if (!lines.length) return 'no library lines';
  return `library: ${lines.map((line) => line.id).join(', ')}`;
}

export function traceGuardResult(hits: Array<string | null | undefined>): {
  status: DevTraceStepStatus;
  output_summary: string;
  guardFired: string | null;
} {
  const fired = hits.filter((hit): hit is string => typeof hit === 'string' && hit.trim().length > 0);
  if (fired.length === 0) {
    return { status: 'ok', output_summary: 'no guards fired', guardFired: null };
  }
  return {
    status: 'flagged',
    output_summary: `flagged: ${fired.join(', ')}`,
    guardFired: fired.join(', '),
  };
}

export function eventsForSection(events: DevTraceEvent[], sectionId: string): DevTraceEvent[] {
  return events.filter((event) => event.surface === sectionId);
}

export function traitSignalsFromMe(me: VoiceMe): Record<string, number> {
  const out: Record<string, number> = {};
  for (const axis of TRAIT_AXES) {
    const value = me[axis];
    if (typeof value === 'number') out[axis] = value;
  }
  return out;
}

export function libraryLinesFor(me: VoiceMe, opts: SelectLibraryOpts): Array<{ id: string; paraphrases: string[] }> {
  return selectLibraryEntries(me, opts).map((entry) => ({
    id: entry.id,
    paraphrases: entry.paraphrases,
  }));
}
