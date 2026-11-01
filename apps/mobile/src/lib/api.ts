import { fetchApi, getDeviceId, ApiError, invalidateApiCache, setAccessTokenGetter } from '@cms/shared';
import { supabase } from './supabase';

export { ApiError, getDeviceId, invalidateApiCache };

// Configure shared apiClient to use mobile Supabase session token
setAccessTokenGetter(async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
});

async function safeFetch<T = any>(endpoint: string, options?: RequestInit): Promise<T | null> {
  try {
    return await fetchApi<T>(endpoint, options);
  } catch (err: any) {
    if (err?.status === 404 || err?.message?.toLowerCase().includes('not found')) {
      return null;
    }
    throw err;
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

    heartbeat: async () => {
      const response = await fetchApi<any>('/auth/heartbeat', { method: 'POST', body: JSON.stringify({ deviceId: getDeviceId() }) });
      if (response && response.ok === false) {
        const error = new ApiError(401, response.error || 'Unauthorized');
        error.errorObj = response;
        throw error;
      }
      return response;
    },

    getSession: () => fetchApi('/auth/session'),

    sendOtp: (data: { userId: string; tempToken: string; method: string }) =>
      fetchApi<{ message: string; destination: string }>('/auth/send-otp', { method: 'POST', body: JSON.stringify(data) }),

    verifyOtp: (data: { userId: string; tempToken: string; code: string }) =>
      fetchApi<{ session: { access_token: string; refresh_token: string }; user: any }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ ...data, deviceId: getDeviceId() }),
      }),

    resendOtp: (data: { userId: string; tempToken: string }) =>
      fetchApi<{ message: string }>('/auth/resend-otp', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ============================================================================
  // USERS & ACCESS MANAGEMENT
  // ============================================================================
  users: {
    getAll: () => fetchApi('/users'),
    getTabAccess: (userId: string) => fetchApi(`/users/${userId}/tab-access`),
    approve: (id: string) => fetchApi(`/users/${id}/approve`, { method: 'POST' }),
    reject: (id: string) => fetchApi(`/users/${id}/reject`, { method: 'POST' }),
    updateRole: (id: string, role: string) => fetchApi(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    resetPassword: (id: string, newPassword: string) => fetchApi(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    // Server expects { tabs } with web tab ids ('members', 'activity-log', ...)
    updateTabAccess: (id: string, tabs: string[]) => fetchApi(`/users/${id}/tab-access`, { method: 'PUT', body: JSON.stringify({ tabs }) }),
    updateTempPermissions: (id: string, permissions: string[], expiresAt?: string) =>
      fetchApi(`/users/${id}/temp-permissions`, { method: 'PUT', body: JSON.stringify({ permissions, expiresAt }) }),
  },

  // ============================================================================
  // CUSTOM ROLES
  // ============================================================================
  roles: {
    getAll: () => fetchApi('/custom-roles'),
    create: (data: any) => fetchApi('/custom-roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/custom-roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/custom-roles/${id}`, { method: 'DELETE' }),
  },

  // ============================================================================
  // BACKUPS & SYSTEM EXPORTS
  // ============================================================================
  backups: {
    getAll: () => safeFetch('/backups'),
    create: () => fetchApi('/backups', { method: 'POST' }),
    restore: (id: string) => fetchApi(`/backups/${id}/restore`, { method: 'POST' }),
  },

  // ============================================================================
  // PREFERENCES
  // ============================================================================
  preferences: {
    get: () => safeFetch('/preferences'),
    save: (data: any) => fetchApi('/preferences', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ============================================================================
  // THEME (per-user, shared with the web app)
  // ============================================================================
  theme: {
    get: () => fetchApi<{ colors: any; mode: string }>('/theme'),
    save: (data: { colors: any; mode: string }) =>
      fetchApi('/theme', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ============================================================================
  // MEMBERS
  // ============================================================================
  members: {
    getAll: () => fetchApi('/members'),
    getById: (id: string) => safeFetch(`/members/${id}`),
    create: (data: any) => fetchApi('/members', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    update: (id: string, data: any) => fetchApi(`/members/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),
    delete: (id: string) => fetchApi(`/members/${id}`, { method: 'DELETE' }),
    getAnalytics: (id: string) => safeFetch(`/members/${id}/analytics`),
    getAttendanceHistory: (id: string, from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      return safeFetch(`/members/${id}/attendance-history${qs ? '?' + qs : ''}`);
    },
  },

  // ============================================================================
  // VISITORS
  // ============================================================================
  visitors: {
    getAll: () => fetchApi('/visitors'),
    getById: (id: string) => safeFetch(`/visitors/${id}`),
    create: (data: any) => fetchApi('/visitors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/visitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/visitors/${id}`, { method: 'DELETE' }),
    convertToMember: (id: string, data: any) => fetchApi(`/visitors/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // ============================================================================
  // CHILDREN
  // ============================================================================
  children: {
    members: {
      getAll: () => fetchApi('/children/members'),
      getById: (id: string) => safeFetch(`/children/members/${id}`),
      create: (data: any) => fetchApi('/children/members', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => fetchApi(`/children/members/${id}`, { method: 'DELETE' }),
      getAnalytics: (id: string) => safeFetch(`/children/members/${id}/analytics`),
      getAttendanceHistory: (id: string, from?: string, to?: string) => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString();
        return safeFetch(`/children/members/${id}/attendance-history${qs ? '?' + qs : ''}`);
      },
    },
    visitors: {
      getAll: () => fetchApi('/children/visitors'),
      create: (data: any) => fetchApi('/children/visitors', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/visitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },
    attendance: {
      getAll: () => fetchApi('/children/attendance'),
      getById: (id: string) => safeFetch(`/children/attendance/${id}`),
      create: (data: any) => fetchApi('/children/attendance', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },
    giving: {
      getAll: () => fetchApi('/children/giving'),
      create: (data: any) => fetchApi('/children/giving', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/giving/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },
    analytics: {
      get: (period?: string) => safeFetch(`/children/analytics${period ? '?period=' + period : ''}`),
    },
  },

  // ============================================================================
  // DYNAMIC OPTIONS (Ministries, Positions, Payment Methods, etc.)
  // ============================================================================
  options: {
    getAll: () => fetchApi('/options'),
  },

  // ============================================================================
  // ZONES
  // ============================================================================
  zones: {
    getAll: () => fetchApi('/zones'),
    create: (data: any) => fetchApi('/zones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/zones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/zones/${id}`, { method: 'DELETE' }),
    getMembers: (id: string) => fetchApi(`/zones/${id}/members`),
  },

  // ============================================================================
  // ATTENDANCE & SESSIONS
  // ============================================================================
  attendance: {
    getOrCreate: (data: { date: string; serviceType: string; startTime: string; endTime: string }) =>
      fetchApi('/attendance/session', { method: 'POST', body: JSON.stringify(data) }),
    finalize: (id: string) =>
      fetchApi(`/attendance/session/${id}/finalize`, { method: 'POST' }),
    cancelSession: (id: string) =>
      fetchApi(`/attendance/session/${id}/cancel`, { method: 'POST' }),
    getLiveSessions: () => fetchApi('/attendance/live-sessions'),
    getAll: () => fetchApi('/attendance'),
    getById: (id: string) => fetchApi(`/attendance/${id}`),
    create: (data: any) => fetchApi('/attendance', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/attendance/${id}`, { method: 'DELETE' }),
    getEditStatus: (id: string) => fetchApi(`/attendance/${id}/edit-status`),
    getAbsentees: (id: string) => fetchApi(`/attendance/${id}/absentees`),
    saveAbsentees: (id: string, data: any[]) => fetchApi(`/attendance/${id}/absentees`, { method: 'POST', body: JSON.stringify(data) }),
    updateAbsentee: (id: string, memberId: string, data: any) => fetchApi(`/attendance/${id}/absentees/${memberId}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ============================================================================
  // SERVICES (Giving & Financial Records)
  // ============================================================================
  serviceRecords: {
    getAll: (params?: { page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      const q = qs.toString();
      return fetchApi(`/service-records${q ? '?' + q : ''}`);
    },
    getByDate: (date: string, serviceType?: string) =>
      fetchApi(`/service-records/by-date/${date}${serviceType ? `?serviceType=${encodeURIComponent(serviceType)}` : ''}`),
    getToday: () => fetchApi('/service-records/today'),
  },

  serviceSetups: {
    getAll: (params?: { page?: number; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      const q = qs.toString();
      return fetchApi(`/service-setups${q ? '?' + q : ''}`);
    },
    getByDate: (date: string, serviceType?: string) =>
      fetchApi(`/service-setups/by-date/${date}${serviceType ? `?serviceType=${encodeURIComponent(serviceType)}` : ''}`),
    create: (data: any) => fetchApi('/service-setups', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/service-setups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  services: {
    getAll: () => fetchApi('/services'),
    create: (data: any) => fetchApi('/services', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/services/${id}`, { method: 'DELETE' }),
  },

  // ============================================================================
  // GIVING
  // ============================================================================
  giving: {
    getAll: () => fetchApi('/giving'),
    getById: (id: string) => fetchApi(`/giving/${id}`),
    create: (data: any) => fetchApi('/giving', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/giving/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/giving/${id}`, { method: 'DELETE' }),
    getEditStatus: (id: string) => fetchApi(`/giving/${id}/edit-status`),
    types: {
      getAll: () => fetchApi('/giving/types'),
      create: (data: any) => fetchApi('/giving/types', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/giving/types/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => fetchApi(`/giving/types/${id}`, { method: 'DELETE' }),
      toggle: (id: string) => fetchApi(`/giving/types/${id}/toggle`, { method: 'PATCH' }),
    },
  },

  // ============================================================================
  // EXPENSES
  // ============================================================================
  expenses: {
    getAll: () => fetchApi('/expenses'),
    getNextFormId: () => fetchApi('/expenses/next-form-id'),
    getById: (id: string) => fetchApi(`/expenses/${id}`),
    create: (data: any) => fetchApi('/expenses', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/expenses/${id}`, { method: 'DELETE' }),
    paymentMethods: {
      getAll: () => fetchApi('/expenses/payment-methods'),
      create: (data: any) => fetchApi('/expenses/payment-methods', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/expenses/payment-methods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => fetchApi(`/expenses/payment-methods/${id}`, { method: 'DELETE' }),
    },
  },

  // ============================================================================
  // ACTIVITY LOGS
  // ============================================================================
  activityLog: {
    getAll: (params?: any) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return safeFetch(`/activity-log${qs}`);
    },
    clear: () => fetchApi('/activity-log', { method: 'DELETE' }),
  },

  // ============================================================================
  // REPORTS
  // ============================================================================
  reports: {
    getSummary: (period?: string, scope?: string) => {
      const params = new URLSearchParams();
      if (period) params.set('period', period);
      if (scope) params.set('scope', scope);
      const qs = params.toString();
      return safeFetch(`/reports${qs ? '?' + qs : ''}`);
    },
  },
};
