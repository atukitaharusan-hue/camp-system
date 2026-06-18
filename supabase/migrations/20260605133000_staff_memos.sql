create table if not exists public.staff_memos (
  id uuid primary key default gen_random_uuid(),
  from_name text not null,
  to_name text not null,
  title text not null,
  body text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  due_at date,
  completed_at timestamptz,
  response_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_memos_status_idx on public.staff_memos(status);
create index if not exists staff_memos_due_at_idx on public.staff_memos(due_at);
create index if not exists staff_memos_created_at_idx on public.staff_memos(created_at desc);

alter table public.staff_memos enable row level security;
