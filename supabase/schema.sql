-- Initial Supabase schema for Nexo. Apply only after reviewing in a disposable project.
-- Deliberately fails closed for SUM submissions and membership creation until audited RPCs exist.
create extension if not exists pgcrypto;

create table if not exists public.dynamics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references auth.users(id) on delete cascade,
  paused boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.memberships (
  dynamic_id uuid not null references public.dynamics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('DOM','SUM')),
  created_at timestamptz not null default now(),
  primary key (dynamic_id,user_id)
);
create table if not exists public.profiles (
  dynamic_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '',
  address_style text not null default 'Tú',
  preferences text not null default '',
  limits text not null default '',
  updated_at timestamptz not null default now(),
  primary key (dynamic_id,user_id),
  foreign key (dynamic_id,user_id) references public.memberships(dynamic_id,user_id) on delete cascade
);
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  dynamic_id uuid not null references public.dynamics(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  detail text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  dynamic_id uuid not null references public.dynamics(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending','submitted','approved')),
  submitted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_dynamic_member(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships m where m.dynamic_id = target and m.user_id = (select auth.uid())); $$;
create or replace function public.is_dynamic_dom(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships m where m.dynamic_id = target and m.user_id = (select auth.uid()) and m.role = 'DOM'); $$;
revoke all on function public.is_dynamic_member(uuid) from public;
revoke all on function public.is_dynamic_dom(uuid) from public;
grant execute on function public.is_dynamic_member(uuid) to authenticated;
grant execute on function public.is_dynamic_dom(uuid) to authenticated;

alter table public.dynamics enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.agreements enable row level security;
alter table public.tasks enable row level security;

create policy dynamics_member_read on public.dynamics for select to authenticated using (public.is_dynamic_member(id));
create policy dynamics_dom_update on public.dynamics for update to authenticated using (public.is_dynamic_dom(id)) with check (public.is_dynamic_dom(id));
create policy dynamics_dom_create on public.dynamics for insert to authenticated with check (created_by = (select auth.uid()));
create policy memberships_self_or_dom_read on public.memberships for select to authenticated using (user_id = (select auth.uid()) or public.is_dynamic_dom(dynamic_id));
create policy profiles_member_read on public.profiles for select to authenticated using (public.is_dynamic_member(dynamic_id));
create policy profiles_owner_write on public.profiles for all to authenticated using (user_id = (select auth.uid()) and public.is_dynamic_member(dynamic_id)) with check (user_id = (select auth.uid()) and public.is_dynamic_member(dynamic_id));
create policy agreements_member_read on public.agreements for select to authenticated using (public.is_dynamic_member(dynamic_id));
create policy agreements_dom_insert on public.agreements for insert to authenticated with check (public.is_dynamic_dom(dynamic_id) and created_by = (select auth.uid()));
create policy agreements_dom_update on public.agreements for update to authenticated using (public.is_dynamic_dom(dynamic_id)) with check (public.is_dynamic_dom(dynamic_id));
create policy agreements_dom_delete on public.agreements for delete to authenticated using (public.is_dynamic_dom(dynamic_id));
create policy tasks_member_read on public.tasks for select to authenticated using (public.is_dynamic_member(dynamic_id));
create policy tasks_dom_insert on public.tasks for insert to authenticated with check (public.is_dynamic_dom(dynamic_id) and created_by = (select auth.uid()));
create policy tasks_dom_update on public.tasks for update to authenticated using (public.is_dynamic_dom(dynamic_id)) with check (public.is_dynamic_dom(dynamic_id));

-- Before launch: add audited RPCs for dynamic creation, invite redemption and status-only SUM task
-- submission; expand audit/event tables and verify every policy using separate test accounts.
