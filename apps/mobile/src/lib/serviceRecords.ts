// Services: one row per service date and type, with the attendance, giving, expense and visitor
// figures for that service. The web app reads these from a server-side `service_records` table.
// On the phone they are derived from the records already synced into SQLite, grouped the way the
// backend groups them, so the screens work offline and need no new endpoint.
import {
  getLocalAttendanceRecords,
  getLocalChildrenAttendanceRecords,
  getLocalChildrenGivingRecords,
  getLocalChildVisitors,
  getLocalDb,
  getLocalExpenses,
  getLocalGivingRecords,
  getLocalVisitors,
  saveLocalChildrenAttendanceRecord,
  saveLocalChildrenGivingRecord,
  LocalAttendanceRecord,
  LocalExpense,
  LocalGivingRecord,
  LocalVisitor,
} from './db';
import { api } from './api';
import { syncAttendanceRecords, syncChildren, syncExpenses, syncGivingRecords, syncVisitors } from './syncEngine';

export interface ServiceSummary {
  key: string;
  date: string;
  type: string;
  totalAttendance: number;
  absentees: number;
  totalGiving: number;
  visitors: number;
  expenses: number;
  childrenAttendance: number;
  childrenGiving: number;
  childrenVisitors: number;
  attendanceRecords: LocalAttendanceRecord[];
  givingRecords: LocalGivingRecord[];
  expenseRecords: LocalExpense[];
  visitorRecords: LocalVisitor[];
}

/** Older records store enum-style service types; show them under their display names. */
export function normalizeServiceType(type: string | undefined | null): string {
  const map: Record<string, string> = {
    sunday_morning: 'Sunday Main Service',
    sunday_evening: 'Sunday Evening',
    midweek: 'Midweek Service',
    special: 'Special Service',
  };
  const t = (type || '').trim();
  return map[t] || t || 'Service';
}

const dayOf = (d: string | undefined | null) => (d || '').slice(0, 10);
const keyOf = (date: string, type: string) => `${date}__${type}`;

export function serviceKey(date: string, type: string) {
  return keyOf(dayOf(date), normalizeServiceType(type));
}

function add(map: Map<string, number>, key: string, n: number) {
  map.set(key, (map.get(key) || 0) + n);
}

/** Builds every service summary from the local database, newest first. */
export async function loadServiceSummaries(): Promise<ServiceSummary[]> {
  const [attendance, giving, expenses, visitors, childAtt, childGiv, childVis] = await Promise.all([
    getLocalAttendanceRecords(),
    getLocalGivingRecords(),
    getLocalExpenses(),
    getLocalVisitors(),
    getLocalChildrenAttendanceRecords(),
    getLocalChildrenGivingRecords(),
    getLocalChildVisitors(),
  ]);

  const db = await getLocalDb();
  const absentRows = await db.getAllAsync<{ attendance_record_id: string; n: number }>(
    'SELECT attendance_record_id, COUNT(*) AS n FROM absentee_records GROUP BY attendance_record_id'
  );
  const absentByRecord = new Map(absentRows.map(r => [r.attendance_record_id, r.n]));

  const summaries = new Map<string, ServiceSummary>();
  const ensure = (date: string, type: string) => {
    const key = keyOf(date, type);
    let s = summaries.get(key);
    if (!s) {
      s = {
        key, date, type, totalAttendance: 0, absentees: 0, totalGiving: 0, visitors: 0, expenses: 0,
        childrenAttendance: 0, childrenGiving: 0, childrenVisitors: 0,
        attendanceRecords: [], givingRecords: [], expenseRecords: [], visitorRecords: [],
      };
      summaries.set(key, s);
    }
    return s;
  };

  // A live register is still being taken; it becomes a service once it is finalized.
  for (const r of attendance) {
    if (r.status === 'live') continue;
    const s = ensure(dayOf(r.date), normalizeServiceType(r.service_type));
    s.attendanceRecords.push(r);
    s.totalAttendance += r.total_count || 0;
    s.absentees += absentByRecord.get(r.id) || 0;
  }
  for (const g of giving) {
    const s = ensure(dayOf(g.service_date), normalizeServiceType(g.service_type));
    s.givingRecords.push(g);
    s.totalGiving += g.total_amount || 0;
  }

  // Figures kept per date, and per date and type. A date with a single service type also
  // takes the date-level figure when the types do not match (as the backend does).
  const typesPerDate = new Map<string, number>();
  for (const s of summaries.values()) typesPerDate.set(s.date, (typesPerDate.get(s.date) || 0) + 1);

  const expByKey = new Map<string, number>();
  const expByDate = new Map<string, number>();
  const expRecords = new Map<string, LocalExpense[]>();
  for (const e of expenses) {
    const d = dayOf(e.service_date);
    const k = keyOf(d, normalizeServiceType(e.service_type));
    add(expByKey, k, e.amount || 0);
    add(expByDate, d, e.amount || 0);
    expRecords.set(k, [...(expRecords.get(k) || []), e]);
  }
  const caByKey = new Map<string, number>();
  const caByDate = new Map<string, number>();
  for (const a of childAtt) {
    const d = dayOf(a.date || a.service_date);
    const n = a.total_count ?? a.total_present ?? 0;
    add(caByKey, keyOf(d, normalizeServiceType(a.service_type)), n);
    add(caByDate, d, n);
  }
  const cgByKey = new Map<string, number>();
  const cgByDate = new Map<string, number>();
  for (const g of childGiv) {
    const d = dayOf(g.service_date || g.giving_date);
    const n = g.total_amount ?? g.amount ?? 0;
    add(cgByKey, keyOf(d, normalizeServiceType(g.service_type)), n);
    add(cgByDate, d, n);
  }
  const visitorsByDate = new Map<string, LocalVisitor[]>();
  for (const v of visitors) {
    const d = dayOf(v.visit_date);
    visitorsByDate.set(d, [...(visitorsByDate.get(d) || []), v]);
  }
  const childVisByDate = new Map<string, number>();
  for (const v of childVis) add(childVisByDate, dayOf(v.visit_date), 1);

  for (const s of summaries.values()) {
    const only = (typesPerDate.get(s.date) || 0) <= 1;
    s.expenses = expByKey.get(s.key) ?? (only ? expByDate.get(s.date) ?? 0 : 0);
    s.expenseRecords = expRecords.get(s.key) || (only ? expenses.filter(e => dayOf(e.service_date) === s.date) : []);
    s.childrenAttendance = caByKey.get(s.key) ?? (only ? caByDate.get(s.date) ?? 0 : 0);
    s.childrenGiving = cgByKey.get(s.key) ?? (only ? cgByDate.get(s.date) ?? 0 : 0);
    s.visitorRecords = visitorsByDate.get(s.date) || [];
    s.visitors = s.visitorRecords.length;
    s.childrenVisitors = childVisByDate.get(s.date) ?? 0;
  }

  return [...summaries.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.type.localeCompare(b.type)));
}

export async function loadServiceSummary(date: string, type: string): Promise<ServiceSummary | null> {
  const key = serviceKey(date, type);
  return (await loadServiceSummaries()).find(s => s.key === key) ?? null;
}

/**
 * Pulls the records a service is built from into SQLite. Each step is best effort, so being
 * offline or one failing endpoint never blocks the screen from showing what is already stored.
 */
export async function refreshServiceData(): Promise<void> {
  await Promise.allSettled([syncAttendanceRecords(), syncGivingRecords(), syncExpenses(), syncVisitors(), syncChildren()]);
  try {
    const att = await api.children.attendance.getAll();
    if (Array.isArray(att)) {
      for (const ra of att) {
        await saveLocalChildrenAttendanceRecord({
          id: ra.id,
          service_date: ra.serviceDate || ra.service_date || ra.date,
          service_type: ra.serviceType || ra.service_type || 'Sunday Main Service',
          total_present: ra.totalPresent || ra.presentCount || ra.total_present || ra.totalCount || 0,
          total_members: ra.totalMembers || ra.total_members || 0,
          marked_by: ra.markedBy || ra.marked_by,
          created_at: ra.createdAt || ra.created_at || new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn('Children attendance refresh failed:', e);
  }
  try {
    const giv = await api.children.giving.getAll();
    if (Array.isArray(giv)) {
      for (const rg of giv) {
        await saveLocalChildrenGivingRecord({
          id: rg.id,
          giving_date: rg.givingDate || rg.giving_date || rg.serviceDate || rg.date,
          service_type: rg.serviceType || rg.service_type || 'Sunday Main Service',
          amount: Number(rg.amount ?? rg.totalAmount ?? 0),
          currency: rg.currency || 'GHS',
          notes: rg.notes,
          created_at: rg.createdAt || rg.created_at || new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.warn('Children giving refresh failed:', e);
  }
}
