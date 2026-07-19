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

router.get('/custom-roles', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);

    const { data: roles, error: rolesError } = await supabase.from('custom_roles').select('*');
    if (rolesError) return c.json({ error: 'Failed to fetch custom roles' }, 500);

    const { data: profiles, error: profError } = await supabase.from('profiles').select('id, name, role');
    if (profError) return c.json({ error: 'Failed to fetch profiles' }, 500);

    const usersByRole: Record<string, any[]> = {};
    if (profiles) {
      profiles.forEach(p => {
        if (!usersByRole[p.role]) usersByRole[p.role] = [];
        usersByRole[p.role].push({ id: p.id, name: p.name });
      });
    }

    const result = (roles || []).map(r => {
      const users = usersByRole[r.name] || [];
      const creator = profiles?.find(p => p.id === r.created_by);
      return {
        ...(toCamelCase(r) as Record<string, unknown>),
        createdByName: creator?.name || 'System',
        userCount: users.length,
        users
      };
    });

    return c.json(result);
  } catch (_e) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.post('/custom-roles', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role, name').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);

    const body = await c.req.json();
    const { name, description, permissions, tabAccess, dashboardWidgets } = body;

    if (!name || name.trim() === '') {
      return c.json({ error: 'Name is required' }, 400);
    }
    const trimName = name.trim();

    if (SYSTEM_ROLES.some(r => r.toLowerCase() === trimName.toLowerCase())) {
      return c.json({ error: 'Cannot create a custom role with a system role name' }, 400);
    }

    const { data: existing } = await supabase.from('custom_roles').select('id').ilike('name', trimName).maybeSingle();
    if (existing) {
      return c.json({ error: 'A custom role with this name already exists' }, 400);
    }

    const { data: inserted, error: insertError } = await supabase.from('custom_roles').insert({
      name: trimName,
      description: description || null,
      permissions: permissions || [],
      tab_access: tabAccess || [],
      dashboard_widgets: dashboardWidgets || [],
      created_by: user.id
    }).select().single();

    if (insertError) {
      return c.json({ error: 'Failed to create custom role: ' + insertError.message }, 500);
    }

    await logActivity({
      userId: user.id,
      userName: prof.name || 'Unknown',
      userRole: prof.role,
      action: 'create',
      entityType: 'custom_role',
      entityId: inserted.id,
      description: `Created custom role: ${trimName}`
    });

    return c.json(toCamelCase(inserted), 201);
  } catch (_e) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.put('/custom-roles/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role, name').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);

    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, description, permissions, tabAccess, dashboardWidgets } = body;

    if (!name || name.trim() === '') {
      return c.json({ error: 'Name is required' }, 400);
    }
    const trimName = name.trim();

    if (SYSTEM_ROLES.some(r => r.toLowerCase() === trimName.toLowerCase())) {
      return c.json({ error: 'Cannot utilize a system role name' }, 400);
    }

    const { data: existing } = await supabase.from('custom_roles').select('id').ilike('name', trimName).neq('id', id).maybeSingle();
    if (existing) {
      return c.json({ error: 'Another custom role with this name already exists' }, 400);
    }

    const { data: updated, error: updateError } = await supabase.from('custom_roles').update({
      name: trimName,
      description: description !== undefined ? description : null,
      permissions: permissions || [],
      tab_access: tabAccess || [],
      dashboard_widgets: dashboardWidgets || []
    }).eq('id', id).select().single();

    if (updateError) {
      return c.json({ error: 'Failed to update custom role: ' + updateError.message }, 500);
    }
    
    if (!updated) {
      return c.json({ error: 'Custom role not found' }, 404);
    }

    await logActivity({
      userId: user.id,
      userName: prof.name || 'Unknown',
      userRole: prof.role,
      action: 'update',
      entityType: 'custom_role',
      entityId: id,
      description: `Updated custom role: ${trimName}`
    });

    return c.json(toCamelCase(updated));
  } catch (_e) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.delete('/custom-roles/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role, name').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);

    const id = c.req.param('id');
    const { data: roleToDelete } = await supabase.from('custom_roles').select('name').eq('id', id).maybeSingle();
    if (!roleToDelete) return c.json({ error: 'Custom role not found' }, 404);

    const roleName = roleToDelete.name;

    let body: { reassignments?: Array<{ userId: string; newRole: string }> } | null = null;
    try {
      body = await c.req.json();
    } catch (_err) {
      body = null;
    }

    if (!body || !body.reassignments || !Array.isArray(body.reassignments)) {
      // Phase 1
      const { data: usersWithRole } = await supabase.from('profiles').select('id, name').eq('role', roleName);
      if (usersWithRole && usersWithRole.length > 0) {
        return c.json({ users: usersWithRole }, 409);
      }
    } else {
      // Phase 2
      const reassignments = body.reassignments;
      
      const { data: usersWithRole } = await supabase.from('profiles').select('id, name').eq('role', roleName);
      const assignedUserIds = (usersWithRole || []).map(u => u.id);
      const reassignedUserIds = reassignments.map((r: any) => r.userId);
      const missingUsers = assignedUserIds.filter(id => !reassignedUserIds.includes(id));
      const uniqueReassignments = new Set(reassignedUserIds);
      const unrelatedUsers = reassignedUserIds.filter(id => !assignedUserIds.includes(id));
      
      if (missingUsers.length > 0 || reassignedUserIds.length !== uniqueReassignments.size || unrelatedUsers.length > 0) {
        return c.json({ error: 'Reassignments must cover exactly all currently assigned users' }, 400);
      }
      
      const allCustomRolesRes = await supabase.from('custom_roles').select('name');
      const validCustomRoles = (allCustomRolesRes.data || []).map(r => r.name);
      
      for (const r of reassignments) {
        if (!SYSTEM_ROLES.includes(r.newRole as any) && !validCustomRoles.includes(r.newRole)) {
          return c.json({ error: `Invalid role specified for reassignment: ${r.newRole}` }, 400);
        }
        if (r.newRole === roleName) {
           return c.json({ error: 'Cannot reassign to the role being deleted' }, 400);
        }
      }

      const { error: rpcError } = await supabase.rpc('delete_custom_role_txn', {
        p_role_id: id,
        p_reassignments: reassignments,
        p_user_id: user.id,
        p_user_name: prof.name || 'Unknown',
        p_user_role: prof.role
      });
      
      if (rpcError) {
        return c.json({ error: 'Failed to delete role: ' + rpcError.message }, 500);
      }
      
      return c.json({ deleted: true, reassigned: reassignments.length });
    }

    const { error: delError } = await supabase.from('custom_roles').delete().eq('id', id);
    if (delError) return c.json({ error: 'Failed to delete role: ' + delError.message }, 500);

    await logActivity({
      userId: user.id,
      userName: prof.name || 'Unknown',
      userRole: prof.role,
      action: 'delete',
      entityType: 'custom_role',
      entityId: id,
      description: `Deleted custom role: ${roleName}`
    });

    return c.json({ deleted: true, reassigned: 0 });
  } catch (_e) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});
// ============================================================================

export default router;
