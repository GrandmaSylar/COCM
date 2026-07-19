import { fetchApi, getDeviceId, ApiError, invalidateApiCache } from '@cms/shared';
import { uploadToCloudinary } from './cloudinaryUpload';

export { ApiError, getDeviceId, invalidateApiCache };

// ============================================================================
// EXPENSE PAYLOAD TYPES (camelCase API contract)
// ============================================================================

export interface ExpenseCreatePayload {
  formId: string;
  details: string;
  serviceDate: string;
  serviceType: string;
  amount: number;
  paymentMethodId?: string;
  paymentMethodName: string;
  referenceNumber?: string;
  requestedById?: string;
  requestedByName?: string;
  recommendedById?: string;
  recommendedByName?: string;
  approvedById?: string;
  approvedByName?: string;
}

export interface ExpenseUpdatePayload {
  formId?: string;
  details?: string;
  serviceDate?: string;
  serviceType?: string;
  amount?: number;
  expenseDate?: string;
  paymentMethodId?: string;
  paymentMethodName?: string;
  referenceNumber?: string;
  requestedById?: string;
  requestedByName?: string;
  recommendedById?: string;
  recommendedByName?: string;
  approvedById?: string;
  approvedByName?: string;
}

export interface CustomRolePayload {
  name: string;
  description?: string;
  permissions: string[];
  tabAccess: string[];
  dashboardWidgets: string[];
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

    uploadPhoto: async (memberId: string, file: File) => uploadToCloudinary(file, memberId),
  },

  // ============================================================================
  // ATTENDANCE
  // ============================================================================
  
  attendance: {
    getOrCreate: (data: { date: string; serviceType: string; startTime: string; endTime: string }) =>
      fetchApi('/attendance/session', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

    finalize: (id: string) =>
      fetchApi(`/attendance/session/${id}/finalize`, { method: 'POST' }),

    cancelSession: (id: string) =>
      fetchApi(`/attendance/session/${id}/cancel`, { method: 'POST' }),

    getLiveSessions: () => fetchApi('/attendance/live-sessions'),

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
    getReports: (period?: string, scope?: string, startDate?: string, endDate?: string) => {
      const qs = new URLSearchParams();
      if (period) qs.set('period', period);
      if (scope) qs.set('scope', scope);
      if (startDate) qs.set('startDate', startDate);
      if (endDate) qs.set('endDate', endDate);
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
  // SERVICE SETUPS
  // ============================================================================

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

    getById: (id: string) => fetchApi(`/service-setups/${id}`),

    create: (data: any) => fetchApi('/service-setups', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),

    update: (id: string, data: any) => fetchApi(`/service-setups/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(data) 
    }),

    delete: (id: string) => fetchApi(`/service-setups/${id}`, { method: 'DELETE' }),
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

  preferences: {
    get: () => fetchApi('/preferences'),

    save: (data: { defaultPaperSize: string }) =>
      fetchApi('/preferences', {
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

    restore: (backupData: any, restoreMode: 'replace' | 'merge' | 'update', selectedTables: string[] = [], restoreFailureMode?: 'partial' | 'atomic') =>
      fetchApi('/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ backupData, restoreMode, selectedTables, restoreFailureMode })
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
      uploadPhoto: async (memberId: string, file: File) => uploadToCloudinary(file, memberId),
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
    analytics: {
      get: (period?: string) => fetchApi(`/children/analytics${period ? '?period=' + period : ''}`)
    },
  },

  // ============================================================================
  // EXPENSES
  // ============================================================================

  expenses: {
    getAll: () => fetchApi('/expenses'),

    getNextFormId: () => fetchApi('/expenses/next-form-id'),

    getById: (id: string) => fetchApi(`/expenses/${id}`),

    create: (data: ExpenseCreatePayload) => fetchApi('/expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

    update: (id: string, data: ExpenseUpdatePayload) => fetchApi(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

    delete: (id: string) => fetchApi(`/expenses/${id}`, { method: 'DELETE' }),

    paymentMethods: {
      getAll: () => fetchApi('/expenses/payment-methods'),

      create: (data: any) => fetchApi('/expenses/payment-methods', {
        method: 'POST',
        body: JSON.stringify(data)
      }),

      update: (id: string, data: any) => fetchApi(`/expenses/payment-methods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),

      delete: (id: string) => fetchApi(`/expenses/payment-methods/${id}`, { method: 'DELETE' }),
    },
  },

  // ============================================================================
  // SYSTEM OPTIONS
  // ============================================================================

  options: {
    getAll: () => fetchApi('/options'),
  },

  // ============================================================================
  // CUSTOM ROLES
  // ============================================================================

  customRoles: {
    getAll: () => fetchApi('/custom-roles'),
    create: (data: CustomRolePayload) => fetchApi('/custom-roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: CustomRolePayload) => fetchApi('/custom-roles/' + id, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string, reassignments?: { userId: string; newRole: string }[]) => fetchApi('/custom-roles/' + id, { method: 'DELETE', body: reassignments ? JSON.stringify({ reassignments }) : undefined }),
  },

  // ============================================================================
  // ADMIN (dev-only configuration)
  // ============================================================================

  admin: {
    getNotificationConfig: () => fetchApi('/admin/notification-config'),
    updateNotificationConfig: (type: string, data: any) =>
      fetchApi(`/admin/notification-config/${type}`, { method: 'PUT', body: JSON.stringify(data) }),
    getActivityLogConfig: () => fetchApi('/admin/activity-log-config'),
    updateActivityLogConfig: (actionType: string, entityType: string, data: any) =>
      fetchApi(`/admin/activity-log-config/${actionType}/${entityType}`, { method: 'PUT', body: JSON.stringify(data) }),

    // System Options Management
    getOptions: () => fetchApi('/admin/options'),
    createOption: (data: any) => fetchApi('/admin/options', { method: 'POST', body: JSON.stringify(data) }),
    updateOption: (id: string, data: any) => fetchApi(`/admin/options/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteOption: (id: string) => fetchApi(`/admin/options/${id}`, { method: 'DELETE' }),
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
    getAttendance: (id: string) => fetchApi(`/zones/${id}/attendance`),
    recordAttendance: (id: string, data: any) => fetchApi(`/zones/${id}/attendance`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // ============================================================================
  // MINISTRIES
  // ============================================================================

  ministries: {
    getAll: () => fetchApi('/ministries'),
    create: (data: any) => fetchApi('/ministries', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`/ministries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`/ministries/${id}`, { method: 'DELETE' }),
    getMembers: (id: string) => fetchApi(`/ministries/${id}/members`),
    addMember: (id: string, data: { memberId: string; role?: string }) => fetchApi(`/ministries/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
    removeMember: (id: string, memberId: string) => fetchApi(`/ministries/${id}/members/${memberId}`, { method: 'DELETE' }),
  },
};

