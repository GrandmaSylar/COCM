-- Seed default service types into custom_services
-- Uses ON CONFLICT (name) DO NOTHING so it is safe to re-run
-- Names aligned with canonical values used across the codebase

INSERT INTO public.custom_services (name, description, start_date, end_date, start_time, end_time, days_of_week, is_active)
VALUES
  ('Sunday Main Service',  'Regular Sunday main service',  '2026-01-01', '2099-12-31', '08:00', '13:00', ARRAY[0], true),
  ('Midweek Service',      'Regular midweek service',      '2026-01-01', '2099-12-31', '18:00', '20:00', ARRAY[3], true),
  ('Prayer Meeting',       'Weekly prayer meeting',        '2026-01-01', '2099-12-31', '06:00', '07:00', ARRAY[5], true),
  ('Special Programme',    'Special church programme or event', '2026-01-01', '2099-12-31', '09:00', '17:00', ARRAY[6], true)
ON CONFLICT (name) DO NOTHING;
