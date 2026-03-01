import { supabase } from '../utils/supabase/client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const BASE_URL = `${supabaseUrl}/functions/v1/server`;

export class ApiError extends Error {
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

function normalizeImageContentType(file: File): string {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return file.type;
  }
  return 'image/jpeg';
}

async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
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
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use status text
      }
      throw new ApiError(response.status, errorMessage);
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

export const api = {
  // ============================================================================
  // AUTH
  // ============================================================================
  
  auth: {
    signUp: (data: { email: string; password: string; name: string; role: string; phone?: string }) =>
      fetchApi('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    
    signIn: (identifier: string, password: string) =>
      fetchApi('/auth/signin', { method: 'POST', body: JSON.stringify({ identifier, password, deviceId: getDeviceId() }) }),
    
    signOut: () =>
      fetchApi('/auth/signout', { method: 'POST' }),

    heartbeat: () =>
      fetchApi('/auth/heartbeat', { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId() }) }),

    getSession: () =>
      fetchApi('/auth/session'),

    sendOtp: (data: { userId: string; tempToken: string; method: string }) =>
      fetchApi('/auth/send-otp', { method: 'POST', body: JSON.stringify(data) }),

    verifyOtp: (data: { userId: string; tempToken: string; code: string }) =>
      fetchApi('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ ...data, deviceId: getDeviceId() }) }),

    resendOtp: (data: { userId: string; tempToken: string }) =>
      fetchApi('/auth/resend-otp', { method: 'POST', body: JSON.stringify(data) }),

    update2FAPreference: (method: 'none' | 'email' | 'phone') =>
      fetchApi('/auth/2fa-preference', { method: 'PATCH', body: JSON.stringify({ method }) }),

    forgotPassword: (identifier: string, method: 'email' | 'phone') =>
      fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier, method }) }),

    verifyResetOtp: (data: { userId: string; tempToken: string; code: string }) =>
      fetchApi('/auth/verify-reset-otp', { method: 'POST', body: JSON.stringify(data) }),

    resetPassword: (data: { userId: string; resetToken: string; newPassword: string }) =>
      fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ============================================================================
  // MEMBERS
  // ============================================================================
  
  members: {
    getAll: () => fetchApi('/members'),
    
    getById: (id: string) => fetchApi(`/members/${id}`),
    
    create: (data: any) => fetchApi('/members', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    update: (id: string, data: any) => fetchApi(`/members/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    delete: (id: string) => fetchApi(`/members/${id}`, { method: 'DELETE' }),

    getAnalytics: (id: string) => fetchApi(`/members/${id}/analytics`),

    getAttendanceHistory: (id: string, from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      return fetchApi(`/members/${id}/attendance-history${qs ? '?' + qs : ''}`);
    },

    setSabbatical: (id: string, data: { startDate: string; endDate?: string; reason?: string }) =>
      fetchApi(`/members/${id}/sabbatical`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),

    endSabbatical: (id: string) => fetchApi(`/members/${id}/sabbatical`, { method: 'DELETE' }),

    uploadPhoto: async (memberId: string, file: File) => {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${memberId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const contentType = normalizeImageContentType(file);

      const { error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file, { contentType, upsert: true });

      if (uploadError) {
        throw new Error('Failed to upload photo');
      }

      const { data } = supabase.storage
        .from('member-photos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    },
  },

  // ============================================================================
  // ATTENDANCE
  // ============================================================================
  
  attendance: {
    getAll: () => fetchApi('/attendance'),
    
    getById: (id: string) => fetchApi(`/attendance/${id}`),
    
    create: (data: any) => fetchApi('/attendance', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    update: (id: string, data: any) => fetchApi(`/attendance/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    delete: (id: string) => fetchApi(`/attendance/${id}`, { method: 'DELETE' }),

    getEditStatus: (id: string) => fetchApi(`/attendance/${id}/edit-status`),

    getAbsentees: (id: string) => fetchApi(`/attendance/${id}/absentees`),

    saveAbsentees: (id: string, data: any[]) => fetchApi(`/attendance/${id}/absentees`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    updateAbsentee: (id: string, memberId: string, data: any) => fetchApi(`/attendance/${id}/absentees/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  },

  // ============================================================================
  // SERVICES
  // ============================================================================
  
  services: {
    getAll: () => fetchApi('/services'),
    
    create: (data: any) => fetchApi('/services', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    update: (id: string, data: any) => fetchApi(`/services/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    delete: (id: string) => fetchApi(`/services/${id}`, { method: 'DELETE' }),
  },

  // ============================================================================
  // GIVING
  // ============================================================================
  
  giving: {
    getAll: () => fetchApi('/giving'),
    
    getById: (id: string) => fetchApi(`/giving/${id}`),
    
    create: (data: any) => fetchApi('/giving', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    update: (id: string, data: any) => fetchApi(`/giving/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    delete: (id: string) => fetchApi(`/giving/${id}`, { method: 'DELETE' }),

    getEditStatus: (id: string) => fetchApi(`/giving/${id}/edit-status`),

    types: {
      getAll: () => fetchApi('/giving/types'),

      create: (data: any) => fetchApi('/giving/types', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

      update: (id: string, data: any) => fetchApi(`/giving/types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),

      delete: (id: string) => fetchApi(`/giving/types/${id}`, { method: 'DELETE' }),

      toggle: (id: string) => fetchApi(`/giving/types/${id}/toggle`, { method: 'PATCH' }),
    },
  },

  // ============================================================================
  // VISITORS
  // ============================================================================
  
  visitors: {
    getAll: () => fetchApi('/visitors'),
    
    getById: (id: string) => fetchApi(`/visitors/${id}`),
    
    create: (data: any) => fetchApi('/visitors', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    
    update: (id: string, data: any) => fetchApi(`/visitors/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    
    delete: (id: string) => fetchApi(`/visitors/${id}`, { method: 'DELETE' }),
    
    convert: (id: string, memberData: any) => fetchApi(`/visitors/${id}/convert`, { 
      method: 'POST', 
      body: JSON.stringify(memberData) 
    }),
  },

  // ============================================================================
  // PERMISSIONS
  // ============================================================================
  
  permissions: {
    grant: (data: { userId: string; permission: string; durationHours: number }) =>
      fetchApi('/permissions/grant', { 
        method: 'POST', 
        body: JSON.stringify(data) 
      }),
    
    revoke: (data: { userId: string; permission: string }) =>
      fetchApi('/permissions/revoke', { 
        method: 'POST', 
        body: JSON.stringify(data) 
      }),
  },

  // ============================================================================
  // STATISTICS
  // ============================================================================

  stats: {
    getDashboard: () => fetchApi('/stats'),
  },

  // ============================================================================
  // REPORTS
  // ============================================================================

  reports: {
    getReports: (period?: string, scope?: string) => {
      const qs = new URLSearchParams();
      if (period) qs.set('period', period);
      if (scope) qs.set('scope', scope);
      const q = qs.toString();
      return fetchApi(`/reports${q ? '?' + q : ''}`);
    },
  },

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  users: {
    getAll: () => fetchApi('/users'),

    getPending: () => fetchApi('/users/pending'),

    create: (data: { email: string; password: string; name: string; role: string; phone?: string; twoFaMethod?: string }) =>
      fetchApi('/users', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    approve: (userId: string) =>
      fetchApi(`/users/${userId}/approve`, { method: 'POST' }),

    reject: (userId: string) =>
      fetchApi(`/users/${userId}/reject`, { method: 'POST' }),

    delete: (userId: string) =>
      fetchApi(`/users/${userId}`, { method: 'DELETE' }),

    updateRole: (userId: string, role: string) =>
      fetchApi(`/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      }),

    grantPermission: (userId: string, permission: string, durationHours: number) =>
      fetchApi(`/users/${userId}/grant-permission`, {
        method: 'POST',
        body: JSON.stringify({ permission, durationHours })
      }),

    revokePermission: (userId: string, permission: string) =>
      fetchApi(`/users/${userId}/revoke-permission/${permission}`, { method: 'DELETE' }),

    getTemporaryPermissions: (userId: string) =>
      fetchApi(`/users/${userId}/temporary-permissions`),

    getAllTemporaryPermissions: () =>
      fetchApi('/users/temporary-permissions/all'),

    updateContact: (userId: string, data: { email?: string; phone?: string }) =>
      fetchApi(`/users/${userId}/contact`, { method: 'PATCH', body: JSON.stringify(data) }),

    getTabAccess: (userId: string) =>
      fetchApi(`/users/${userId}/tab-access`),

    setTabAccess: (userId: string, tabs: string[]) =>
      fetchApi(`/users/${userId}/tab-access`, {
        method: 'PUT',
        body: JSON.stringify({ tabs })
      }),

    resetPassword: (userId: string, newPassword: string) =>
      fetchApi(`/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      }),
  },

  // ============================================================================
  // SERVICE RECORDS
  // ============================================================================

  serviceRecords: {
    getAll: (params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.startDate) qs.set('startDate', params.startDate);
      if (params?.endDate) qs.set('endDate', params.endDate);
      const q = qs.toString();
      return fetchApi(`/service-records${q ? '?' + q : ''}`);
    },

    getById: (id: string) => fetchApi(`/service-records/${id}`),

    getByDate: (date: string, serviceType?: string) => fetchApi(`/service-records/by-date/${date}${serviceType ? `?serviceType=${encodeURIComponent(serviceType)}` : ''}`),

    getToday: () => fetchApi('/service-records/today'),
  },

  // ============================================================================
  // ACTIVITY LOG
  // ============================================================================

  activityLog: {
    getAll: (params?: { page?: number; limit?: number; userId?: string; action?: string; entityType?: string; startDate?: string; endDate?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.userId) qs.set('userId', params.userId);
      if (params?.action) qs.set('action', params.action);
      if (params?.entityType) qs.set('entityType', params.entityType);
      if (params?.startDate) qs.set('startDate', params.startDate);
      if (params?.endDate) qs.set('endDate', params.endDate);
      const q = qs.toString();
      return fetchApi(`/activity-log${q ? '?' + q : ''}`);
    },

    export: (params?: { userId?: string; action?: string; entityType?: string; startDate?: string; endDate?: string }) => {
      const qs = new URLSearchParams();
      if (params?.userId) qs.set('userId', params.userId);
      if (params?.action) qs.set('action', params.action);
      if (params?.entityType) qs.set('entityType', params.entityType);
      if (params?.startDate) qs.set('startDate', params.startDate);
      if (params?.endDate) qs.set('endDate', params.endDate);
      const q = qs.toString();
      return fetchApi(`/activity-log/export${q ? '?' + q : ''}`);
    },
  },

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  notifications: {
    getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.unreadOnly) qs.set('unreadOnly', 'true');
      const q = qs.toString();
      return fetchApi(`/notifications${q ? '?' + q : ''}`);
    },

    getUnreadCount: () => fetchApi('/notifications/unread-count'),

    getLoginSummary: () => fetchApi('/notifications/login-summary'),

    markAsRead: (id: string) =>
      fetchApi(`/notifications/${id}/read`, { method: 'PATCH' }),

    markAllAsRead: () =>
      fetchApi('/notifications/read-all', { method: 'PATCH' }),
  },

  // ============================================================================
  // THEME SETTINGS
  // ============================================================================

  theme: {
    get: () => fetchApi('/theme'),

    save: (data: { colors: any; mode: string }) =>
      fetchApi('/theme', {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
  },

  // ============================================================================
  // BACKUP & RESTORE
  // ============================================================================

  backups: {
    getAll: () => fetchApi('/backups'),

    getLastFull: () => fetchApi('/backups/last-full'),

    create: (type: 'full' | 'differential', storageLocations: string[] = ['device'], selectedTables: string[] = []) =>
      fetchApi('/backups', {
        method: 'POST',
        body: JSON.stringify({ type, storageLocations, selectedTables })
      }),

    preview: (backupData: any, restoreMode: 'replace' | 'merge' | 'update', selectedTables: string[] = []) =>
      fetchApi('/backups/preview', {
        method: 'POST',
        body: JSON.stringify({ backupData, restoreMode, selectedTables })
      }),

    restore: (backupData: any, restoreMode: 'replace' | 'merge' | 'update', selectedTables: string[] = []) =>
      fetchApi('/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ backupData, restoreMode, selectedTables })
      }),

    delete: (id: string) => fetchApi(`/backups/${id}`, { method: 'DELETE' }),
  },

  // ============================================================================
  // CHILDREN
  // ============================================================================

  children: {
    members: {
      getAll: () => fetchApi('/children/members'),
      getById: (id: string) => fetchApi(`/children/members/${id}`),
      create: (data: any) => fetchApi('/children/members', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => fetchApi(`/children/members/${id}`, { method: 'DELETE' }),
      getAnalytics: (id: string) => fetchApi(`/children/members/${id}/analytics`),
      getAttendanceHistory: (id: string, from?: string, to?: string) => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString();
        return fetchApi(`/children/members/${id}/attendance-history${qs ? '?' + qs : ''}`);
      },
      uploadPhoto: async (memberId: string, file: File) => {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${memberId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const contentType = normalizeImageContentType(file);

        const { error: uploadError } = await supabase.storage
          .from('member-photos')
          .upload(filePath, file, { contentType, upsert: true });

        if (uploadError) throw new Error('Failed to upload photo');

        const { data } = supabase.storage
          .from('member-photos')
          .getPublicUrl(filePath);

        return data.publicUrl;
      },
    },
    visitors: {
      getAll: () => fetchApi('/children/visitors'),
      create: (data: any) => fetchApi('/children/visitors', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/visitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },
    attendance: {
      getAll: () => fetchApi('/children/attendance'),
      getById: (id: string) => fetchApi(`/children/attendance/${id}`),
      create: (data: any) => fetchApi('/children/attendance', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },
    giving: {
      getAll: () => fetchApi('/children/giving'),
      create: (data: any) => fetchApi('/children/giving', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/giving/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },
  },

  // ============================================================================
  // SYSTEM OPTIONS
  // ============================================================================

  options: {
    getAll: () => fetchApi('/options'),
  },

  // ============================================================================
  // ADMIN (dev-only configuration)
  // ============================================================================

  admin: {
    getNotificationConfig: () => fetchApi('/admin/notification-config'),
    updateNotificationConfig: (type: string, data: any) =>
      fetchApi(`/admin/notification-config/${type}`, { method: 'PUT', body: JSON.stringify(data) }),
    getActivityLogConfig: () => fetchApi('/admin/activity-log-config'),
    updateActivityLogConfig: (category: string, data: any) =>
      fetchApi(`/admin/activity-log-config/${category}`, { method: 'PUT', body: JSON.stringify(data) }),

    // System Options Management
    getOptions: () => fetchApi('/admin/options'),
    createOption: (data: any) => fetchApi('/admin/options', { method: 'POST', body: JSON.stringify(data) }),
    updateOption: (id: string, data: any) => fetchApi(`/admin/options/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteOption: (id: string) => fetchApi(`/admin/options/${id}`, { method: 'DELETE' }),
  },
};
