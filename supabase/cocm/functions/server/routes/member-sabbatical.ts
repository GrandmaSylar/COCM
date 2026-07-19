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

router.put("/members/:id/sabbatical", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check permission: admin, dev, or pastor with temp permission
    const hasPermission = await checkPermission(user.id, 'manage_members');
    if (!hasPermission) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const id = c.req.param('id');
    const { startDate, endDate, reason } = await c.req.json();

    if (!startDate) {
      return c.json({ error: 'Start date is required' }, 400);
    }

    // Get current status for logging
    const { data: currentMember } = await supabase
      .from('members')
      .select('status')
      .eq('id', id)
      .single();

    if (!currentMember) {
      return c.json({ error: 'Member not found' }, 404);
    }

    const { data: member, error } = await supabase
      .from('members')
      .update({
        status: 'sabbatical',
        sabbatical_start_date: startDate,
        sabbatical_end_date: endDate || null,
        sabbatical_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error setting sabbatical:', error);
      return c.json({ error: 'Failed to set sabbatical' }, 500);
    }

    // Log the status change
    await supabase.from('member_status_log').insert({
      member_id: id,
      previous_status: currentMember.status,
      new_status: 'sabbatical',
      change_type: 'manual',
      changed_by: user.id,
      reason: reason || 'Sabbatical assigned',
    });

    return c.json(toCamelCase(member));
  } catch (error) {
    console.error('Set sabbatical error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.delete("/members/:id/sabbatical", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = await checkPermission(user.id, 'manage_members');
    if (!hasPermission) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const id = c.req.param('id');

    // Clear sabbatical fields
    const { data: member, error } = await supabase
      .from('members')
      .update({
        sabbatical_start_date: null,
        sabbatical_end_date: null,
        sabbatical_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error ending sabbatical:', error);
      return c.json({ error: 'Failed to end sabbatical' }, 500);
    }

    // Log the status change
    await supabase.from('member_status_log').insert({
      member_id: id,
      previous_status: 'sabbatical',
      new_status: member.status,
      change_type: 'manual',
      changed_by: user.id,
      reason: 'Sabbatical ended manually',
    });

    // Trigger recalculation for this member
    await recalculateMemberStatuses(user.id);

    return c.json(toCamelCase(member));
  } catch (error) {
    console.error('End sabbatical error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
