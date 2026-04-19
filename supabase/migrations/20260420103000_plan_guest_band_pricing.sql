alter table public.plans
  add column if not exists guest_band_rules jsonb not null default '[]'::jsonb;

update public.plans
set guest_band_rules = '[]'::jsonb
where guest_band_rules is null;
