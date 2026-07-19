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

// Get activity log
router.get("/activity-log", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const userRole = profile?.role || 'viewer';

    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = (page - 1) * limit;
    const userId = c.req.query('userId');
    const action = c.req.query('action');
    const entityType = c.req.query('entityType');
    const endDate = c.req.query('endDate');
    const startDate = c.req.query('startDate');
    // Fetch dev config rules where is_enabled is false, or specific allowed_roles are set
    const { data: configs } = await supabase
      .from('activity_log_config')
      .select('action_type, entity_type, is_enabled, allowed_roles, allowed_user_ids');

    const hiddenConfigs: { action: string, entity: string }[] = [];
    if (configs) {
      for (const cfg of configs) {
        const isEnabled = cfg.is_enabled;
        const allowedRoles: string[] = cfg.allowed_roles || [];
        const allowedUsers: string[] = cfg.allowed_user_ids || [];

        // If not globally enabled, or if role/user isn't in lists (when lists are not empty)
        let isConfigHidden = false;
        if (!isEnabled) {
          isConfigHidden = true;
        } else if (allowedRoles.length > 0 || allowedUsers.length > 0) {
          const roleMatch = allowedRoles.includes(userRole);
          const userMatch = allowedUsers.includes(user.id);
          if (!roleMatch && !userMatch) {
            isConfigHidden = true; // Hidden for THIS user
          }
        }

        if (isConfigHidden) {
          hiddenConfigs.push({ action: cfg.action_type, entity: cfg.entity_type });
        }
      }
    }

    let query = supabase.from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Dev and admin can see all logs; others see only their own
    const isPrivileged = userRole === 'dev' || userRole === 'admin';
    if (!isPrivileged) {
      query = query.eq('user_id', user.id);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply visibility filter — exclude hidden combinations using De Morgan's Laws
    // NOT (action=A AND entity=B)  ==> (action != A OR entity != B)
    if (hiddenConfigs.length > 0) {
      for (const hc of hiddenConfigs) {
        query = query.or(`action.neq.${hc.action},entity_type.neq.${hc.entity}`);
      }
    }

    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entity_type', entityType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z');

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('Error fetching activity log:', error);
      return c.json({ error: 'Failed to fetch activity log' }, 500);
    }

    return c.json({
      logs: (logs || []).map((l: any) => toCamelCase(l)),
      total: count || 0,
      page,
      limit
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Export activity log
router.get("/activity-log/export", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const userRole = profile?.role || 'viewer';

    const userId = c.req.query('userId');
    const action = c.req.query('action');
    const entityType = c.req.query('entityType');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    // Fetch dev config rules where is_enabled is false, or specific allowed_roles are set
    const { data: configs } = await supabase
      .from('activity_log_config')
      .select('action_type, entity_type, is_enabled, allowed_roles, allowed_user_ids');

    const hiddenConfigs: { action: string, entity: string }[] = [];
    if (configs) {
      for (const cfg of configs) {
        const isEnabled = cfg.is_enabled;
        const allowedRoles: string[] = cfg.allowed_roles || [];
        const allowedUsers: string[] = cfg.allowed_user_ids || [];

        let isConfigHidden = false;
        if (!isEnabled) {
          isConfigHidden = true;
        } else if (allowedRoles.length > 0 || allowedUsers.length > 0) {
          const roleMatch = allowedRoles.includes(userRole);
          const userMatch = allowedUsers.includes(user.id);
          if (!roleMatch && !userMatch) {
            isConfigHidden = true; // Hidden for THIS user
          }
        }

        if (isConfigHidden) {
          hiddenConfigs.push({ action: cfg.action_type, entity: cfg.entity_type });
        }
      }
    }

    let query = supabase.from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    // Dev and admin can see all logs; others see only their own
    const isPrivileged = profile && (profile.role === 'dev' || profile.role === 'admin');
    if (!isPrivileged) {
      query = query.eq('user_id', user.id);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply visibility filter — exclude hidden combinations using De Morgan's Laws
    if (hiddenConfigs.length > 0) {
      for (const hc of hiddenConfigs) {
        query = query.or(`action.neq.${hc.action},entity_type.neq.${hc.entity}`);
      }
    }

    if (action) query = query.eq('action', action);
    if (entityType) query = query.eq('entity_type', entityType);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate + 'T23:59:59.999Z');

    const { data: logs, error } = await query;

    if (error) {
      return c.json({ error: 'Failed to export activity log' }, 500);
    }

    return c.json({ logs: (logs || []).map((l: any) => toCamelCase(l)) });
  } catch (error) {
    console.error('Export activity log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
