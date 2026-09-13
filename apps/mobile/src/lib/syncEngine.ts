import { 
  getLocalDb, 
  LocalSyncQueueItem, 
  upsertLocalCustomService, 
  upsertLocalAttendanceRecord,
  upsertLocalGivingRecord,
  upsertLocalCustomGivingType,
  upsertLocalExpense,
  upsertLocalExpensePaymentMethod,
  upsertLocalActivityLog
} from './db';
import { supabase } from './supabase';
import { syncDropdownOptions, syncChurchZones } from './options';
import { generateUUID } from './uuid';
import { api } from './api';

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

export interface SyncTaskParams {
  operation?: string;
  action?: string;
  table_name?: string;
  endpoint?: string;
  method?: string;
  data?: any;
  payload?: any;
}

export async function enqueueSyncTask(
  methodOrParams: string | SyncTaskParams,
  endpoint?: string,
  data?: any
): Promise<void> {
  try {
    const db = await getLocalDb();
    const id = generateUUID();
    let method = 'POST';
    let url = endpoint || '';
    let payloadStr = '{}';

    if (typeof methodOrParams === 'object') {
      method = methodOrParams.method || methodOrParams.action || 'POST';
      url = methodOrParams.endpoint || url;
      payloadStr = JSON.stringify(methodOrParams.data || {});
    } else {
      method = methodOrParams;
      payloadStr = JSON.stringify(data || {});
    }

    await db.runAsync(
      `INSERT INTO sync_queue (id, action, endpoint, payload, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [id, method.toUpperCase(), url, payloadStr, new Date().toISOString()]
    );
    notifySyncQueueListeners();
  } catch (err) {
    console.error('Failed to enqueue sync task:', err);
  }
}

/**
 * Flushes all pending outbox queue mutations from SQLite to the backend.
 */
export async function flushSyncQueue(): Promise<{ processed: number; errors: number }> {
  if (isSyncing) return { processed: 0, errors: 0 };
  isSyncing = true;
  notifySyncQueueListeners();

  let processed = 0;
  let errors = 0;

  try {
    const db = await getLocalDb();
    const items = await db.getAllAsync<LocalSyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status != 'syncing' ORDER BY created_at ASC LIMIT 50`
    );

    for (const item of items) {
      await db.runAsync(`UPDATE sync_queue SET status = 'syncing' WHERE id = ?`, [item.id]);

      try {
        const payload = JSON.parse(item.payload || '{}');
        let error: any = null;

        if (item.action === 'POST' || item.action === 'PUT' || item.action === 'PATCH') {
          try {
            const res = await supabase.rpc('handle_sync_task', {
              endpoint: item.endpoint,
              method: item.action,
              body: payload
            });
            if (res && res.error) error = res.error;
          } catch (e) { error = e; }
        } else if (item.action === 'DELETE') {
          try {
            const res = await supabase.rpc('handle_sync_task', {
              endpoint: item.endpoint,
              method: 'DELETE',
              body: payload
            });
            if (res && res.error) error = res.error;
          } catch (e) { error = e; }
        }

        if (!error) {
          await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
          processed++;
        } else {
          await db.runAsync(`UPDATE sync_queue SET status = 'error' WHERE id = ?`, [item.id]);
          errors++;
        }
      } catch (err) {
        console.error('Error processing sync item:', item.id, err);
        await db.runAsync(`UPDATE sync_queue SET status = 'error' WHERE id = ?`, [item.id]);
        errors++;
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

export async function syncCustomServices(): Promise<void> {
  try {
    const svcs = await api.services.getAll();
    if (Array.isArray(svcs)) {
      const db = await getLocalDb();
      const serverIds = svcs.map((s: any) => s.id).filter(Boolean);
      if (serverIds.length > 0) {
        const placeholders = serverIds.map(() => '?').join(',');
        await db.runAsync(`DELETE FROM custom_services WHERE id NOT IN (${placeholders})`, serverIds);
      } else {
        await db.runAsync(`DELETE FROM custom_services`);
      }
      for (const s of svcs) {
        await upsertLocalCustomService(s);
      }
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
      const db = await getLocalDb();
      const serverIds = recs.map((r: any) => r.id).filter(Boolean);
      if (serverIds.length > 0) {
        const placeholders = serverIds.map(() => '?').join(',');
        await db.runAsync(`DELETE FROM giving_records WHERE id NOT IN (${placeholders})`, serverIds);
      } else {
        await db.runAsync(`DELETE FROM giving_records`);
      }
      for (const r of recs) {
        await upsertLocalGivingRecord(r);
      }
    }
  } catch (err) {
    console.warn('Failed to sync giving records:', err);
  }
}

export async function syncCustomGivingTypes(): Promise<void> {
  try {
    const types = await api.giving.types.getAll();
    if (Array.isArray(types)) {
      const db = await getLocalDb();
      const serverIds = types.map((t: any) => t.id).filter(Boolean);
      if (serverIds.length > 0) {
        const placeholders = serverIds.map(() => '?').join(',');
        await db.runAsync(`DELETE FROM custom_giving_types WHERE id NOT IN (${placeholders})`, serverIds);
      } else {
        await db.runAsync(`DELETE FROM custom_giving_types`);
      }
      for (const t of types) {
        await upsertLocalCustomGivingType(t);
      }
    }
  } catch (err) {
    console.warn('Failed to sync custom giving types:', err);
  }
}

export async function syncExpenses(): Promise<void> {
  try {
    const exps = await api.expenses.getAll();
    if (Array.isArray(exps)) {
      const db = await getLocalDb();
      const serverIds = exps.map((e: any) => e.id).filter(Boolean);
      if (serverIds.length > 0) {
        const placeholders = serverIds.map(() => '?').join(',');
        await db.runAsync(`DELETE FROM expenses WHERE id NOT IN (${placeholders})`, serverIds);
      } else {
        await db.runAsync(`DELETE FROM expenses`);
      }
      for (const e of exps) {
        await upsertLocalExpense(e);
      }
    }
  } catch (err) {
    console.warn('Failed to sync expenses:', err);
  }
}

export async function syncExpensePaymentMethods(): Promise<void> {
  try {
    const pms = await api.expenses.paymentMethods.getAll();
    if (Array.isArray(pms)) {
      const db = await getLocalDb();
      const serverIds = pms.map((p: any) => p.id).filter(Boolean);
      if (serverIds.length > 0) {
        const placeholders = serverIds.map(() => '?').join(',');
        await db.runAsync(`DELETE FROM expense_payment_methods WHERE id NOT IN (${placeholders})`, serverIds);
      } else {
        await db.runAsync(`DELETE FROM expense_payment_methods`);
      }
      for (const p of pms) {
        await upsertLocalExpensePaymentMethod(p);
      }
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
    syncCustomServices(),
    syncAttendanceRecords(),
    syncGivingRecords(),
    syncCustomGivingTypes(),
    syncExpenses(),
    syncExpensePaymentMethods(),
    syncActivityLogs(),
  ]);
}

