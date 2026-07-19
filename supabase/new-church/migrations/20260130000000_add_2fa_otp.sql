-- Migration: Add Two-Factor Authentication (2FA) support
-- Adds user 2FA preference and OTP verification codes table

-- Add 2FA preference to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS two_fa_method text DEFAULT 'none'
  CONSTRAINT profiles_two_fa_method_check CHECK (two_fa_method IN ('none', 'email', 'phone'));

-- OTP verification codes table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  method text NOT NULL CHECK (method IN ('email', 'phone')),
  temp_token text NOT NULL,
  session_data jsonb,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_otp_codes_user_lookup
  ON public.otp_codes(user_id, temp_token, used);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at
  ON public.otp_codes(expires_at);

-- Disable RLS - this table is only accessed by the backend edge function via service_role key
ALTER TABLE public.otp_codes DISABLE ROW LEVEL SECURITY;

-- Cleanup function for expired/used OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps() RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < NOW() OR used = true;
END;
$$;

ALTER FUNCTION public.cleanup_expired_otps() OWNER TO postgres;
