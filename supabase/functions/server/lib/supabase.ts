import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("FATAL ERROR: Missing Supabase Environment Variables!");
  console.error("SUPABASE_URL present:", !!supabaseUrl);
  console.error("SUPABASE_SERVICE_ROLE_KEY present:", !!serviceRoleKey);
}

export const supabase = createClient(
  supabaseUrl || "https://missing-url.supabase.co",
  serviceRoleKey || "missing-key",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export function createAuthClient() {
  return createClient(
    supabaseUrl || "https://missing-url.supabase.co",
    serviceRoleKey || "missing-key",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function getSupabaseClient(accessToken?: string) {
  if (accessToken) {
    return createClient(
      supabaseUrl || "https://missing-url.supabase.co",
      anonKey || "missing-key",
      {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      }
    );
  }
  return supabase;
}
