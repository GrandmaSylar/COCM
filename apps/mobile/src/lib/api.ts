import { fetchApi, getDeviceId, ApiError, invalidateApiCache } from '@cms/shared';

export { ApiError, getDeviceId, invalidateApiCache };

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
    getAttendanceHistory: (id: string, from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      return fetchApi(`/members/${id}/attendance-history${qs ? '?' + qs : ''}`);
    },
  },
};
