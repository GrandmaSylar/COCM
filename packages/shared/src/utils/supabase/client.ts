import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'dev' | 'admin' | 'pastor' | 'elder';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      members: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          other_names: string | null;
          email: string | null;
          phone: string;
          second_phone: string | null;
          gender: 'male' | 'female' | null;
          date_of_birth: string | null;
          residence_location: string;
          digital_address: string | null;
          zone: 'A' | 'B' | 'F' | 'K' | 'M' | 'R';
          zone_number: string;
          notes: string | null;
          status: 'active' | 'semi-active' | 'inactive' | 'sabbatical' | 'blacklisted';
          join_date: string;
          photo_url: string | null;
          baptism_info: any;
          legal_info: any;
          ministries: any;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
      };
    };
  };
};
