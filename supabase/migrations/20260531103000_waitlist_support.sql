alter type public.reservation_status add value if not exists 'waitlisted';

alter table public.guest_reservations
  add column if not exists waitlist_status text,
  add column if not exists waitlist_promoted_at timestamptz;

create index if not exists guest_reservations_waitlist_lookup_idx
  on public.guest_reservations (plan_id, status, waitlist_status, check_in_date, check_out_date);

alter table public.plans
  add column if not exists waitlist_enabled boolean not null default false,
  add column if not exists waitlist_max_count integer not null default 0,
  add column if not exists waitlist_start_date date,
  add column if not exists waitlist_end_date date,
  add column if not exists waitlist_message text;

create table if not exists public.waitlist_excluded_periods (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint waitlist_excluded_periods_date_check check (start_date <= end_date)
);

create index if not exists waitlist_excluded_periods_plan_id_idx
  on public.waitlist_excluded_periods (plan_id);

alter table public.waitlist_excluded_periods enable row level security;

drop policy if exists "Allow anon select waitlist_excluded_periods" on public.waitlist_excluded_periods;
create policy "Allow anon select waitlist_excluded_periods"
  on public.waitlist_excluded_periods
  for select
  using (true);

drop policy if exists "Allow anon insert waitlist_excluded_periods" on public.waitlist_excluded_periods;
create policy "Allow anon insert waitlist_excluded_periods"
  on public.waitlist_excluded_periods
  for insert
  with check (true);

drop policy if exists "Allow anon update waitlist_excluded_periods" on public.waitlist_excluded_periods;
create policy "Allow anon update waitlist_excluded_periods"
  on public.waitlist_excluded_periods
  for update
  using (true)
  with check (true);

drop policy if exists "Allow anon delete waitlist_excluded_periods" on public.waitlist_excluded_periods;
create policy "Allow anon delete waitlist_excluded_periods"
  on public.waitlist_excluded_periods
  for delete
  using (true);
