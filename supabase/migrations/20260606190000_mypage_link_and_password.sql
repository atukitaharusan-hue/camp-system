create table if not exists public.mypage_reservation_links (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.guest_reservations(id) on delete cascade,
  user_identifier text,
  phone text,
  email text,
  verified_level text not null default 'support'
    check (verified_level in ('support', 'phone_verified', 'password_verified')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create unique index if not exists mypage_reservation_links_reservation_id_idx
  on public.mypage_reservation_links(reservation_id);

create index if not exists mypage_reservation_links_user_identifier_idx
  on public.mypage_reservation_links(user_identifier);

create table if not exists public.mypage_access_credentials (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.guest_reservations(id) on delete cascade,
  password_hash text not null,
  password_fingerprint text not null,
  is_active boolean not null default true,
  passkey_enabled boolean not null default false,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mypage_access_credentials_reservation_id_idx
  on public.mypage_access_credentials(reservation_id);

create unique index if not exists mypage_access_credentials_password_fingerprint_idx
  on public.mypage_access_credentials(password_fingerprint)
  where is_active = true;

drop trigger if exists mypage_reservation_links_updated_at on public.mypage_reservation_links;
create trigger mypage_reservation_links_updated_at
before update on public.mypage_reservation_links
for each row execute function public.update_updated_at();

drop trigger if exists mypage_access_credentials_updated_at on public.mypage_access_credentials;
create trigger mypage_access_credentials_updated_at
before update on public.mypage_access_credentials
for each row execute function public.update_updated_at();
