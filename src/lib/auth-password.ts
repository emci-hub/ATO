import { supabase } from '@/lib/supabase';

export const PASSWORD_MIN_LENGTH = 8;

export const LOGIN_PASSWORD_HINT =
  'Only if you have set a password in Settings. Otherwise use a code.';

export const LOGIN_PASSWORD_FAILED =
  'That didn’t work. Use a code, or set a password in Settings after you sign in.';

export const PASSWORD_MISMATCH = 'Those two passwords do not match.';

export const PASSWORD_TOO_SHORT = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;

export const PASSWORD_SET_OK = 'Password saved. You can use it on Log in next time.';

export const PASSWORD_CHANGED_OK = 'Password updated.';

export const CURRENT_PASSWORD_WRONG = 'Current password is not right.';

export const CURRENT_PASSWORD_REQUIRED = 'Enter your current password.';

/** Never log or trace the password value — only length for client-side checks. */
export function passwordMeetsLength(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH;
}

export function passwordsMatch(a: string, b: string): boolean {
  return a.length > 0 && a === b;
}

/**
 * Email as typed, or @handle → auth email via RPC. Null means no match
 * (same user-facing failure as a wrong password — do not say which).
 */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) return trimmed.toLowerCase();

  const { data, error } = await supabase.rpc('login_email_for_identifier', {
    p_identifier: trimmed,
  });
  if (error) return null;
  if (typeof data !== 'string') return null;
  const email = data.trim();
  return email.length > 0 ? email : null;
}

export async function fetchAuthHasPassword(): Promise<boolean> {
  const { data, error } = await supabase.rpc('auth_has_password');
  if (error) return false;
  return data === true;
}

/** GoTrue bcrypt-hashes on the server. Do not log `password`. */
export async function setAuthPassword(password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Confirms the current password by signing in with the session email, then
 * writes the new hash through updateUser. Session stays; password is not logged.
 */
export async function changeAuthPassword(
  currentPassword: string,
  nextPassword: string,
): Promise<{ error: string | null }> {
  if (!currentPassword) {
    return { error: CURRENT_PASSWORD_REQUIRED };
  }
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user?.email) {
    return { error: 'Could not confirm this account. Try again.' };
  }
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: data.user.email,
    password: currentPassword,
  });
  if (checkError) return { error: CURRENT_PASSWORD_WRONG };

  const { error } = await supabase.auth.updateUser({ password: nextPassword });
  if (error) return { error: error.message };
  return { error: null };
}
