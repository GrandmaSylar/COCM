
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

router.get('/children/giving', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_giving_records').select('*')
      .order('service_date', { ascending: false });
    if (error) {
      console.error('Error fetching children giving:', error);
      return c.json({ error: 'Failed to fetch children giving' }, 500);
    }
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { console.error('GET /children/giving error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.post('/children/giving', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await checkPermission(user.id, 'manage_members')) {
      console.warn('Unauthorized children giving attempt by', user.id);
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const total = (body.offeringAmount || 0) + (body.cashAmount || 0) + (body.mobileMoneyAmount || 0);
    const { data, error } = await supabase.from('children_giving_records').insert({
      service_date: body.serviceDate,
      service_type: body.serviceType,
      offering_amount: body.offeringAmount || 0,
      total_amount: body.totalAmount ?? total,
      cash_amount: body.cashAmount || 0,
      mobile_money_amount: body.mobileMoneyAmount || 0,
      notes: body.notes,
      created_by: user.id,
    }).select().single();
    if (error) {
      console.error('Error creating children giving record:', error);
      return c.json({ error: error.message }, 500);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'create', entityType: 'children_giving', entityId: data.id,
      description: `Recorded children giving for ${body.serviceDate} — GHS ${body.totalAmount ?? (body.offeringAmount || 0) + (body.cashAmount || 0) + (body.mobileMoneyAmount || 0)}`
    });

    return c.json(toCamelCase(data), 201);
  } catch (e) { console.error('POST /children/giving error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/children/giving/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await checkPermission(user.id, 'manage_members')) {
      console.warn('Unauthorized children giving attempt by', user.id);
      return c.json({ error: 'Forbidden' }, 403);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const { data, error } = await supabase.from('children_giving_records').update({
      service_date: body.serviceDate,
      service_type: body.serviceType,
      offering_amount: body.offeringAmount || 0,
      total_amount: body.totalAmount || 0,
      cash_amount: body.cashAmount || 0,
      mobile_money_amount: body.mobileMoneyAmount || 0,
      notes: body.notes,
    }).eq('id', id).select().single();
    if (error) {
      console.error('Error updating children giving record:', error);
      return c.json({ error: error.message }, 500);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'update', entityType: 'children_giving', entityId: id,
      description: `Updated children giving record`
    });

    return c.json(toCamelCase(data));
  } catch (e) { console.error('PUT /children/giving/:id error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================

export default router;
