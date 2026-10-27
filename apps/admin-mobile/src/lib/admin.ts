import { AdminApiError, createAdminApi } from '@cms/admin-core';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export { AdminApiError };

export const adminApi = createAdminApi({
  baseUrl: `${supabaseUrl}/functions/v1/server`,
  anonKey: supabaseAnonKey ?? '',
  getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});
