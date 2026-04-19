ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'per_group',
  ADD COLUMN IF NOT EXISTS adult_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS child_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS infant_price numeric NOT NULL DEFAULT 0;

UPDATE public.plans
SET
  pricing_mode = COALESCE(NULLIF(pricing_mode, ''), 'per_group'),
  adult_price = COALESCE(adult_price, 0),
  child_price = COALESCE(child_price, 0),
  infant_price = COALESCE(infant_price, 0);

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_pricing_mode_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_pricing_mode_check
  CHECK (pricing_mode IN ('per_group', 'per_person'));
