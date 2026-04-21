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

// Get today's (or most recent) service records
// Helper: enrich and group service records by date, combining multiple service types
// Uses batch queries instead of per-record to avoid N+1
// Normalise legacy enum-style service types to their canonical display names
function normalizeServiceType(type: string): string {
  const map: Record<string, string> = {
    sunday_morning: 'Sunday Main Service',
    sunday_evening: 'Sunday Evening',
    midweek: 'Midweek Service',
    special: 'Special Service',
  };
  return map[type] || type;
}

async function enrichAndGroupByDate(records: any[]) {
  if (!records || records.length === 0) return [];

  // Sort by created_at desc so newest records come first (they overwrite older)
  const sorted = [...records].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Collect all IDs for batch fetching
  const attendanceIds = sorted.map(sr => sr.attendance_record_id).filter(Boolean);
  const givingIds = sorted.map(sr => sr.giving_record_id).filter(Boolean);
  const allDates = [...new Set(sorted.map(sr => sr.service_date))];

  // Batch fetch attendance totals
  const attendanceMap: Record<string, number> = {};
  if (attendanceIds.length > 0) {
    const { data: attData } = await supabase.from('attendance_records')
      .select('id, total_count')
      .in('id', attendanceIds);
    if (attData) {
      for (const a of attData) attendanceMap[a.id] = a.total_count || 0;
    }
  }

  // Batch fetch absentee counts
  const absenteeMap: Record<string, number> = {};
  if (attendanceIds.length > 0) {
    const { data: absData } = await supabase.from('absentee_records')
      .select('attendance_record_id')
      .in('attendance_record_id', attendanceIds);
    if (absData) {
      for (const a of absData) {
        absenteeMap[a.attendance_record_id] = (absenteeMap[a.attendance_record_id] || 0) + 1;
      }
    }
  }

  // Batch fetch giving totals
  const givingMap: Record<string, number> = {};
  if (givingIds.length > 0) {
    const { data: givData } = await supabase.from('giving_records')
      .select('id, total_amount')
      .in('id', givingIds);
    if (givData) {
      for (const g of givData) givingMap[g.id] = g.total_amount || 0;
    }
  }

  // Batch fetch visitor counts per date
  const visitorCountMap: Record<string, number> = {};
  if (allDates.length > 0) {
    const { data: visData } = await supabase.from('visitors')
      .select('visit_date')
      .in('visit_date', allDates);
    if (visData) {
      for (const v of visData) {
        visitorCountMap[v.visit_date] = (visitorCountMap[v.visit_date] || 0) + 1;
      }
    }
  }

  const childrenGivingTotalMap: Record<string, number> = {};
  const childrenAttendanceCountMap: Record<string, number> = {};
  const childrenVisitorsCountMap: Record<string, number> = {};
  const expensesTotalMap: Record<string, number> = {};
  // Date-only fallback maps for when service_type keys don't match
  const childrenGivingByDateMap: Record<string, number> = {};
  const childrenAttendanceByDateMap: Record<string, number> = {};
  const expensesByDateMap: Record<string, number> = {};

  if (allDates.length > 0) {
    const [
      { data: cgData },
      { data: caData },
      { data: cvData },
      { data: expData }
    ] = await Promise.all([
      supabase.from('children_giving_records').select('service_date, service_type, total_amount').in('service_date', allDates),
      supabase.from('children_attendance_records').select('date, service_type, total_count').in('date', allDates),
      supabase.from('children_visitors').select('visit_date').in('visit_date', allDates),
      supabase.from('expense_records').select('service_date, service_type, amount').in('service_date', allDates)
    ]);

    if (cgData) {
      for (const rec of cgData) {
        const key = `${rec.service_date}_${normalizeServiceType(rec.service_type)}`;
        childrenGivingTotalMap[key] = (childrenGivingTotalMap[key] || 0) + (rec.total_amount || 0);
        childrenGivingByDateMap[rec.service_date] = (childrenGivingByDateMap[rec.service_date] || 0) + (rec.total_amount || 0);
      }
    }
    if (caData) {
      for (const rec of caData) {
        const key = `${rec.date}_${normalizeServiceType(rec.service_type)}`;
        childrenAttendanceCountMap[key] = (childrenAttendanceCountMap[key] || 0) + (rec.total_count || 0);
        childrenAttendanceByDateMap[rec.date] = (childrenAttendanceByDateMap[rec.date] || 0) + (rec.total_count || 0);
      }
    }
    if (cvData) {
      for (const rec of cvData) {
        childrenVisitorsCountMap[rec.visit_date] = (childrenVisitorsCountMap[rec.visit_date] || 0) + 1;
      }
    }
    if (expData) {
      for (const rec of expData) {
        const key = `${rec.service_date}_${normalizeServiceType(rec.service_type)}`;
        expensesTotalMap[key] = (expensesTotalMap[key] || 0) + (rec.amount || 0);
        expensesByDateMap[rec.service_date] = (expensesByDateMap[rec.service_date] || 0) + (rec.amount || 0);
      }
    }
  }

  // Group by service_date and NORMALISED service_type
  const dateTypeMap: Record<string, any[]> = {};
  for (const sr of sorted) {
    const key = `${sr.service_date}_${normalizeServiceType(sr.service_type)}`;
    if (!dateTypeMap[key]) dateTypeMap[key] = [];
    dateTypeMap[key].push(sr);
  }

  // Check if there's only one service type per date (common case)
  const dateToTypeCount: Record<string, number> = {};
  for (const key of Object.keys(dateTypeMap)) {
    const d = key.split('_')[0];
    dateToTypeCount[d] = (dateToTypeCount[d] || 0) + 1;
  }

  const grouped = Object.entries(dateTypeMap).map(([key, srs]) => {
    // key is date_type, we can get date from the first record
    const date = srs[0].service_date;
    const type = normalizeServiceType(srs[0].service_type);
    const compositeKey = `${date}_${type}`;
    const isOnlyTypeForDate = (dateToTypeCount[date] || 0) <= 1;

    let totalAttendance = 0;
    let totalGiving = 0;
    let totalAbsentees = 0;
    let totalVisitors = 0;
    let totalNewMembers = 0;
    const serviceTypes: string[] = [type];

    for (const sr of srs) {
      if (sr.attendance_record_id) {
        totalAttendance += attendanceMap[sr.attendance_record_id] || 0;
        totalAbsentees += absenteeMap[sr.attendance_record_id] || 0;
      }
      if (sr.giving_record_id) {
        totalGiving += givingMap[sr.giving_record_id] || 0;
      }
      totalVisitors += sr.visitors_count || 0;
      totalNewMembers += sr.members_registered || 0;
    }

    // Use composite key first; if 0 and only one service type for the date, fall back to date-only
    const childrenAttCount = childrenAttendanceCountMap[compositeKey] ?? (isOnlyTypeForDate ? (childrenAttendanceByDateMap[date] ?? 0) : 0);
    const childrenGivTotal = childrenGivingTotalMap[compositeKey] ?? (isOnlyTypeForDate ? (childrenGivingByDateMap[date] ?? 0) : 0);
    const expTotal = expensesTotalMap[compositeKey] ?? (isOnlyTypeForDate ? (expensesByDateMap[date] ?? 0) : 0);

    return {
      serviceDate: date,
      serviceTypes,
      serviceType: type || 'Service',
      totalAttendance,
      totalGiving,
      absenteesCount: totalAbsentees,
      visitorsCount: totalVisitors,
      membersRegistered: totalNewMembers,
      recordCount: srs.length,
      childrenGivingTotal: childrenGivTotal,
      childrenAttendanceCount: childrenAttCount,
      childrenVisitorsCount: childrenVisitorsCountMap[date] ?? 0,
      expensesTotal: expTotal,
    };
  });

  // Sort by date descending, then by service_type
  grouped.sort((a, b) => {
    const dateCompare = b.serviceDate.localeCompare(a.serviceDate);
    if (dateCompare !== 0) return dateCompare;
    return a.serviceType.localeCompare(b.serviceType);
  });
  return grouped;
}

router.get("/service-records/today", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const today = new Date().toISOString().split('T')[0];

    // Try today first
    let { data: records, error } = await supabase.from('service_records')
      .select('*')
      .eq('service_date', today)
      .order('created_at', { ascending: false });

    // If no records today, get most recent date's records
    if (!error && (!records || records.length === 0)) {
      const { data: latestOne } = await supabase.from('service_records')
        .select('service_date')
        .order('service_date', { ascending: false })
        .limit(1);
      if (latestOne && latestOne.length > 0) {
        const latestDate = latestOne[0].service_date;
        const { data: latestRecords } = await supabase.from('service_records')
          .select('*')
          .eq('service_date', latestDate)
          .order('created_at', { ascending: false });
        records = latestRecords || [];
      }
    }

    if (error) {
      return c.json({ error: 'Failed to fetch service records' }, 500);
    }

    const grouped = await enrichAndGroupByDate(records || []);
    return c.json(grouped);
  } catch (error) {
    console.error('Get today service records error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all service records (grouped by date)
router.get("/service-records", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');

    // First get distinct dates with pagination
    let dateQuery = supabase.from('service_records')
      .select('service_date')
      .order('service_date', { ascending: false });

    if (startDate) dateQuery = dateQuery.gte('service_date', startDate);
    if (endDate) dateQuery = dateQuery.lte('service_date', endDate);

    const { data: allDates, error: dateError } = await dateQuery;

    if (dateError) {
      return c.json({ error: 'Failed to fetch service records' }, 500);
    }

    // Get unique dates
    const uniqueDates = [...new Set((allDates || []).map((d: any) => d.service_date))];
    const totalDates = uniqueDates.length;
    const offset = (page - 1) * limit;
    const paginatedDates = uniqueDates.slice(offset, offset + limit);

    if (paginatedDates.length === 0) {
      return c.json({ records: [], total: totalDates, page, limit });
    }

    // Fetch all records for these dates
    const { data: records, error } = await supabase.from('service_records')
      .select('*')
      .in('service_date', paginatedDates)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch service records' }, 500);
    }

    const grouped = await enrichAndGroupByDate(records || []);
    return c.json({ records: grouped, total: totalDates, page, limit });
  } catch (error) {
    console.error('Get service records error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get combined service record detail for a date
router.get("/service-records/by-date/:date", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const date = c.req.param('date');
    const serviceType = c.req.query('serviceType');

    const reverseMap: Record<string, string> = {
      'Sunday Main Service': 'sunday_morning',
      'Sunday Evening': 'sunday_evening',
      'Midweek Service': 'midweek',
      'Special Service': 'special',
    };

    let candidateTypes: string[] = [];
    if (serviceType) {
      const normalizedType = normalizeServiceType(serviceType);
      const legacyType = reverseMap[normalizedType];
      
      const typeSet = new Set<string>();
      typeSet.add(serviceType);
      if (normalizedType) typeSet.add(normalizedType);
      if (legacyType) typeSet.add(legacyType);
      
      candidateTypes = Array.from(typeSet);
    }
    
    let query = supabase.from('service_records')
      .select('*')
      .eq('service_date', date);
      
    if (candidateTypes.length > 0) {
      query = query.in('service_type', candidateTypes);
    }
    
    const { data: records, error } = await query.order('created_at', { ascending: false });

    if (error || !records || records.length === 0) {
      return c.json({ error: 'No service records found for this date and type' }, 404);
    }

    const serviceTypes: string[] = [];
    const services: any[] = [];

    // Process each service record (newest first = overwrites)
    for (const sr of records) {
      const normType = normalizeServiceType(sr.service_type);
      if (normType && !serviceTypes.includes(normType)) {
        serviceTypes.push(normType);
      }

      let attendance = null;
      let giving = null;
      let attendees: any[] = [];
      let absentees: any[] = [];

      if (sr.attendance_record_id) {
        const { data: att } = await supabase.from('attendance_records')
          .select('*').eq('id', sr.attendance_record_id).single();
        attendance = att ? toCamelCase(att) : null;

        const { data: entries } = await supabase.from('attendance_entries')
          .select('member_id, members!inner(first_name, last_name, zone)')
          .eq('attendance_record_id', sr.attendance_record_id);
        attendees = (entries || []).map((e: any) => ({
          memberId: e.member_id,
          firstName: e.members.first_name,
          lastName: e.members.last_name,
          zone: e.members.zone
        }));

        const { data: abs } = await supabase.from('absentee_records')
          .select('*, members!inner(first_name, last_name)')
          .eq('attendance_record_id', sr.attendance_record_id);
        absentees = (abs || []).map((a: any) => toCamelCase({
          ...a,
          memberName: `${a.members.first_name} ${a.members.last_name}`
        }));
      }

      if (sr.giving_record_id) {
        const { data: giv } = await supabase.from('giving_records')
          .select('*').eq('id', sr.giving_record_id).single();
        giving = giv ? toCamelCase(giv) : null;
      }

      services.push({
        ...(toCamelCase(sr) as Record<string, unknown>),
        attendance,
        giving,
        attendees,
        absentees,
      });
    }

    // Combine totals across all services for this date
    let totalAttendance = 0;
    let totalGivingAmount = 0;
    const allAttendees: any[] = [];
    const allAbsentees: any[] = [];
    const seenAttendeeIds = new Set<string>();
    const seenAbsenteeIds = new Set<string>();

    for (const svc of services) {
      if (svc.attendance) totalAttendance += svc.attendance.totalCount || 0;
      if (svc.giving) totalGivingAmount += svc.giving.totalAmount || svc.giving.total_amount || 0;

      for (const a of svc.attendees) {
        if (!seenAttendeeIds.has(a.memberId)) {
          seenAttendeeIds.add(a.memberId);
          allAttendees.push(a);
        }
      }
      for (const a of svc.absentees) {
        const abId = a.id || a.memberId;
        if (!seenAbsenteeIds.has(abId)) {
          seenAbsenteeIds.add(abId);
          allAbsentees.push(a);
        }
      }
    }

    // Get visitors for this date
    const { data: visitors } = await supabase.from('visitors')
      .select('id, first_name, last_name, phone')
      .eq('visit_date', date);

    // Get new members registered on this date
    const { data: newMembers } = await supabase.from('members')
      .select('id, first_name, last_name, zone')
      .eq('join_date', date);

    let childrenGivingQuery = supabase.from('children_giving_records').select('*').eq('service_date', date);
    if (candidateTypes.length > 0) {
      childrenGivingQuery = childrenGivingQuery.in('service_type', candidateTypes);
    }

    let childrenAttendanceQuery = supabase.from('children_attendance_records').select('*').eq('date', date);
    if (candidateTypes.length > 0) {
      childrenAttendanceQuery = childrenAttendanceQuery.in('service_type', candidateTypes);
    }

    let expensesQuery = supabase.from('expense_records').select('*').eq('service_date', date);
    if (candidateTypes.length > 0) {
      expensesQuery = expensesQuery.in('service_type', candidateTypes);
    }

    let [
      { data: childrenGivingData },
      { data: childrenAttendanceData },
      { data: childrenVisitorsData },
      { data: newChildMembersData },
      { data: expensesData }
    ] = await Promise.all([
      childrenGivingQuery,
      childrenAttendanceQuery,
      supabase.from('children_visitors').select('*').eq('visit_date', date),
      supabase.from('children_members').select('*').eq('join_date', date),
      expensesQuery
    ]);

    // Fallback: if service_type filter yielded no children attendance, retry without it
    if (candidateTypes.length > 0 && (!childrenAttendanceData || childrenAttendanceData.length === 0)) {
      const { data: fallbackData } = await supabase.from('children_attendance_records').select('*').eq('date', date);
      if (fallbackData && fallbackData.length > 0) {
        childrenAttendanceData = fallbackData;
      }
    }

    let childrenEntriesData: any[] = [];
    const recordIds = (childrenAttendanceData || []).map((r: any) => r.id);
    if (recordIds.length > 0) {
      const { data: entriesData } = await supabase.from('children_attendance_entries')
        .select('*, children_members(first_name, last_name)')
        .in('attendance_record_id', recordIds);
      childrenEntriesData = entriesData || [];
    }

    const childrenAttendanceMap: Record<string, any[]> = {};
    for (const entry of childrenEntriesData) {
      if (!childrenAttendanceMap[entry.attendance_record_id]) {
        childrenAttendanceMap[entry.attendance_record_id] = [];
      }
      childrenAttendanceMap[entry.attendance_record_id].push({
        id: entry.id,
        childName: entry.children_members
          ? `${entry.children_members.first_name} ${entry.children_members.last_name}`
          : `Child #${entry.child_member_id?.slice(0, 6) || 'unknown'}`
      });
    }

    const childrenAttendance = (childrenAttendanceData || []).map((r: any) => ({
      ...(toCamelCase(r) as Record<string, unknown>),
      entries: childrenAttendanceMap[r.id] || []
    }));

    const extra: Record<string, any> = {};
    const effectiveCandidateTypes = candidateTypes.length > 0 
      ? candidateTypes 
      : (serviceTypes && serviceTypes.length > 0 ? serviceTypes.flatMap(st => {
          const norm = normalizeServiceType(st);
          const leg = reverseMap[norm];
          return [st, norm, leg].filter(Boolean) as string[];
        }) : []);
        
    if (effectiveCandidateTypes.length > 0) {
      // De-duplicate types
      const lookupTypes = Array.from(new Set(effectiveCandidateTypes));
      
      const { data: prevServiceRecs } = await supabase
        .from('service_records')
        .select('service_date, giving_record_id')
        .in('service_type', lookupTypes)
        .lt('service_date', date)
        .order('service_date', { ascending: false })
        .limit(1);

      if (prevServiceRecs && prevServiceRecs.length > 0) {
        const prevRecord = prevServiceRecs[0];
        if (prevRecord.giving_record_id) {
          const { data: prevGiving } = await supabase
            .from('giving_records')
            .select('total_amount')
            .eq('id', prevRecord.giving_record_id)
            .single();

          if (prevGiving && typeof prevGiving.total_amount === 'number') {
            extra.previousServiceGiving = {
              totalGivingAmount: prevGiving.total_amount,
              serviceDate: prevRecord.service_date
            };
          }
        }
      }
    }

    // Fetch service setup for this date (match by date only to be robust against service_type string mismatches)
    const { data: serviceSetupsData } = await supabase.from('service_setups').select('*').eq('service_date', date);

    return c.json({
      serviceDate: date,
      serviceTypes,
      serviceType: serviceTypes.join(', ') || 'Service',
      totalAttendance,
      totalGivingAmount,
      services,
      attendees: allAttendees,
      absentees: allAbsentees,
      visitors: (visitors || []).map((v: any) => toCamelCase(v)),
      newMembers: (newMembers || []).map((m: Record<string, unknown>) => toCamelCase(m)),
      childrenGiving: (childrenGivingData || []).map((r: any) => toCamelCase(r)),
      childrenAttendance,
      childrenVisitors: (childrenVisitorsData || []).map((r: any) => toCamelCase(r)),
      newChildMembers: (newChildMembersData || []).map((r: any) => toCamelCase(r)),
      expenses: (expensesData || []).map((r: any) => toCamelCase(r)),
      serviceSetup: serviceSetupsData && serviceSetupsData.length > 0 ? toCamelCase(serviceSetupsData[0]) : null,
      ...extra
    });
  } catch (error) {
    console.error('Get service record by date error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single service record detail (legacy, kept for compatibility)
router.get("/service-records/:id", async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const { data: sr, error } = await supabase.from('service_records')
      .select('*').eq('id', id).single();

    if (error || !sr) {
      return c.json({ error: 'Service record not found' }, 404);
    }

    // Redirect to by-date endpoint logic
    const date = sr.service_date;
    const { data: records } = await supabase.from('service_records')
      .select('*')
      .eq('service_date', date)
      .order('created_at', { ascending: false });

    const serviceTypes: string[] = [];
    const services: any[] = [];

    for (const rec of (records || [sr])) {
      if (rec.service_type && !serviceTypes.includes(rec.service_type)) {
        serviceTypes.push(rec.service_type);
      }

      let attendance = null;
      let giving = null;
      let attendees: any[] = [];
      let absentees: any[] = [];

      if (rec.attendance_record_id) {
        const { data: att } = await supabase.from('attendance_records')
          .select('*').eq('id', rec.attendance_record_id).single();
        attendance = att ? toCamelCase(att) : null;

        const { data: entries } = await supabase.from('attendance_entries')
          .select('member_id, members!inner(first_name, last_name, zone)')
          .eq('attendance_record_id', rec.attendance_record_id);
        attendees = (entries || []).map((e: any) => ({
          memberId: e.member_id,
          firstName: e.members.first_name,
          lastName: e.members.last_name,
          zone: e.members.zone
        }));

        const { data: abs } = await supabase.from('absentee_records')
          .select('*, members!inner(first_name, last_name)')
          .eq('attendance_record_id', rec.attendance_record_id);
        absentees = (abs || []).map((a: any) => toCamelCase({
          ...a,
          memberName: `${a.members.first_name} ${a.members.last_name}`
        }));
      }

      if (rec.giving_record_id) {
        const { data: giv } = await supabase.from('giving_records')
          .select('*').eq('id', rec.giving_record_id).single();
        giving = giv ? toCamelCase(giv) : null;
      }

      services.push({ ...(toCamelCase(rec) as Record<string, unknown>), attendance, giving, attendees, absentees });
    }

    let totalAttendance = 0;
    let totalGivingAmount = 0;
    const allAttendees: any[] = [];
    const allAbsentees: any[] = [];
    const seenAttendeeIds = new Set<string>();
    const seenAbsenteeIds = new Set<string>();

    for (const svc of services) {
      if (svc.attendance) totalAttendance += svc.attendance.totalCount || 0;
      if (svc.giving) totalGivingAmount += svc.giving.totalAmount || svc.giving.total_amount || 0;
      for (const a of svc.attendees) {
        if (!seenAttendeeIds.has(a.memberId)) { seenAttendeeIds.add(a.memberId); allAttendees.push(a); }
      }
      for (const a of svc.absentees) {
        const abId = a.id || a.memberId;
        if (!seenAbsenteeIds.has(abId)) { seenAbsenteeIds.add(abId); allAbsentees.push(a); }
      }
    }

    const { data: visitors } = await supabase.from('visitors')
      .select('id, first_name, last_name, phone').eq('visit_date', date);
    const { data: newMembers } = await supabase.from('members')
      .select('id, first_name, last_name, zone').eq('join_date', date);

    return c.json({
      serviceDate: date,
      serviceTypes,
      serviceType: serviceTypes.join(', ') || 'Service',
      totalAttendance,
      totalGivingAmount,
      services,
      attendees: allAttendees,
      absentees: allAbsentees,
      visitors: (visitors || []).map((v: any) => toCamelCase(v)),
      newMembers: (newMembers || []).map((m: any) => toCamelCase(m)),
    });
  } catch (error) {
    console.error('Get service record detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
