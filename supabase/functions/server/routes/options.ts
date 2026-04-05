import { Hono } from "hono";
import { supabase } from "../lib/supabase.ts";
import { getUserFromToken, checkPermission } from "../lib/auth-helpers.ts";
import { toCamelCase, toSnakeCase } from "../lib/transform.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";
// Additional helpers
import { logActivity, getProfileForLog } from "../lib/activity-helpers.ts";
import { recalculateMemberStatuses, applyInverseLinks } from "../lib/member-helpers.ts";
import { createNotification, notifyTabUsers } from "../lib/notification-helpers.ts";
import { normalizePhone, generateOtp, maskEmail, maskPhone, sendOtpEmail, sendOtpSms } from "../lib/two-factor-helpers.ts";

const router = new Hono();

// ============================================================================

router.get('/options', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!prof) return c.json({ error: 'Forbidden' }, 403);
    
    // Auth users can read all active options
    const { data, error } = await supabase
      .from('system_dropdown_options')
      .select('*')
      .or('is_active.eq.true,is_active.is.null')
      .order('category')
      .order('label');
      
    if (error) return c.json({ error: 'Failed to fetch options' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
