import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(supabaseUrl && anonKey);

// A separate storage key keeps this app's session apart from the main app's.
// Signing in here uses Supabase Auth directly. It deliberately does NOT call the
// app's /auth/signin route, which would overwrite active_device_id and sign the
// user out of the main app.
export const supabase = createClient(supabaseUrl ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { storageKey: 'cocm-admin-auth', persistSession: true, autoRefreshToken: true },
});
export { anonKey };
