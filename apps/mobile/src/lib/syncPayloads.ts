import type { LocalAttendanceRecord, LocalCustomService } from './db';

/**
 * Builders that turn local SQLite rows into the request bodies the Edge Function
 * routes expect (the same shapes the web app sends). The local rows are snake_case;
 * the API is camelCase.
 */

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// POST /attendance (general head count) — mirrors web RecordAttendance
export function toAttendancePayload(rec: LocalAttendanceRecord) {
  return {
    id: rec.id,
    date: rec.date,
    serviceType: rec.service_type,
    startTime: rec.start_time || undefined,
    endTime: rec.end_time || undefined,
    attendees: [],
    totalCount: rec.total_count,
    menCount: rec.men_count || 0,
    womenCount: rec.women_count || 0,
    childrenCount: rec.children_count || 0,
    visitorsCount: rec.visitors_count || 0,
    isCustomService: !!rec.is_custom_service,
    attendanceType: rec.attendance_type || 'general',
  };
}

// POST /services — inserted as-is into custom_services (days_of_week is integer[])
export function toServicePayload(svc: LocalCustomService) {
  let days: number[] = [];
  try {
    days = typeof svc.days_of_week === 'string' ? JSON.parse(svc.days_of_week) : (svc.days_of_week as any) || [];
  } catch {}
  return {
    id: svc.id,
    name: svc.name,
    description: svc.description,
    start_date: svc.start_date,
    end_date: svc.end_date,
    start_time: svc.start_time,
    end_time: svc.end_time,
    days_of_week: days,
    is_active: !!svc.is_active,
  };
}

// POST /visitors
export function toVisitorPayload(v: {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  visit_date: string;
  potential_zone?: string | null;
  notes?: string | null;
  residence?: string | null;
}) {
  const { firstName, lastName } = splitName(v.name);
  return {
    id: v.id,
    firstName,
    lastName,
    phone: v.phone || undefined,
    email: v.email || undefined,
    residenceLocation: v.residence || undefined,
    visitDate: v.visit_date,
    potentialZone: v.potential_zone || undefined,
    notes: v.notes || undefined,
    followUpStatus: 'pending',
  };
}

// POST /children/visitors — the API requires at least one guardian
export function toChildVisitorPayload(v: {
  id: string;
  childName: string;
  guardianName?: string;
  guardianPhone?: string;
  visitDate: string;
  notes?: string;
}) {
  const { firstName, lastName } = splitName(v.childName);
  return {
    id: v.id,
    firstName,
    lastName,
    visitDate: v.visitDate,
    contactPhone: v.guardianPhone || undefined,
    notes: v.notes || undefined,
    guardians: v.guardianName
      ? [{ fullName: v.guardianName, contactInfo: v.guardianPhone || undefined }]
      : [],
  };
}

// POST /children/giving
export function toChildGivingPayload(g: {
  id: string;
  givingDate: string;
  serviceType: string;
  amount: number;
  notes?: string;
}) {
  return {
    id: g.id,
    serviceDate: g.givingDate,
    serviceType: g.serviceType,
    offeringAmount: g.amount,
    totalAmount: g.amount,
    notes: g.notes || undefined,
  };
}
