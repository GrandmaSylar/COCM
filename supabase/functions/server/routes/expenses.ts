import { isAdminOrDev } from "../lib/admin-helpers.ts";
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

// --- Payment Methods ---

router.get('/expenses/payment-methods', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase.from('expense_payment_methods').select('*').order('name', { ascending: true });
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.post('/expenses/payment-methods', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await isAdminOrDev(user.id)) return c.json({ error: 'Forbidden' }, 403);

    const body = await c.req.json();
    const { data, error } = await supabase.from('expense_payment_methods').insert({
      name: body.name,
      is_active: true,
      created_by: user.id
    }).select().single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data), 201);
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.patch('/expenses/payment-methods/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await isAdminOrDev(user.id)) return c.json({ error: 'Forbidden' }, 403);

    const id = c.req.param('id');
    const body = await c.req.json();
    const updateData: any = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase.from('expense_payment_methods').update(updateData).eq('id', id).select().single();
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.delete('/expenses/payment-methods/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await isAdminOrDev(user.id)) return c.json({ error: 'Forbidden' }, 403);

    const id = c.req.param('id');
    const { count, error: countErr } = await supabase.from('expense_records').select('*', { count: 'exact', head: true }).eq('payment_method_id', id);
    if (countErr) return c.json({ error: countErr.message }, 500);
    
    if (count && count > 0) {
      return c.json({ error: 'Payment method is in use and cannot be deleted' }, 409);
    }

    const { error } = await supabase.from('expense_payment_methods').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ message: 'Deleted successfully' });
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// --- Form ID ---

router.get('/expenses/next-form-id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    // Fetch ALL form_ids and compute numeric max robustly
    const { data, error } = await supabase.from('expense_records').select('form_id');
    if (error) return c.json({ error: error.message }, 500);

    let maxNum = 0;
    if (data && data.length > 0) {
      for (const row of data) {
        const match = row.form_id.match(/^EXP-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextFormId = `EXP-${String(maxNum + 1).padStart(4, '0')}`;
    return c.json({ nextFormId });
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// --- Expense Records ---

router.get('/expenses', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const { data, error } = await supabase.from('expense_records').select('*').order('expense_date', { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json(toCamelCase(data));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.post('/expenses', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const rawBody = await c.req.json();
    // Accept camelCase payloads and normalize to snake_case
    const body = toSnakeCase(rawBody) as Record<string, any>;
    const { form_id, details, service_date, service_type, amount, payment_method_name } = body;
    
    if (!form_id || !details || !service_date || !service_type || amount === undefined || !payment_method_name) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase.from('expense_records').insert({
      form_id, details, service_date, service_type, amount, payment_method_name,
      payment_method_id: body.payment_method_id || null,
      expense_date: today,
      reference_number: body.reference_number || null,
      requested_by_id: body.requested_by_id || null,
      requested_by_name: body.requested_by_name || null,
      recommended_by_id: body.recommended_by_id || null,
      recommended_by_name: body.recommended_by_name || null,
      approved_by_id: body.approved_by_id || null,
      approved_by_name: body.approved_by_name || null,
      status: 'approved',
      created_by: user.id
    }).select().single();

    if (error) {
      if (error.code === '23505' && error.message.includes('form_id')) {
        return c.json({ error: 'This Form ID already exists — please change it' }, 409);
      }
      return c.json({ error: error.message }, 500);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'create', entityType: 'expense', entityId: data.id,
      description: `Created expense record ${form_id}`
    });

    return c.json(toCamelCase(data), 201);
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/expenses/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const rawBody = await c.req.json();
    // Accept camelCase payloads and normalize to snake_case
    const body = toSnakeCase(rawBody) as Record<string, any>;
    
    const { data: existing, error: getErr } = await supabase.from('expense_records').select('form_id').eq('id', id).single();
    if (getErr || !existing) return c.json({ error: 'Record not found' }, 404);

    if (body.form_id && body.form_id !== existing.form_id) {
      if (!await isAdminOrDev(user.id)) {
        return c.json({ error: 'Only admin or dev can change the Form ID' }, 403);
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    // status is excluded — always remains 'approved'
    const allowedFields = [
      'form_id', 'expense_date', 'details', 'service_date', 'service_type', 'amount',
      'payment_method_id', 'payment_method_name', 'reference_number',
      'requested_by_id', 'requested_by_name', 'recommended_by_id', 'recommended_by_name',
      'approved_by_id', 'approved_by_name'
    ];
    for (const f of allowedFields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const { data: updated, error } = await supabase.from('expense_records').update(updateData).eq('id', id).select().single();
    if (error) {
      if (error.code === '23505' && error.message.includes('form_id')) {
        return c.json({ error: 'This Form ID already exists — please change it' }, 409);
      }
      return c.json({ error: error.message }, 500);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'update', entityType: 'expense', entityId: id,
      description: `Updated expense record ${updated.form_id}`
    });

    return c.json(toCamelCase(updated));
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

router.delete('/expenses/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await isAdminOrDev(user.id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const id = c.req.param('id');
    const { data: existing } = await supabase.from('expense_records').select('form_id').eq('id', id).single();

    const { error } = await supabase.from('expense_records').delete().eq('id', id);
    if (error) return c.json({ error: error.message }, 500);

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'delete', entityType: 'expense', entityId: id,
      description: `Deleted expense record ${existing?.form_id || id}`
    });

    return c.json({ message: 'Expense deleted successfully' });
  } catch (e) { return c.json({ error: 'Internal server error' }, 500); }
});

// --- GET single expense record ---
// NOTE: This route MUST remain registered after /expenses/next-form-id and
// /expenses/payment-methods to prevent /:id param from greedily capturing
// those literal paths.
router.get('/expenses/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return c.json({ error: 'Invalid expense ID format' }, 400);
    }

    const { data, error } = await supabase.from('expense_records').select('*').eq('id', id).single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Expense record not found' }, 404);
      }
      if (error.code === '22P02') {
        return c.json({ error: 'Invalid expense ID format' }, 400);
      }
      return c.json({ error: error.message }, 500);
    }

    return c.json(toCamelCase(data));
  } catch (e) {
    console.error('GET /expenses/:id error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
