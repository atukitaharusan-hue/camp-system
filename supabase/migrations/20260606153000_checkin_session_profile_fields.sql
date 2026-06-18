alter table public.checkin_sessions
  add column if not exists user_gender text,
  add column if not exists user_occupation text,
  add column if not exists user_address text,
  add column if not exists user_referral_source text;
