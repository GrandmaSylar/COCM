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

router.get('/children/analytics', async (c) => {
  try {
    const user = await getUserFromToken(c.req.raw);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const period = c.req.query('period') || '1y';
    let startDate: string | null = null;
    if (period !== 'all') {
      const d = new Date();
      if (period === '3m') d.setMonth(d.getMonth() - 3);
      else if (period === '6m') d.setMonth(d.getMonth() - 6);
      else if (period === '1y') d.setFullYear(d.getFullYear() - 1);
      startDate = d.toISOString();
    }

    let givingQuery = supabase.from('children_giving_records').select('service_date, total_amount');
    let attendanceQuery = supabase.from('children_attendance_records').select('id, date, total_count');
    
    if (startDate) {
      givingQuery = givingQuery.gte('service_date', startDate.split('T')[0]);
      attendanceQuery = attendanceQuery.gte('date', startDate.split('T')[0]);
    }

    const [membersRes, visitorsRes, givingRes, attendanceRes] = await Promise.all([
      supabase.from('children_members').select('id, first_name, last_name, date_of_birth, gender, status, join_date'),
      supabase.from('children_visitors').select('id, visit_date, converted_member_id'),
      givingQuery,
      attendanceQuery
    ]);

    if (membersRes.error || visitorsRes.error || givingRes.error || attendanceRes.error) {
      console.error('Failed to fetch analytics base datasets:', {
        membersErr: membersRes.error,
        visitorsErr: visitorsRes.error,
        givingErr: givingRes.error,
        attendanceErr: attendanceRes.error
      });
      return c.json({ error: 'Failed to fetch analytics data' }, 500);
    }

    const members = membersRes.data || [];
    const visitors = visitorsRes.data || [];
    const giving = givingRes.data || [];
    const attendanceRecords = attendanceRes.data || [];

    const recordIds = attendanceRecords.map(r => r.id);
    let attendanceEntries: any[] = [];
    if (recordIds.length > 0) {
      const { data: entriesData, error: entriesError } = await supabase.from('children_attendance_entries')
        .select('attendance_record_id, child_member_id')
        .in('attendance_record_id', recordIds);
        
      if (entriesError) {
        console.error('Failed to fetch children attendance entries:', entriesError);
        return c.json({ error: 'Failed to fetch analytics data' }, 500);
      }
      attendanceEntries = entriesData || [];
    }

    // 1. summary
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'active').length;
    const visitorCount = visitors.length;
    const totalGiving = giving.reduce((sum, g) => sum + (Number(g.total_amount) || 0), 0);
    const summary = {
      totalMembers,
      activeMembers,
      visitorCount,
      totalGiving
    };

    // 2. memberGrowth
    const joinsByMonth: Record<string, number> = {};
    members.forEach(m => {
      if (!m.join_date) return;
      if (startDate && m.join_date < startDate.split('T')[0]) return;
      const ym = m.join_date.substring(0, 7); // YYYY-MM
      joinsByMonth[ym] = (joinsByMonth[ym] || 0) + 1;
    });
    const memberGrowth = Object.entries(joinsByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));

    // 3. genderBreakdown
    const maleCount = members.filter(m => m.gender?.toLowerCase() === 'male').length;
    const femaleCount = members.filter(m => m.gender?.toLowerCase() === 'female').length;
    const genderBreakdown = { male: maleCount, female: femaleCount };

    // 4. ageDistribution
    const ageBuckets = { '0-5': 0, '6-10': 0, '11-14': 0, '15-17': 0 };
    const today = new Date();
    members.forEach(m => {
      if (!m.date_of_birth) return;
      const dob = new Date(m.date_of_birth);
      let age = today.getFullYear() - dob.getFullYear();
      const mDiff = today.getMonth() - dob.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age >= 0 && age <= 5) ageBuckets['0-5']++;
      else if (age >= 6 && age <= 10) ageBuckets['6-10']++;
      else if (age >= 11 && age <= 14) ageBuckets['11-14']++;
      else if (age >= 15 && age <= 17) ageBuckets['15-17']++;
    });
    const ageDistribution = ageBuckets;

    // 5. attendanceTrend
    const entriesByRecord = attendanceEntries.reduce((acc, e) => {
      acc[e.attendance_record_id] = (acc[e.attendance_record_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const recordsByMonth: Record<string, { totalRate: number, count: number }> = {};
    attendanceRecords.forEach(r => {
      if (!r.date) return;
      const ym = r.date.substring(0, 7);
      const entriesCount = entriesByRecord[r.id] || 0;
      const rate = totalMembers > 0 ? (entriesCount / totalMembers) * 100 : 0;
      
      if (!recordsByMonth[ym]) recordsByMonth[ym] = { totalRate: 0, count: 0 };
      recordsByMonth[ym].totalRate += rate;
      recordsByMonth[ym].count += 1;
    });
    
    const attendanceTrend = Object.entries(recordsByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, stats]) => ({
        month,
        rate: Math.round(stats.totalRate / stats.count)
      }));

    // 6. givingTrend
    const givingByMonth: Record<string, number> = {};
    giving.forEach(g => {
      if (!g.service_date) return;
      const ym = g.service_date.substring(0, 7);
      givingByMonth[ym] = (givingByMonth[ym] || 0) + Number(g.total_amount || 0);
    });
    const givingTrend = Object.entries(givingByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));

    // 7. visitorConversion
    const childrenMemberIds = new Set(members.map(m => m.id));
    const convertedCount = visitors.filter(v => v.converted_member_id && childrenMemberIds.has(v.converted_member_id)).length;
    const visitorConversion = { total: visitors.length, converted: convertedCount };

    // 8. baptismStats
    const baptisedCount = members.filter(m => m.status !== 'not baptised').length;
    const baptismStats = { baptised: baptisedCount, notBaptised: totalMembers - baptisedCount };

    // 9. ageOutAlerts
    const ageOutAlerts: any[] = [];
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    members.forEach(m => {
      if (!m.date_of_birth) return;
      const dobStr = m.date_of_birth.includes('T') ? m.date_of_birth.split('T')[0] : m.date_of_birth;
      const dobDate = new Date(dobStr);
      const eighteenthBday = new Date(dobDate.getFullYear() + 18, dobDate.getMonth(), dobDate.getDate());
      
      const bdayStr = eighteenthBday.toISOString().split('T')[0];
      const ninetyDaysFromNowStr = ninetyDaysFromNow.toISOString().split('T')[0];
      
      if (bdayStr >= todayStr && bdayStr <= ninetyDaysFromNowStr) {
        ageOutAlerts.push({
          id: m.id,
          firstName: m.first_name,
          lastName: m.last_name,
          dateOfBirth: m.date_of_birth,
          turnsEighteenOn: bdayStr
        });
      }
    });

    return c.json({
      summary,
      memberGrowth,
      genderBreakdown,
      ageDistribution,
      attendanceTrend,
      givingTrend,
      visitorConversion,
      baptismStats,
      ageOutAlerts
    });
  } catch (e) {
    console.error('GET /children/analytics error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================

export default router;
