ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS max_site_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_concurrent_reservations INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_guests_per_booking INTEGER NOT NULL DEFAULT 4;

UPDATE public.plans
SET
  max_site_count = GREATEST(COALESCE(max_site_count, capacity), 1),
  max_concurrent_reservations = GREATEST(COALESCE(max_concurrent_reservations, capacity), 1),
  max_guests_per_booking = GREATEST(COALESCE(max_guests_per_booking, capacity), 1);

ALTER TABLE public.guest_reservations
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reserved_site_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS selected_site_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.guest_reservations
SET selected_site_numbers =
  CASE
    WHEN site_number IS NOT NULL AND jsonb_array_length(selected_site_numbers) = 0 THEN jsonb_build_array(site_number)
    ELSE selected_site_numbers
  END;
