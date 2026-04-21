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

router.get('/children/visitors', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_visitors').select('*, children_visitor_guardians(*)')
      .eq('converted_to_member', false)
      .order('visit_date', { ascending: false });
    if (error) {
      console.error('Error fetching children visitors:', error);
      return c.json({ error: 'Failed to fetch children visitors' }, 500);
    }
    return c.json((data || []).map((v: any) => {
      const camelV = toCamelCase(v) as Record<string, unknown>;
      if (camelV.childrenVisitorGuardians) {
        camelV.guardians = camelV.childrenVisitorGuardians;
        delete camelV.childrenVisitorGuardians;
      }
      delete camelV.followUpStatus;
      delete camelV.parentGuardianName;
      delete camelV.parentGuardianPhone;
      return camelV;
    }));
  } catch (e) { console.error('GET /children/visitors error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.post('/children/visitors', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const hasPermission = await checkPermission(user.id, 'manage_members');
    if (!hasPermission) {
      console.warn('Insufficient manage_members permission for children visitors create by', user.id);
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    const body = await c.req.json();

    if (body.dateOfBirth) {
      const dob = new Date(body.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      if (dob <= cutoff) return c.json({ error: 'Visitor must be under 18 years old' }, 400);
    }

    if (!body.guardians || !Array.isArray(body.guardians) || body.guardians.length === 0) {
      return c.json({ error: 'At least one guardian is required' }, 400);
    }

    const { data, error } = await supabase.from('children_visitors').insert({
      first_name: body.firstName,
      last_name: body.lastName,
      other_names: body.otherNames,
      gender: body.gender || null,
      date_of_birth: body.dateOfBirth || null,
      occupation: body.occupation || null,
      contact_phone: body.contactPhone || null,
      referred_by: body.referredBy || null,
      visit_date: body.visitDate,
      service_type: body.serviceType || null,
      notes: body.notes || null,
      created_by: user.id,
    }).select().single();
    if (error) {
      console.error('Error creating child visitor:', error);
      return c.json({ error: error.message }, 500);
    }

    const guardiansToInsert = body.guardians.map((g: any) => ({
      visitor_id: data.id,
      full_name: g.fullName,
      residential_location: g.residentialLocation || null,
      contact_info: g.contactInfo || null,
    }));
    const { data: guardiansData, error: guardiansError } = await supabase.from('children_visitor_guardians').insert(guardiansToInsert).select();
    if (guardiansError) {
      console.error('Error creating child visitor guardians:', guardiansError);
      await supabase.from('children_visitors').delete().eq('id', data.id);
      return c.json({ error: 'Failed to save guardians. Visitor creation rolled back.' }, 500);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'create', entityType: 'child_visitor', entityId: data.id,
      description: `Added child visitor: ${body.firstName} ${body.lastName}`
    });

    const result = toCamelCase(data) as Record<string, unknown>;
    result.guardians = guardiansData ? guardiansData.map((g: any) => toCamelCase(g)) : [];
    return c.json(result, 201);
  } catch (e) { console.error('POST /children/visitors error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/children/visitors/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const hasPermission = await checkPermission(user.id, 'manage_members');
    if (!hasPermission) {
      console.warn('Insufficient manage_members permission for children visitors update by', user.id);
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    const id = c.req.param('id');
    const body = await c.req.json();

    if (body.dateOfBirth) {
      const dob = new Date(body.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      if (dob <= cutoff) return c.json({ error: 'Visitor must be under 18 years old' }, 400);
    }

    if (!body.guardians || !Array.isArray(body.guardians) || body.guardians.length === 0) {
      return c.json({ error: 'At least one guardian is required' }, 400);
    }

    const { data: oldVisitor } = await supabase.from('children_visitors').select('*').eq('id', id).single();
    const { data: oldGuardians } = await supabase.from('children_visitor_guardians').select('*').eq('visitor_id', id);

    const { data, error } = await supabase.from('children_visitors').update({
      first_name: body.firstName,
      last_name: body.lastName,
      other_names: body.otherNames,
      gender: body.gender || null,
      date_of_birth: body.dateOfBirth || null,
      occupation: body.occupation || null,
      contact_phone: body.contactPhone || null,
      referred_by: body.referredBy || null,
      visit_date: body.visitDate,
      service_type: body.serviceType || null,
      notes: body.notes || null,
      converted_to_member: body.convertedToMember || false,
      converted_member_id: body.convertedMemberId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) {
      console.error('Error updating child visitor:', error);
      return c.json({ error: error.message }, 500);
    }

    // Replace guardians
    const { error: delError } = await supabase.from('children_visitor_guardians').delete().eq('visitor_id', id);
    if (delError) {
      console.error('Error deleting old guardians:', delError);
      if (oldVisitor) await supabase.from('children_visitors').update(oldVisitor).eq('id', id);
      return c.json({ error: 'Failed to update guardians. Changes rolled back.' }, 500);
    }

    const guardiansToInsert = body.guardians.map((g: any) => ({
      visitor_id: id,
      full_name: g.fullName,
      residential_location: g.residentialLocation || null,
      contact_info: g.contactInfo || null,
    }));
    const { data: guardiansData, error: guardiansError } = await supabase.from('children_visitor_guardians').insert(guardiansToInsert).select();
    if (guardiansError) {
      console.error('Error updating child visitor guardians:', guardiansError);
      if (oldVisitor) await supabase.from('children_visitors').update(oldVisitor).eq('id', id);
      if (oldGuardians && oldGuardians.length > 0) {
        await supabase.from('children_visitor_guardians').insert(oldGuardians);
      }
      return c.json({ error: 'Failed to save new guardians. Changes rolled back.' }, 500);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'update', entityType: 'child_visitor', entityId: id,
      description: `Updated child visitor: ${body.firstName} ${body.lastName}`
    });

    const result = toCamelCase(data) as Record<string, unknown>;
    result.guardians = guardiansData ? guardiansData.map((g: any) => toCamelCase(g)) : [];
    return c.json(result);
  } catch (e) { console.error('PUT /children/visitors/:id error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================

export default router;
