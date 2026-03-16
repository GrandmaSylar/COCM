import { openDB, type IDBPDatabase } from 'idb';

// ── Types ──────────────────────────────────────────────────────────────

export interface CacheEntry {
  endpoint: string;
  data: unknown;
  timestamp: number;
}

export interface SyncQueueEntry {
  id?: number;
  module: string;
  method: string;
  endpoint: string;
  payload: unknown;
  timestamp: number;
  status: 'pending' | 'in-progress' | 'failed';
}

export interface ConflictEntry {
  id?: number;
  module: string;
  endpoint: string;
  recordId?: string | number;
  localPayload: unknown;
  serverPayload: unknown;
  timestamp: number;
}

// ── Constants ──────────────────────────────────────────────────────────

const DB_NAME = 'cocm-offline';
const DB_VERSION = 2;

const CORE_PREFIXES = ['/members', '/attendance', '/giving', '/expenses'];

// ── Database singleton ─────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Remove v1 per-module stores if upgrading from v1
        if (oldVersion < 2) {
          for (const name of [
            'members_cache',
            'attendance_cache',
            'giving_cache',
            'expenses_cache',
          ]) {
            if (db.objectStoreNames.contains(name)) {
              db.deleteObjectStore(name);
            }
          }
        }

        // Endpoint-keyed cache store (v2)
        if (!db.objectStoreNames.contains('api_cache')) {
          db.createObjectStore('api_cache', { keyPath: 'endpoint' });
        }

        // Sync queue for pending writes
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }

        // Conflicts store
        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      },
    });
  }
  return dbPromise;
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Returns `true` if the endpoint belongs to a core module that should be
 * cached for offline use.
 */
export function isCoreEndpoint(endpoint: string): boolean {
  return CORE_PREFIXES.some((prefix) => endpoint.startsWith(prefix));
}

/**
 * Returns `true` if the endpoint is a core record endpoint allowed for
 * optimistic offline writes (e.g. /expenses or /expenses/123, NOT /expenses/payment-methods).
 */
export function isAllowlistedOfflineEndpoint(endpoint: string): boolean {
  const parts = endpoint.split('/');
  if (parts.length < 2) return false;
  
  const prefix = '/' + parts[1];
  if (!CORE_PREFIXES.includes(prefix)) return false;
  
  if (parts.length === 2) return true; // e.g. /expenses
  if (parts.length === 3) {
    const forbiddenSubPaths = ['payment-methods', 'types', 'bulk', 'import', 'export'];
    if (forbiddenSubPaths.includes(parts[2])) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Stores the full API response as a single snapshot keyed by the exact
 * endpoint string.  Overwrites any previous snapshot for this endpoint
 * (atomic snapshot replacement — no stale residue).
 */
export async function writeCacheSnapshot(
  endpoint: string,
  data: unknown,
): Promise<void> {
  const db = await getDb();
  const entry: CacheEntry = { endpoint, data, timestamp: Date.now() };
  await db.put('api_cache', entry);
}

/**
 * Reads the cached response for an exact endpoint key.
 * Returns `undefined` if nothing is cached for this endpoint.
 */
export async function readCacheSnapshot(
  endpoint: string,
): Promise<unknown | undefined> {
  const db = await getDb();
  const entry: CacheEntry | undefined = await db.get('api_cache', endpoint);
  return entry?.data;
}

/**
 * Deletes all cached snapshots whose endpoint starts with the same
 * module prefix as the given endpoint (e.g. a mutation on `/members/123`
 * clears `/members`, `/members/123`, `/members?search=foo`, etc.).
 */
export async function invalidateModuleCache(
  endpoint: string,
): Promise<void> {
  const modulePrefix = '/' + endpoint.split('/')[1]; // e.g. "/members"
  const db = await getDb();
  const tx = db.transaction('api_cache', 'readwrite');
  const store = tx.objectStore('api_cache');
  let cursor = await store.openCursor();
  while (cursor) {
    if ((cursor.value as CacheEntry).endpoint.startsWith(modulePrefix)) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Appends a pending write operation to the sync queue.
 */
export async function addToSyncQueue(
  entry: Omit<SyncQueueEntry, 'id'>,
): Promise<void> {
  const db = await getDb();
  await db.add('sync_queue', entry);
}

/**
 * Returns all pending entries in the sync queue, ordered by timestamp ascending.
 */
export async function getAllPendingQueueEntries(): Promise<SyncQueueEntry[]> {
  const db = await getDb();
  const tx = db.transaction('sync_queue', 'readonly');
  const store = tx.objectStore('sync_queue');
  const entries: SyncQueueEntry[] = [];
  let cursor = await store.openCursor();
  while (cursor) {
    if (cursor.value.status === 'pending') {
      entries.push(cursor.value);
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Updates a single entry's status field in-place.
 */
export async function updateQueueEntryStatus(id: number, status: SyncQueueEntry['status']): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('sync_queue', 'readwrite');
  const store = tx.objectStore('sync_queue');
  const entry = await store.get(id);
  if (entry) {
    entry.status = status;
    await store.put(entry);
  }
  await tx.done;
}

/**
 * Deletes a single entry from the sync queue.
 */
export async function removeQueueEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('sync_queue', id);
}

/**
 * Writes a new conflict to the conflicts store.
 */
export async function addConflict(entry: Omit<ConflictEntry, 'id'>): Promise<void> {
  const db = await getDb();
  await db.add('conflicts', entry);
}

/**
 * Deletes a single conflict from the conflicts store.
 */
export async function removeConflict(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('conflicts', id);
}

/**
 * Returns all unresolved conflict entries.
 */
export async function getConflicts(): Promise<ConflictEntry[]> {
  const db = await getDb();
  return db.getAll('conflicts') as Promise<ConflictEntry[]>;
}

/**
 * Returns the count of pending write operations in the sync queue.
 */
export async function getPendingQueueCount(): Promise<number> {
  const db = await getDb();
  const tx = db.transaction('sync_queue', 'readonly');
  const store = tx.objectStore('sync_queue');
  let count = 0;
  let cursor = await store.openCursor();
  while (cursor) {
    if (cursor.value.status === 'pending') {
      count++;
    }
    cursor = await cursor.continue();
  }
  await tx.done;
  return count;
}

/**
 * Optimistically updates the local cached array for a list endpoint.
 */
export async function applyOptimisticWrite(
  endpoint: string,
  method: 'POST' | 'PUT',
  payload: unknown
): Promise<void> {
  const modulePrefix = '/' + endpoint.split('/')[1]; // e.g. "/members"
  const cachedData = await readCacheSnapshot(modulePrefix);
  
  if (Array.isArray(cachedData)) {
    const defaultPayload = payload as any;
    if (method === 'PUT') {
      // Endpoint Example: /members/123 -> id = 123
      const parts = endpoint.split('/');
      const targetId = parts[parts.length - 1];
      const index = cachedData.findIndex((item: any) => String(item.id) === targetId);
      if (index !== -1) {
        cachedData[index] = { ...cachedData[index], ...defaultPayload };
      }
    } else if (method === 'POST') {
      if (!defaultPayload.id) {
        defaultPayload.id = 'offline-' + Date.now();
      }
      cachedData.push(defaultPayload);
    }
    await writeCacheSnapshot(modulePrefix, cachedData);
  }
}
