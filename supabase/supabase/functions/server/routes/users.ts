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
// Get all users (for Settings page)
router.get("/users", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can view users'
      }, 403);
    }
    const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching users:', error);
      return c.json({
        error: 'Failed to fetch users'
      }, 500);
    }

    // Fetch tab access for all users
    const { data: allTabAccess } = await supabase.from('user_tab_access').select('user_id, tab');
    const tabAccessMap: Record<string, string[]> = {};
    if (allTabAccess) {
      for (const ta of allTabAccess) {
        if (!tabAccessMap[ta.user_id]) tabAccessMap[ta.user_id] = [];
        tabAccessMap[ta.user_id].push(ta.tab);
      }
    }

    const usersWithTabs = (users || []).map((u: any) => ({
      ...(toCamelCase(u) as Record<string, unknown>),
      tabAccess: tabAccessMap[u.id] || []
    }));

    return c.json(usersWithTabs);
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Get pending users (waiting for approval)
router.get("/users/pending", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can view pending users'
      }, 403);
    }
    const { data: pendingUsers, error } = await supabase.from('profiles').select('*').eq('approval_status', 'pending').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching pending users:', error);
      return c.json({
        error: 'Failed to fetch pending users'
      }, 500);
    }
    return c.json(toCamelCase(pendingUsers));
  } catch (error) {
    console.error('Get pending users error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Create user directly (by dev/admin in Settings)
router.post("/users", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can create users'
      }, 403);
    }
    const body = await c.req.json();
    const { email, password, name, role, phone, twoFaMethod } = body;
    if (!email || !password || !name || !role) {
      return c.json({
        error: 'Missing required fields'
      }, 400);
    }
    if (!SYSTEM_ROLES.includes(role)) {
      const { data: customRole } = await supabase
        .from('custom_roles')
        .select('name')
        .eq('name', role)
        .maybeSingle();

      if (!customRole) {
        return c.json({
          error: 'Invalid role'
        }, 400);
      }
    }
    if (role === 'dev' && profile.role !== 'dev') {
      return c.json({
        error: 'Only developers can create developer accounts'
      }, 403);
    }
    const normalizedUserPhone = phone ? normalizePhone(phone) : null;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        phone: normalizedUserPhone
      }
    });
    if (authError) {
      console.error('Auth error during user creation:', authError);
      return c.json({
        error: authError.message
      }, 400);
    }
    if (!authData.user) {
      return c.json({
        error: 'Failed to create user'
      }, 500);
    }
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      name,
      email,
      phone: normalizedUserPhone,
      role,
      is_active: true,
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      two_fa_method: twoFaMethod || 'none'
    });
    if (profileError) {
      console.error('Profile creation error:', profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return c.json({
        error: 'Failed to create user profile'
      }, 500);
    }
    // Log activity
    const logPU = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logPU.name, userRole: logPU.role,
      action: 'create', entityType: 'user', entityId: authData.user.id,
      description: `Created user account: ${name} (${role})`
    });

    return c.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name,
        role
      }
    }, 201);
  } catch (error) {
    console.error('Create user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Approve pending user
router.post("/users/:id/approve", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can approve users'
      }, 403);
    }
    const userId = c.req.param('id');
    const { error } = await supabase.from('profiles').update({
      is_active: true,
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }).eq('id', userId);
    if (error) {
      console.error('Error approving user:', error);
      return c.json({
        error: 'Failed to approve user'
      }, 500);
    }
    return c.json({
      message: 'User approved successfully'
    });
  } catch (error) {
    console.error('Approve user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Reject pending user
router.post("/users/:id/reject", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !['dev', 'admin'].includes(profile.role)) {
      return c.json({
        error: 'Forbidden: Only dev and admin can reject users'
      }, 403);
    }
    const userId = c.req.param('id');
    const { error } = await supabase.from('profiles').update({
      is_active: false,
      approval_status: 'rejected'
    }).eq('id', userId);
    if (error) {
      console.error('Error rejecting user:', error);
      return c.json({
        error: 'Failed to reject user'
      }, 500);
    }
    return c.json({
      message: 'User rejected successfully'
    });
  } catch (error) {
    console.error('Reject user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Admin/Dev reset user password
router.post("/users/:id/reset-password", async (c) => {
  try {
    const adminUser = await getUserFromToken(c.req.raw);
    if (!adminUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: adminProfile } = await supabase.from('profiles').select('role, name').eq('id', adminUser.id).single();
    if (!adminProfile || !['dev', 'admin'].includes(adminProfile.role)) {
      return c.json({ error: 'Forbidden: Only dev and admin can reset user passwords' }, 403);
    }

    const userId = c.req.param('id');
    const { newPassword } = await c.req.json();

    if (!newPassword || newPassword.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }

    // Get the target user's profile
    const { data: targetProfile } = await supabase.from('profiles').select('name, role').eq('id', userId).single();
    if (!targetProfile) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Admins cannot reset dev passwords
    if (adminProfile.role === 'admin' && targetProfile.role === 'dev') {
      return c.json({ error: 'Admins cannot reset developer passwords' }, 403);
    }

    // Use admin API to update the user's password
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (updateError) {
      console.error('Error resetting password:', updateError);
      return c.json({ error: 'Failed to reset password: ' + updateError.message }, 500);
    }

    // Log the activity
    await logActivity({
      userId: adminUser.id,
      userName: adminProfile.name,
      userRole: adminProfile.role,
      action: 'update',
      entityType: 'user',
      entityId: userId,
      description: `${adminProfile.name} reset password for ${targetProfile.name}`
    });

    return c.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset user password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user contact info (email/phone) - dev only
router.patch("/users/:id/contact", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'dev') {
      return c.json({ error: 'Forbidden: Only developers can update user contact info' }, 403);
    }

    const userId = c.req.param('id');
    const body = await c.req.json();
    const { email, phone } = body;

    if (!email && phone === undefined) {
      return c.json({ error: 'At least one of email or phone is required' }, 400);
    }

    const profileUpdate: any = {};
    if (email) profileUpdate.email = email;
    if (phone !== undefined) profileUpdate.phone = phone ? normalizePhone(phone) : null;

    // Update profiles table
    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating user contact:', profileError);
      return c.json({ error: 'Failed to update contact info: ' + profileError.message }, 500);
    }

    // If email changed, also update in auth.users
    if (email) {
      const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email });
      if (authError) {
        console.error('Error updating auth email:', authError);
        // Revert profile email change
        return c.json({ error: 'Failed to update auth email: ' + authError.message }, 500);
      }
    }

    return c.json({
      message: 'Contact info updated successfully',
      user: toCamelCase(updatedProfile)
    });
  } catch (error) {
    console.error('Update user contact error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user role (by dev only)
router.patch("/users/:id/role", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || profile.role !== 'dev') {
      return c.json({
        error: 'Forbidden: Only developers can change user roles'
      }, 403);
    }
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { role } = body;

    if (!role) {
      return c.json({ error: 'Invalid role' }, 400);
    }
    
    if (!SYSTEM_ROLES.includes(role as any)) {
      const { data: customRole } = await supabase
        .from('custom_roles')
        .select('name')
        .eq('name', role)
        .maybeSingle();
        
      if (!customRole) {
        return c.json({ error: 'Invalid role' }, 400);
      }
    }
    const { data: updatedProfile, error } = await supabase.from('profiles').update({
      role,
      updated_at: new Date().toISOString()
    }).eq('id', userId).select().single();
    if (error) {
      console.error('Error updating user role:', error);
      return c.json({
        error: 'Failed to update user role: ' + error.message
      }, 500);
    }
    if (!updatedProfile) {
      return c.json({
        error: 'User not found'
      }, 404);
    }
    return c.json({
      message: 'User role updated successfully',
      user: toCamelCase(updatedProfile)
    });
  } catch (error) {
    console.error('Update user role error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// Delete user (by dev only)
router.delete("/users/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

    if (!profile || profile.role !== 'dev') {
      return c.json({
        error: 'Forbidden: Only developers can delete users'
      }, 403);
    }
    const userId = c.req.param('id');

    if (userId === user.id) {
      return c.json({
        error: 'Cannot delete your own account'
      }, 400);
    }

    // First, nullify all references to avoid foreign key constraint violations
    // These tables have FK constraints that reference profiles(id)
    await Promise.all([
      supabase.from('members').update({ created_by: null }).eq('created_by', userId),
      supabase.from('attendance_records').update({ created_by: null }).eq('created_by', userId),
      supabase.from('giving_records').update({ created_by: null }).eq('created_by', userId),
      supabase.from('visitors').update({ created_by: null }).eq('created_by', userId),
      supabase.from('custom_services').update({ created_by: null }).eq('created_by', userId),
      supabase.from('custom_giving_types').update({ created_by: null }).eq('created_by', userId),
      supabase.from('custom_roles').update({ created_by: null }).eq('created_by', userId),
      supabase.from('temporary_permissions').update({ granted_by: null }).eq('granted_by', userId),
      // Also handle approved_by references in profiles table
      supabase.from('profiles').update({ approved_by: null }).eq('approved_by', userId),
    ]);

    // Delete temporary permissions for this user (has ON DELETE CASCADE but doing explicitly)
    await supabase.from('temporary_permissions').delete().eq('user_id', userId);

    const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileError) {
      console.error('Error deleting profile:', profileError);
      return c.json({
        error: 'Failed to delete user profile: ' + profileError.message
      }, 500);
    }
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('Error deleting auth user:', authError);
    }
    return c.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// Grant temporary permission
router.post("/users/:id/grant-permission", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user has grant_permissions permission
    const hasPermission = await checkPermission(user.id, 'grant_permissions');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden: You do not have permission to grant permissions' }, 403);
    }

    const userId = c.req.param('id');
    const { permission, durationHours } = await c.req.json();

    if (!permission || !durationHours) {
      return c.json({ error: 'Permission and durationHours are required' }, 400);
    }

    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

    // Delete any existing temporary permission for the same user and permission
    await supabase
      .from('temporary_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission', permission);

    // Insert new temporary permission
    const { error } = await supabase
      .from('temporary_permissions')
      .insert({
        user_id: userId,
        permission,
        expires_at: expiresAt,
        granted_by: user.id
      });

    if (error) {
      console.error('Error granting permission:', error);
      return c.json({ error: 'Failed to grant permission' }, 500);
    }

    return c.json({ message: 'Permission granted successfully' });
  } catch (error) {
    console.error('Grant permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Revoke temporary permission
router.delete("/users/:id/revoke-permission/:permission", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user has grant_permissions permission
    const hasPermission = await checkPermission(user.id, 'grant_permissions');
    if (!hasPermission) {
      return c.json({ error: 'Forbidden: You do not have permission to revoke permissions' }, 403);
    }

    const userId = c.req.param('id');
    const permission = c.req.param('permission');

    const { error } = await supabase
      .from('temporary_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission', permission);

    if (error) {
      console.error('Error revoking permission:', error);
      return c.json({ error: 'Failed to revoke permission' }, 500);
    }

    return c.json({ message: 'Permission revoked successfully' });
  } catch (error) {
    console.error('Revoke permission error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all temporary permissions (batch - avoids N+1 per-user queries)
router.get("/users/temporary-permissions/all", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase
      .from('temporary_permissions')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch temporary permissions' }, 500);
    }

    // Group by user_id
    const grouped: Record<string, any[]> = {};
    for (const perm of (data || [])) {
      const uid = perm.user_id;
      if (!grouped[uid]) grouped[uid] = [];
      grouped[uid].push(perm);
    }

    return c.json(grouped);
  } catch (error) {
    console.error('Get all temporary permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get temporary permissions for a user
router.get("/users/:id/temporary-permissions", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('id');

    const { data, error } = await supabase
      .from('temporary_permissions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching temporary permissions:', error);
      return c.json({ error: 'Failed to fetch temporary permissions' }, 500);
    }

    return c.json(data || []);
  } catch (error) {
    console.error('Get temporary permissions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
