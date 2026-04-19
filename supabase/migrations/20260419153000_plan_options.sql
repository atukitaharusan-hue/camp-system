create table if not exists public.plan_options (
  plan_id uuid not null references public.plans(id) on delete cascade,
  option_id uuid not null references public.options(id) on delete cascade,
  primary key (plan_id, option_id)
);

create index if not exists plan_options_option_id_idx
  on public.plan_options (option_id);
