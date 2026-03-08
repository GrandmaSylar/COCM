-- Upsert default payment methods: ensure Cash, Cheque, Mobile Money exist and are active.
-- Idempotent: ON CONFLICT reactivates previously-deactivated core methods.
-- Does not touch user-created custom methods.

INSERT INTO public.expense_payment_methods (name)
VALUES ('Cash'), ('Cheque'), ('Mobile Money')
ON CONFLICT (name) DO UPDATE SET is_active = true;
