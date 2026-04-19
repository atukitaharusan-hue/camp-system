alter table public.plan_options enable row level security;

drop policy if exists "Allow anon select plan_options" on public.plan_options;
create policy "Allow anon select plan_options"
  on public.plan_options
  for select
  using (true);

drop policy if exists "Allow anon insert plan_options" on public.plan_options;
create policy "Allow anon insert plan_options"
  on public.plan_options
  for insert
  with check (true);

drop policy if exists "Allow anon delete plan_options" on public.plan_options;
create policy "Allow anon delete plan_options"
  on public.plan_options
  for delete
  using (true);
