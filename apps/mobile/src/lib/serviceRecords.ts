// Services: the same read models the web Services page uses (`/service-records`,
// `/service-setups`), cached in SQLite so the screens open offline. Every loader returns the
// cached copy when the network call fails, and `null` only when nothing has ever been cached.
import { api } from './api';
import { getReadCache, setReadCache } from './db';

export interface ServiceDateSummary {
  serviceDate: string;
  serviceTypes: string[];
  serviceType: string;
  totalAttendance: number;
  totalGiving: number;
  absenteesCount: number;
  visitorsCount: number;
  membersRegistered: number;
  recordCount: number;
  childrenAttendanceCount?: number;
  childrenGivingTotal?: number;
  childrenVisitorsCount?: number;
  expensesTotal?: number;
}

export interface ServiceDetailRecord {
  id: string;
  serviceDate: string;
  serviceType: string;
  attendance: any;
  giving: any;
  attendees: { memberId: string; firstName: string; lastName: string; zone: string }[];
  absentees: any[];
}

export interface ServiceDateDetail {
  serviceDate: string;
  serviceTypes: string[];
  serviceType: string;
  totalAttendance: number;
  totalGivingAmount: number;
  services: ServiceDetailRecord[];
  attendees: { memberId: string; firstName: string; lastName: string; zone: string }[];
  absentees: any[];
  visitors: { id: string; firstName: string; lastName: string; phone: string }[];
  newMembers: { id: string; firstName: string; lastName: string; zone: string }[];
  childrenAttendance?: any[];
  childrenGiving?: any[];
  childrenVisitors?: any[];
  newChildMembers?: any[];
  expenses?: any[];
  serviceSetup?: any;
  membersRegistered?: number;
  previousServiceGiving?: { totalGivingAmount: number; serviceDate: string };
}

export const PAGE_SIZE = 15;

export interface ServicesOverview {
  today: ServiceDateSummary[];
  records: ServiceDateSummary[];
  total: number;
  page: number;
  /** True when this came from the cache because the network call failed. */
  stale: boolean;
}

const OVERVIEW_KEY = 'services:overview';
const SETUPS_KEY = 'services:setups';
const detailKey = (date: string, type: string) => `services:detail:${date}:${type}`;

/** Page 1 of the services list plus today's (or the latest) service. Pages after 1 are not cached. */
export async function loadServicesOverview(page = 1): Promise<ServicesOverview | null> {
  try {
    const [today, all] = await Promise.all([
      page === 1 ? api.serviceRecords.getToday() : Promise.resolve(null),
      api.serviceRecords.getAll({ page, limit: PAGE_SIZE }),
    ]);
    const result: ServicesOverview = {
      today: page === 1 ? (Array.isArray(today) ? today : []) : [],
      records: all?.records || [],
      total: all?.total || 0,
      page,
      stale: false,
    };
    if (page === 1) await setReadCache(OVERVIEW_KEY, result);
    return result;
  } catch (err) {
    if (page !== 1) throw err;
    const cached = await getReadCache<ServicesOverview>(OVERVIEW_KEY);
    return cached ? { ...cached, stale: true } : null;
  }
}

export async function loadCachedServicesOverview(): Promise<ServicesOverview | null> {
  const cached = await getReadCache<ServicesOverview>(OVERVIEW_KEY);
  return cached ? { ...cached, stale: true } : null;
}

export async function loadCachedServiceDetail(date: string, type: string): Promise<ServiceDateDetail | null> {
  return getReadCache<ServiceDateDetail>(detailKey(date, type));
}

/** One service date in full. Falls back to the cached copy if the server cannot be reached. */
export async function loadServiceDetail(date: string, type: string): Promise<{ detail: ServiceDateDetail; stale: boolean } | null> {
  try {
    const detail: ServiceDateDetail = await api.serviceRecords.getByDate(date, type || undefined);
    if (detail) await setReadCache(detailKey(date, type), detail);
    return detail ? { detail, stale: false } : null;
  } catch {
    const cached = await getReadCache<ServiceDateDetail>(detailKey(date, type));
    return cached ? { detail: cached, stale: true } : null;
  }
}

export async function loadCachedServiceSetups(): Promise<any[] | null> {
  return getReadCache<any[]>(SETUPS_KEY);
}

export async function loadServiceSetups(): Promise<{ setups: any[]; stale: boolean }> {
  try {
    const res: any = await api.serviceSetups.getAll({ limit: 20 });
    const setups = (res?.setups || res?.items || res?.data || res?.records) ?? (Array.isArray(res) ? res : []);
    await setReadCache(SETUPS_KEY, setups);
    return { setups, stale: false };
  } catch {
    return { setups: (await getReadCache<any[]>(SETUPS_KEY)) ?? [], stale: true };
  }
}
