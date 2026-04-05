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

router.get("/attendance/:id/absentees", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const id = c.req.param('id');

    // Get all member IDs who were present
    const { data: presentEntries } = await supabase
      .from('attendance_entries')
      .select('member_id')
      .eq('attendance_record_id', id);

    const presentIds = (presentEntries || []).map(e => e.member_id);

    // Get all members
    const { data: allMembers } = await supabase
      .from('members')
      .select('id, first_name, last_name, other_names, zone, zone_number, phone, status, photo_url')
      .not('status', 'eq', 'blacklisted')
      .order('first_name');

    if (!allMembers) {
      return c.json([]);
    }

    // Filter to only absent members
    const absentMemberIds = allMembers
      .filter(m => !presentIds.includes(m.id))
      .map(m => m.id);

    // Get existing absentee records for this attendance
    const { data: absenteeRecords } = await supabase
      .from('absentee_records')
      .select('*')
      .eq('attendance_record_id', id);

    const absenteeMap: Record<string, any> = {};
    if (absenteeRecords) {
      for (const rec of absenteeRecords) {
        absenteeMap[rec.member_id] = rec;
      }
    }

    // Combine member info with absentee records
    const absentees = allMembers
      .filter(m => !presentIds.includes(m.id))
      .map(m => {
        const absenteeRecord = absenteeMap[m.id];
        return toCamelCase({
          ...m,
          photo: m.photo_url,
          absenteeInfo: absenteeRecord ? toCamelCase({
            id: absenteeRecord.id,
            requested_permission: absenteeRecord.requested_permission,
            reason: absenteeRecord.reason,
            reason_notes: absenteeRecord.reason_notes,
            absence_start_date: absenteeRecord.absence_start_date,
            absence_end_date: absenteeRecord.absence_end_date,
            until_further_notice: absenteeRecord.until_further_notice,
          }) : null
        });
      });

    return c.json(absentees);
  } catch (error) {
    console.error('Get absentees error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

router.post("/attendance/:id/absentees", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const attendanceRecordId = c.req.param('id');
    const absentees = await c.req.json();

    if (!Array.isArray(absentees) || absentees.length === 0) {
      return c.json({ error: 'Expected an array of absentee records' }, 400);
    }

    const records = absentees.map((a: any) => ({
      attendance_record_id: attendanceRecordId,
      member_id: a.memberId,
      requested_permission: a.requestedPermission || false,
      reason: a.reason || null,
      reason_notes: a.reasonNotes || null,
      absence_start_date: a.absenceStartDate || null,
      absence_end_date: a.absenceEndDate || null,
      until_further_notice: a.untilFurtherNotice || false,
    }));

    const { data, error } = await supabase
      .from('absentee_records')
      .upsert(records, { onConflict: 'attendance_record_id,member_id' })
      .select();

    if (error) {
      console.error('Error saving absentee records:', error);
      return c.json({ error: 'Failed to save absentee records: ' + error.message }, 500);
    }

    // Update member status + leave dates for reason-mapped absences (sick/schooling/traveled)
    const VALID_LEAVE_STATUSES = ['sick', 'schooling', 'traveled'];
    for (const a of absentees) {
      if (a.memberStatus && VALID_LEAVE_STATUSES.includes(a.memberStatus)) {
        try {
          // Get current status for audit log
          const { data: currentMember } = await supabase
            .from('members')
            .select('status, first_name, last_name')
            .eq('id', a.memberId)
            .single();

          // Only update if not already this leave status (avoids redundant writes)
          if (currentMember && currentMember.status !== a.memberStatus) {
            await supabase.from('members').update({
              status: a.memberStatus,
              leave_start_date: a.absenceStartDate || null,
              leave_end_date: a.absenceEndDate || null,
              updated_at: new Date().toISOString(),
            }).eq('id', a.memberId);

            // Log the status change
            await supabase.from('member_status_log').insert({
              member_id: a.memberId,
              previous_status: currentMember.status,
              new_status: a.memberStatus,
              change_type: 'automatic',
              changed_by: user.id,
              reason: `Absence reason: ${a.reason}`,
            });

            // Notify members tab users
            const mName = currentMember
              ? `${currentMember.first_name} ${currentMember.last_name}`
              : 'A member';
            notifyTabUsers('members', {
              type: 'member_status_change',
              title: 'Member Status Updated',
              message: `${mName} status changed to ${a.memberStatus} (reason: ${a.reason}).`,
              entityType: 'member',
              entityId: a.memberId,
              excludeUserId: user.id,
            });
          }
        } catch (memberUpdateErr) {
          console.error('Failed to update member status for absentee:', memberUpdateErr);
          // Non-fatal: absentee record was already saved
        }
      }
    }

    return c.json(toCamelCase(data), 201);
  } catch (error) {
    console.error('Save absentees error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});


router.put("/attendance/:id/absentees/:memberId", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const attendanceRecordId = c.req.param('id');
    const memberId = c.req.param('memberId');
    const updateData = await c.req.json();

    const dbData = {
      requested_permission: updateData.requestedPermission,
      reason: updateData.reason || null,
      reason_notes: updateData.reasonNotes || null,
      absence_start_date: updateData.absenceStartDate || null,
      absence_end_date: updateData.absenceEndDate || null,
      until_further_notice: updateData.untilFurtherNotice || false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('absentee_records')
      .upsert({
        attendance_record_id: attendanceRecordId,
        member_id: memberId,
        ...dbData,
      }, { onConflict: 'attendance_record_id,member_id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating absentee record:', error);
      return c.json({ error: 'Failed to update absentee record' }, 500);
    }

    return c.json(toCamelCase(data));
  } catch (error) {
    console.error('Update absentee error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
