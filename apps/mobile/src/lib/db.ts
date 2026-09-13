import * as SQLite from 'expo-sqlite';

export interface LocalMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  zone?: string;
  zone_number?: string;
  ministry?: string;
  photo_url?: string;
  local_photo_path?: string;
  status?: string;
  raw_json?: string;
  created_at: string;
}

export interface LocalDropdownOption {
  id: string;
  category: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: number;
  updated_at: string;
}

export interface LocalZone {
  id: string;
  name: string;
  code: string;
  description?: string;
  updated_at: string;
}

export interface LocalVisitor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  visit_date: string;
  potential_zone?: string;
  follow_up_status: string;
  notes?: string;
  raw_json?: string;
  created_at: string;
}

export interface LocalChild {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  other_names?: string;
  date_of_birth: string;
  gender?: string;
  zone?: string;
  status: string;
  phone?: string;
  second_phone?: string;
  email?: string;
  residence_location?: string;
  digital_address?: string;
  hometown?: string;
  notes?: string;
  photo_url?: string;
  guardian_name?: string;
  guardian_phone?: string;
  raw_json?: string;
  created_at: string;
}

export interface LocalChildParent {
  id: string;
  child_member_id: string;
  first_name: string;
  last_name: string;
  other_names?: string;
  phone?: string;
  relationship: string;
  occupation?: string;
  hometown?: string;
  is_linked?: number;
  linked_member_id?: string;
  created_at: string;
}

export interface LocalFamilyMember {
  id: string;
  member_id: string;
  relationship: string;
  first_name: string;
  last_name: string;
  other_names?: string;
  phone?: string;
  occupation?: string;
  hometown?: string;
  is_linked?: number;
  linked_member_id?: string;
  created_at: string;
}

export interface LocalChildVisitor {
  id: string;
  first_name?: string;
  last_name?: string;
  child_name?: string;
  name?: string;
  gender?: string;
  date_of_birth?: string;
  visit_date: string;
  notes?: string;
  guardian_name?: string;
  guardian_phone?: string;
  status?: string;
  raw_json?: string;
  created_at: string;
}

export interface LocalChildrenAttendanceRecord {
  id: string;
  date?: string;
  service_date?: string;
  service_type: string;
  total_count?: number;
  total_present?: number;
  total_members?: number;
  marked_by?: string;
  created_at: string;
}

export interface LocalChildrenAttendanceEntry {
  id: string;
  attendance_record_id: string;
  child_id: string;
  present: number;
  created_at: string;
}

export interface LocalChildrenGivingRecord {
  id: string;
  service_date?: string;
  giving_date?: string;
  service_type: string;
  total_amount?: number;
  amount?: number;
  currency?: string;
  notes?: string;
  created_at: string;
}

export interface LocalActivityLog {
  id: string;
  action: string;
  details?: string;
  user_id?: string;
  created_at: string;
}

export interface LocalGivingRecord {
  id: string;
  service_name: string;
  service_date: string;
  service_type: string;
  offering_amount: number;
  donation_amount: number;
  thanksgiving_amount: number;
  custom_types?: string; // JSON string of {[key: string]: number}
  total_amount: number;
  cash_amount: number;
  mobile_money_amount: number;
  card_amount: number;
  bank_transfer_amount: number;
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface LocalCustomGivingType {
  id: string;
  name: string;
  description?: string;
  is_active: number;
  created_by?: string;
  created_at: string;
}

export interface LocalAttendanceEntry {
  id: string;
  attendance_record_id: string;
  member_id: string;
  created_at: string;
}

export interface LocalExpense {
  id: string;
  form_id: string;
  details: string;
  amount: number;
  service_date: string;
  service_type: string;
  payment_method_id?: string;
  payment_method_name: string;
  reference_number?: string;
  receipt_local_path?: string;
  requested_by_name?: string;
  recommended_by_name?: string;
  approved_by_name?: string;
  status: string;
  created_by?: string;
  created_at: string;
}

export interface LocalExpensePaymentMethod {
  id: string;
  name: string;
  is_active: number;
  created_at?: string;
}

export interface LocalSyncQueueItem {
  id: string;
  action: string;
  endpoint: string;
  payload: string;
  status: 'pending' | 'syncing' | 'error';
  created_at: string;
}

export interface LocalCustomService {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  days_of_week: string; // JSON array of numbers
  is_active: number;
  created_by?: string;
  created_at: string;
}

export interface LocalAttendanceRecord {
  id: string;
  date: string;
  service_type: string;
  start_time?: string;
  end_time?: string;
  total_count: number;
  is_custom_service?: number;
  custom_service_id?: string;
  status?: 'live' | 'finalized';
  attendance_type?: 'individual' | 'general';
  men_count?: number;
  women_count?: number;
  children_count?: number;
  visitors_count?: number;
  created_by?: string;
  created_at: string;
}

export interface LocalAbsenteeRecord {
  id: string;
  attendance_record_id: string;
  member_id: string;
  requested_permission?: number;
  reason?: string;
  reason_notes?: string;
  absence_start_date?: string;
  absence_end_date?: string;
  until_further_notice?: number;
  created_at: string;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getLocalDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await SQLite.openDatabaseAsync('cocm_local.db');
  
  // Initialize Schema with Indexing for 0ms performance
  await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      role TEXT,
      zone TEXT,
      zone_number TEXT,
      ministry TEXT,
      photo_url TEXT,
      local_photo_path TEXT,
      status TEXT DEFAULT 'active',
      raw_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);

    CREATE TABLE IF NOT EXISTS system_dropdown_options (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_options_cat ON system_dropdown_options(category, is_active);

    CREATE TABLE IF NOT EXISTS zones (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_zones_code ON zones(code);

    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      visit_date TEXT NOT NULL,
      potential_zone TEXT,
      follow_up_status TEXT DEFAULT 'pending',
      notes TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(visit_date);

    CREATE TABLE IF NOT EXISTS children_members (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      gender TEXT,
      zone TEXT,
      status TEXT DEFAULT 'active',
      guardian_name TEXT,
      guardian_phone TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_children_name ON children_members(name);

    CREATE TABLE IF NOT EXISTS children_member_parents (
      id TEXT PRIMARY KEY NOT NULL,
      child_member_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      other_names TEXT,
      phone TEXT,
      relationship TEXT NOT NULL,
      occupation TEXT,
      hometown TEXT,
      is_linked INTEGER DEFAULT 0,
      linked_member_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cmp_child_id ON children_member_parents(child_member_id);

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      other_names TEXT,
      phone TEXT,
      occupation TEXT,
      hometown TEXT,
      is_linked INTEGER DEFAULT 0,
      linked_member_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fm_member_id ON family_members(member_id);
    CREATE INDEX IF NOT EXISTS idx_fm_linked_id ON family_members(linked_member_id);

    CREATE TABLE IF NOT EXISTS children_visitors (
      id TEXT PRIMARY KEY NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT,
      date_of_birth TEXT,
      visit_date TEXT NOT NULL,
      notes TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cv_visit_date ON children_visitors(visit_date);

    CREATE TABLE IF NOT EXISTS children_attendance_records (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_car_date ON children_attendance_records(date);

    CREATE TABLE IF NOT EXISTS children_attendance_entries (
      id TEXT PRIMARY KEY NOT NULL,
      attendance_record_id TEXT NOT NULL,
      child_id TEXT NOT NULL,
      present INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cae_record ON children_attendance_entries(attendance_record_id);

    CREATE TABLE IF NOT EXISTS children_giving_records (
      id TEXT PRIMARY KEY NOT NULL,
      service_date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      total_amount REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cgr_date ON children_giving_records(service_date);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_logs(created_at);

    CREATE TABLE IF NOT EXISTS giving_records (
      id TEXT PRIMARY KEY NOT NULL,
      service_name TEXT,
      service_date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      offering_amount REAL DEFAULT 0,
      donation_amount REAL DEFAULT 0,
      thanksgiving_amount REAL DEFAULT 0,
      custom_types TEXT DEFAULT '{}',
      total_amount REAL NOT NULL,
      cash_amount REAL DEFAULT 0,
      mobile_money_amount REAL DEFAULT 0,
      card_amount REAL DEFAULT 0,
      bank_transfer_amount REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_giving_date ON giving_records(service_date);

    CREATE TABLE IF NOT EXISTS custom_giving_types (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attendance_entries (
      id TEXT PRIMARY KEY NOT NULL,
      attendance_record_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_record ON attendance_entries(attendance_record_id);

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY NOT NULL,
      form_id TEXT NOT NULL,
      details TEXT NOT NULL,
      amount REAL NOT NULL,
      service_date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      payment_method_id TEXT,
      payment_method_name TEXT NOT NULL,
      reference_number TEXT,
      receipt_local_path TEXT,
      requested_by_name TEXT,
      recommended_by_name TEXT,
      approved_by_name TEXT,
      status TEXT DEFAULT 'approved',
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(service_date);

    CREATE TABLE IF NOT EXISTS expense_payment_methods (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT
    );
  `);

  // Safe Column Migrations for Existing SQLite Databases
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN service_date TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN service_name TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN service_type TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN offering_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN donation_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN thanksgiving_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN custom_types TEXT DEFAULT '{}';`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN total_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN cash_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN mobile_money_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN card_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN bank_transfer_amount REAL DEFAULT 0;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN notes TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE giving_records ADD COLUMN created_by TEXT;`); } catch (e) {}

  try { await dbInstance.runAsync(`ALTER TABLE expenses ADD COLUMN payment_method_id TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE expenses ADD COLUMN reference_number TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE expenses ADD COLUMN requested_by_name TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE expenses ADD COLUMN recommended_by_name TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE expenses ADD COLUMN approved_by_name TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE expenses ADD COLUMN created_by TEXT;`); } catch (e) {}

  try { await dbInstance.runAsync(`ALTER TABLE activity_logs ADD COLUMN user_name TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE activity_logs ADD COLUMN user_role TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE activity_logs ADD COLUMN entity_type TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE activity_logs ADD COLUMN description TEXT;`); } catch (e) {}
  try { await dbInstance.runAsync(`ALTER TABLE activity_logs ADD COLUMN metadata TEXT;`); } catch (e) {}

  await dbInstance.execAsync(`

    CREATE TABLE IF NOT EXISTS custom_services (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      days_of_week TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cs_name ON custom_services(name);

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      service_type TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      total_count INTEGER DEFAULT 0,
      is_custom_service INTEGER DEFAULT 0,
      custom_service_id TEXT,
      status TEXT DEFAULT 'finalized',
      attendance_type TEXT DEFAULT 'individual',
      men_count INTEGER DEFAULT 0,
      women_count INTEGER DEFAULT 0,
      children_count INTEGER DEFAULT 0,
      visitors_count INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ar_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_ar_status ON attendance_records(status);

    CREATE TABLE IF NOT EXISTS absentee_records (
      id TEXT PRIMARY KEY NOT NULL,
      attendance_record_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      requested_permission INTEGER DEFAULT 0,
      reason TEXT,
      reason_notes TEXT,
      absence_start_date TEXT,
      absence_end_date TEXT,
      until_further_notice INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_absentee_rec ON absentee_records(attendance_record_id, member_id);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
  `);

  try {
    await dbInstance.execAsync(`ALTER TABLE members ADD COLUMN raw_json TEXT;`);
  } catch (e) {}

  try {
    await dbInstance.execAsync(`ALTER TABLE members ADD COLUMN zone_number TEXT;`);
  } catch (e) {}

  return dbInstance;
}

// ============================================================================
// LOCAL SQLITE READ & WRITE HELPERS (0ms Network Roundtrip)
// ============================================================================

export async function getLocalStats() {
  const db = await getLocalDb();

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const dayOfWeek = now.getDay();
  const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const firstDayOfWeek = new Date(now.setDate(diffToMonday));
  firstDayOfWeek.setHours(0, 0, 0, 0);
  const firstDayOfWeekIso = firstDayOfWeek.toISOString();

  const membersRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM members');
  const newMembersRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM members WHERE created_at >= ?', [firstDayOfMonth]);
  const givingRes = await db.getFirstAsync<{ total: number }>('SELECT SUM(amount) as total FROM giving_records WHERE date >= ?', [firstDayOfMonth.split('T')[0]]);
  const attendanceRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM attendance_entries WHERE created_at >= ?', [firstDayOfWeekIso]);

  return {
    totalMembers: membersRes?.count || 0,
    newMembersThisMonth: newMembersRes?.count || 0,
    attendanceThisWeek: attendanceRes?.count || 0,
    givingThisMonth: givingRes?.total || 0,
  };
}

export async function upsertLocalMember(member: LocalMember) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO members (id, name, phone, email, role, zone, zone_number, ministry, photo_url, local_photo_path, status, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      member.id,
      member.name,
      member.phone || null,
      member.email || null,
      member.role || null,
      member.zone || null,
      member.zone_number || null,
      member.ministry || null,
      member.photo_url || null,
      member.local_photo_path || null,
      member.status || 'active',
      member.raw_json || null,
      member.created_at || new Date().toISOString()
    ]
  );
}

export async function upsertLocalDropdownOption(opt: LocalDropdownOption) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO system_dropdown_options (id, category, label, value, sort_order, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [opt.id, opt.category, opt.label, opt.value, opt.sort_order ?? 0, opt.is_active ?? 1, opt.updated_at || new Date().toISOString()]
  );
}

export async function batchUpsertDropdownOptions(opts: LocalDropdownOption[]) {
  const db = await getLocalDb();
  for (const opt of opts) {
    await db.runAsync(
      `INSERT OR REPLACE INTO system_dropdown_options (id, category, label, value, sort_order, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [opt.id, opt.category, opt.label, opt.value, opt.sort_order ?? 0, opt.is_active ?? 1, opt.updated_at || new Date().toISOString()]
    );
  }
}

export async function deleteLocalDropdownOption(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync('DELETE FROM system_dropdown_options WHERE id = ?', [id]);
}

export async function getLocalMembers(): Promise<LocalMember[]> {
  const db = await getLocalDb();
  return await db.getAllAsync<LocalMember>('SELECT * FROM members ORDER BY name ASC');
}

export async function getLocalDropdownOptions(category: string): Promise<LocalDropdownOption[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalDropdownOption>(
    'SELECT * FROM system_dropdown_options WHERE category = ? AND is_active = 1 ORDER BY sort_order ASC, label ASC',
    [category]
  );
  return rows;
}

export async function upsertLocalZone(zone: LocalZone) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO zones (id, name, code, description, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [zone.id, zone.name, zone.code, zone.description || null, zone.updated_at || new Date().toISOString()]
  );
}

export async function batchUpsertZones(zones: LocalZone[]) {
  const db = await getLocalDb();
  for (const zone of zones) {
    await db.runAsync(
      `INSERT OR REPLACE INTO zones (id, name, code, description, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [zone.id, zone.name, zone.code, zone.description || null, zone.updated_at || new Date().toISOString()]
    );
  }
}

export async function getLocalZones(): Promise<LocalZone[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalZone>('SELECT * FROM zones ORDER BY code ASC');
  return rows;
}

export async function upsertLocalVisitor(vis: LocalVisitor) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO visitors (id, name, phone, email, visit_date, potential_zone, follow_up_status, notes, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vis.id,
      vis.name,
      vis.phone || null,
      vis.email || null,
      vis.visit_date,
      vis.potential_zone || null,
      vis.follow_up_status || 'pending',
      vis.notes || null,
      vis.raw_json || null,
      vis.created_at || new Date().toISOString()
    ]
  );
}

export async function getLocalVisitors(): Promise<LocalVisitor[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalVisitor>(
    'SELECT * FROM visitors ORDER BY created_at DESC'
  );
  return rows;
}

export async function upsertLocalChild(child: LocalChild) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO children_members (id, name, date_of_birth, gender, zone, status, guardian_name, guardian_phone, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      child.id,
      child.name,
      child.date_of_birth,
      child.gender || null,
      child.zone || null,
      child.status || 'active',
      child.guardian_name || null,
      child.guardian_phone || null,
      child.raw_json || null,
      child.created_at || new Date().toISOString()
    ]
  );
}

export async function getLocalChildren(): Promise<LocalChild[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalChild>(
    'SELECT * FROM children_members ORDER BY name ASC'
  );
  return rows;
}

export async function getLocalChildById(id: string): Promise<LocalChild | null> {
  const db = await getLocalDb();
  const row = await db.getFirstAsync<LocalChild>(
    'SELECT * FROM children_members WHERE id = ?',
    [id]
  );
  return row || null;
}

export async function deleteLocalChild(id: string) {
  const db = await getLocalDb();
  await db.runAsync('DELETE FROM children_members WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM children_member_parents WHERE child_member_id = ?', [id]);
}

export async function upsertLocalChildParent(p: LocalChildParent) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO children_member_parents (id, child_member_id, first_name, last_name, other_names, phone, relationship, occupation, hometown, is_linked, linked_member_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.child_member_id,
      p.first_name,
      p.last_name,
      p.other_names || null,
      p.phone || null,
      p.relationship,
      p.occupation || null,
      p.hometown || null,
      p.is_linked ? 1 : 0,
      p.linked_member_id || null,
      p.created_at || new Date().toISOString()
    ]
  );
}

export async function getLocalChildParents(childMemberId: string): Promise<LocalChildParent[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalChildParent>(
    'SELECT * FROM children_member_parents WHERE child_member_id = ? ORDER BY created_at ASC',
    [childMemberId]
  );
  return rows;
}

export async function upsertLocalFamilyMember(fm: LocalFamilyMember) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO family_members (id, member_id, relationship, first_name, last_name, other_names, phone, occupation, hometown, is_linked, linked_member_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fm.id,
      fm.member_id,
      fm.relationship,
      fm.first_name,
      fm.last_name,
      fm.other_names || null,
      fm.phone || null,
      fm.occupation || null,
      fm.hometown || null,
      fm.is_linked ? 1 : 0,
      fm.linked_member_id || null,
      fm.created_at || new Date().toISOString()
    ]
  );
}

export async function getLocalFamilyMembers(memberId: string): Promise<LocalFamilyMember[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalFamilyMember>(
    'SELECT * FROM family_members WHERE member_id = ? ORDER BY created_at ASC',
    [memberId]
  );
  return rows;
}

export async function deleteLocalFamilyMember(id: string) {
  const db = await getLocalDb();
  await db.runAsync('DELETE FROM family_members WHERE id = ?', [id]);
}

export async function upsertLocalChildVisitor(v: LocalChildVisitor) {
  const db = await getLocalDb();
  const fName = v.first_name || (v.child_name ? v.child_name.split(' ')[0] : 'Visitor');
  const lName = v.last_name || (v.child_name ? v.child_name.split(' ').slice(1).join(' ') || 'Child' : 'Child');
  await db.runAsync(
    `INSERT OR REPLACE INTO children_visitors (id, first_name, last_name, gender, date_of_birth, visit_date, notes, guardian_name, guardian_phone, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      v.id,
      fName,
      lName,
      v.gender || null,
      v.date_of_birth || null,
      v.visit_date,
      v.notes || null,
      v.guardian_name || null,
      v.guardian_phone || null,
      v.raw_json || JSON.stringify(v),
      v.created_at || new Date().toISOString()
    ]
  );
}

export async function getLocalChildVisitors(): Promise<LocalChildVisitor[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM children_visitors ORDER BY visit_date DESC'
  );
  return rows.map(r => ({
    ...r,
    child_name: r.child_name || `${r.first_name || ''} ${r.last_name || ''}`.trim()
  }));
}

export async function saveLocalChildrenAttendanceRecord(
  rec: LocalChildrenAttendanceRecord,
  entries: LocalChildrenAttendanceEntry[] = []
) {
  const db = await getLocalDb();
  const attDate = rec.date || rec.service_date || new Date().toISOString().split('T')[0];
  const total = rec.total_count !== undefined ? rec.total_count : (rec.total_present !== undefined ? rec.total_present : 0);
  await db.runAsync(
    `INSERT OR REPLACE INTO children_attendance_records (id, date, service_type, total_count, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [rec.id, attDate, rec.service_type, total, rec.created_at || new Date().toISOString()]
  );
  for (const ent of entries) {
    await db.runAsync(
      `INSERT OR REPLACE INTO children_attendance_entries (id, attendance_record_id, child_id, present, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [ent.id, ent.attendance_record_id, ent.child_id, ent.present ? 1 : 0, ent.created_at || new Date().toISOString()]
    );
  }
}

export async function getLocalChildrenAttendanceRecords(): Promise<LocalChildrenAttendanceRecord[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM children_attendance_records ORDER BY date DESC'
  );
  return rows.map(r => ({
    ...r,
    service_date: r.date,
    total_present: r.total_count
  }));
}

export async function saveLocalChildrenGivingRecord(g: LocalChildrenGivingRecord) {
  const db = await getLocalDb();
  const amt = g.total_amount !== undefined ? g.total_amount : (g.amount !== undefined ? g.amount : 0);
  const sDate = g.service_date || g.giving_date || new Date().toISOString().split('T')[0];
  await db.runAsync(
    `INSERT OR REPLACE INTO children_giving_records (id, service_date, service_type, total_amount, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [g.id, sDate, g.service_type, amt, g.notes || null, g.created_at || new Date().toISOString()]
  );
}

export async function getLocalChildrenGivingRecords(): Promise<LocalChildrenGivingRecord[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM children_giving_records ORDER BY service_date DESC'
  );
  return rows.map(r => ({
    ...r,
    amount: r.total_amount,
    giving_date: r.service_date,
    currency: 'GHS'
  }));
}

export async function addLocalActivityLog(log: LocalActivityLog) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO activity_logs (id, action, details, user_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [log.id, log.action, log.details || null, log.user_id || null, log.created_at || new Date().toISOString()]
  );
}

// ============================================================================
// FINANCIAL & GIVING RECORDS HELPERS
// ============================================================================

export const upsertLocalGiving = upsertLocalGivingRecord;

export async function upsertLocalGivingRecord(rec: any): Promise<void> {
  const db = await getLocalDb();
  const id = rec.id;
  const serviceName = rec.service_name || rec.serviceName || rec.service_type || rec.serviceType || 'Sunday Service';
  const serviceDate = rec.service_date || rec.serviceDate || rec.date || new Date().toISOString().split('T')[0];
  const serviceType = rec.service_type || rec.serviceType || 'sunday_morning';
  
  const offeringAmount = rec.offering_amount ?? rec.offeringAmount ?? (rec.offerings?.offering || 0);
  const donationAmount = rec.donation_amount ?? rec.donationAmount ?? (rec.offerings?.donation || 0);
  const thanksgivingAmount = rec.thanksgiving_amount ?? rec.thanksgivingAmount ?? (rec.offerings?.thanksgiving || 0);
  
  let customTypes = rec.custom_types ?? rec.customTypes ?? (rec.offerings?.customTypes || {});
  if (typeof customTypes !== 'string') {
    customTypes = JSON.stringify(customTypes);
  }

  const totalAmount = rec.total_amount ?? rec.totalAmount ?? rec.amount ?? 0;
  const cashAmount = rec.cash_amount ?? rec.cashAmount ?? (rec.paymentBreakdown?.cash || 0);
  const mobileMoneyAmount = rec.mobile_money_amount ?? rec.mobileMoneyAmount ?? (rec.paymentBreakdown?.mobile_money || 0);
  const cardAmount = rec.card_amount ?? rec.cardAmount ?? (rec.paymentBreakdown?.card || 0);
  const bankTransferAmount = rec.bank_transfer_amount ?? rec.bankTransferAmount ?? (rec.paymentBreakdown?.bank_transfer || 0);
  const notes = rec.notes || null;
  const createdBy = rec.created_by || rec.createdBy || null;
  const createdAt = rec.created_at || rec.createdAt || new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO giving_records 
      (id, service_name, service_date, service_type, offering_amount, donation_amount, thanksgiving_amount, custom_types, total_amount, cash_amount, mobile_money_amount, card_amount, bank_transfer_amount, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, serviceName, serviceDate, serviceType, offeringAmount, donationAmount, thanksgivingAmount,
      customTypes, totalAmount, cashAmount, mobileMoneyAmount, cardAmount, bankTransferAmount,
      notes, createdBy, createdAt
    ]
  );
}

export async function getLocalGivingRecords(): Promise<LocalGivingRecord[]> {
  const db = await getLocalDb();
  try {
    const rows = await db.getAllAsync<LocalGivingRecord>(
      `SELECT * FROM giving_records ORDER BY service_date DESC`
    );
    return rows;
  } catch (err) {
    const rows = await db.getAllAsync<any>(
      `SELECT *, date as service_date, amount as total_amount FROM giving_records ORDER BY date DESC`
    );
    return rows;
  }
}

export async function deleteLocalGivingRecord(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM giving_records WHERE id = ?`, [id]);
}

export async function upsertLocalCustomGivingType(type: any): Promise<void> {
  const db = await getLocalDb();
  const id = type.id;
  const name = type.name;
  const description = type.description || null;
  const isActive = type.is_active !== undefined
    ? (type.is_active ? 1 : 0)
    : (type.isActive !== undefined ? (type.isActive ? 1 : 0) : 1);
  const createdBy = type.created_by || type.createdBy || null;
  const createdAt = type.created_at || type.createdAt || new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO custom_giving_types (id, name, description, is_active, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, description, isActive, createdBy, createdAt]
  );
}

export async function getLocalCustomGivingTypes(): Promise<LocalCustomGivingType[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalCustomGivingType>(
    `SELECT * FROM custom_giving_types ORDER BY name ASC`
  );
  return rows;
}

export async function deleteLocalCustomGivingType(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM custom_giving_types WHERE id = ?`, [id]);
}

export async function upsertLocalExpense(exp: any): Promise<void> {
  const db = await getLocalDb();
  const id = exp.id;
  const formId = exp.form_id || exp.formId || 'EXP-0001';
  const details = exp.details || '';
  const amount = exp.amount || 0;
  const serviceDate = exp.service_date || exp.serviceDate || exp.expense_date || new Date().toISOString().split('T')[0];
  const serviceType = exp.service_type || exp.serviceType || 'General';
  const paymentMethodId = exp.payment_method_id || exp.paymentMethodId || null;
  const paymentMethodName = exp.payment_method_name || exp.paymentMethodName || 'Cash';
  const referenceNumber = exp.reference_number || exp.referenceNumber || null;
  const receiptLocalPath = exp.receipt_local_path || exp.receiptLocalPath || null;
  const requestedByName = exp.requested_by_name || exp.requestedByName || null;
  const recommendedByName = exp.recommended_by_name || exp.recommendedByName || null;
  const approvedByName = exp.approved_by_name || exp.approvedByName || null;
  const status = exp.status || 'approved';
  const createdBy = exp.created_by || exp.createdBy || null;
  const createdAt = exp.created_at || exp.createdAt || new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO expenses
      (id, form_id, details, amount, service_date, service_type, payment_method_id, payment_method_name, reference_number, receipt_local_path, requested_by_name, recommended_by_name, approved_by_name, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, formId, details, amount, serviceDate, serviceType, paymentMethodId, paymentMethodName,
      referenceNumber, receiptLocalPath, requestedByName, recommendedByName, approvedByName, status,
      createdBy, createdAt
    ]
  );
}

export async function getLocalExpenses(): Promise<LocalExpense[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalExpense>(
    `SELECT * FROM expenses ORDER BY service_date DESC, created_at DESC`
  );
  return rows;
}

export async function deleteLocalExpense(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM expenses WHERE id = ?`, [id]);
}

export async function upsertLocalExpensePaymentMethod(pm: any): Promise<void> {
  const db = await getLocalDb();
  const id = pm.id;
  const name = pm.name;
  const isActive = pm.is_active !== undefined
    ? (pm.is_active ? 1 : 0)
    : (pm.isActive !== undefined ? (pm.isActive ? 1 : 0) : 1);
  const createdAt = pm.created_at || pm.createdAt || new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO expense_payment_methods (id, name, is_active, created_at)
     VALUES (?, ?, ?, ?)`,
    [id, name, isActive, createdAt]
  );
}

export async function getLocalExpensePaymentMethods(): Promise<LocalExpensePaymentMethod[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalExpensePaymentMethod>(
    `SELECT * FROM expense_payment_methods ORDER BY name ASC`
  );
  return rows;
}

export async function deleteLocalExpensePaymentMethod(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM expense_payment_methods WHERE id = ?`, [id]);
}

export async function upsertLocalAttendanceEntry(entry: LocalAttendanceEntry) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO attendance_entries (id, attendance_record_id, member_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [entry.id, entry.attendance_record_id, entry.member_id, entry.created_at || new Date().toISOString()]
  );
}

export async function removeLocalAttendanceEntry(attendanceRecordId: string, memberId: string) {
  const db = await getLocalDb();
  await db.runAsync(
    `DELETE FROM attendance_entries WHERE attendance_record_id = ? AND member_id = ?`,
    [attendanceRecordId, memberId]
  );
}

export async function getSyncQueueStats(): Promise<{ total: number; pending: number; syncing: number; error: number }> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`
  );
  
  let pending = 0;
  let syncing = 0;
  let error = 0;
  let total = 0;

  for (const r of rows) {
    if (r.status === 'pending') pending = r.count;
    else if (r.status === 'syncing') syncing = r.count;
    else if (r.status === 'error') error = r.count;
    total += r.count;
  }

  return { total, pending, syncing, error };
}

export async function getAllSyncQueueItems(): Promise<LocalSyncQueueItem[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalSyncQueueItem>(
    `SELECT * FROM sync_queue ORDER BY created_at DESC`
  );
  return rows;
}

export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

export async function retryFailedSyncItems(): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`UPDATE sync_queue SET status = 'pending' WHERE status = 'error'`);
}

export async function clearAllSyncQueue(): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM sync_queue`);
}

// ============================================================================
// CUSTOM SERVICES HELPERS
// ============================================================================

export async function upsertLocalCustomService(service: any) {
  const db = await getLocalDb();
  const id = service.id;
  const name = service.name;
  const description = service.description || null;
  const startDate = service.start_date || service.startDate || new Date().toISOString().split('T')[0];
  const endDate = service.end_date || service.endDate || '2099-12-31';
  const startTime = service.start_time || service.startTime || '09:00';
  const endTime = service.end_time || service.endTime || '12:00';
  
  let daysOfWeek = service.days_of_week || service.daysOfWeek || '[0]';
  if (Array.isArray(daysOfWeek)) {
    daysOfWeek = JSON.stringify(daysOfWeek);
  } else if (typeof daysOfWeek !== 'string') {
    daysOfWeek = JSON.stringify([0]);
  }

  const isActive = service.is_active !== undefined
    ? (service.is_active ? 1 : 0)
    : (service.isActive !== undefined ? (service.isActive ? 1 : 0) : 1);

  const createdBy = service.created_by || service.createdBy || null;
  const createdAt = service.created_at || service.createdAt || new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO custom_services (id, name, description, start_date, end_date, start_time, end_time, days_of_week, is_active, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, startDate, endDate, startTime, endTime, daysOfWeek, isActive, createdBy, createdAt]
  );
}

export async function getLocalCustomServices(): Promise<LocalCustomService[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalCustomService>(
    `SELECT * FROM custom_services ORDER BY name ASC`
  );
  return rows;
}

export async function toggleLocalCustomService(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `UPDATE custom_services SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?`,
    [id]
  );
}

export async function deleteLocalCustomService(id: string): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(`DELETE FROM custom_services WHERE id = ?`, [id]);
}

// ============================================================================
// ATTENDANCE RECORDS & ABSENTEE HELPERS
// ============================================================================

export async function upsertLocalAttendanceRecord(rec: LocalAttendanceRecord) {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO attendance_records (id, date, service_type, start_time, end_time, total_count, is_custom_service, custom_service_id, status, attendance_type, men_count, women_count, children_count, visitors_count, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rec.id,
      rec.date,
      rec.service_type,
      rec.start_time || null,
      rec.end_time || null,
      rec.total_count,
      rec.is_custom_service ? 1 : 0,
      rec.custom_service_id || null,
      rec.status || 'finalized',
      rec.attendance_type || 'individual',
      rec.men_count || 0,
      rec.women_count || 0,
      rec.children_count || 0,
      rec.visitors_count || 0,
      rec.created_by || null,
      rec.created_at || new Date().toISOString()
    ]
  );
}

export async function getLocalAttendanceRecords(): Promise<LocalAttendanceRecord[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalAttendanceRecord>(
    `SELECT * FROM attendance_records ORDER BY date DESC, created_at DESC`
  );
  return rows;
}

export async function getLocalAttendanceRecordById(id: string): Promise<LocalAttendanceRecord | null> {
  const db = await getLocalDb();
  const rec = await db.getFirstAsync<LocalAttendanceRecord>(
    `SELECT * FROM attendance_records WHERE id = ?`,
    [id]
  );
  return rec || null;
}

export async function getLocalAttendanceEntriesForRecord(recordId: string): Promise<string[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<{ member_id: string }>(
    `SELECT member_id FROM attendance_entries WHERE attendance_record_id = ?`,
    [recordId]
  );
  return rows.map(r => r.member_id);
}

export async function saveLocalAbsenteeRecords(records: LocalAbsenteeRecord[]) {
  const db = await getLocalDb();
  for (const r of records) {
    await db.runAsync(
      `INSERT OR REPLACE INTO absentee_records (id, attendance_record_id, member_id, requested_permission, reason, reason_notes, absence_start_date, absence_end_date, until_further_notice, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.attendance_record_id,
        r.member_id,
        r.requested_permission ? 1 : 0,
        r.reason || null,
        r.reason_notes || null,
        r.absence_start_date || null,
        r.absence_end_date || null,
        r.until_further_notice ? 1 : 0,
        r.created_at || new Date().toISOString()
      ]
    );

    // Update local member status if reason is Sick, Traveled, or Schooling
    if (r.reason && ['Sick', 'Traveled', 'Schooling'].includes(r.reason)) {
      const statusMap: Record<string, string> = { Sick: 'sick', Traveled: 'traveled', Schooling: 'schooling' };
      const newStatus = statusMap[r.reason];
      await db.runAsync(
        `UPDATE members SET status = ? WHERE id = ?`,
        [newStatus, r.member_id]
      );
    }
  }
}

export async function getLocalAbsenteeRecords(attendanceRecordId: string): Promise<LocalAbsenteeRecord[]> {
  const db = await getLocalDb();
  const rows = await db.getAllAsync<LocalAbsenteeRecord>(
    `SELECT * FROM absentee_records WHERE attendance_record_id = ?`,
    [attendanceRecordId]
  );
  return rows;
}

// ============================================================================
// MEMBER PROFILE ATTENDANCE HISTORY & STATUS RECALCULATION ENGINE
// ============================================================================

export async function getMemberAttendanceHistory(memberId: string) {
  const db = await getLocalDb();
  
  // Get all finalized individual attendance records
  const records = await db.getAllAsync<LocalAttendanceRecord>(
    `SELECT * FROM attendance_records WHERE attendance_type = 'individual' AND status = 'finalized' ORDER BY date DESC`
  );

  const presentEntries = await db.getAllAsync<{ attendance_record_id: string }>(
    `SELECT attendance_record_id FROM attendance_entries WHERE member_id = ?`,
    [memberId]
  );
  const presentSet = new Set(presentEntries.map(e => e.attendance_record_id));

  const history = records.map(r => ({
    id: r.id,
    date: r.date,
    serviceType: r.service_type,
    isPresent: presentSet.has(r.id),
  }));

  const presentCount = history.filter(h => h.isPresent).length;
  const absentCount = history.length - presentCount;
  const percentage = history.length > 0 ? Math.round((presentCount / history.length) * 100) : 0;

  return {
    history,
    totalServices: history.length,
    presentCount,
    absentCount,
    percentage,
  };
}

export async function recalculateMemberStatusesLocal() {
  const db = await getLocalDb();

  // Get last 4 finalized Sunday Main Service records
  const sundayRecords = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM attendance_records WHERE service_type = 'Sunday Main Service' AND attendance_type = 'individual' AND status = 'finalized' ORDER BY date DESC LIMIT 4`
  );

  if (!sundayRecords || sundayRecords.length < 4) return;

  const recordIds = sundayRecords.map(r => r.id);
  const recordIdPlaceholders = recordIds.map(() => '?').join(',');

  // Get member attendance counts in last 4 Sundays
  const counts = await db.getAllAsync<{ member_id: string; count: number }>(
    `SELECT member_id, COUNT(*) as count FROM attendance_entries WHERE attendance_record_id IN (${recordIdPlaceholders}) GROUP BY member_id`,
    recordIds
  );

  const countMap: Record<string, number> = {};
  for (const c of counts) {
    countMap[c.member_id] = c.count;
  }

  // Get members
  const members = await db.getAllAsync<{ id: string; status: string }>(
    `SELECT id, status FROM members WHERE status NOT IN ('blacklisted', 'not baptised', 'sick', 'traveled', 'schooling')`
  );

  for (const m of members) {
    const attCount = countMap[m.id] || 0;
    let newStatus = 'inactive';
    if (attCount >= 3) newStatus = 'active';
    else if (attCount >= 1) newStatus = 'semi-active';

    if (newStatus !== m.status) {
      await db.runAsync(`UPDATE members SET status = ? WHERE id = ?`, [newStatus, m.id]);
    }
  }
}

export interface LocalActivityLog {
  id: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  action: string;
  entity_type?: string;
  description: string;
  details?: string;
  created_at: string;
}

export async function getLocalActivityLogs(params?: { action?: string; entityType?: string }): Promise<LocalActivityLog[]> {
  const db = await getLocalDb();
  try {
    let query = `SELECT * FROM activity_logs`;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.action && params.action !== 'all') {
      conditions.push(`action = ?`);
      values.push(params.action);
    }
    if (params?.entityType && params.entityType !== 'all') {
      conditions.push(`entity_type = ?`);
      values.push(params.entityType);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` ORDER BY created_at DESC LIMIT 100`;

    return await db.getAllAsync<LocalActivityLog>(query, values);
  } catch (err) {
    console.warn('Failed to query activity_logs:', err);
    return [];
  }
}

export async function upsertLocalActivityLog(log: LocalActivityLog): Promise<void> {
  const db = await getLocalDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO activity_logs (id, user_id, user_name, user_role, action, entity_type, description, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.user_id || null,
      log.user_name || 'System User',
      log.user_role || 'user',
      log.action,
      log.entity_type || 'general',
      log.description || log.details || '',
      log.details || null,
      log.created_at || new Date().toISOString()
    ]
  );
}



