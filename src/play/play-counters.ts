/**
 * Anonymous Divecore counters — the I/O (2026-10-15). Rules in `cloud-save-model.ts`; server in
 * wave96 (`bump_play_counter`, no user id stored). Each counter is sent at most once per local day
 * from this phone. Never throws, never blocks play; skips when signed out or offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { parseCounterState, planBump, planOpen, localYmd, type CounterState, type PlayCounter } from '@/play/cloud-save-model';

const KEY = 'ato.play.counters.v1';
let chain: Promise<void> = Promise.resolve();

async function send(names: readonly PlayCounter[]): Promise<void> {
  if (names.length === 0) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    for (const name of names) await supabase.rpc('bump_play_counter', { p_name: name });
  } catch {
    // Best effort: a missed count is fine.
  }
}

function step(plan: (state: CounterState, now: number) => { send: PlayCounter[]; next: CounterState }): void {
  chain = chain
    .then(async () => {
      const now = Date.now();
      const state = parseCounterState(await AsyncStorage.getItem(KEY));
      const out = plan(state, now);
      await AsyncStorage.setItem(KEY, JSON.stringify(out.next));
      await send(out.send);
    })
    .catch(() => {});
}

/** Play opened (also counts a return the next day). */
export function countPlayOpen(): void {
  step((state, now) => planOpen(state, now));
}

/** One of the daily counters (once per local day). */
export function countOnce(name: Exclude<PlayCounter, 'play_open' | 'return_next_day'>): void {
  step((state, now) => {
    const r = planBump(state, name, localYmd(now));
    return { send: r.send ? [name] : [], next: r.next };
  });
}
