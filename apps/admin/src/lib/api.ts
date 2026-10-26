import type { HealthReport } from '../types';
import { anonKey, supabase, supabaseUrl } from './supabase';

export class AdminApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AdminApiError('Not signed in', 401);

  const res = await fetch(`${supabaseUrl}/functions/v1/server${path}`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey ?? '' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new AdminApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const getHealth = () => request<HealthReport>('/dev/health');
