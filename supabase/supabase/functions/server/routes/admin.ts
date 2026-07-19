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

router.get('/admin/options', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    // Devs can read ALL options (including inactive)
    const { data, error } = await supabase
      .from('system_dropdown_options')
      .select('*')
      .order('category')
      .order('label');
      
    if (error) return c.json({ error: 'Failed to fetch options' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.post('/admin/options', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    const body = await c.req.json();
    const { data, error } = await supabase.from('system_dropdown_options').insert({
      category: body.category,
      label: body.label,
      value: body.value,
      is_active: body.isActive !== undefined ? body.isActive : true
    }).select().single();
    
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data), 201);
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/admin/options/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    const id = c.req.param('id');
    const body = await c.req.json();
    
    const { data, error } = await supabase.from('system_dropdown_options').update({
      label: body.label,
      value: body.value,
      is_active: body.isActive,
      updated_at: new Date().toISOString()
    }).eq('id', id).select().single();
    
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.delete('/admin/options/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    const id = c.req.param('id');
    const { error } = await supabase.from('system_dropdown_options').update({
      is_active: false,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================
// ============================================================================

router.get('/admin/notification-config', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    const { data, error } = await supabase.from('notification_type_config').select('*').order('type');
    if (error) return c.json({ error: 'Failed to fetch config' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/admin/notification-config/:type', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    const type = c.req.param('type');
    const body = await c.req.json();

    const payload = {
      is_enabled: body.isEnabled !== undefined ? body.isEnabled : true,
      allowed_roles: body.allowedRoles || [],
      allowed_user_ids: body.allowedUserIds || [],
      updated_at: new Date().toISOString()
    };

    // Check if a row for this type already exists
    const { data: existing } = await supabase
      .from('notification_type_config')
      .select('type')
      .eq('type', type)
      .maybeSingle();

    let data: any;
    let error: any;

    if (existing) {
      // Update existing row
      const res = await supabase
        .from('notification_type_config')
        .update(payload)
        .eq('type', type)
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else {
      // Insert new row
      const res = await supabase
        .from('notification_type_config')
        .insert({ type, ...payload })
        .select()
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('notification-config save error:', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json(toCamelCase(data));
  } catch (e) {
    console.error('PUT /admin/notification-config/:type error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// ============================================================================

router.get('/admin/activity-log-config', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    const { data, error } = await supabase.from('activity_log_config').select('*').order('entity_type').order('action_type');
    if (error) return c.json({ error: 'Failed to fetch config' }, 500);
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/admin/activity-log-config/:action_type/:entity_type', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (prof?.role !== 'dev') return c.json({ error: 'Forbidden' }, 403);
    
    const action_type = c.req.param('action_type');
    const entity_type = c.req.param('entity_type');
    const body = await c.req.json();

    const payload = {
      is_enabled: body.isEnabled !== undefined ? body.isEnabled : true,
      allowed_roles: body.allowedRoles || [],
      allowed_user_ids: body.allowedUserIds || [],
      updated_at: new Date().toISOString()
    };

    // Check if a row for this combination already exists
    const { data: existing } = await supabase
      .from('activity_log_config')
      .select('action_type')
      .eq('action_type', action_type)
      .eq('entity_type', entity_type)
      .maybeSingle();

    let data: any;
    let error: any;

    if (existing) {
      const res = await supabase
        .from('activity_log_config')
        .update(payload)
        .eq('action_type', action_type)
        .eq('entity_type', entity_type)
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else {
      const res = await supabase
        .from('activity_log_config')
        .insert({ action_type, entity_type, ...payload })
        .select()
        .single();
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('activity-log-config save error:', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json(toCamelCase(data));
  } catch (e) {
    console.error('PUT /admin/activity-log-config error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// (Removed duplicate Cloudinary signature route)

// (Moved Higher)

// DEBUG: Global 404 Handler



export default router;
