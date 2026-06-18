alter table public.checkin_sessions
  add column if not exists user_identifier text;

create index if not exists idx_checkin_sessions_user_identifier
  on public.checkin_sessions(user_identifier);
