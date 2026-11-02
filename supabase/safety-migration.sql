-- Nexo 0.8.0 — safety, consent, check-ins and aftercare
-- Run this AFTER the existing Nexo supabase/schema.sql.
-- It is additive and does not remove existing data.

create table if not exists public.dynamic_safety (
  dynamic_id uuid primary key references public.dynamics(id) on delete cascade,
  red_word text not null default '',
  yellow_word text not null default '',
  nonverbal_signal text not null default '',
  hard_limits text not null default '',
  soft_limits text not null default '',
  scope text not null default '',
  exit_plan text not null default '',
  aftercare_dom text not null default '',
  aftercare_sum text not null default '',
  review_interval_days integer not null default 30 check (review_interval_days between 1 and 365),
  last_reviewed_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.dynamic_checkins (
  id uuid primary key default gen_random_uuid(),
  dynamic_id uuid not null references public.dynamics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null check (state in ('green','yellow','red')),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (dynamic_id,user_id)
    references public.memberships(dynamic_id,user_id)
    on delete cascade
);

create index if not exists dynamic_checkins_dynamic_created_idx
  on public.dynamic_checkins(dynamic_id, created_at desc);

alter table public.dynamic_safety enable row level security;
alter table public.dynamic_checkins enable row level security;

drop policy if exists dynamic_safety_member_read on public.dynamic_safety;
create policy dynamic_safety_member_read
on public.dynamic_safety for select to authenticated
using (public.is_dynamic_member(dynamic_id));

drop policy if exists dynamic_safety_member_insert on public.dynamic_safety;
create policy dynamic_safety_member_insert
on public.dynamic_safety for insert to authenticated
with check (
  public.is_dynamic_member(dynamic_id)
  and updated_by=(select auth.uid())
);

drop policy if exists dynamic_safety_member_update on public.dynamic_safety;
create policy dynamic_safety_member_update
on public.dynamic_safety for update to authenticated
using (public.is_dynamic_member(dynamic_id))
with check (public.is_dynamic_member(dynamic_id));

drop policy if exists dynamic_checkins_member_read on public.dynamic_checkins;
create policy dynamic_checkins_member_read
on public.dynamic_checkins for select to authenticated
using (public.is_dynamic_member(dynamic_id));

drop policy if exists dynamic_checkins_member_insert on public.dynamic_checkins;
create policy dynamic_checkins_member_insert
on public.dynamic_checkins for insert to authenticated
with check (
  public.is_dynamic_member(dynamic_id)
  and user_id=(select auth.uid())
);

-- One initial safety record per dynamic is created automatically when the DOM
-- creates a dynamic, without changing the existing create_dynamic function.
create or replace function public.ensure_dynamic_safety()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dynamic_safety(dynamic_id)
  values(new.id)
  on conflict (dynamic_id) do nothing;
  return new;
end
$$;

drop trigger if exists dynamics_create_safety on public.dynamics;
create trigger dynamics_create_safety
after insert on public.dynamics
for each row execute function public.ensure_dynamic_safety();

revoke all on function public.ensure_dynamic_safety() from public;
grant execute on function public.ensure_dynamic_safety() to authenticated;

-- Existing dynamics receive a safety record too.
insert into public.dynamic_safety(dynamic_id)
select id from public.dynamics
on conflict (dynamic_id) do nothing;
