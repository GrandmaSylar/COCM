// Export Supabase utilities
export { supabase } from './utils/supabase/client';
export type { Database } from './utils/supabase/client';

// Export API Client utilities
export { fetchApi, invalidateApiCache, ApiError, OfflineDeleteError, getDeviceId } from './services/apiClient';

// Export Offline Store utilities
export { 
  getDb, 
  isCoreEndpoint, 
  isAllowlistedOfflineEndpoint, 
  writeCacheSnapshot, 
  readCacheSnapshot, 
  invalidateModuleCache, 
  addToSyncQueue, 
  getAllPendingQueueEntries, 
  updateQueueEntryStatus, 
  removeQueueEntry, 
  addConflict, 
  removeConflict, 
  getConflicts, 
  getPendingQueueCount, 
  applyOptimisticWrite 
} from './services/offlineStore';
export type { CacheEntry, SyncQueueEntry, ConflictEntry } from './services/offlineStore';

// Export Sync Engine utilities
export { startSync, initSyncEngine, retrySyncNow } from './services/syncEngine';
