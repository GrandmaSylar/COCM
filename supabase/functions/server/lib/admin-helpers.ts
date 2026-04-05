import { supabase } from "../lib/supabase.ts";

export async function isAdminOrDev(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return profile?.role === 'dev' || profile?.role === 'admin';
}
