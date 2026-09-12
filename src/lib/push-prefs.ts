/**
 * Per-kind notification on/off. Device-local (AsyncStorage), same pattern as
 * `ASKED_KEY` in push.ts. Resets to default (all on) on reinstall/new device —
 * acceptable since these are local-only notifications with no push server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PushKindPref = 'morning' | 'evening' | 'insight' | 'sunday';

const KEY = 'ato.push.prefs.v1';

const DEFAULT_PREFS: Record<PushKindPref, boolean> = {
  morning: true,
  evening: true,
  insight: true,
  sunday: true,
};

function isPushKindPref(value: string): value is PushKindPref {
  return value === 'morning' || value === 'evening' || value === 'insight' || value === 'sunday';
}

export async function getPushPrefs(): Promise<Record<PushKindPref, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = { ...DEFAULT_PREFS };
    for (const [key, value] of Object.entries(parsed)) {
      if (isPushKindPref(key) && typeof value === 'boolean') next[key] = value;
    }
    return next;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function setPushPref(
  kind: PushKindPref,
  enabled: boolean,
): Promise<Record<PushKindPref, boolean>> {
  const current = await getPushPrefs();
  const next = { ...current, [kind]: enabled };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
