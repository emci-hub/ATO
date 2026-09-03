import { supabase } from '@/lib/supabase';

/** Checks a typed password against the DEV_UNLOCK_PASSWORD Supabase secret. */
export async function verifyDevUnlockPassword(password: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('dev-unlock', {
    body: { password },
  });
  if (error) return false;
  return (data as { ok?: boolean } | null)?.ok === true;
}
