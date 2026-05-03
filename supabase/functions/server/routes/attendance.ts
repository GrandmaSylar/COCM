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

// POST /attendance/session — gets existing or creates new session record
router.post("/attendance/session", async (c) => {
  const user = await getUserFromToken(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const { date, serviceType, startTime, endTime } = body;

  // Helper to fetch creator name
  const getCreatorName = async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', userId)
      .single();
    return profile?.name || 'Unknown';
  };

  // Try to find an existing record for this date+service (any status)
  const { data: existing } = await supabase
    .from('attendance_records')
    .select('id, status, created_by')
    .eq('date', date)
    .eq('service_type', serviceType)
    .single();

  if (existing) {
    const creatorName = await getCreatorName(existing.created_by);
    return c.json({ id: existing.id, status: existing.status, createdBy: existing.created_by, creatorName });
  }

  // Create a new one with 'live' status
  const { data: created, error } = await supabase
    .from('attendance_records')
    .insert({
      date,
      service_type: serviceType,
      start_time: startTime,
      end_time: endTime,
      total_count: 0,
      created_by: user.id,
      status: 'live'
    })
    .select('id')
    .single();

  if (error) return c.json({ error: error.message }, 500);

  const creatorName = await getCreatorName(user.id);
  return c.json({ id: created.id, status: 'live', createdBy: user.id, creatorName });
});

router.get("/attendance/:id/edit-status", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record } = await supabase
      .from('attendance_records')
      .select('created_at')
      .eq('id', id)
      .single();

    if (!record) {
      return c.json({ error: 'Record not found' }, 404);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const createdAt = new Date(record.created_at).getTime();
    const now = Date.now();
    const twelveHours = 12 * 60 * 60 * 1000;
    const timeRemaining = Math.max(0, twelveHours - (now - createdAt));
    const isDev = profile?.role === 'dev';

    return c.json({
      canEdit: isDev || timeRemaining > 0,
      timeRemaining: timeRemaining > 0 ? timeRemaining : null,
      lockedAt: timeRemaining <= 0 ? new Date(createdAt + twelveHours).toISOString() : null,
      isDev
    });
  } catch (error) {
    console.error('Get edit status error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

// POST /attendance/session/:id/cancel — cancels a live session (creator only)
router.post("/attendance/session/:id/cancel", async (c) => {
  const user = await getUserFromToken(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  const { data: record } = await supabase
    .from('attendance_records')
    .select('created_by, status')
    .eq('id', id)
    .single();

  if (!record) return c.json({ error: 'Record not found' }, 404);
  if (record.created_by !== user.id) {
    return c.json({ error: 'Only the session initiator can cancel' }, 403);
  }

  // Delete entries first, then the record
  await supabase.from('attendance_entries').delete().eq('attendance_record_id', id);
  const { error } = await supabase.from('attendance_records').delete().eq('id', id);

  if (error) return c.json({ error: error.message }, 500);

  try {
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'delete', entityType: 'attendance', entityId: id,
      description: 'Cancelled live attendance session'
    });
  } catch (e) { console.error('Log activity error:', e); }

  return c.json({ success: true });
});

// POST /attendance/session/:id/finalize — marks a live session as finalized
router.post("/attendance/session/:id/finalize", async (c) => {
  const user = await getUserFromToken(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  // Only the session creator can finalize
  const { data: record } = await supabase
    .from('attendance_records')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!record) return c.json({ error: 'Record not found' }, 404);
  if (record.created_by !== user.id) {
    return c.json({ error: 'Only the session initiator can finalize attendance' }, 403);
  }

  // Count actual attendance entries
  const { count } = await supabase
    .from('attendance_entries')
    .select('*', { count: 'exact', head: true })
    .eq('attendance_record_id', id);

  // Update the record: set status to finalized, update total_count
  const { error } = await supabase
    .from('attendance_records')
    .update({
      status: 'finalized',
      total_count: count || 0
    })
    .eq('id', id);

  if (error) return c.json({ error: error.message }, 500);

  // Auto-create/update service_record
  try {
    const { data: record } = await supabase
      .from('attendance_records')
      .select('date, service_type')
      .eq('id', id)
      .single();

    if (record) {
      const { data: existingSR } = await supabase
        .from('service_records')
        .select('id')
        .eq('service_date', record.date)
        .eq('service_type', record.service_type)
        .single();

      if (existingSR) {
        await supabase.from('service_records').update({
          attendance_record_id: id, updated_at: new Date().toISOString()
        }).eq('id', existingSR.id);
      } else {
        await supabase.from('service_records').insert({
          service_date: record.date, service_type: record.service_type,
          attendance_record_id: id, created_by: user.id
        });
      }
    }
  } catch (srErr) { console.error('Service record auto-create error:', srErr); }

  // Recalculate member statuses
  try {
    const { data: record } = await supabase
      .from('attendance_records')
      .select('service_type, attendance_type')
      .eq('id', id)
      .single();

    if (record?.service_type === 'Sunday Main Service' && record?.attendance_type === 'individual') {
      await recalculateMemberStatuses(user.id);
    }
  } catch (e) { console.error('Recalculate statuses error:', e); }

  // Log activity
  try {
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'create', entityType: 'attendance', entityId: id,
      description: `Finalized attendance session with ${count || 0} present`
    });
  } catch (e) { console.error('Log activity error:', e); }

  return c.json({ success: true, totalCount: count || 0 });
});

// GET /attendance/live-sessions — returns any live sessions for today
router.get("/attendance/live-sessions", async (c) => {
  const user = await getUserFromToken(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const today = new Date().toISOString().split('T')[0];

  const { data: sessions, error } = await supabase
    .from('attendance_records')
    .select('id, date, service_type, start_time, end_time, created_at, status')
    .eq('status', 'live')
    .eq('date', today);

  if (error) return c.json({ error: error.message }, 500);

  // For each session, get the current count of entries
  const enriched = await Promise.all((sessions || []).map(async (s: any) => {
    const { count } = await supabase
      .from('attendance_entries')
      .select('*', { count: 'exact', head: true })
      .eq('attendance_record_id', s.id);

    return {
      id: s.id,
      date: s.date,
      serviceType: s.service_type,
      startTime: s.start_time,
      endTime: s.end_time,
      createdAt: s.created_at,
      presentCount: count || 0,
      status: s.status
    };
  }));

  return c.json(enriched);
});

// ============================================================================

export default router;
