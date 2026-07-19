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

// Get user's general preferences
router.get("/preferences", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase.from('user_settings')
      .select('default_paper_size')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching preferences:', error);
      return c.json({ error: 'Failed to fetch preferences' }, 500);
    }

    return c.json({
      defaultPaperSize: data?.default_paper_size || 'a4'
    });
  } catch (error) {
    console.error('Preferences fetch error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Save user's general preferences
router.put("/preferences", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { defaultPaperSize } = await c.req.json();

    const allowedSizes = ['a4', 'letter', 'legal', 'tabloid', 'executive', 'a5'];
    if (!allowedSizes.includes(defaultPaperSize)) {
      return c.json({ error: 'Invalid paper size' }, 400);
    }

    // Upsert the user settings
    const { error } = await supabase.from('user_settings')
      .upsert({
        user_id: user.id,
        default_paper_size: defaultPaperSize,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving preferences:', error);
      return c.json({ error: 'Failed to save preferences' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Preferences save error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
