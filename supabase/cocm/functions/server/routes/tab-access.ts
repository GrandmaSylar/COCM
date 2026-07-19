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

// Get tab access for a user
router.get("/users/:id/tab-access", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const userId = c.req.param('id');
    const { data, error } = await supabase.from('user_tab_access')
      .select('tab').eq('user_id', userId);

    if (error) {
      console.error('Error fetching tab access:', error);
      return c.json({ error: 'Failed to fetch tab access' }, 500);
    }

    return c.json({ tabs: (data || []).map(d => d.tab) });
  } catch (error) {
    console.error('Get tab access error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Set tab access for a user (dev only)
router.put("/users/:id/tab-access", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single();
    if (!profile || profile.role !== 'dev') {
      return c.json({ error: 'Forbidden: Only dev can manage tab access' }, 403);
    }

    const userId = c.req.param('id');
    const { tabs } = await c.req.json();

    if (!Array.isArray(tabs)) {
      return c.json({ error: 'tabs must be an array' }, 400);
    }

    // Delete existing tab access
    await supabase.from('user_tab_access').delete().eq('user_id', userId);

    // Insert new tab access
    if (tabs.length > 0) {
      const rows = tabs.map((tab: string) => ({
        user_id: userId,
        tab,
        granted_by: user.id
      }));
      const { error } = await supabase.from('user_tab_access').insert(rows);
      if (error) {
        console.error('Error setting tab access:', error);
        return c.json({ error: 'Failed to set tab access' }, 500);
      }
    }

    // Log activity
    const { data: targetProfile } = await supabase.from('profiles').select('name').eq('id', userId).single();
    await logActivity({
      userId: user.id, userName: profile.name, userRole: profile.role,
      action: 'update', entityType: 'user', entityId: userId,
      description: `Updated tab access for ${targetProfile?.name || userId}: ${tabs.join(', ') || 'none'}`
    });

    return c.json({ tabs });
  } catch (error) {
    console.error('Set tab access error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
