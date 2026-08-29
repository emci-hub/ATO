import { supabase } from '@/lib/supabase';

export async function sendEmailOtp(
  email: string,
  createUser: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: createUser },
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) return { error: error.message };
  return { error: null };
}
