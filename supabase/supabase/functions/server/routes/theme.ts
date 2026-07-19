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

// Get user's theme settings
router.get("/theme", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase.from('user_settings')
      .select('theme_colors, theme_mode')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Error fetching theme:', error);
      return c.json({ error: 'Failed to fetch theme' }, 500);
    }

    return c.json({
      colors: data?.theme_colors || null,
      mode: data?.theme_mode || 'system'
    });
  } catch (error) {
    console.error('Theme fetch error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Save user's theme settings
router.put("/theme", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { colors, mode } = await c.req.json();

    // Upsert the user settings
    const { error } = await supabase.from('user_settings')
      .upsert({
        user_id: user.id,
        theme_colors: colors,
        theme_mode: mode,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving theme:', error);
      return c.json({ error: 'Failed to save theme' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Theme save error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
