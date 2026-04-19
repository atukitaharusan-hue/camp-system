ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_lodging_tax_applicable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.guest_reservations
  ADD COLUMN IF NOT EXISTS pricing_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
