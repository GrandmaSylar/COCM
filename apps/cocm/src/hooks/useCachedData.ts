import { useEffect, useRef, useState, useCallback } from 'react';
import { invalidateApiCache } from '../services/api';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const dataCache = new Map<string, CacheEntry<any>>();

export interface UseCachedDataOptions {
  duration?: number; // Cache duration in milliseconds (default: 5 minutes)
  refetch?: boolean; // Force refetch even if cached
}

export function useCachedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: UseCachedDataOptions = {}
) {
  const [data, setData] = useState<T | null>(() => {
    // Initialize from cache synchronously to avoid flash
    const cached = dataCache.get(cacheKey);
    const cacheDuration = options.duration ?? 5 * 60 * 1000;
    if (cached && !options.refetch && Date.now() - cached.timestamp < cacheDuration) {
      return cached.data;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = dataCache.get(cacheKey);
    const cacheDuration = options.duration ?? 5 * 60 * 1000;
    return !(cached && !options.refetch && Date.now() - cached.timestamp < cacheDuration);
  });
  const [error, setError] = useState<Error | null>(null);
  const isFetching = useRef(false);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const cacheDuration = options.duration ?? 5 * 60 * 1000; // Default 5 minutes

  useEffect(() => {
    const cached = dataCache.get(cacheKey);
    const now = Date.now();

    // Return cached data if valid and not forcing refetch
    if (cached && !options.refetch && now - cached.timestamp < cacheDuration) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetching.current) return;

    isFetching.current = true;
    setLoading(true);
    setError(null);

    fetchFnRef.current()
      .then(result => {
        dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
        setData(result);
      })
      .catch(err => {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
      })
      .finally(() => {
        isFetching.current = false;
        setLoading(false);
      });
  // Only re-run when cacheKey or refetch changes, not fetchFn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, options.refetch, cacheDuration]);

  const refresh = useCallback(async () => {
    // Clear both local cache and API cache to force fresh data
    dataCache.delete(cacheKey);
    invalidateApiCache();

    isFetching.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFnRef.current();
      dataCache.set(cacheKey, { data: result, timestamp: Date.now() });
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  }, [cacheKey]);

  const clearCache = useCallback(() => {
    dataCache.delete(cacheKey);
  }, [cacheKey]);

  return { data, loading, error, refresh, clearCache };
}



export function clearAllCache() {
  dataCache.clear();
}

export function clearCacheByPattern(pattern: string) {
  const regex = new RegExp(pattern.replace('*', '.*'));
  for (const key of dataCache.keys()) {
    if (regex.test(key)) {
      dataCache.delete(key);
    }
  }
}

export function getCacheStats() {
  const stats = {
    totalEntries: dataCache.size,
    entries: Array.from(dataCache.entries()).map(([key, entry]) => ({
      key,
      age: Date.now() - entry.timestamp,
      size: JSON.stringify(entry.data).length
    }))
  };
  return stats;
}
