import { supabase } from '../utils/supabase/client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const BASE_URL = `${supabaseUrl}/functions/v1/server`;

export class ApiError extends Error {
  failedTable?: string;
  results?: any;
  errorObj?: any;

  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Generate or retrieve a persistent Device ID for tracking active sessions
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown'; // Server-side rendering fallback
  const DEVICE_ID_KEY = 'cocm_device_id';
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || publicAnonKey;
}

// In-flight request deduplication: prevents duplicate simultaneous GET requests
const inflightRequests = new Map<string, Promise<any>>();

// Short-lived GET cache (30 seconds) to avoid re-fetching on rapid navigation
const getCache = new Map<string, { data: any; timestamp: number }>();
const GET_CACHE_TTL = 60_000; // 60 seconds

function getCacheKey(endpoint: string): string {
  return endpoint;
}

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = getCacheKey(endpoint);

  // For GET requests, check short-lived cache
  if (isGet && !isRetry) {
    const cached = getCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < GET_CACHE_TTL) {
      return cached.data as T;
    }

    // Deduplicate in-flight GET requests
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    const token = await getAccessToken();

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const isPublicAuthRoute = endpoint.startsWith('/auth/signin') || 
                                endpoint.startsWith('/auth/signup') || 
                                endpoint.startsWith('/auth/forgot-password') || 
                                endpoint.startsWith('/auth/reset-password') || 
                                endpoint.startsWith('/auth/verify-reset-otp') ||
                                endpoint.startsWith('/auth/heartbeat');

      if (response.status === 401 && !isRetry && !isPublicAuthRoute) {
        // Only attempt refresh if we actually had a user session
        if (token !== publicAnonKey) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData.session) {
            await supabase.auth.signOut();
            window.location.href = '/';
            throw new ApiError(401, 'Session expired. Please log in again.');
          }
          return fetchApi<T>(endpoint, options, true);
        }
      }

      let errorMessage = `Request failed: ${response.statusText}`;
      let errorData: any = null;
      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use status text
      }
      
      const apiError = new ApiError(response.status, errorMessage);
      if (errorData) {
        apiError.errorObj = errorData;
        if (errorData.failedTable) apiError.failedTable = errorData.failedTable;
        if (errorData.results) apiError.results = errorData.results;
      }
      throw apiError;
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      const parsed = JSON.parse(text);
      // Cache successful GET responses
      if (isGet) {
        getCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
      }
      return parsed;
    } catch {
      return text as any;
    }
  })();

  // Track in-flight GET requests for dedup
  if (isGet && !isRetry) {
    inflightRequests.set(cacheKey, requestPromise);
    requestPromise.finally(() => inflightRequests.delete(cacheKey));
  }

  // Mutating requests invalidate related cache entries
  if (!isGet && !isRetry) {
    // Extract the resource path (e.g., /members from /members/123)
    const resourcePath = endpoint.split('/').slice(0, 2).join('/');
    for (const key of getCache.keys()) {
      if (key.startsWith(resourcePath)) {
        getCache.delete(key);
      }
    }
  }

  return requestPromise;
}

// Allow manual cache invalidation from components
export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    getCache.clear();
    return;
  }
  for (const key of getCache.keys()) {
    if (key.includes(pattern)) {
      getCache.delete(key);
    }
  }
}
