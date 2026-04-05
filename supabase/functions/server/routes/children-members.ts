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

router.get('/children/members', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const { data, error } = await supabase
      .from('children_members')
      .select('*')
      .order('first_name', { ascending: true });
    if (error) {
      console.error('Error fetching children members:', error);
      return c.json({ error: 'Failed to fetch children members' }, 500);
    }

    const ids = (data || []).map((m: any) => m.id);
    let parentsMap: Record<string, any[]> = {};
    if (ids.length > 0) {
      const { data: allParents } = await supabase
        .from('children_member_parents').select('*').in('child_member_id', ids);
      for (const p of allParents || []) {
        if (!parentsMap[p.child_member_id]) parentsMap[p.child_member_id] = [];
        parentsMap[p.child_member_id].push(toCamelCase(p));
      }
    }
    return c.json((data || []).map((m: any) => ({ ...(toCamelCase(m) as Record<string, unknown>), parents: parentsMap[m.id] || [] })));
  } catch (e) { console.error('GET /children/members error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.get('/children/members/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    const { data, error } = await supabase.from('children_members').select('*').eq('id', id).single();
    if (error) {
      console.error('Error fetching child member:', error);
      if (error.code === 'PGRST116') return c.json({ error: 'Child member not found' }, 404);
      return c.json({ error: 'Failed to fetch child member' }, 500);
    }
    if (!data) return c.json({ error: 'Child member not found' }, 404);
    const parents = await supabase.from('children_member_parents').select('*').eq('child_member_id', id);
    return c.json({ ...(toCamelCase(data) as Record<string, unknown>), parents: (parents.data || []).map((p: any) => toCamelCase(p)) });
  } catch (e) { console.error('GET /children/members/:id error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.get('/children/members/:id/analytics', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const id = c.req.param('id');
    
    // Fetch attendance from children_attendance_entries with the associated records
    const { data: entriesData, error } = await supabase
      .from('children_attendance_entries')
      .select('*, children_attendance_records(*)')
      .eq('child_member_id', id);

    if (error) {
      console.error('Error fetching child member analytics:', error);
      return c.json({ error: error.message }, 500);
    }

    const entries = entriesData || [];
    
    // Calculate stats
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthStart = new Date(currentYear, currentMonth, 1);
    const thisMonthEnd = new Date(currentYear, currentMonth + 1, 0);

    let thisMonthCount = 0;
    
    // sort entries by date descending to get recent activity
    const sortedEntries = entries.sort((a: any, b: any) => {
      const dateA = new Date(a.children_attendance_records?.date || 0).getTime();
      const dateB = new Date(b.children_attendance_records?.date || 0).getTime();
      return dateB - dateA;
    });

    sortedEntries.forEach((e: any) => {
      if (!e.children_attendance_records) return;
      const d = new Date(e.children_attendance_records.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        thisMonthCount++;
      }
    });

    // Get total children's services this month from children_attendance_records
    const { data: allServicesThisMonth } = await supabase
      .from('children_attendance_records')
      .select('id')
      .gte('date', thisMonthStart.toISOString().split('T')[0])
      .lte('date', thisMonthEnd.toISOString().split('T')[0]);

    const totalServices = allServicesThisMonth?.length || 0;
    const percentage = totalServices > 0 ? Math.round((thisMonthCount / totalServices) * 100) : 0;

    const recentActivity = sortedEntries.slice(0, 10).map((e: any) => {
      const rec = e.children_attendance_records;
      return {
        id: e.id,
        type: 'attendance',
        title: 'Attended Service',
        description: rec ? rec.service_type : 'Unknown Service',
        date: rec ? rec.date : e.created_at
      };
    });

    return c.json({
      attendanceStats: {
        thisMonth: thisMonthCount,
        totalServices: totalServices,
        percentage: percentage
      },
      recentActivity: recentActivity
    });
  } catch (e) { console.error('GET /children/members/:id/analytics error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.get('/children/members/:id/attendance-history', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    
    const childId = c.req.param('id');
    const fromParam = c.req.query('from');
    const toParam = c.req.query('to');

    // Get child info
    const { data: child, error: childError } = await supabase
      .from('children_members')
      .select('first_name, last_name, join_date')
      .eq('id', childId)
      .single();

    if (childError) {
      console.error('Error fetching child for attendance history:', childError);
      if (childError.code === 'PGRST116') return c.json({ error: 'Child not found' }, 404);
      return c.json({ error: 'Failed to fetch child' }, 500);
    }
    if (!child) return c.json({ error: 'Child not found' }, 404);

    const joinDate = child.join_date || '2020-01-01';
    const today = new Date().toISOString().split('T')[0];
    const from = fromParam || joinDate;
    const to = toParam || today;

    // Get all children's attendance records in the range
    const { data: allRecords, error: recordsErr } = await supabase
      .from('children_attendance_records')
      .select('id, date, service_type')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (recordsErr) {
      console.error('Error fetching children attendance records:', recordsErr);
      return c.json({ error: 'Failed to fetch records' }, 500);
    }
    const records = allRecords || [];

    // Get the child's entries in that range
    const { data: entries, error: entriesErr } = await supabase
      .from('children_attendance_entries')
      .select('attendance_record_id')
      .eq('child_member_id', childId);

    if (entriesErr) {
      console.error('Error fetching children attendance entries:', entriesErr);
      return c.json({ error: 'Failed to fetch entries' }, 500);
    }
    const presentRecordIds = new Set((entries || []).map(e => e.attendance_record_id));

    let totalPresent = 0;
    const historyRecords = records.map((rec: any) => {
      const isPresent = presentRecordIds.has(rec.id);
      if (isPresent) totalPresent++;
      return {
        date: rec.date,
        serviceType: rec.service_type,
        serviceName: rec.service_type,
        status: isPresent ? 'present' : 'absent',
        absenceInfo: null, // Children don't have separate absence workflows yet
      };
    });

    const totalServices = records.length;
    const totalAbsent = totalServices - totalPresent;
    const percentage = totalServices > 0 ? Math.round((totalPresent / totalServices) * 100) : 0;

    return c.json({
      memberName: `${child.first_name} ${child.last_name}`,
      joinDate: child.join_date,
      summary: {
        totalServices,
        totalPresent,
        totalAbsent,
        percentage
      },
      records: historyRecords
    });
  } catch (e) { console.error('GET /children/members/:id/attendance-history error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.post('/children/members', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await isAdminOrDev(user.id)) {
      console.warn('Unauthorized children members create attempt by', user.id);
      return c.json({ error: 'Forbidden' }, 403);
    }
    const body = await c.req.json();

    // Age validation: must be < 18
    if (body.dateOfBirth) {
      const dob = new Date(body.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      if (dob <= cutoff) return c.json({ error: 'Date of birth indicates age ≥ 18 — this person is not a child' }, 400);
    }

    // Extract parents and photo before toSnakeCase
    const { parents, photo, ...memberInfo } = body;
    const dbData = toSnakeCase(memberInfo) as Record<string, any>;

    // Handle special field mappings (photo -> photo_url)
    if (dbData.photo !== undefined) {
      dbData.photo_url = dbData.photo;
      delete dbData.photo;
    }

    // Set defaults
    dbData.status = body.status || 'new';
    dbData.ministries = body.ministries || ["Children's Ministry"];
    if (!dbData.join_date) {
      dbData.join_date = new Date().toISOString().split('T')[0];
    }

    // Only pass columns that exist on children_members table
    const allowedColumns = [
      'first_name', 'last_name', 'other_names', 'gender', 'date_of_birth',
      'phone', 'second_phone', 'email', 'digital_address', 'occupation', 'hometown',
      'zone', 'status', 'residence_location', 'notes', 'photo_url', 'ministries',
      'join_date', 'converted_to_member', 'converted_member_id'
    ];
    const insertPayload: any = {};
    for (const key of allowedColumns) {
      if (dbData[key] !== undefined) {
        insertPayload[key] = dbData[key];
      }
    }
    insertPayload.created_by = user.id;

    const { data, error } = await supabase.from('children_members').insert(insertPayload).select().single();

    if (error) {
      console.error('Error creating child member:', error);
      return c.json({ error: error.message }, 500);
    }

    // Save parents
    if (parents && parents.length > 0) {
      const parentRows = parents.map((p: any) => {
        const snakeP = toSnakeCase(p) as Record<string, unknown>;
        const { id: _tempId, ...rest } = snakeP;
        return {
          ...rest,
          child_member_id: data.id,
        };
      });
      await supabase.from('children_member_parents').insert(parentRows);
    }

    await applyInverseLinks({
      currentMemberId: data.id,
      currentPool: 'children_members',
      currentGender: data.gender ?? null,
      currentFirstName: data.first_name,
      currentLastName: data.last_name,
      previousLinkedEntries: [],
      newLinkedEntries: parents ?? [],
    });

    const prof = await getProfileForLog(user.id);
    await logActivity({ userId: user.id, userName: prof.name, userRole: prof.role,
      action: 'create', entityType: 'child_member', entityId: data.id,
      description: `Added child member ${dbData.first_name} ${dbData.last_name}` });

    notifyTabUsers('children', {
      type: 'child_member_registered', title: 'New Child Member Added',
      message: `${dbData.first_name} ${dbData.last_name} was added to Children's Ministry.`,
      entityType: 'child_member', entityId: data.id, excludeUserId: user.id
    });

    return c.json(toCamelCase(data), 201);
  } catch (e) { console.error('POST /children/members error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.put('/children/members/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await isAdminOrDev(user.id)) {
      console.warn('Unauthorized children members update attempt by', user.id);
      return c.json({ error: 'Forbidden' }, 403);
    }
    const id = c.req.param('id');
    const body = await c.req.json();

    if (body.dateOfBirth) {
      const dob = new Date(body.dateOfBirth);
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 18);
      if (dob <= cutoff) return c.json({ error: 'Date of birth indicates age ≥ 18 — this person is not a child' }, 400);
    }

    // Extract parents and photo before toSnakeCase
    const { parents, photo, ...memberInfo } = body;
    const dbData = toSnakeCase(memberInfo) as Record<string, any>;

    // Handle special field mappings (photo -> photo_url)
    if (dbData.photo !== undefined) {
      dbData.photo_url = dbData.photo;
      delete dbData.photo;
    }

    // Only pass columns that exist on children_members table
    const allowedColumns = [
      'first_name', 'last_name', 'other_names', 'gender', 'date_of_birth',
      'phone', 'second_phone', 'email', 'digital_address', 'occupation', 'hometown',
      'zone', 'status', 'residence_location', 'notes', 'photo_url', 'ministries',
      'converted_to_member', 'converted_member_id'
    ];
    const updatePayload: any = {};
    for (const key of allowedColumns) {
      if (dbData[key] !== undefined) {
        updatePayload[key] = dbData[key];
      }
    }
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('children_members')
      .update(updatePayload).eq('id', id).select().single();

    if (error) {
      console.error('Error updating child member:', error);
      return c.json({ error: error.message }, 500);
    }

    if (parents) {
      const { data: previousParentRows } = await supabase
        .from('children_member_parents')
        .select('*')
        .eq('child_member_id', id);

      await supabase.from('children_member_parents').delete().eq('child_member_id', id);
      if (parents.length > 0) {
        const parentRows = parents.map((p: any) => {
          const snakeP = toSnakeCase(p) as Record<string, unknown>;
          const { id: _tempId, ...rest } = snakeP;
          return {
            ...rest,
            child_member_id: id,
          };
        });
        await supabase.from('children_member_parents').insert(parentRows);
      }

      await applyInverseLinks({
        currentMemberId: id,
        currentPool: 'children_members',
        currentGender: data.gender ?? null,
        currentFirstName: data.first_name,
        currentLastName: data.last_name,
        previousLinkedEntries: (previousParentRows ?? []).filter((r: any) => r.is_linked),
        newLinkedEntries: parents,
      });
    }

    // Log activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'update', entityType: 'child_member', entityId: id,
      description: `Updated child member: ${data.first_name} ${data.last_name}`
    });

    return c.json(toCamelCase(data));
  } catch (e) { console.error('PUT /children/members/:id error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

router.delete('/children/members/:id', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (!await isAdminOrDev(user.id)) {
      console.warn('Unauthorized children members delete attempt by', user.id);
      return c.json({ error: 'Forbidden' }, 403);
    }
    const id = c.req.param('id');

    // Get child member name before deleting
    const { data: childToDelete } = await supabase.from('children_members')
      .select('first_name, last_name').eq('id', id).single();

    const { error: cleanupError } = await supabase.from('family_members').delete().eq('linked_child_member_id', id);
    if (cleanupError) {
      console.error('Error deleting child member inverse links:', cleanupError);
      return c.json({ error: cleanupError.message }, 500);
    }

    const { error } = await supabase.from('children_members').delete().eq('id', id);
    if (error) {
      console.error('Error deleting child member:', error);
      return c.json({ error: error.message }, 500);
    }

    // Log activity
    const logP = await getProfileForLog(user.id);
    const delName = childToDelete ? `${childToDelete.first_name} ${childToDelete.last_name}` : id;
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'delete', entityType: 'child_member', entityId: id,
      description: `Deleted child member: ${delName}`
    });

    return c.json({ success: true });
  } catch (e) { console.error('DELETE /children/members/:id error:', e); return c.json({ error: 'Internal server error' }, 500); }
});

// ============================================================================

export default router;
