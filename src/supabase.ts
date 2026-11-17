import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !publishableKey) {
  console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.');
}

export const supabase = createClient(url || 'https://missing.supabase.co', publishableKey || 'missing-key');

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export function mapSupabaseUser(user: {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  user_metadata?: Record<string, unknown>;
} | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email || null,
    displayName: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || ''),
    photoURL: String(user.user_metadata?.avatar_url || user.user_metadata?.picture || '') || null,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}
