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

router.get("/attendance/:id/edit-status", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record } = await supabase
      .from('attendance_records')
      .select('created_at')
      .eq('id', id)
      .single();

    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const createdAt = new Date(record.created_at).getTime();
    const now = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;
    const timeRemaining = Math.max(0, twelveHours - (now - createdAt));
    const isDev = profile?.role === 'dev';

    return c.json({
      canEdit: isDev || timeRemaining > 0,
      timeRemaining: timeRemaining > 0 ? timeRemaining : null,
      lockedAt: timeRemaining <= 0 ? new Date(createdAt + twelveHours).toISOString() : null,
      isDev
    });
  } catch (error) {
    console.error('Get edit status error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
