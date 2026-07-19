
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

router.get('/children/attendance', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_attendance_records').select('*')
      .order('date', { ascending: false });
    if (error) {
      console.error('Error fetching children attendance:', error);
      return c.json({ error: 'Failed to fetch children attendance' }, 500);
    }
    return c.json((data || []).map((r: any) => toCamelCase(r)));
  } catch (e) { console.error('GET /children/attendance error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.get('/children/attendance/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const { data, error } = await supabase.from('children_attendance_records').select('*').eq('id', id).single();
    if (error) {
      console.error('Error fetching children attendance record:', error);
      if (error.code === 'PGRST116') return c.json({ error: 'Not found' }, 404);
      return c.json({ error: 'Failed to fetch attendance record' }, 500);
    }
    if (!data) return c.json({ error: 'Not found' }, 404);
    const entries = await supabase.from('children_attendance_entries')
      .select('*, children_members(first_name, last_name)')
      .eq('attendance_record_id', id);
    return c.json({ ...(toCamelCase(data) as Record<string, unknown>), entries: (entries.data || []).map((e: any) => toCamelCase(e)) });
  } catch (e) { console.error('GET /children/attendance/:id error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.post('/children/attendance', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await checkPermission(user.id, 'manage_members')) {
      console.warn('Unauthorized children attendance create attempt by', user.id);
      return c.json({ error: 'Forbidden' }, 403);
    }
    const body = await c.req.json();
    const childIds: string[] = body.childMemberIds || [];
    const visitorsCount: number = body.visitorsCount || 0;

    // Upsert the attendance record
    const { data: record, error: recErr } = await supabase
      .from('children_attendance_records')
      .upsert({
        date: body.date,
        service_type: body.serviceType,
        total_count: childIds.length + visitorsCount,
        visitors_count: visitorsCount,
        created_by: user.id,
      }, { onConflict: 'date,service_type' })
      .select().single();

    if (recErr) {
      console.error('Error creating children attendance:', recErr);
      return c.json({ error: recErr.message }, 500);
    }

    // Delete existing entries for this record, then insert the new set (authoritative save)
    await supabase.from('children_attendance_entries').delete().eq('attendance_record_id', record.id);
    if (childIds.length > 0) {
      const entries = childIds.map(cid => ({
        attendance_record_id: record.id,
        child_member_id: cid,
      }));
      await supabase.from('children_attendance_entries').insert(entries);
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'create', entityType: 'children_attendance', entityId: record.id,
      description: `Recorded children attendance for ${body.date} (${body.serviceType})`
    });

    return c.json(toCamelCase(record), 201);
  } catch (e) { console.error('POST /children/attendance error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/children/attendance/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await checkPermission(user.id, 'manage_members')) {
      console.warn('Unauthorized children attendance update attempt by', user.id);
      return c.json({ error: 'Forbidden' }, 403);
    }
    const id = c.req.param('id');
    const body = await c.req.json();
    const childIds: string[] = body.childMemberIds || [];
    const visitorsCount: number = body.visitorsCount || 0;

    const { data, error } = await supabase.from('children_attendance_records').update({
      total_count: childIds.length + visitorsCount,
      visitors_count: visitorsCount,
    }).eq('id', id).select().single();
    if (error) {
      console.error('Error updating children attendance:', error);
      return c.json({ error: error.message }, 500);
    }

    // Replace entries
    await supabase.from('children_attendance_entries').delete().eq('attendance_record_id', id);
    if (childIds.length > 0) {
      await supabase.from('children_attendance_entries').insert(
        childIds.map(cid => ({ attendance_record_id: id, child_member_id: cid }))
      );
    }

    const prof = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'update', entityType: 'children_attendance', entityId: id,
      description: `Updated children attendance record`
    });

    return c.json(toCamelCase(data));
  } catch (e) { console.error('PUT /children/attendance/:id error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================

export default router;
