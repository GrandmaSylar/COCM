// Read-only data health checks for the developer admin app.
// Pure analysis lives in `analyze`; `loadHealthData` only issues SELECTs.
// Nothing in this file writes to the database.

export type Severity = 'ok' | 'info' | 'warn' | 'error';
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
export type HealthData = Record<string, Row[]>;

export interface HealthCheck {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  count: number;
  samples: Row[];
}

interface TableSpec {
  table: string;
  columns: string;
  // Only the most recent rows of big, append-only tables.
  recent?: { column: string; limit: number };
}

const TABLE_SPECS: TableSpec[] = [
  { table: 'members', columns: 'id,first_name,last_name,phone,date_of_birth,join_date,zone,zone_number,zone_id,status,sabbatical_start_date,sabbatical_end_date' },
  { table: 'children_members', columns: 'id,first_name,last_name,date_of_birth,join_date,converted_to_member,converted_member_id' },
  { table: 'children_member_parents', columns: 'id,child_member_id' },
  { table: 'family_members', columns: 'id,member_id,is_linked,linked_member_id' },
  { table: 'visitors', columns: 'id,first_name,last_name,visit_date,converted_to_member,converted_member_id' },
  { table: 'children_visitors', columns: 'id,first_name,last_name,visit_date,converted_to_member,converted_member_id' },
  { table: 'children_visitor_guardians', columns: 'id,visitor_id' },
  { table: 'attendance_records', columns: 'id,date,service_type' },
  { table: 'attendance_entries', columns: 'id,attendance_record_id,member_id' },
  { table: 'children_attendance_records', columns: 'id,date,service_type' },
  { table: 'children_attendance_entries', columns: 'id,attendance_record_id,child_member_id' },
  { table: 'giving_records', columns: 'id,service_date,service_type,total_amount,cash_amount,mobile_money_amount,card_amount,bank_transfer_amount' },
  { table: 'children_giving_records', columns: 'id,service_date,service_type,total_amount,cash_amount,mobile_money_amount' },
  { table: 'expense_records', columns: 'id,form_id,service_date,amount,status' },
  { table: 'service_records', columns: 'id,service_date,service_type,attendance_record_id,giving_record_id' },
  { table: 'profiles', columns: 'id,name,email,role,is_active,approval_status,last_login,two_fa_method,created_at' },
  { table: 'tally_submissions', columns: 'id,status,context_type' },
  { table: 'otp_codes', columns: 'id,expires_at,used' },
  { table: 'activity_log', columns: 'id,action,entity_type,user_name,description,created_at', recent: { column: 'created_at', limit: 1000 } },
  { table: 'backup_history', columns: 'id,type,status,file_name,file_size,created_at,completed_at,error_message', recent: { column: 'created_at', limit: 50 } },
];

// Tables we only count (their rows are not needed for any check).
const COUNT_ONLY_TABLES = [
  'notifications', 'ministries', 'ministry_members', 'zones', 'zone_attendance', 'service_setups',
  'custom_services', 'custom_roles', 'custom_giving_types', 'user_tab_access', 'temporary_permissions',
  'absentee_records', 'member_status_log', 'expense_payment_methods', 'expense_requisitions',
  'user_settings', 'tally_form_configs', 'system_dropdown_options',
];

const PAGE = 1000;
const MAX_ROWS = 100000;

// deno-lint-ignore no-explicit-any
async function fetchAll(client: any, spec: TableSpec): Promise<Row[]> {
  if (spec.recent) {
    const { data, error } = await client
      .from(spec.table)
      .select(spec.columns)
      .order(spec.recent.column, { ascending: false })
      .limit(spec.recent.limit);
    if (error) throw new Error(`${spec.table}: ${error.message}`);
    return data || [];
  }
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await client
      .from(spec.table)
      .select(spec.columns)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${spec.table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export interface LoadedHealth {
  data: HealthData;
  counts: Record<string, number | null>;
  loadErrors: string[];
}

// deno-lint-ignore no-explicit-any
export async function loadHealthData(client: any): Promise<LoadedHealth> {
  const data: HealthData = {};
  const counts: Record<string, number | null> = {};
  const loadErrors: string[] = [];

  await Promise.all([
    ...TABLE_SPECS.map(async (spec) => {
      try {
        data[spec.table] = await fetchAll(client, spec);
        if (!spec.recent) counts[spec.table] = data[spec.table].length;
      } catch (e) {
        data[spec.table] = [];
        counts[spec.table] = null;
        loadErrors.push((e as Error).message);
      }
    }),
    ...COUNT_ONLY_TABLES.map(async (table) => {
      const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        counts[table] = null;
        loadErrors.push(`${table}: ${error.message}`);
      } else {
        counts[table] = count ?? 0;
      }
    }),
    // Exact totals for the two capped tables.
    ...['activity_log', 'backup_history'].map(async (table) => {
      const { count } = await client.from(table).select('*', { count: 'exact', head: true });
      counts[table] = count ?? null;
    }),
  ]);

  return { data, counts, loadErrors };
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

const SAMPLE_LIMIT = 25;

function check(
  id: string,
  title: string,
  description: string,
  items: Row[],
  severity: Exclude<Severity, 'ok'>,
): HealthCheck {
  return {
    id,
    title,
    description,
    severity: items.length === 0 ? 'ok' : severity,
    count: items.length,
    samples: items.slice(0, SAMPLE_LIMIT),
  };
}

export const alnum = (s: unknown) => String(s ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '');
const fullName = (r: Row) => `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim();
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

function groupBy<T>(items: T[], key: (t: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function groupsWithDuplicates<T>(groups: Map<string, T[]>): { key: string; items: T[] }[] {
  return [...groups.entries()].filter(([, v]) => v.length > 1).map(([key, items]) => ({ key, items }));
}

// Strip the zone letter and leading zeros: "A05", "A-05" and "5" in zone A are all "5".
export function zoneNumberCore(zone: unknown, zoneNumber: unknown): string {
  let n = alnum(zoneNumber);
  const z = alnum(zone);
  if (z && n.startsWith(z)) n = n.slice(z.length);
  return n.replace(/^0+(?=.)/, '');
}

const today = () => new Date().toISOString().slice(0, 10);

// ----------------------------------------------------------------------------
// analysis
// ----------------------------------------------------------------------------

export function analyze(data: HealthData): HealthCheck[] {
  const members = data.members || [];
  const memberIds = new Set(members.map((m) => m.id));
  const childIds = new Set((data.children_members || []).map((c) => c.id));
  const checks: HealthCheck[] = [];
  const t = today();

  // --- members -------------------------------------------------------------
  const zoneGroups = groupsWithDuplicates(
    groupBy(members, (m) => {
      const core = zoneNumberCore(m.zone, m.zone_number);
      return core ? `${alnum(m.zone)}:${core}` : null;
    }),
  );
  checks.push(check(
    'members_duplicate_zone_number',
    'Duplicate zone numbers',
    'Two or more members share the same zone and zone number (ignoring the zone letter, dashes and leading zeros).',
    zoneGroups.map((g) => ({
      zoneNumber: g.key,
      kind: new Set(g.items.map((m) => alnum(m.zone) + alnum(m.zone_number).replace(new RegExp(`^${alnum(m.zone)}`), ''))).size === 1
        ? 'exact'
        : 'differs only by zone prefix or leading zeros',
      members: g.items.map((m) => ({ id: m.id, name: fullName(m), zoneNumber: m.zone_number, status: m.status })),
    })),
    'error',
  ));

  checks.push(check(
    'members_missing_zone',
    'Members missing a zone or zone number',
    'The zone or the zone number is empty.',
    members.filter((m) => !alnum(m.zone) || !alnum(m.zone_number)).map((m) => ({ id: m.id, name: fullName(m), zone: m.zone, zoneNumber: m.zone_number })),
    'warn',
  ));

  checks.push(check(
    'members_placeholder_zone_number',
    'Members with a placeholder zone number',
    'The number is all zeros (like A00 or B000), so the member has not been given a real zone number yet.',
    members
      .filter((m) => alnum(m.zone_number) && zoneNumberCore(m.zone, m.zone_number) === '0')
      .map((m) => ({ id: m.id, name: fullName(m), zone: m.zone, zoneNumber: m.zone_number })),
    'warn',
  ));

  checks.push(check(
    'members_no_zone_link',
    'Members not linked to a zone record',
    'zone_id is empty, so zone leaders and zone attendance do not include them.',
    members.filter((m) => !m.zone_id).map((m) => ({ id: m.id, name: fullName(m), zone: m.zone })),
    'info',
  ));

  const identityGroups = groupsWithDuplicates(
    groupBy(members, (m) => {
      const name = `${String(m.first_name ?? '').trim().toLowerCase()}|${String(m.last_name ?? '').trim().toLowerCase()}`;
      return m.date_of_birth ? `${name}|${m.date_of_birth}` : null;
    }),
  );
  checks.push(check(
    'members_duplicate_identity',
    'Possible duplicate members',
    'Same first name, last name and date of birth.',
    identityGroups.map((g) => ({ key: g.key, members: g.items.map((m) => ({ id: m.id, name: fullName(m), zoneNumber: m.zone_number, phone: m.phone })) })),
    'warn',
  ));

  const phoneGroups = groupsWithDuplicates(groupBy(members, (m) => {
    const d = digits(m.phone);
    return d.length >= 7 ? d.slice(-9) : null;
  }));
  checks.push(check(
    'members_duplicate_phone',
    'Members sharing a phone number',
    'Often a family sharing a phone, but can also reveal duplicate records.',
    phoneGroups.map((g) => ({ phone: g.key, members: g.items.map((m) => ({ id: m.id, name: fullName(m), zoneNumber: m.zone_number })) })),
    'info',
  ));

  checks.push(check(
    'members_suspicious_dates',
    'Members with impossible dates',
    'Join date or date of birth in the future, or a birth year before 1900.',
    members.filter((m) =>
      (m.join_date && m.join_date > t) ||
      (m.date_of_birth && (m.date_of_birth > t || m.date_of_birth < '1900-01-01'))
    ).map((m) => ({ id: m.id, name: fullName(m), dateOfBirth: m.date_of_birth, joinDate: m.join_date })),
    'warn',
  ));

  checks.push(check(
    'members_sabbatical_inconsistent',
    'Sabbatical status and dates disagree',
    'Status is sabbatical with no start date, or sabbatical dates are set on a member who is not on sabbatical.',
    members.filter((m) =>
      (m.status === 'sabbatical' && !m.sabbatical_start_date) ||
      (m.status !== 'sabbatical' && m.sabbatical_start_date && !m.sabbatical_end_date)
    ).map((m) => ({ id: m.id, name: fullName(m), status: m.status, sabbaticalStart: m.sabbatical_start_date, sabbaticalEnd: m.sabbatical_end_date })),
    'info',
  ));

  // --- children and links -------------------------------------------------
  const childrenWithParents = new Set((data.children_member_parents || []).map((p) => p.child_member_id));
  checks.push(check(
    'children_without_parents',
    "Children with no parent or guardian recorded",
    'No row in children_member_parents.',
    (data.children_members || []).filter((c) => !childrenWithParents.has(c.id)).map((c) => ({ id: c.id, name: fullName(c) })),
    'info',
  ));

  const visitorsWithGuardians = new Set((data.children_visitor_guardians || []).map((g) => g.visitor_id));
  checks.push(check(
    'children_visitors_without_guardians',
    'Child visitors with no guardian recorded',
    'No row in children_visitor_guardians.',
    (data.children_visitors || []).filter((v) => !visitorsWithGuardians.has(v.id)).map((v) => ({ id: v.id, name: fullName(v), visitDate: v.visit_date })),
    'info',
  ));

  const brokenConversions: Row[] = [];
  const conv = (table: string, rows: Row[], targets: Set<unknown>) => {
    for (const r of rows) {
      if (r.converted_to_member && (!r.converted_member_id || !targets.has(r.converted_member_id))) {
        brokenConversions.push({ table, id: r.id, name: fullName(r), convertedMemberId: r.converted_member_id });
      }
    }
  };
  conv('visitors', data.visitors || [], memberIds);
  conv('children_visitors', data.children_visitors || [], childIds);
  conv('children_members', data.children_members || [], memberIds);
  checks.push(check(
    'conversions_broken',
    'Converted records pointing nowhere',
    'Marked as converted, but the member they became is missing.',
    brokenConversions,
    'warn',
  ));

  checks.push(check(
    'family_links_broken',
    'Family links that do not resolve',
    'A family member is marked linked, but the linked member is missing, or the member is linked to themself.',
    (data.family_members || []).filter((f) =>
      f.is_linked && (!f.linked_member_id || !memberIds.has(f.linked_member_id) || f.linked_member_id === f.member_id)
    ).map((f) => ({ id: f.id, memberId: f.member_id, linkedMemberId: f.linked_member_id })),
    'warn',
  ));

  // --- attendance -----------------------------------------------------------
  const dupEntries = (rows: Row[], memberKey: string, table: string): Row[] =>
    groupsWithDuplicates(groupBy(rows, (e) => (e.attendance_record_id && e[memberKey] ? `${e.attendance_record_id}:${e[memberKey]}` : null)))
      .map((g) => ({ table, attendanceRecordId: g.items[0].attendance_record_id, memberId: g.items[0][memberKey], copies: g.items.length, entryIds: g.items.map((e) => e.id) }));
  checks.push(check(
    'attendance_duplicate_entries',
    'People marked present twice in one service',
    'The same person has more than one entry in the same attendance record.',
    [
      ...dupEntries(data.attendance_entries || [], 'member_id', 'attendance_entries'),
      ...dupEntries(data.children_attendance_entries || [], 'child_member_id', 'children_attendance_entries'),
    ],
    'error',
  ));

  const dupRecords = (rows: Row[], table: string): Row[] =>
    groupsWithDuplicates(groupBy(rows, (r) => (r.date ? `${r.date}|${r.service_type}` : null)))
      .map((g) => ({ table, date: g.items[0].date, serviceType: g.items[0].service_type, recordIds: g.items.map((r) => r.id) }));
  checks.push(check(
    'attendance_duplicate_records',
    'Two attendance records for the same service',
    'Same date and service type appears more than once.',
    [
      ...dupRecords(data.attendance_records || [], 'attendance_records'),
      ...dupRecords(data.children_attendance_records || [], 'children_attendance_records'),
    ],
    'warn',
  ));

  const recordIds = new Set((data.attendance_records || []).map((r) => r.id));
  const childRecordIds = new Set((data.children_attendance_records || []).map((r) => r.id));
  checks.push(check(
    'attendance_dangling_entries',
    'Attendance entries with no record or person',
    'The attendance record, or the member, no longer exists.',
    [
      ...(data.attendance_entries || []).filter((e) => !recordIds.has(e.attendance_record_id) || !memberIds.has(e.member_id))
        .map((e) => ({ table: 'attendance_entries', id: e.id })),
      ...(data.children_attendance_entries || []).filter((e) => !childRecordIds.has(e.attendance_record_id) || !childIds.has(e.child_member_id))
        .map((e) => ({ table: 'children_attendance_entries', id: e.id })),
    ],
    'error',
  ));

  checks.push(check(
    'attendance_future_dates',
    'Attendance recorded for a future date',
    'The service date is after today.',
    [
      ...(data.attendance_records || []).filter((r) => r.date > t).map((r) => ({ table: 'attendance_records', id: r.id, date: r.date })),
      ...(data.children_attendance_records || []).filter((r) => r.date > t).map((r) => ({ table: 'children_attendance_records', id: r.id, date: r.date })),
    ],
    'warn',
  ));

  // --- giving and expenses ------------------------------------------------
  const givingProblems: Row[] = [];
  const givingInfo: Row[] = [];
  const givingSplit = (table: string, rows: Row[], splitCols: string[]) => {
    for (const r of rows) {
      const total = num(r.total_amount);
      const split = splitCols.reduce((sum, c) => sum + num(r[c]), 0);
      const base = { table, id: r.id, serviceDate: r.service_date, total, paymentSplitTotal: Math.round(split * 100) / 100 };
      if (total < 0 || splitCols.some((c) => num(r[c]) < 0)) givingProblems.push({ ...base, problem: 'negative amount' });
      else if (split > 0 && Math.abs(split - total) > 0.005) givingProblems.push({ ...base, problem: 'payment methods do not add up to the total' });
      else if (split === 0 && total > 0) givingInfo.push(base);
      if (r.service_date > t) givingProblems.push({ ...base, problem: 'future date' });
    }
  };
  givingSplit('giving_records', data.giving_records || [], ['cash_amount', 'mobile_money_amount', 'card_amount', 'bank_transfer_amount']);
  givingSplit('children_giving_records', data.children_giving_records || [], ['cash_amount', 'mobile_money_amount']);
  checks.push(check('giving_inconsistent', 'Giving records that do not add up', 'Payment methods do not sum to the total, negative amounts, or a future date.', givingProblems, 'error'));
  checks.push(check('giving_no_payment_split', 'Giving records with no payment breakdown', 'A total was recorded without cash / mobile money / card / bank amounts.', givingInfo, 'info'));

  const expenses = data.expense_records || [];
  const dupForms = groupsWithDuplicates(groupBy(expenses, (e) => (e.form_id ? String(e.form_id).trim().toUpperCase() : null)))
    .map((g) => ({ formId: g.key, expenseIds: g.items.map((e) => e.id) }));
  checks.push(check('expenses_duplicate_form_id', 'Duplicate expense form IDs', 'Form IDs are meant to be sequential and unique.', dupForms, 'warn'));
  checks.push(check(
    'expenses_bad_amount',
    'Expenses with a zero or negative amount',
    'Amount is not greater than zero.',
    expenses.filter((e) => !(num(e.amount) > 0)).map((e) => ({ id: e.id, formId: e.form_id, amount: e.amount })),
    'warn',
  ));

  checks.push(check(
    'service_records_unlinked',
    'Service records linked to neither attendance nor giving',
    'Both attendance_record_id and giving_record_id are empty.',
    (data.service_records || []).filter((s) => !s.attendance_record_id && !s.giving_record_id).map((s) => ({ id: s.id, serviceDate: s.service_date, serviceType: s.service_type })),
    'info',
  ));

  // --- accounts and housekeeping --------------------------------------------
  const profiles = data.profiles || [];
  checks.push(check(
    'users_pending_approval',
    'Accounts waiting for approval',
    'approval_status is pending.',
    profiles.filter((p) => p.approval_status === 'pending').map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role })),
    'info',
  ));
  checks.push(check(
    'users_never_logged_in',
    'Active accounts that have never logged in',
    'last_login is empty (it is also cleared on logout, so this includes people who logged out).',
    profiles.filter((p) => p.is_active && !p.last_login).map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role })),
    'info',
  ));

  const nowMs = Date.now();
  checks.push(check(
    'otp_stale',
    'Expired one-time codes not cleaned up',
    'Expired or used OTP codes still stored.',
    (data.otp_codes || []).filter((o) => o.used || new Date(o.expires_at).getTime() < nowMs).map((o) => ({ id: o.id })),
    'info',
  ));

  const backups = data.backup_history || [];
  const lastGood = backups.find((b) => b.status === 'completed');
  const lastGoodAgeDays = lastGood?.completed_at ? Math.floor((nowMs - new Date(lastGood.completed_at).getTime()) / 86400000) : null;
  const backupItems: Row[] = [];
  if (!lastGood) backupItems.push({ problem: 'no completed backup found' });
  else if (lastGoodAgeDays !== null && lastGoodAgeDays > 14) backupItems.push({ problem: `last completed backup is ${lastGoodAgeDays} days old`, completedAt: lastGood.completed_at });
  checks.push(check('backup_stale', 'Backups out of date', 'No completed backup in the last 14 days.', backupItems, lastGood ? 'warn' : 'error'));
  checks.push(check(
    'backup_failed_recent',
    'Failed backups',
    'Backup attempts with status failed among the last 50.',
    backups.filter((b) => b.status === 'failed').map((b) => ({ id: b.id, type: b.type, createdAt: b.created_at, error: b.error_message })),
    'warn',
  ));

  return checks;
}

// ----------------------------------------------------------------------------
// summaries shown next to the checks
// ----------------------------------------------------------------------------

export function summarize(data: HealthData) {
  const profiles = data.profiles || [];
  const log = data.activity_log || [];
  const weekAgo = Date.now() - 7 * 86400000;
  const recent = log.filter((l) => new Date(l.created_at).getTime() >= weekAgo);
  const byAction: Record<string, number> = {};
  for (const l of recent) byAction[l.action] = (byAction[l.action] || 0) + 1;

  const tally: Record<string, number> = {};
  for (const s of data.tally_submissions || []) tally[s.status ?? 'unknown'] = (tally[s.status ?? 'unknown'] || 0) + 1;

  return {
    users: profiles
      .map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        isActive: p.is_active,
        approvalStatus: p.approval_status,
        lastLogin: p.last_login,
        twoFaMethod: p.two_fa_method,
      }))
      .sort((a, b) => String(b.lastLogin ?? '').localeCompare(String(a.lastLogin ?? ''))),
    activity: {
      last7Days: recent.length,
      byAction,
      latest: log.slice(0, 20).map((l) => ({ id: l.id, action: l.action, entityType: l.entity_type, user: l.user_name, description: l.description, createdAt: l.created_at })),
    },
    backups: (data.backup_history || []).slice(0, 10).map((b) => ({
      id: b.id, type: b.type, status: b.status, fileName: b.file_name, fileSize: b.file_size, createdAt: b.created_at, completedAt: b.completed_at, error: b.error_message,
    })),
    tally,
  };
}
