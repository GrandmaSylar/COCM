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
      promoteToMember: (id: string, data?: any) => fetchApi(`/children/members/${id}/promote`, { method: 'POST', body: JSON.stringify(data || {}) }),
    },
    visitors: {
      getAll: () => fetchApi('/children/visitors'),
      create: (data: any) => fetchApi('/children/visitors', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => fetchApi(`/children/visitors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      delete: (id: string) => fetchApi(`/children/visitors/${id}`, { method: 'DELETE' }),
      convert: (id: string, data: any) => fetchApi(`/children/visitors/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
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
    getLiveState: (sessionId: string) => fetchApi(`/attendance/live/${sessionId}`),
    checkIn: (sessionId: string, memberId: string) =>
      fetchApi(`/attendance/session/${sessionId}/checkin`, { method: 'POST', body: JSON.stringify({ memberId }) }),
    checkOut: (sessionId: string, memberId: string) =>
      fetchApi(`/attendance/session/${sessionId}/checkout`, { method: 'DELETE', body: JSON.stringify({ memberId }) }),
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
