import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { HealthReport } from '@cms/admin-core';
import { AdminApiError, adminApi } from '../lib/admin';
import { useAuth } from './AuthContext';

interface AdminDataValue {
  report: HealthReport | null;
  loading: boolean;
  error: string | null;
  /** Re-run the health report. */
  reload: () => Promise<void>;
  /** Changes after every fix or backup, so lists that depend on them can refresh. */
  version: number;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const { session, signOut } = useAuth();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const signedIn = Boolean(session);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await adminApi.getHealth());
      setVersion((n) => n + 1);
    } catch (e) {
      if (e instanceof AdminApiError && (e.status === 401 || e.status === 403)) {
        await signOut(e.status === 403 ? 'This account is not a developer account.' : 'Your session has expired. Sign in again.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    if (signedIn) void reload();
    else setReport(null);
  }, [signedIn, reload]);

  const value = useMemo(() => ({ report, loading, error, reload, version }), [report, loading, error, reload, version]);
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const value = useContext(AdminDataContext);
  if (!value) throw new Error('useAdminData must be used inside AdminDataProvider');
  return value;
}
