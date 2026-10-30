/**
 * The "Include Quests" switch (quests-game-track-plan §5 fix 10, D2). Device only: no column,
 * no RPC. Off by default. The key starts with `ato.` and is not on the device-level keep-list,
 * so sign-out / account deletion wipes it (`clearLocalAccountData`) and "Preview as new user"
 * removes it from the phone while it runs (`startPreview`); `clearAccountMemoryCaches` resets
 * the in-memory copy. The profile screens are the only readers (`check:quest-blend`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useAccountDataEpoch } from '@/lib/account-data-epoch';

export function includeQuestsKey(userId: string): string {
  return `ato.quests.include.v1:${userId}`;
}

let cache: { userId: string | null; on: boolean } = { userId: null, on: false };
let generation = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Sign-out / deletion: forget the in-memory copy so the next account starts off. */
export function resetIncludeQuestsCache(): void {
  generation += 1;
  cache = { userId: null, on: false };
  emit();
}

async function load(userId: string): Promise<void> {
  const mine = ++generation;
  let on = false;
  try {
    on = (await AsyncStorage.getItem(includeQuestsKey(userId))) === '1';
  } catch {
    on = false;
  }
  if (mine !== generation) return;
  if (cache.userId === userId && cache.on === on) return;
  cache = { userId, on };
  emit();
}

/** [on, setOn] for this account on this phone. Re-reads storage when account data is replaced (Preview). */
export function useIncludeQuests(userId: string | null | undefined): [boolean, (next: boolean) => void] {
  const epoch = useAccountDataEpoch();
  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, epoch]);

  const on = useSyncExternalStore(
    subscribe,
    () => !!userId && cache.userId === userId && cache.on,
    () => false,
  );

  const setOn = useCallback(
    (next: boolean) => {
      if (!userId) return;
      generation += 1;
      cache = { userId, on: next };
      emit();
      const write = next
        ? AsyncStorage.setItem(includeQuestsKey(userId), '1')
        : AsyncStorage.removeItem(includeQuestsKey(userId));
      write.catch((err) => console.log('[quests] include switch not saved:', err));
    },
    [userId],
  );

  return [on, setOn];
}
