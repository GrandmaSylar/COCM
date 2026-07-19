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

// Get notifications for current user
router.get("/notifications", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    const unreadOnly = c.req.query('unreadOnly') === 'true';

    let query = supabase.from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, error, count } = await query;

    if (error) {
      return c.json({ error: 'Failed to fetch notifications' }, 500);
    }

    return c.json({
      notifications: (data || []).map((n: any) => toCamelCase(n)),
      total: count || 0,
      page,
      limit
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get unread count
router.get("/notifications/unread-count", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { count, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      return c.json({ error: 'Failed to fetch unread count' }, 500);
    }

    return c.json({ count: count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Login summary — notifications since last login + birthday check
router.get("/notifications/login-summary", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    // Get user's tab access
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const isDev = profile?.role === 'dev';

    let accessibleTabs: string[] = [];
    if (isDev) {
      accessibleTabs = ['members', 'visitors', 'attendance', 'giving', 'reports', 'services', 'activity-log'];
    } else {
      const { data: tabData } = await supabase.from('user_tab_access').select('tab').eq('user_id', user.id);
      accessibleTabs = (tabData || []).map(t => t.tab);
    }

    // Get unread notifications for accessible tabs
    const { data: unread } = await supabase.from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter to accessible tabs
    const filtered = (unread || []).filter(n => !n.tab || accessibleTabs.includes(n.tab));

    // Birthday check - members with birthdays today
    let birthdays: any[] = [];
    if (isDev || accessibleTabs.includes('members')) {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      const { data: bdayMembers } = await supabase.from('members')
        .select('id, first_name, last_name, date_of_birth')
        .not('date_of_birth', 'is', null);

      birthdays = (bdayMembers || []).filter((m: any) => {
        if (!m.date_of_birth) return false;
        const d = new Date(m.date_of_birth);
        return d.getMonth() + 1 === month && d.getDate() === day;
      }).map((m: any) => ({
        memberId: m.id,
        name: `${m.first_name} ${m.last_name}`,
        dateOfBirth: m.date_of_birth
      }));

      // Create birthday notifications if not already created today
      for (const bday of birthdays) {
        const todayStr = today.toISOString().split('T')[0];
        const { data: existing } = await supabase.from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'birthday')
          .eq('entity_id', bday.memberId)
          .gte('created_at', todayStr)
          .limit(1);

        if (!existing || existing.length === 0) {
          await createNotification({
            userId: user.id,
            type: 'birthday',
            title: 'Birthday Today!',
            message: `${bday.name} has a birthday today.`,
            tab: 'members',
            entityType: 'member',
            entityId: bday.memberId
          });
        }
      }
    }

    // Age-out check — children turning 18 today
    const today2 = new Date();
    const eighteenYearsAgo = new Date(today2);
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    const ageOutDate = eighteenYearsAgo.toISOString().split('T')[0];

    // Check if children table exists before querying
    const { data: ageOutKids } = await supabase
      .from('children_members')
      .select('id, first_name, last_name')
      .eq('date_of_birth', ageOutDate)
      .eq('converted_to_member', false);

    if (ageOutKids && ageOutKids.length > 0) {
      // Get audience from notification_type_config
      const { data: ageOutConfig } = await supabase
        .from('notification_type_config')
        .select('allowed_roles, allowed_user_ids, is_enabled')
        .eq('type', 'child_age_out')
        .maybeSingle();

      if (!ageOutConfig || ageOutConfig.is_enabled !== false) {
        const allowedRoles = ageOutConfig?.allowed_roles || ['admin', 'pastor'];
        const allowedUserIds: string[] = ageOutConfig?.allowed_user_ids || [];

        // Get all users matching allowed roles
        const { data: roleUsers } = await supabase
          .from('profiles')
          .select('id')
          .in('role', allowedRoles)
          .eq('is_active', true);

        const audienceIds = new Set<string>();
        (roleUsers || []).forEach(u => audienceIds.add(u.id));
        allowedUserIds.forEach(id => audienceIds.add(id));

        for (const child of ageOutKids) {
          const todayStr2 = today2.toISOString().split('T')[0];
          for (const recipientId of audienceIds) {
            const { data: existingAO } = await supabase.from('notifications')
              .select('id').eq('user_id', recipientId)
              .eq('type', 'child_age_out').eq('entity_id', child.id)
              .gte('created_at', todayStr2).limit(1);
            if (!existingAO || existingAO.length === 0) {
              await supabase.from('notifications').insert({
                user_id: recipientId,
                type: 'child_age_out',
                title: `${child.first_name} ${child.last_name} has turned 18`,
                message: `This child member has reached the age limit (18). Consider promoting them to the main congregation.`,
                tab: 'children',
                entity_type: 'child_member',
                entity_id: child.id,
              });
            }
          }
        }
      }
    }

    return c.json({
      notifications: filtered.map((n: any) => toCamelCase(n)),
      birthdays,
      accessibleTabs
    });
  } catch (error) {
    console.error('Login summary error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark notification as read
router.patch("/notifications/:id/read", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { error } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return c.json({ error: 'Failed to mark as read' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mark all notifications as read
router.patch("/notifications/read-all", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { error } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      return c.json({ error: 'Failed to mark all as read' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
