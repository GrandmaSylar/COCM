import { fetchApi } from '@cms/shared';
import {
  getLocalDb,
  LocalSyncQueueItem,
  upsertLocalCustomService,
  upsertLocalAttendanceRecord,
  upsertLocalGivingRecord,
  upsertLocalCustomGivingType,
  upsertLocalExpense,
  upsertLocalExpensePaymentMethod,
  upsertLocalActivityLog,
  upsertLocalMember,
  upsertLocalVisitor,
  upsertLocalChild,
  upsertLocalChildVisitor,
  pruneLocalTable,
} from './db';
import { syncDropdownOptions, syncChurchZones } from './options';
import { generateUUID } from './uuid';
import { api } from './api';
import {
  toAttendancePayload,
  toServicePayload,
  toVisitorPayload,
  toChildVisitorPayload,
  toChildGivingPayload,
} from './syncPayloads';

export type HttpMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const HTTP_METHODS: HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** Automatic retries per outbox item before it waits for a manual "Retry Failed". */
const MAX_AUTO_ATTEMPTS = 5;

let isSyncing = false;
const listeners = new Set<() => void>();

export function subscribeSyncQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySyncQueueListeners(): void {
  listeners.forEach(fn => {
    try {
      fn();
    } catch (err) {
      console.warn('Sync queue listener error:', err);
    }
  });
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function errorStatus(err: any): number | undefined {
  return typeof err?.status === 'number' ? err.status : undefined;
}

function errorMessage(err: any): string {
  return String(err?.message || err || 'Unknown error');
}

/** No HTTP status means the request never got a response (offline, DNS, timeout). */
function isNetworkError(err: any): boolean {
  return errorStatus(err) === undefined;
}

/** Worth retrying later: offline, expired session, rate limit, or server error. */
function isRetryableError(err: any): boolean {
  const status = errorStatus(err);
  if (status === undefined) return true;
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

/** The create already exists on the server (its id was sent with the payload). */
function isAlreadyAppliedError(err: any): boolean {
  return /duplicate key/i.test(errorMessage(err));
}

// ============================================================================
// OUTBOX WRITES
// ============================================================================

export async function enqueueSyncTask(method: HttpMethod, endpoint: string, data?: any): Promise<void> {
  if (!HTTP_METHODS.includes(method)) {
    throw new Error(`enqueueSyncTask: unsupported method "${method}"`);
  }
  if (!endpoint.startsWith('/')) {
    throw new Error(`enqueueSyncTask: endpoint must start with "/" (got "${endpoint}")`);
  }

  const db = await getLocalDb();
  await db.runAsync(
    `INSERT INTO sync_queue (id, action, endpoint, payload, status, attempts, created_at)
     VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
    [generateUUID(), method, endpoint, JSON.stringify(data ?? {}), new Date().toISOString()]
  );
  notifySyncQueueListeners();
}

/**
 * Sends a mutation to the server now, and only falls back to the outbox when the
 * server can't be reached. Each mutation is therefore delivered exactly once.
 * Validation/permission rejections (4xx) are thrown so the screen can show them.
 */
export async function pushOrQueue<T = any>(
  method: HttpMethod,
  endpoint: string,
  data?: any
): Promise<{ queued: boolean; result?: T }> {
  try {
    const result = await fetchApi<T>(endpoint, {
      method,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { queued: false, result };
  } catch (err) {
    if (isAlreadyAppliedError(err)) return { queued: false };
    if (!isRetryableError(err)) throw err;
    await enqueueSyncTask(method, endpoint, data);
    return { queued: true };
  }
}

// ============================================================================
// LEGACY OUTBOX MIGRATION
// ----------------------------------------------------------------------------
// Before the outbox replayed through the REST API, items were stored with
// non-HTTP actions ('member_create', 'INSERT', ...) and some screens also pushed
// the same mutation live. Those items are rewritten (or dropped if the server
// already has the change) before they are ever replayed.
// ============================================================================

function isLegacyItem(item: LocalSyncQueueItem): boolean {
  return !HTTP_METHODS.includes(item.action as HttpMethod) || !item.endpoint?.startsWith('/');
}

/** True when the server record changed after this queue item was created. */
function serverChangedAfter(serverRecord: any, item: LocalSyncQueueItem): boolean {
  const updatedAt = serverRecord?.updatedAt || serverRecord?.updated_at;
  if (!updatedAt) return true; // can't prove the server is older; don't overwrite it
  return new Date(updatedAt).getTime() >= new Date(item.created_at).getTime();
}

const norm = (s: any) => String(s ?? '').trim().toLowerCase();

async function migrateLegacyQueueItems(): Promise<void> {
  const db = await getLocalDb();
  const items = await db.getAllAsync<LocalSyncQueueItem>(
    `SELECT * FROM sync_queue ORDER BY created_at ASC`
  );
  const legacy = items.filter(isLegacyItem);
  if (legacy.length === 0) return;

  const rewrite = (item: LocalSyncQueueItem, method: HttpMethod, endpoint: string, payload: any) =>
    db.runAsync(
      `UPDATE sync_queue SET action = ?, endpoint = ?, payload = ?, status = 'pending', attempts = 0 WHERE id = ?`,
      [method, endpoint, JSON.stringify(payload), item.id]
    );
  const drop = (item: LocalSyncQueueItem) => db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);

  // Fetched lazily, at most once. A network failure throws and aborts the
  // migration so legacy items are never replayed in their old form.
  let serverChildren: any[] | null = null;
  let serverChildAttendance: any[] | null = null;
  const claimedVisitorIds = new Set<string>();

  for (const item of legacy) {
    const payload = JSON.parse(item.payload || '{}');
    const action = item.action;

    if (action === 'member_create') {
      // Server accepts the client id, so an already-created member is a duplicate key → dropped on replay.
      await rewrite(item, 'POST', '/members', payload);
    } else if (action === 'member_update' || action === 'child_update') {
      const id = item.endpoint.split('/').pop() as string;
      const server = action === 'member_update'
        ? await api.members.getById(id)
        : await api.children.members.getById(id);
      if (!server || serverChangedAfter(server, item)) await drop(item);
      else await rewrite(item, 'PUT', item.endpoint, payload);
    } else if (action === 'child_create') {
      // Older backend ignored the client id, so match on identity instead.
      serverChildren ??= ((await api.children.members.getAll()) as any[]) || [];
      const exists = serverChildren.some(c =>
        norm(c.firstName) === norm(payload.firstName) &&
        norm(c.lastName) === norm(payload.lastName) &&
        norm(c.dateOfBirth).slice(0, 10) === norm(payload.dateOfBirth).slice(0, 10)
      );
      if (exists) await drop(item);
      else await rewrite(item, 'POST', '/children/members', payload);
    } else if (action === 'child_attendance_create') {
      serverChildAttendance ??= ((await api.children.attendance.getAll()) as any[]) || [];
      const exists = serverChildAttendance.some(r =>
        norm(r.date).slice(0, 10) === norm(payload.date).slice(0, 10) &&
        norm(r.serviceType) === norm(payload.serviceType)
      );
      if (exists) await drop(item);
      else await rewrite(item, 'POST', '/children/attendance', payload);
    } else if (action === 'child_visitor_create') {
      // The live call always failed (wrong payload shape), so replay with the correct shape.
      await rewrite(item, 'POST', '/children/visitors', toChildVisitorPayload(payload));
    } else if (action === 'child_giving_create') {
      await rewrite(item, 'POST', '/children/giving', toChildGivingPayload(payload));
    } else if (item.endpoint === '/attendance' && payload.service_type) {
      await rewrite(item, 'POST', '/attendance', toAttendancePayload(payload));
    } else if (item.endpoint === '/services' && typeof payload.days_of_week === 'string') {
      await rewrite(item, 'POST', '/services', toServicePayload(payload));
    } else if (!item.endpoint?.startsWith('/')) {
      // Visitor rows were queued without an endpoint or body. Recover the visitor
      // that was saved locally in the same moment and queue it properly.
      const queuedAt = new Date(item.created_at).getTime();
      const candidates = await db.getAllAsync<any>(
        `SELECT * FROM visitors WHERE created_at <= ? AND created_at >= ? ORDER BY created_at DESC`,
        [item.created_at, new Date(queuedAt - 60_000).toISOString()]
      );
      const visitor = candidates.find(v => !claimedVisitorIds.has(v.id));
      if (visitor) {
        claimedVisitorIds.add(visitor.id);
        let residence: string | undefined;
        try { residence = JSON.parse(visitor.raw_json || '{}').residence; } catch {}
        await rewrite(item, 'POST', '/visitors', toVisitorPayload({ ...visitor, residence }));
      } else {
        await drop(item);
      }
    } else {
      const method = /DELETE/i.test(action) ? 'DELETE' : /UPDATE|PUT/i.test(action) ? 'PUT' : 'POST';
      await rewrite(item, method, item.endpoint, payload);
    }
  }
}

// ============================================================================
// OUTBOX FLUSH
// ============================================================================

/**
 * Replays pending outbox mutations against the Edge Function REST API, oldest first.
 */
export async function flushSyncQueue(): Promise<{ processed: number; errors: number }> {
  if (isSyncing) return { processed: 0, errors: 0 };
  isSyncing = true;
  notifySyncQueueListeners();

  let processed = 0;
  let errors = 0;

  try {
    const db = await getLocalDb();

    // Items left in 'syncing' by an app kill mid-flush would otherwise be stuck forever.
    await db.runAsync(`UPDATE sync_queue SET status = 'pending' WHERE status = 'syncing'`);

    try {
      await migrateLegacyQueueItems();
    } catch (err) {
      console.warn('Legacy outbox migration deferred (server unreachable):', err);
      return { processed, errors };
    }

    const items = await db.getAllAsync<LocalSyncQueueItem>(
      `SELECT * FROM sync_queue
       WHERE status = 'pending' OR (status = 'error' AND COALESCE(attempts, 0) < ?)
       ORDER BY created_at ASC LIMIT 50`,
      [MAX_AUTO_ATTEMPTS]
    );

    for (const item of items) {
      await db.runAsync(`UPDATE sync_queue SET status = 'syncing' WHERE id = ?`, [item.id]);
      notifySyncQueueListeners();

      try {
        await fetchApi(item.endpoint, {
          method: item.action,
          body: item.action === 'DELETE' && item.payload === '{}' ? undefined : item.payload,
        });
        await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
        processed++;
      } catch (err) {
        if (isAlreadyAppliedError(err)) {
          await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
          processed++;
          continue;
        }

        // Non-retryable rejections stop auto-retrying immediately; they stay
        // visible in Sync Diagnostics with the server's message.
        const attempts = isRetryableError(err) ? (item.attempts || 0) + 1 : MAX_AUTO_ATTEMPTS;
        await db.runAsync(
          `UPDATE sync_queue SET status = 'error', attempts = ?, last_error = ? WHERE id = ?`,
          [attempts, errorMessage(err), item.id]
        );
        errors++;

        // Offline: leave the remaining items untouched (and in order) for the next flush.
        if (isNetworkError(err)) break;
      } finally {
        notifySyncQueueListeners();
      }
    }
  } catch (err) {
    console.warn('Failed executing flushSyncQueue:', err);
  } finally {
    isSyncing = false;
    notifySyncQueueListeners();
  }

  return { processed, errors };
}

// ============================================================================
// PULL SYNC (server → SQLite)
// ============================================================================

export async function syncMembers(): Promise<void> {
  try {
    const members = await api.members.getAll();
    if (!Array.isArray(members)) return;
    for (const m of members) {
      await upsertLocalMember({
        id: m.id,
        name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Member',
        phone: m.phone,
        email: m.email,
        role: Array.isArray(m.positionHeld) ? m.positionHeld[0] : m.positionHeld,
        zone: m.zone,
        zone_number: m.zoneNumber,
        ministry: Array.isArray(m.ministries) ? m.ministries[0] : undefined,
        photo_url: m.photoUrl || m.photo,
        status: m.status || 'active',
        raw_json: JSON.stringify({ ...m, photo: m.photo || m.photoUrl }),
        created_at: m.createdAt || new Date().toISOString(),
      });
    }
    await pruneLocalTable('members', members.map((m: any) => m.id));
  } catch (err) {
    console.warn('Failed to sync members:', err);
  }
}

export async function syncVisitors(): Promise<void> {
  try {
    const visitors = await api.visitors.getAll();
    if (!Array.isArray(visitors)) return;
    for (const v of visitors) {
      await upsertLocalVisitor({
        id: v.id,
        name: `${v.firstName || ''} ${v.lastName || ''}`.trim() || 'Visitor',
        phone: v.phone,
        email: v.email,
        visit_date: v.visitDate || (v.createdAt || new Date().toISOString()).split('T')[0],
        potential_zone: v.potentialZone,
        follow_up_status: v.followUpStatus || 'pending',
        notes: v.notes,
        raw_json: JSON.stringify({ ...v, residence: v.residenceLocation }),
        created_at: v.createdAt || new Date().toISOString(),
      });
    }
    await pruneLocalTable('visitors', visitors.map((v: any) => v.id));
  } catch (err) {
    console.warn('Failed to sync visitors:', err);
  }
}

export async function syncChildren(): Promise<void> {
  try {
    const children = await api.children.members.getAll();
    if (Array.isArray(children)) {
      for (const c of children) {
        const firstParent = Array.isArray(c.parents) ? c.parents[0] : undefined;
        await upsertLocalChild({
          id: c.id,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Child Member',
          first_name: c.firstName,
          last_name: c.lastName,
          other_names: c.otherNames,
          date_of_birth: c.dateOfBirth || '',
          gender: c.gender,
          zone: c.zone,
          status: c.status || 'active',
          guardian_name: firstParent ? `${firstParent.firstName || ''} ${firstParent.lastName || ''}`.trim() : undefined,
          guardian_phone: firstParent?.phone,
          raw_json: JSON.stringify(c),
          created_at: c.createdAt || new Date().toISOString(),
        });
      }
      await pruneLocalTable('children_members', children.map((c: any) => c.id));
    }
  } catch (err) {
    console.warn('Failed to sync children members:', err);
  }

  try {
    const visitors = await api.children.visitors.getAll();
    if (Array.isArray(visitors)) {
      for (const v of visitors) {
        const guardian = Array.isArray(v.guardians) ? v.guardians[0] : undefined;
        await upsertLocalChildVisitor({
          id: v.id,
          first_name: v.firstName,
          last_name: v.lastName,
          gender: v.gender,
          date_of_birth: v.dateOfBirth,
          visit_date: v.visitDate || (v.createdAt || new Date().toISOString()).split('T')[0],
          notes: v.notes,
          guardian_name: guardian?.fullName,
          guardian_phone: guardian?.contactInfo || v.contactPhone,
          raw_json: JSON.stringify(v),
          created_at: v.createdAt || new Date().toISOString(),
        });
      }
      await pruneLocalTable('children_visitors', visitors.map((v: any) => v.id));
    }
  } catch (err) {
    console.warn('Failed to sync children visitors:', err);
  }
}

export async function syncCustomServices(): Promise<void> {
  try {
    const svcs = await api.services.getAll();
    if (Array.isArray(svcs)) {
      for (const s of svcs) {
        await upsertLocalCustomService(s);
      }
      await pruneLocalTable('custom_services', svcs.map((s: any) => s.id));
    }
  } catch (err) {
    console.warn('Failed to sync custom services:', err);
  }
}

export async function syncAttendanceRecords(): Promise<void> {
  try {
    const recs = await api.attendance.getAll();
    if (Array.isArray(recs)) {
      for (const r of recs) {
        await upsertLocalAttendanceRecord({
          id: r.id,
          date: r.date,
          service_type: r.serviceType || r.service_type,
          start_time: r.startTime || r.start_time,
          end_time: r.endTime || r.end_time,
          total_count: r.totalCount || r.total_count || 0,
          is_custom_service: r.isCustomService ? 1 : 0,
          status: r.status || 'finalized',
          attendance_type: r.attendanceType || r.attendance_type || 'individual',
          men_count: r.menCount || r.men_count || 0,
          women_count: r.womenCount || r.women_count || 0,
          children_count: r.childrenCount || r.children_count || 0,
          visitors_count: r.visitorsCount || r.visitors_count || 0,
          created_by: r.createdBy || r.created_by,
          created_at: r.createdAt || r.created_at || new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn('Failed to sync attendance records:', err);
  }
}

export async function syncGivingRecords(): Promise<void> {
  try {
    const recs = await api.giving.getAll();
    if (Array.isArray(recs)) {
      for (const r of recs) {
        await upsertLocalGivingRecord(r);
      }
      await pruneLocalTable('giving_records', recs.map((r: any) => r.id));
    }
  } catch (err) {
    console.warn('Failed to sync giving records:', err);
  }
}

export async function syncCustomGivingTypes(): Promise<void> {
  try {
    const types = await api.giving.types.getAll();
    if (Array.isArray(types)) {
      for (const t of types) {
        await upsertLocalCustomGivingType(t);
      }
      await pruneLocalTable('custom_giving_types', types.map((t: any) => t.id));
    }
  } catch (err) {
    console.warn('Failed to sync custom giving types:', err);
  }
}

export async function syncExpenses(): Promise<void> {
  try {
    const exps = await api.expenses.getAll();
    if (Array.isArray(exps)) {
      for (const e of exps) {
        await upsertLocalExpense(e);
      }
      await pruneLocalTable('expenses', exps.map((e: any) => e.id));
    }
  } catch (err) {
    console.warn('Failed to sync expenses:', err);
  }
}

export async function syncExpensePaymentMethods(): Promise<void> {
  try {
    const pms = await api.expenses.paymentMethods.getAll();
    if (Array.isArray(pms)) {
      for (const p of pms) {
        await upsertLocalExpensePaymentMethod(p);
      }
      await pruneLocalTable('expense_payment_methods', pms.map((p: any) => p.id));
    }
  } catch (err) {
    console.warn('Failed to sync expense payment methods:', err);
  }
}

export async function syncActivityLogs(): Promise<void> {
  try {
    const logs = await api.activityLog.getAll();
    if (Array.isArray(logs)) {
      for (const log of logs) {
        await upsertLocalActivityLog({
          id: log.id,
          user_id: log.userId || log.user_id,
          user_name: log.userName || log.user_name || 'System User',
          user_role: log.userRole || log.user_role || 'user',
          action: log.action,
          entity_type: log.entityType || log.entity_type || 'general',
          description: log.description || log.details || '',
          details: log.details,
          created_at: log.createdAt || log.created_at || new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.warn('Failed to sync activity logs:', err);
  }
}

/**
 * Pulls down latest changes from Supabase to keep SQLite up to date.
 */
export async function syncAllMetadata(): Promise<void> {
  await Promise.all([
    syncDropdownOptions(),
    syncChurchZones(),
    syncMembers(),
    syncVisitors(),
    syncChildren(),
    syncCustomServices(),
    syncAttendanceRecords(),
    syncGivingRecords(),
    syncCustomGivingTypes(),
    syncExpenses(),
    syncExpensePaymentMethods(),
    syncActivityLogs(),
  ]);
}

/**
 * Push local mutations first, then pull. Pulling first would prune rows the
 * server hasn't received yet and pull stale data over local edits.
 */
export async function syncEverything(): Promise<void> {
  await flushSyncQueue();
  await syncAllMetadata();
}
