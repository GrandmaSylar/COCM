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
router.get("/members", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    // Fetch members
    const { data: members, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching members:', error);
      return c.json({ error: 'Failed to fetch members' }, 500);
    }

    // Fetch family members for all members in a single batched query (optimized)
    const memberIds = members?.map(m => m.id) || [];
    let familyMembersMap: Record<string, any[]> = {};

    if (memberIds.length > 0) {
      const { data: allFamilyMembers } = await supabase
        .from('family_members')
        .select('*')
        .in('member_id', memberIds);

      // Group family members by member_id
      if (allFamilyMembers) {
        for (const fm of allFamilyMembers) {
          if (!familyMembersMap[fm.member_id]) {
            familyMembersMap[fm.member_id] = [];
          }
          familyMembersMap[fm.member_id].push(fm);
        }
      }
    }

    // Attach family members to each member
    const membersWithFamily = members?.map(member => ({
      ...member,
      family_members: familyMembersMap[member.id] || []
    })) || [];

    // Transform to camelCase
    const transformedMembers = toCamelCase(membersWithFamily);

    return c.json(transformedMembers);
  } catch (error) {
    console.error('Get members error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.get("/members/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const { data: member, error } = await supabase.from('members').select(`
        *,
        family_members!family_members_member_id_fkey (*)
      `).eq('id', id).single();
    if (error) {
      console.error('Error fetching member:', error);
      // PGRST116 = no rows returned (member does not exist)
      if (error.code === 'PGRST116') {
        return c.json({
          error: 'Member not found'
        }, 404);
      }
      return c.json({
        error: error.message || 'Failed to fetch member'
      }, 500);
    }

    // ── Bidirectional family linking ──
    // Find children_members who have a parent linked to this member
    const { data: childParentLinks } = await supabase
      .from('children_member_parents')
      .select('child_member_id, relationship, children_members!inner(first_name, last_name, other_names, id)')
      .eq('linked_member_id', id);

    // Build synthetic family_members entries for each linked child
    const linkedChildren = (childParentLinks || []).map((link: any) => ({
      id: `child-link-${link.child_member_id}`,
      member_id: id,
      relationship: 'child',
      first_name: link.children_members?.first_name || '',
      last_name: link.children_members?.last_name || '',
      other_names: link.children_members?.other_names || null,
      phone: null,
      is_linked: true,
      linked_member_id: null,
      linked_child_member_id: link.child_member_id,
    }));

    const existingFamily = member.family_members || [];
    const merged = { ...member, family_members: [...existingFamily, ...linkedChildren] };
    return c.json(toCamelCase(merged));
  } catch (error) {
    console.error('Get member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.get("/members/:id/analytics", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const memberId = c.req.param('id');

    // Get attendance records for this member
    const { data: attendanceEntries, error: attendanceError } = await supabase
      .from('attendance_entries')
      .select(`
        attendance_record:attendance_records!inner (
          id,
          date,
          service_type,
          start_time,
          end_time,
          attendance_type
        )
      `)
      .eq('member_id', memberId)
      .eq('attendance_records.attendance_type', 'individual')
      .order('created_at', { ascending: false });

    if (attendanceError) {
      console.error('Error fetching attendance:', attendanceError);
      return c.json({
        error: 'Failed to fetch analytics'
      }, 500);
    }

    // Calculate attendance stats
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const allRecords = attendanceEntries
      .map(entry => Array.isArray(entry.attendance_record) ? entry.attendance_record[0] : entry.attendance_record)
      .filter((record: any) => record !== null && record !== undefined);

    const thisMonthRecords = allRecords.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= thisMonthStart && recordDate <= thisMonthEnd;
    });

    // Get total individual services this month from attendance_records
    const { data: allServicesThisMonth } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('attendance_type', 'individual')
      .gte('date', thisMonthStart.toISOString().split('T')[0])
      .lte('date', thisMonthEnd.toISOString().split('T')[0]);

    const totalServices = allServicesThisMonth?.length || 0;
    const attendedServices = thisMonthRecords.length;
    const percentage = totalServices > 0 ? Math.round((attendedServices / totalServices) * 100) : 0;

    // Format recent activity (last 10)
    const recentActivity = allRecords.slice(0, 10).map(record => ({
      date: record.date,
      type: 'attendance',
      description: record.service_type
    }));

    return c.json({
      attendanceStats: {
        thisMonth: attendedServices,
        totalServices: totalServices,
        percentage: percentage
      },
      recentActivity: recentActivity
    });
  } catch (error) {
    console.error('Get member analytics error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});

// ── GET /members/:id/attendance-history ──────────────────────────────
router.get("/members/:id/attendance-history", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const memberId = c.req.param('id');
    const fromParam = c.req.query('from');
    const toParam = c.req.query('to');

    // Get member info (name, join date)
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('first_name, last_name, other_names, join_date')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      return c.json({ error: 'Member not found' }, 404);
    }

    const joinDate = member.join_date || '2020-01-01';
    const today = new Date().toISOString().split('T')[0];
    const from = fromParam || joinDate;
    const to = toParam || today;

    // Get ALL individual attendance records in the date range
    const { data: allRecords, error: recordsError } = await supabase
      .from('attendance_records')
      .select('id, date, service_type, start_time, end_time')
      .eq('attendance_type', 'individual')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (recordsError) {
      console.error('Error fetching attendance records:', recordsError);
      return c.json({ error: 'Failed to fetch attendance records' }, 500);
    }

    // Get this member's attendance entries (records they were present for)
    const { data: presentEntries, error: entriesError } = await supabase
      .from('attendance_entries')
      .select('attendance_record_id')
      .eq('member_id', memberId);

    if (entriesError) {
      console.error('Error fetching attendance entries:', entriesError);
      return c.json({ error: 'Failed to fetch attendance entries' }, 500);
    }

    const presentRecordIds = new Set(
      (presentEntries || []).map((e: any) => e.attendance_record_id)
    );

    // Get absentee records for this member
    const { data: absenteeRecords, error: absenteeError } = await supabase
      .from('absentee_records')
      .select('attendance_record_id, requested_permission, reason, reason_notes, absence_start_date, absence_end_date, until_further_notice')
      .eq('member_id', memberId);

    if (absenteeError) {
      console.error('Error fetching absentee records:', absenteeError);
      // Non-fatal, continue without absence info
    }

    const absenteeMap = new Map<string, any>();
    (absenteeRecords || []).forEach((r: any) => {
      absenteeMap.set(r.attendance_record_id, {
        requestedPermission: r.requested_permission || false,
        reason: r.reason || null,
        reasonNotes: r.reason_notes || null,
        absenceStartDate: r.absence_start_date || null,
        absenceEndDate: r.absence_end_date || null,
        untilFurtherNotice: r.until_further_notice || false
      });
    });

    // Build records list
    const serviceTypeNames: Record<string, string> = {
      sunday_morning: 'Sunday Main Service',
      sunday_evening: 'Sunday Evening Service',
      midweek: 'Midweek Service',
      special: 'Special Service',
      other: 'Other Service'
    };

    let totalPresent = 0;
    let totalAbsent = 0;

    const records = (allRecords || []).map((rec: any) => {
      const isPresent = presentRecordIds.has(rec.id);
      if (isPresent) totalPresent++;
      else totalAbsent++;

      return {
        date: rec.date,
        serviceType: rec.service_type,
        serviceName: serviceTypeNames[rec.service_type] || rec.service_type,
        startTime: rec.start_time,
        endTime: rec.end_time,
        status: isPresent ? 'present' : 'absent',
        absenceInfo: !isPresent ? (absenteeMap.get(rec.id) || null) : null
      };
    });

    const totalServices = records.length;
    const percentage = totalServices > 0 ? Math.round((totalPresent / totalServices) * 100 * 10) / 10 : 0;

    const memberName = [member.first_name, member.other_names, member.last_name].filter(Boolean).join(' ');

    return c.json({
      memberName,
      joinDate,
      summary: {
        totalServices,
        totalPresent,
        totalAbsent,
        percentage
      },
      records
    });
  } catch (error) {
    console.error('Get member attendance history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.post("/members", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const memberData = await c.req.json();
    const { familyMembers, ...memberInfo } = memberData;
    // Convert camelCase to snake_case for database
    const dbMemberData = toSnakeCase(memberInfo) as Record<string, any>;

    // Handle special field mappings (photo -> photo_url)
    if (dbMemberData.photo !== undefined) {
      dbMemberData.photo_url = dbMemberData.photo;
      delete dbMemberData.photo;
    }

    // Set join_date to today if not provided
    if (!dbMemberData.join_date) {
      dbMemberData.join_date = new Date().toISOString().split('T')[0];
    }

    // Force 'new' status for newly created members, unless they are 'not baptised'
    if (dbMemberData.status !== 'not baptised') {
      dbMemberData.status = 'new';
    }

    const { data: member, error: memberError } = await supabase.from('members').insert({
      ...dbMemberData,
      created_by: user.id
    }).select().single();
    if (memberError) {
      console.error('Error creating member:', memberError);
      return c.json({
        error: 'Failed to create member: ' + memberError.message
      }, 500);
    }
    await applyInverseLinks({
      currentMemberId: member.id,
      currentPool: 'members',
      currentGender: dbMemberData.gender ?? null,
      currentFirstName: dbMemberData.first_name,
      currentLastName: dbMemberData.last_name,
      previousLinkedEntries: [],
      newLinkedEntries: familyMembers ?? [],
    });
    if (familyMembers && familyMembers.length > 0) {
      // Convert family members to snake_case
      const familyMembersData = familyMembers.map((fm: any) => {
        const snakeFm = toSnakeCase(fm) as Record<string, any>;
        // Remove the temp id and ensure member_id is set
        const { id: _tempId, ...rest } = snakeFm;
        return {
          ...rest,
          member_id: member.id
        };
      });
      console.log('Inserting family members:', JSON.stringify(familyMembersData));
      const { error: fmError } = await supabase.from('family_members').insert(familyMembersData);
      if (fmError) {
        console.error('Error inserting family members:', fmError);
      }
    }
    const { data: completeMember } = await supabase.from('members').select(`
        *,
        family_members!family_members_member_id_fkey (*)
      `).eq('id', member.id).single();

    // Log activity
    const logP = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP.name, userRole: logP.role,
      action: 'create', entityType: 'member', entityId: member.id,
      description: `Registered new member: ${dbMemberData.first_name} ${dbMemberData.last_name}`
    });

    // Notify users with members tab access
    notifyTabUsers('members', {
      type: 'member_registered', title: 'New Member Registered',
      message: `${dbMemberData.first_name} ${dbMemberData.last_name} was registered as a new member.`,
      entityType: 'member', entityId: member.id, excludeUserId: user.id
    });

    // Convert response back to camelCase for frontend
    return c.json(toCamelCase(completeMember || member), 201);
  } catch (error) {
    console.error('Create member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.put("/members/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const memberData = await c.req.json();
    const { familyMembers, ...memberInfo } = memberData;

    // Convert camelCase to snake_case for database
    const dbMemberData = toSnakeCase(memberInfo) as Record<string, any>;

    // Handle special field mappings (photo -> photo_url)
    if (dbMemberData.photo !== undefined) {
      dbMemberData.photo_url = dbMemberData.photo;
      delete dbMemberData.photo;
    }

    // Only pass columns that exist on members table (avoid 500 from occupation, hometown, id, etc.)
    const allowedColumns = [
      'first_name', 'last_name', 'other_names', 'email', 'phone', 'second_phone',
      'gender', 'date_of_birth', 'marital_status', 'residence_location', 'digital_address',
      'zone', 'zone_number', 'notes', 'status', 'join_date', 'photo_url',
      'baptism_info', 'legal_info', 'ministries', 'position_held',
      'sabbatical_start_date', 'sabbatical_end_date', 'sabbatical_reason'
    ];
    const updatePayload: Record<string, any> = {};
    for (const key of allowedColumns) {
      if (dbMemberData[key] !== undefined) {
        updatePayload[key] = dbMemberData[key];
      }
    }

    // Log manual status changes
    if (updatePayload.status) {
      const { data: currentMember } = await supabase
        .from('members')
        .select('status')
        .eq('id', id)
        .single();
      if (currentMember && currentMember.status !== updatePayload.status) {
        await supabase.from('member_status_log').insert({
          member_id: id,
          previous_status: currentMember.status,
          new_status: updatePayload.status,
          change_type: 'manual',
          changed_by: user.id,
          reason: 'Manual status override'
        });
      }
    }

    const { data: member, error: memberError } = await supabase.from('members').update(updatePayload).eq('id', id).select().single();
    if (memberError) {
      console.error('Error updating member:', memberError);
      return c.json({
        error: memberError.message || 'Failed to update member'
      }, 500);
    }
    if (familyMembers) {
      const { data: previousFamilyRows } = await supabase
        .from('family_members')
        .select('*')
        .eq('member_id', id);

      await applyInverseLinks({
        currentMemberId: id,
        currentPool: 'members',
        currentGender: member.gender ?? null,
        currentFirstName: member.first_name,
        currentLastName: member.last_name,
        previousLinkedEntries: (previousFamilyRows ?? []).filter((r: any) => r.is_linked),
        newLinkedEntries: familyMembers,
      });

      await supabase.from('family_members').delete().eq('member_id', id);
      if (familyMembers.length > 0) {
        const familyMembersData = familyMembers.map((fm: any) => {
          const snakeFm = toSnakeCase(fm) as Record<string, any>;
          // Remove the temp/old id and ensure member_id is set
          const { id: _tempId, ...rest } = snakeFm;
          return {
            ...rest,
            member_id: id
          };
        });
        console.log('Updating family members:', JSON.stringify(familyMembersData));
        const { error: fmError } = await supabase.from('family_members').insert(familyMembersData);
        if (fmError) {
          console.error('Error inserting family members:', fmError);
        }
      }
    }

    const { data: completeMember } = await supabase.from('members').select(`
        *,
        family_members!family_members_member_id_fkey (*)
      `).eq('id', id).single();

    // Log activity
    const logP2 = await getProfileForLog(user.id);
    await logActivity({
      userId: user.id, userName: logP2.name, userRole: logP2.role,
      action: 'update', entityType: 'member', entityId: id,
      description: `Updated member: ${member.first_name} ${member.last_name}`
    });

    return c.json(toCamelCase(completeMember || member));
  } catch (error) {
    console.error('Update member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.delete("/members/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');

    // Get member name before deleting
    const { data: memberToDelete } = await supabase.from('members').select('first_name, last_name').eq('id', id).single();

    // Clean up inverse links and delete member atomically using RPC
    const { error } = await supabase.rpc('delete_member_txn', { target_member_id: id });
    if (error) {
      console.error('Error deleting member:', error);
      return c.json({
        error: 'Failed to delete member'
      }, 500);
    }

    // Log activity
    const logP3 = await getProfileForLog(user.id);
    const delName = memberToDelete ? `${memberToDelete.first_name} ${memberToDelete.last_name}` : id;
    await logActivity({
      userId: user.id, userName: logP3.name, userRole: logP3.role,
      action: 'delete', entityType: 'member', entityId: id,
      description: `Deleted member: ${delName}`
    });

    return c.json({
      message: 'Member deleted successfully'
    });
  } catch (error) {
    console.error('Delete member error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.get("/attendance", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const { data: records, error } = await supabase.from('attendance_records').select(`
        *,
        attendance_entries (
          member_id
        )
      `).order('date', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching attendance:', error);
      return c.json({
        error: 'Failed to fetch attendance records'
      }, 500);
    }
    const transformed = records.map((record)=>{
        const attendees = (record.attendance_entries || []).map((entry: any)=>entry.member_id);
        const camelRecord = toCamelCase(record) as Record<string, any>;
        return {
          ...camelRecord,
          attendees
        };
      });
    return c.json(transformed);
  } catch (error) {
    console.error('Get attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.post("/attendance", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const data = await c.req.json();
    const { attendees, totalCount, serviceType, startTime, endTime, isCustomService, customServiceId, attendanceType, menCount, womenCount, childrenCount, visitorsCount, ...rest } = data;
    const recordType = attendanceType || 'individual';
    const dateValue = rest.date || data.date;

    // Check if a record already exists for this date + service + type
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, created_at')
      .eq('date', dateValue)
      .eq('service_type', serviceType)
      .eq('attendance_type', recordType)
      .single();

    let record: any;
    if (existingRecord) {
      // Update the existing record instead of creating a duplicate
      const { data: updated, error: updateError } = await supabase.from('attendance_records').update({
        start_time: startTime || null,
        end_time: endTime || null,
        is_custom_service: isCustomService || false,
        custom_service_id: customServiceId || null,
        total_count: totalCount || attendees?.length || 0,
        men_count: menCount || 0,
        women_count: womenCount || 0,
        children_count: childrenCount || 0,
        visitors_count: visitorsCount || 0
      }).eq('id', existingRecord.id).select().single();
      if (updateError) {
        console.error('Error updating attendance record:', updateError);
        return c.json({
          error: 'Failed to update attendance record: ' + updateError.message
        }, 500);
      }
      record = updated;

      // For individual records, replace attendance entries
      if (recordType === 'individual') {
        await supabase.from('attendance_entries').delete().eq('attendance_record_id', record.id);
        if (attendees && attendees.length > 0) {
          const entries = attendees.map((memberId: string)=>({
              attendance_record_id: record.id,
              member_id: memberId
            }));
          await supabase.from('attendance_entries').insert(entries);
        }
      }
    } else {
      // Create new record
      const { data: created, error: recordError } = await supabase.from('attendance_records').insert({
        ...rest,
        service_type: serviceType,
        start_time: startTime || null,
        end_time: endTime || null,
        is_custom_service: isCustomService || false,
        custom_service_id: customServiceId || null,
        created_by: user.id,
        total_count: totalCount || attendees?.length || 0,
        attendance_type: recordType,
        men_count: menCount || 0,
        women_count: womenCount || 0,
        children_count: childrenCount || 0,
        visitors_count: visitorsCount || 0
      }).select().single();
      if (recordError) {
        console.error('Error creating attendance record:', recordError);
        return c.json({
          error: 'Failed to create attendance record: ' + recordError.message
        }, 500);
      }
      record = created;

      // Only create attendance entries for individual records
      if (recordType === 'individual' && attendees && attendees.length > 0) {
        const entries = attendees.map((memberId: string)=>({
            attendance_record_id: record.id,
            member_id: memberId
          }));
        await supabase.from('attendance_entries').insert(entries);
      }
    }
    // Recalculate member statuses after Sunday Main Service individual attendance
    if (serviceType === 'Sunday Main Service' && recordType === 'individual') {
      await recalculateMemberStatuses(user.id);
    }

    // Auto-create/update service_record
    try {
      const attCount = totalCount || attendees?.length || 0;
      const { data: existingSR } = await supabase.from('service_records')
        .select('id, attendance_record_id').eq('service_date', dateValue).eq('service_type', serviceType).single();
      if (existingSR) {
        await supabase.from('service_records').update({
          attendance_record_id: record.id, updated_at: new Date().toISOString()
        }).eq('id', existingSR.id);
      } else {
        await supabase.from('service_records').insert({
          service_date: dateValue, service_type: serviceType,
          attendance_record_id: record.id, created_by: user.id
        });
      }
    } catch (srErr) { console.error('Service record auto-create error:', srErr); }

    // Log activity
    const logPA = await getProfileForLog(user.id);
    const attTotal = totalCount || attendees?.length || 0;
    await logActivity({
      userId: user.id, userName: logPA.name, userRole: logPA.role,
      action: existingRecord ? 'update' : 'create', entityType: 'attendance', entityId: record.id,
      description: `${existingRecord ? 'Updated' : 'Recorded'} ${recordType} attendance for ${serviceType} on ${dateValue} (${attTotal} ${recordType === 'individual' ? 'members' : 'head count'})`
    });

    // Check for new high attendance and notify
    try {
      const { data: maxAtt } = await supabase.from('attendance_records')
        .select('total_count').order('total_count', { ascending: false }).limit(1).neq('id', record.id).single();
      if (maxAtt && attTotal > maxAtt.total_count) {
        notifyTabUsers('attendance', {
          type: 'attendance_record', title: 'New Attendance Record!',
          message: `${serviceType} on ${dateValue} had ${attTotal} attendees — a new high! Previous record was ${maxAtt.total_count}.`,
          entityType: 'attendance', entityId: record.id, excludeUserId: user.id
        });
      }
    } catch (nErr) { console.error('Notification check error:', nErr); }

    return c.json({
      ...record,
      attendees
    }, 201);
  } catch (error) {
    console.error('Create attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.get("/attendance/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');
    const { data: record, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        attendance_entries (
          member_id
        )
      `)
      .eq('id', id)
      .single();
    if (error) {
      console.error('Error fetching attendance record:', error);
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Attendance record not found' }, 404);
      }
      return c.json({ error: 'Failed to fetch attendance record' }, 500);
    }
    const attendees = (record.attendance_entries || []).map((entry: { member_id: string }) => entry.member_id);
    const camelRecord = toCamelCase(record) as Record<string, any>;
    return c.json({ ...camelRecord, attendees });
  } catch (error) {
    console.error('Get attendance by id error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
router.put("/attendance/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');

    // Check edit window (12 hours) - only Dev can edit after window closes
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('created_at, service_type, attendance_type')
      .eq('id', id)
      .single();

    if (existingRecord) {
      const createdAt = new Date(existingRecord.created_at).getTime();
      const now = Date.now();
      const twelveHours = 12 * 60 * 60 * 1000;
      if (now - createdAt > twelveHours) {
        // Check if user is dev
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (!profile || profile.role !== 'dev') {
          return c.json({
            error: 'Edit window has expired (12 hours). Only Dev users can edit after this period.'
          }, 403);
        }
      }
    }

    const data = await c.req.json();
    const { attendees, totalCount, serviceType, startTime, endTime, isCustomService, customServiceId, attendanceType, menCount, womenCount, childrenCount, visitorsCount, ...rest } = data;
    const { data: record, error: recordError } = await supabase.from('attendance_records').update({
      ...rest,
      service_type: serviceType,
      start_time: startTime || null,
      end_time: endTime || null,
      is_custom_service: isCustomService || false,
      custom_service_id: customServiceId || null,
      total_count: totalCount || attendees?.length || 0,
      men_count: menCount || 0,
      women_count: womenCount || 0,
      children_count: childrenCount || 0,
      visitors_count: visitorsCount || 0
    }).eq('id', id).select().single();
    if (recordError) {
      console.error('Error updating attendance:', recordError);
      return c.json({
        error: 'Failed to update attendance'
      }, 500);
    }
    // Only manage attendance entries for individual records
    if (existingRecord?.attendance_type === 'individual' && attendees) {
      await supabase.from('attendance_entries').delete().eq('attendance_record_id', id);
      if (attendees.length > 0) {
        const entries = attendees.map((memberId: string)=>({
            attendance_record_id: id,
            member_id: memberId
          }));
        await supabase.from('attendance_entries').insert(entries);
      }
    }
    // Recalculate member statuses only for individual Sunday Main Service records
    if ((serviceType === 'Sunday Main Service' || record.service_type === 'Sunday Main Service') && existingRecord?.attendance_type === 'individual') {
      await recalculateMemberStatuses(user.id);
    }
    return c.json({
      ...record,
      attendees
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
router.delete("/attendance/:id", async (c)=>{
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({
        error: 'Unauthorized'
      }, 401);
    }
    const id = c.req.param('id');
    const { error } = await supabase.from('attendance_records').delete().eq('id', id);
    if (error) {
      console.error('Error deleting attendance:', error);
      return c.json({
        error: 'Failed to delete attendance'
      }, 500);
    }
    return c.json({
      message: 'Attendance deleted successfully'
    });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
});
// ============================================================================

export default router;
