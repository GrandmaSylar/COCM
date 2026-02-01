import { projectId, publicAnonKey } from '../utils/supabase/info';
import { supabase } from '../utils/supabase/client';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/server`;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || publicAnonKey;
}

async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    return JSON.parse(text);
  } catch {
    return text as any;
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
      fetchApi('/auth/signin', { method: 'POST', body: JSON.stringify({ identifier, password }) }),
    
    signOut: () =>
      fetchApi('/auth/signout', { method: 'POST' }),

    getSession: () =>
      fetchApi('/auth/session'),

    verifyOtp: (data: { userId: string; tempToken: string; code: string }) =>
      fetchApi('/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),

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
      const fileExt = file.name.split('.').pop();
      const fileName = `${memberId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file);

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
    getReports: (period?: string) => fetchApi(`/reports${period ? `?period=${period}` : ''}`),
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

    updateContact: (userId: string, data: { email?: string; phone?: string }) =>
      fetchApi(`/users/${userId}/contact`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
};
