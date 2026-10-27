// The admin API client, shared by the admin web app and the admin Expo app.
// It only needs a base URL, the public anon key and a way to get the signed-in
// person's access token, so it has no dependency on a browser or React Native.
import type { ThemeColors, ThemeModePreference } from '@cms/shared/theme';
import type { BackupResult, HealthReport, RecentFix, ZoneFixPreview } from './types';

export class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface AdminApiConfig {
  /** `${SUPABASE_URL}/functions/v1/server` */
  baseUrl: string;
  anonKey: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export interface ZoneFixInput {
  memberId: string;
  proposed: string;
  expectedCurrent: string;
  reason: string;
  confirm: string;
}

export function createAdminApi(config: AdminApiConfig) {
  const doFetch = config.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function request<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
    const token = await config.getToken();
    if (!token) throw new AdminApiError('Not signed in', 401);

    const res = await doFetch(`${config.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.anonKey,
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new AdminApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.details);
    return body as T;
  }

  return {
    getHealth: () => request<HealthReport>('/dev/health'),

    previewZoneFix: (memberId: string, proposed: string) =>
      request<ZoneFixPreview>('/dev/actions/zone-number/preview', { method: 'POST', body: { memberId, proposed } }),

    applyZoneFix: (input: ZoneFixInput) =>
      request<{ ok: true; name: string; before: string; after: string }>('/dev/actions/zone-number/apply', { method: 'POST', body: input }),

    getRecentFixes: () => request<RecentFix[]>('/dev/actions/recent'),

    // Uses the app's existing backup route; the backup is returned to be saved by the caller.
    runBackup: () => request<BackupResult>('/backups', { method: 'POST', body: { type: 'full', storageLocations: ['device'] } }),

    // The colors and mode the person saved in the Expo/web app. Read only.
    getTheme: async () => {
      const data = await request<{ colors: Partial<ThemeColors> | null; mode: string }>('/theme');
      const mode: ThemeModePreference = data.mode === 'light' || data.mode === 'dark' ? data.mode : 'system';
      return { colors: data.colors ?? null, mode };
    },
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
