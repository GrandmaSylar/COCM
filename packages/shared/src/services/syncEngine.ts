import { fetchApi, ApiError, invalidateApiCache } from './apiClient';
import { 
  getAllPendingQueueEntries, 
  updateQueueEntryStatus, 
  removeQueueEntry, 
  addConflict,
  SyncQueueEntry 
} from './offlineStore';
import { toast } from 'sonner';

let isSyncing = false;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dispatchSyncState(
  state: 'syncing' | 'conflicts' | 'fix-retry' | 'success',
  conflictCount?: number,
  failureReason?: string
) {
  window.dispatchEvent(
    new CustomEvent('sync-state', {
      detail: { state, conflictCount, failureReason },
    })
  );
}

export async function startSync() {
  if (isSyncing) return;
  isSyncing = true;
  dispatchSyncState('syncing');

  try {
    const entries = await getAllPendingQueueEntries();
    if (entries.length === 0) {
      dispatchSyncState('success');
      toast.success('✓ All changes synced successfully.');
      isSyncing = false;
      return;
    }

    const pausedModules = new Set<string>();
    let hasConflicts = false;

    // Process globally sorted entries one by one
    for (const entry of entries) {
      if (pausedModules.has(entry.module)) {
        continue; 
      }

      let retries = 0;
      let success = false;

      while (retries <= MAX_RETRIES && !success) {
        try {
          await fetchApi(entry.endpoint, {
            method: entry.method,
            body: JSON.stringify(entry.payload),
          });
          
          if (entry.id) {
            await removeQueueEntry(entry.id);
          }
          invalidateApiCache('/' + entry.module);
          success = true;
        } catch (error: any) {
          const isApiError = error instanceof ApiError;
          const status = isApiError ? error.status : 0;
          const isConflict = status === 409 || status === 404;

          if (isConflict) {
            let serverPayload = isApiError && error.errorObj ? error.errorObj : {};
            if (status === 404 || serverPayload.deleted) {
              serverPayload = { deleted: true };
            }

            // Extract recordId from endpoint for stable identification
            const endpointParts = entry.endpoint.split('/');
            const recordId = endpointParts.length > 2 ? endpointParts[2] : undefined;

            if (entry.id) {
              await addConflict({
                module: entry.module,
                endpoint: entry.endpoint,
                recordId,
                localPayload: entry.payload,
                serverPayload,
                timestamp: Date.now()
              });
              await updateQueueEntryStatus(entry.id, 'failed');
            }
            pausedModules.add(entry.module);
            hasConflicts = true;
            break; 
          } else {
            if (retries < MAX_RETRIES) {
              retries++;
              await sleep(1000 * Math.pow(2, retries));
            } else {
              // Non-conflict failure exhausts retries -> keep pending
              dispatchSyncState('fix-retry', undefined, error.message || 'Unknown network error');
              isSyncing = false;
              return; 
            }
          }
        }
      }
    }

    if (hasConflicts) {
      dispatchSyncState('conflicts');
    } else {
      if (pausedModules.size === 0) {
        dispatchSyncState('success');
        toast.success('✓ All changes synced successfully.');
      }
    }
  } catch (err: any) {
    console.error('Sync engine error:', err);
    dispatchSyncState('fix-retry', undefined, err.message);
  } finally {
    isSyncing = false;
  }
}

export function initSyncEngine() {
  window.addEventListener('online', () => {
    startSync();
  });
}

export function retrySyncNow() {
  startSync();
}
