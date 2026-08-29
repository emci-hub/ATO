/**
 * What this binary is actually running. expo-updates exposes a per-platform
 * update UUID; EAS group id is only present if the manifest metadata includes it.
 */
export const RUNNING_UPDATE_SHORT = 8;

export type RunningUpdateKind = 'group' | 'update' | 'embedded' | 'local';

export interface RunningUpdateSnapshot {
  enabled: boolean;
  isEmbedded: boolean;
  updateId: string | null;
  groupId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
}

export interface RunningUpdateLabel {
  kind: RunningUpdateKind;
  id: string;
  line: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(row: Record<string, unknown> | null, key: string): string | null {
  if (!row) return null;
  const value = row[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Pull an EAS update group UUID out of a manifest when the server sent one. */
export function groupIdFromManifest(manifest: unknown): string | null {
  const root = asRecord(manifest);
  if (!root) return null;
  const metadata = asRecord(root.metadata);
  const extra = asRecord(root.extra);
  const eas = asRecord(extra?.eas);
  return (
    stringField(metadata, 'updateGroup') ??
    stringField(metadata, 'group') ??
    stringField(eas, 'updateGroup') ??
    stringField(eas, 'group') ??
    null
  );
}

export function shortId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, RUNNING_UPDATE_SHORT);
}

export function formatRunningUpdate(snap: RunningUpdateSnapshot): RunningUpdateLabel {
  const group = shortId(snap.groupId);
  const update = shortId(snap.updateId);
  const runtime = snap.runtimeVersion?.trim() || null;
  const channel = snap.channel?.trim() || null;

  if (group) {
    const bits = ['group', group];
    if (channel) bits.push(channel);
    if (runtime) bits.push(runtime);
    return { kind: 'group', id: group, line: bits.join(' · ') };
  }
  if (update && snap.enabled && !snap.isEmbedded) {
    const bits = ['update', update];
    if (channel) bits.push(channel);
    if (runtime) bits.push(runtime);
    return { kind: 'update', id: update, line: bits.join(' · ') };
  }
  if (snap.isEmbedded || (snap.enabled && !update)) {
    const bits = ['embedded'];
    if (runtime) bits.push(runtime);
    return { kind: 'embedded', id: update ?? 'embedded', line: bits.join(' · ') };
  }
  return { kind: 'local', id: 'local', line: 'local · expo-updates off' };
}
