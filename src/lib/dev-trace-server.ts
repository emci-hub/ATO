import { supabase } from '@/lib/supabase';
import {
  parseDevTraceSteps,
  type DevTraceEvent,
  type DevTraceRecordInput,
  type DevTraceSession,
  type DevTraceSurface,
} from '@/lib/dev-trace';

function rpcMessage(error: { message?: string } | null): string {
  return error?.message || 'request_failed';
}

export async function recordOwnDevTrace(input: DevTraceRecordInput): Promise<void> {
  try {
    await supabase.rpc('record_dev_trace', {
      p_surface: input.surface,
      p_library_lines: input.libraryLines ?? [],
      p_trait_signals: input.traitSignals ?? {},
      p_raw_before: input.rawBefore,
      p_raw_after: input.rawAfter,
      p_guard_fired: input.guardFired,
      p_steps: input.steps ?? [],
    });
  } catch (err) {
    console.log('[dev-trace] record error:', err);
  }
}

export async function fetchDevTraceSession(): Promise<DevTraceSession> {
  const { data, error } = await supabase.rpc('my_dev_trace_session');
  if (error) throw new Error(rpcMessage(error));
  const raw = data as { active?: boolean; expires_at?: string | null; remaining?: number } | null;
  return {
    active: raw?.active === true,
    expiresAt: raw?.expires_at ?? null,
    remaining: Number(raw?.remaining) || 0,
  };
}

export async function startDevTrace(): Promise<DevTraceSession> {
  const { data, error } = await supabase.rpc('start_dev_trace');
  if (error) throw new Error(rpcMessage(error));
  const raw = data as { active?: boolean; expires_at?: string | null; remaining?: number } | null;
  return {
    active: raw?.active === true,
    expiresAt: raw?.expires_at ?? null,
    remaining: Number(raw?.remaining) || 0,
  };
}

export async function stopDevTrace(): Promise<void> {
  const { error } = await supabase.rpc('stop_dev_trace');
  if (error) throw new Error(rpcMessage(error));
}

export async function listOwnDevTraceEvents(): Promise<DevTraceEvent[]> {
  const { data, error } = await supabase.rpc('list_my_dev_trace_events');
  if (error) throw new Error(rpcMessage(error));
  return ((data ?? []) as Array<{
    id: string;
    created_at: string;
    surface: DevTraceSurface;
    library_lines: unknown;
    trait_signals: unknown;
    raw_before: string | null;
    raw_after: string | null;
    guard_fired: string | null;
    steps: unknown;
  }>).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    surface: row.surface,
    libraryLines: row.library_lines,
    traitSignals: row.trait_signals,
    rawBefore: row.raw_before,
    rawAfter: row.raw_after,
    guardFired: row.guard_fired,
    steps: parseDevTraceSteps(row.steps),
  }));
}
