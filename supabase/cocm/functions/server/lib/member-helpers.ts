import { notifyTabUsers } from "./notification-helpers.ts";
import { supabase } from "../lib/supabase.ts";
import { SYSTEM_ROLES } from "../lib/types.ts";

// ============================================================================

export async function recalculateMemberStatuses(changedByUserId?: string) {
  try {
    // Get last 4 Sunday Main Service records ordered by date DESC
    const { data: sundayRecords } = await supabase
      .from('attendance_records')
      .select('id, date')
      .eq('service_type', 'Sunday Main Service')
      .eq('attendance_type', 'individual')
      .order('date', { ascending: false })
      .limit(4);

    if (!sundayRecords || sundayRecords.length < 4) {
      // Not enough Sunday records to evaluate - skip
      return;
    }

    const recordIds = sundayRecords.map(r => r.id);
    const oldestRecordDate = sundayRecords[sundayRecords.length - 1].date;

    // Get attendance counts per member for those 4 records
    const { data: attendanceCounts } = await supabase
      .from('attendance_entries')
      .select('member_id')
      .in('attendance_record_id', recordIds);

    // Build a map: memberId -> count of attendances in last 4 Sundays
    const countMap: Record<string, number> = {};
    if (attendanceCounts) {
      for (const entry of attendanceCounts) {
        countMap[entry.member_id] = (countMap[entry.member_id] || 0) + 1;
      }
    }

    // Get all members that should be evaluated
    const { data: members } = await supabase
      .from('members')
      .select('id, status, join_date, leave_end_date')
      .neq('status', 'blacklisted')
      .neq('status', 'not baptised');

    if (!members) return;

    const today = new Date().toISOString().split('T')[0];
    const updates: { id: string; oldStatus: string; newStatus: string }[] = [];

    // Batch: find which on-leave (sick/schooling/traveled) members (with ended leave) have attendance
    const ON_LEAVE_STATUSES = ['sick', 'schooling', 'traveled'];
    const endedLeaveIds = members
      .filter(m => ON_LEAVE_STATUSES.includes(m.status) && m.leave_end_date && m.leave_end_date < today)
      .map(m => m.id);
    const leaveWithAttendance = new Set<string>();
    if (endedLeaveIds.length > 0) {
      const { data: leaveAtt } = await supabase.from('attendance_entries')
        .select('member_id')
        .in('member_id', endedLeaveIds)
        .in('attendance_record_id', recordIds);
      if (leaveAtt) {
        for (const e of leaveAtt) leaveWithAttendance.add(e.member_id);
      }
    }

    // Batch: for 'new' members, get count of Sunday records since each unique join_date
    // Group new members by join_date to minimize queries
    const newMembers = members.filter(m => m.status === 'new');
    const joinDates = [...new Set(newMembers.map(m => m.join_date).filter(Boolean))];
    const sundayCountSinceJoin: Record<string, number> = {};
    if (joinDates.length > 0) {
      // Get the earliest join date and fetch all Sunday records from there
      const earliestJoin = joinDates.sort()[0];
      const { data: allSundaysSinceJoin } = await supabase
        .from('attendance_records')
        .select('id, date')
        .eq('service_type', 'Sunday Main Service')
        .eq('attendance_type', 'individual')
        .gte('date', earliestJoin)
        .order('date', { ascending: true });
      if (allSundaysSinceJoin) {
        for (const jd of joinDates) {
          sundayCountSinceJoin[jd] = allSundaysSinceJoin.filter(r => r.date >= jd).length;
        }
      }
    }

    for (const member of members) {
      // Skip on-leave members (sick/studies/traveled) unless their leave has ended and they've attended
      if (ON_LEAVE_STATUSES.includes(member.status)) {
        if (!member.leave_end_date || member.leave_end_date >= today) {
          continue; // Still on leave, skip
        }
        if (!leaveWithAttendance.has(member.id)) {
          continue; // No attendance after leave end, keep as-is
        }
        // Has attendance after leave end — fall through to recalculate
      }

      // For 'new' members: check if at least 4 Sunday records exist since their join date
      if (member.status === 'new') {
        const count = sundayCountSinceJoin[member.join_date] || 0;
        if (count < 4) {
          continue; // Not enough Sundays since they joined, keep as 'new'
        }
      }

      const attendCount = countMap[member.id] || 0;
      let newStatus: string;

      if (attendCount >= 3) {
        newStatus = 'active';
      } else if (attendCount >= 1) {
        newStatus = 'semi-active';
      } else {
        newStatus = 'inactive';
      }

      if (newStatus !== member.status) {
        updates.push({ id: member.id, oldStatus: member.status, newStatus });
      }
    }

    // Apply updates
    for (const update of updates) {
      await supabase
        .from('members')
        .update({ status: update.newStatus, updated_at: new Date().toISOString() })
        .eq('id', update.id);

      // Log the status change
      await supabase
        .from('member_status_log')
        .insert({
          member_id: update.id,
          previous_status: update.oldStatus,
          new_status: update.newStatus,
          change_type: 'automatic',
          changed_by: changedByUserId || null,
          reason: `Auto-recalculated after Sunday Main Service attendance`
        });

      // Get member name for notification
      const { data: memberInfo } = await supabase.from('members').select('first_name, last_name').eq('id', update.id).single();
      const mName = memberInfo ? `${memberInfo.first_name} ${memberInfo.last_name}` : 'A member';

      // Notify users with members tab access
      notifyTabUsers('members', {
        type: 'member_status_change', title: 'Member Status Changed',
        message: `${mName} changed from ${update.oldStatus} to ${update.newStatus} (auto-recalculated).`,
        entityType: 'member', entityId: update.id, excludeUserId: changedByUserId
      });
    }

    console.log(`Status recalculation complete: ${updates.length} members updated`);
  } catch (error) {
    console.error('Status recalculation error:', error);
  }
}

// ============================================================================
// ============================================================================
export function inverseOf(relationship: string, gender: string | null): string {
  const rel = relationship.toLowerCase();
  
  if (rel === 'father' || rel === 'mother' || rel === 'parent') return 'child';
  
  if (rel === 'child' || rel === 'son' || rel === 'daughter') {
    if (gender === 'male') return 'father';
    if (gender === 'female') return 'mother';
    return 'parent';
  }

  if (rel === 'sibling' || rel === 'brother' || rel === 'sister') {
    if (gender === 'male') return 'brother';
    if (gender === 'female') return 'sister';
    return 'sibling';
  }

  if (rel === 'spouse') return 'spouse';
  
  return relationship; // fallback
}

export async function applyInverseLinks(params: {
  currentMemberId: string,
  currentPool: 'members' | 'children_members',
  currentGender: string | null,
  currentFirstName: string,
  currentLastName: string,
  previousLinkedEntries: any[],
  newLinkedEntries: any[],
}) {
  const { currentMemberId, currentPool, currentGender, currentFirstName, currentLastName, previousLinkedEntries, newLinkedEntries } = params;
  
  // Build maps keyed by linked id
  const prevMap = new Map();
  for (const entry of previousLinkedEntries) {
    const id = entry.linked_member_id || entry.linked_child_member_id;
    if (id) prevMap.set(id, entry);
  }

  const newMap = new Map();
  for (const entry of newLinkedEntries) {
    const id = entry.linkedMemberId || entry.linkedChildMemberId;
    if (id) newMap.set(id, entry);
  }

  const removedKeys = Array.from(prevMap.keys()).filter(k => !newMap.has(k));
  const addedKeys = Array.from(newMap.keys()).filter(k => !prevMap.has(k));
  const changedKeys = Array.from(prevMap.keys()).filter(k => {
    const newVal = newMap.get(k);
    return newVal && newVal.relationship !== prevMap.get(k).relationship;
  });

  // Handle Removals
  for (const id of removedKeys) {
    const entry = prevMap.get(id);
    if (currentPool === 'members') {
      if (entry.linked_member_id) {
        await supabase.from('family_members')
          .delete()
          .eq('member_id', id)
          .eq('linked_member_id', currentMemberId);
      } else if (entry.linked_child_member_id) {
        await supabase.from('children_member_parents')
          .delete()
          .eq('child_member_id', entry.linked_child_member_id)
          .eq('linked_member_id', currentMemberId);
      }
    } else if (currentPool === 'children_members') {
      if (entry.linked_child_member_id) {
        await supabase.from('children_member_parents')
          .delete()
          .eq('child_member_id', entry.linked_child_member_id)
          .eq('linked_child_member_id', currentMemberId);
      }
    }
  }

  // Handle Changed
  for (const id of changedKeys) {
    const entry = prevMap.get(id);
    if (currentPool === 'members') {
      if (entry.linked_member_id) {
        await supabase.from('family_members').delete().eq('member_id', id).eq('linked_member_id', currentMemberId);
      } else if (entry.linked_child_member_id) {
        await supabase.from('children_member_parents').delete().eq('child_member_id', entry.linked_child_member_id).eq('linked_member_id', currentMemberId);
      }
    } else if (currentPool === 'children_members') {
      if (entry.linked_child_member_id) {
        await supabase.from('children_member_parents')
          .delete()
          .eq('child_member_id', entry.linked_child_member_id)
          .eq('linked_child_member_id', currentMemberId);
      }
    }
  }

  const entriesToInsert = [...addedKeys, ...changedKeys].map(id => newMap.get(id));

  for (const entry of entriesToInsert) {
    if (currentPool === 'members') {
      // Skip inverse insert when relationship is 'child' but gender is unknown
      // — inverseOf('child', null) returns 'parent' which is not a valid UI relationship
      if (entry.relationship === 'child' && !currentGender) {
        continue;
      }
      if (entry.linkedMemberId) {
        const { data: existingReverse } = await supabase.from('family_members')
          .select('id').eq('member_id', entry.linkedMemberId).eq('linked_member_id', currentMemberId);
        if (!existingReverse?.length) {
          await supabase.from('family_members').insert({
            member_id: entry.linkedMemberId,
            relationship: inverseOf(entry.relationship, currentGender),
            linked_member_id: currentMemberId,
            is_linked: true,
            first_name: currentFirstName,
            last_name: currentLastName,
            other_names: null,
            phone: null
          });
        }
      } else if (entry.linkedChildMemberId) {
        const { data: existing } = await supabase.from('children_member_parents')
          .select('id').eq('child_member_id', entry.linkedChildMemberId).eq('linked_member_id', currentMemberId);
        if (!existing?.length) {
          await supabase.from('children_member_parents').insert({
            child_member_id: entry.linkedChildMemberId,
            relationship: inverseOf(entry.relationship, currentGender),
            linked_member_id: currentMemberId,
            is_linked: true,
            first_name: currentFirstName,
            last_name: currentLastName
          });
        }
      }
    } else if (currentPool === 'children_members') {
      if (entry.linkedChildMemberId) {
        const { data: existing } = await supabase.from('children_member_parents')
          .select('id').eq('child_member_id', entry.linkedChildMemberId).eq('linked_child_member_id', currentMemberId);
        if (!existing?.length) {
          await supabase.from('children_member_parents').insert({
            child_member_id: entry.linkedChildMemberId,
            relationship: inverseOf(entry.relationship, currentGender),
            linked_child_member_id: currentMemberId,
            is_linked: true,
            first_name: currentFirstName,
            last_name: currentLastName
          });
        }
      }
    }
  }
}

// ============================================================================
