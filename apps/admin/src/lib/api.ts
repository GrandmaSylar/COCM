import { AdminApiError, createAdminApi } from '@cms/admin-core';
import { anonKey, supabase, supabaseUrl } from './supabase';

export { AdminApiError };

const api = createAdminApi({
  baseUrl: `${supabaseUrl}/functions/v1/server`,
  anonKey: anonKey ?? '',
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});

export const { getHealth, previewZoneFix, applyZoneFix, getRecentFixes, runBackup, getTheme } = api;
