import type { Context } from "hono";
import { supabase } from "./supabase.ts";
import { getUserFromToken } from "./auth-helpers.ts";

export interface DevActor {
  id: string;
  name: string;
  role: string;
}

// Only an active, approved account with the `dev` role may use the /dev/* routes.
// Returns the actor, or a ready-made error response.
export async function requireDev(c: Context): Promise<{ actor: DevActor } | { error: Response }> {
  const user = await getUserFromToken(c.req.raw);
  if (!user) return { error: c.json({ error: 'Unauthorized' }, 401) };

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, is_active, approval_status')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'dev' || profile.is_active === false || profile.approval_status !== 'approved') {
    return { error: c.json({ error: 'Forbidden' }, 403) };
  }
  return { actor: { id: user.id, name: profile.name ?? 'Unknown', role: profile.role } };
}
