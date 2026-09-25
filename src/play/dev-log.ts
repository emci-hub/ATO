/**
 * Dev kit only — send a Play dev test's results to `public.play_dev_logs`
 * (wave73) so they can be read back from a dev machine instead of copied by
 * hand. Non-personal by design: no user id, just the numbers, the platform /
 * device model and the running OTA id.
 *
 * Never throws: a failed send returns false and the caller shows "couldn't
 * send" next to the on-screen results, which stay the source of truth.
 */
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { supabase } from '@/lib/supabase';

export async function sendPlayDevLog(kind: string, payload: unknown): Promise<boolean> {
  if (!PRE_LAUNCH_DEV) return false;
  try {
    const platform = `${Platform.OS} ${String(Platform.Version)} · ${Device.modelName ?? 'unknown'}`;
    const { error } = await supabase.from('play_dev_logs').insert({
      kind,
      payload,
      platform: platform.slice(0, 40),
      app_update: Updates.updateId ?? 'embedded',
    });
    if (error && __DEV__) console.warn('[play-dev-log]', error.message);
    return !error;
  } catch (err) {
    if (__DEV__) console.warn('[play-dev-log]', err);
    return false;
  }
}
