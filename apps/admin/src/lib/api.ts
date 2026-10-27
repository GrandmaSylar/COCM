import type { ThemeColors, ThemeModePreference } from '@cms/shared/theme';
import type { BackupResult, HealthReport, RecentFix, ZoneFixPreview } from '../types';
import { anonKey, supabase, supabaseUrl } from './supabase';

export class AdminApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError('Not signed in', 401);

  const res = await fetch(`${supabaseUrl}/functions/v1/server${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey ?? '',
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.details);
  return body as T;
}

export const getHealth = () => request<HealthReport>('/dev/health');

export const previewZoneFix = (memberId: string, proposed: string) =>
  request<ZoneFixPreview>('/dev/actions/zone-number/preview', { method: 'POST', body: { memberId, proposed } });

export const applyZoneFix = (input: { memberId: string; proposed: string; expectedCurrent: string; reason: string; confirm: string }) =>
  request<{ ok: true; name: string; before: string; after: string }>('/dev/actions/zone-number/apply', { method: 'POST', body: input });

export const getRecentFixes = () => request<RecentFix[]>('/dev/actions/recent');

// Uses the app's existing backup route; the backup is returned for download.
export const runBackup = () =>
  request<BackupResult>('/backups', { method: 'POST', body: { type: 'full', storageLocations: ['device'] } });

// The colors and mode the person saved in the Expo/web app. Read only.
export async function getTheme() {
  const data = await request<{ colors: Partial<ThemeColors> | null; mode: string }>('/theme');
  const mode: ThemeModePreference = data.mode === 'light' || data.mode === 'dark' ? data.mode : 'system';
  return { colors: data.colors ?? null, mode };
}
