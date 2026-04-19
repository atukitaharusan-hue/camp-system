alter table public.plans
  drop constraint if exists plans_pricing_mode_check;

alter table public.plans
  add constraint plans_pricing_mode_check
  check (pricing_mode in ('per_group', 'per_person', 'guest_band'));
