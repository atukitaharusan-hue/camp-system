alter table public.guest_reservations
  add column if not exists checkin_flow_status text;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.checkin_sessions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.guest_reservations(id) on delete cascade,
  session_token text not null unique,
  counter_token text not null unique,
  status text not null default 'self_started' check (status in ('self_started', 'arrived_pending', 'counter_processing', 'completed', 'cancelled')),
  user_name text,
  user_phone text,
  user_email text,
  adults integer not null default 1,
  children integer not null default 0,
  infants integer not null default 0,
  guests integer not null default 1,
  special_requests text,
  options_json jsonb not null default '[]'::jsonb,
  selected_site_numbers jsonb not null default '[]'::jsonb,
  requested_site_count integer not null default 1,
  estimated_total_amount integer not null default 0,
  customer_note text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checkin_sessions_reservation on public.checkin_sessions(reservation_id);
create index if not exists idx_checkin_sessions_status on public.checkin_sessions(status);
create index if not exists idx_checkin_sessions_counter_token on public.checkin_sessions(counter_token);

drop trigger if exists checkin_sessions_set_updated_at on public.checkin_sessions;
create trigger checkin_sessions_set_updated_at
before update on public.checkin_sessions
for each row execute function public.update_updated_at();

alter table public.checkin_sessions enable row level security;

drop policy if exists "checkin_sessions_admin_manage" on public.checkin_sessions;
create policy "checkin_sessions_admin_manage" on public.checkin_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
