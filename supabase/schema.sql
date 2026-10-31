-- Nexo v0.6.0 — reviewed submissions and archival with per-dynamic RLS.
-- Apply in Supabase SQL Editor before configuring the PWA.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

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
  instructions text not null default '' check (char_length(instructions) <= 1000),
  frequency text not null default 'once' check (frequency in ('once','daily','weekly','monthly')),
  required_count integer not null default 1 check (required_count between 1 and 99),
  due_date date,
  deadline_time time,
  -- Kept for compatibility with the first schema draft.
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending','submitted','approved')),
  submitted_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.tasks add column if not exists instructions text not null default '';
alter table public.tasks add column if not exists frequency text not null default 'once';
alter table public.tasks add column if not exists required_count integer not null default 1;
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add column if not exists deadline_time time;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='tasks_frequency_allowed' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_frequency_allowed check (frequency in ('once','daily','weekly','monthly'));
  end if;
  if not exists (select 1 from pg_constraint where conname='tasks_required_count_range' and conrelid='public.tasks'::regclass) then
    alter table public.tasks add constraint tasks_required_count_range check (required_count between 1 and 99);
  end if;
end $$;

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  dynamic_id uuid not null references public.dynamics(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null,
  occurrence integer not null check (occurrence between 1 and 99),
  completed_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_note text not null default '' check (char_length(review_note) <= 500),
  unique (task_id,user_id,period_key,occurrence),
  foreign key (dynamic_id,user_id) references public.memberships(dynamic_id,user_id) on delete cascade
);
create index if not exists task_completions_member_period_idx on public.task_completions(dynamic_id,user_id,period_key);

-- Existing completions predate review and are retained as approved history.
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.task_completions add column if not exists review_status text not null default 'approved';
alter table public.task_completions add column if not exists reviewed_at timestamptz;
alter table public.task_completions add column if not exists reviewed_by uuid references auth.users(id);
alter table public.task_completions add column if not exists review_note text not null default '';
alter table public.task_completions alter column review_status set default 'pending';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='task_completions_review_status_allowed' and conrelid='public.task_completions'::regclass) then
    alter table public.task_completions add constraint task_completions_review_status_allowed check (review_status in ('pending','approved','rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname='task_completions_review_note_length' and conrelid='public.task_completions'::regclass) then
    alter table public.task_completions add constraint task_completions_review_note_length check (char_length(review_note) <= 500);
  end if;
end $$;

-- Raw invite tokens are never stored or readable by app clients; only a SHA-256 hash is stored.
create table if not exists public.dynamic_invites (
  id uuid primary key default gen_random_uuid(),
  dynamic_id uuid not null references public.dynamics(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 1 check (max_uses = 1),
  uses integer not null default 0 check (uses between 0 and 1),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.is_dynamic_member(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships m where m.dynamic_id=target and m.user_id=(select auth.uid())); $$;
create or replace function public.is_dynamic_dom(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships m where m.dynamic_id=target and m.user_id=(select auth.uid()) and m.role='DOM'); $$;
create or replace function public.is_dynamic_sum(target uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.memberships m where m.dynamic_id=target and m.user_id=(select auth.uid()) and m.role='SUM'); $$;
revoke all on function public.is_dynamic_member(uuid) from public;
revoke all on function public.is_dynamic_dom(uuid) from public;
revoke all on function public.is_dynamic_sum(uuid) from public;
grant execute on function public.is_dynamic_member(uuid) to authenticated;
grant execute on function public.is_dynamic_dom(uuid) to authenticated;
grant execute on function public.is_dynamic_sum(uuid) to authenticated;

create or replace function public.create_dynamic(dynamic_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(trim(dynamic_name)) not between 1 and 100 then raise exception 'Name must be between 1 and 100 characters'; end if;
  insert into public.dynamics(name,created_by) values(trim(dynamic_name),auth.uid()) returning id into new_id;
  insert into public.memberships(dynamic_id,user_id,role) values(new_id,auth.uid(),'DOM');
  return new_id;
end $$;

create or replace function public.create_dynamic_invite(target_dynamic uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare raw_token text;
begin
  if auth.uid() is null or not public.is_dynamic_dom(target_dynamic) then raise exception 'DOM access required'; end if;
  raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
  insert into public.dynamic_invites(dynamic_id,token_hash,created_by)
  values(target_dynamic,encode(extensions.digest(convert_to(raw_token,'UTF8'),'sha256'),'hex'),auth.uid());
  return raw_token;
end $$;

create or replace function public.accept_dynamic_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare invite_row public.dynamic_invites%rowtype; current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Sign in before accepting an invitation'; end if;
  if invite_token is null or char_length(invite_token) < 32 then raise exception 'Invitation is invalid'; end if;
  select * into invite_row from public.dynamic_invites
  where token_hash=encode(extensions.digest(convert_to(invite_token,'UTF8'),'sha256'),'hex')
  for update;
  if not found then raise exception 'Invitation is invalid or expired'; end if;
  if exists(select 1 from public.memberships where dynamic_id=invite_row.dynamic_id and user_id=current_user_id) then return invite_row.dynamic_id; end if;
  if invite_row.revoked_at is not null or invite_row.expires_at <= now() or invite_row.uses >= invite_row.max_uses then
    raise exception 'Invitation is invalid, expired, revoked, or already used';
  end if;
  insert into public.memberships(dynamic_id,user_id,role) values(invite_row.dynamic_id,current_user_id,'SUM');
  insert into public.profiles(dynamic_id,user_id) values(invite_row.dynamic_id,current_user_id) on conflict do nothing;
  update public.dynamic_invites set uses=uses+1 where id=invite_row.id;
  return invite_row.dynamic_id;
end $$;

-- Completion period and count are calculated by the database to prevent arbitrary client counts.
create or replace function public.record_task_completion(target_task uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare task_row public.tasks%rowtype; key text; n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into task_row from public.tasks where id=target_task for update;
  if not found or not public.is_dynamic_sum(task_row.dynamic_id) then raise exception 'SUM membership required'; end if;
  if task_row.archived_at is not null then raise exception 'Task is archived'; end if;
  if exists(select 1 from public.dynamics where id=task_row.dynamic_id and paused) then raise exception 'Dynamic is paused'; end if;
  if task_row.frequency='once' and exists(select 1 from public.task_completions where task_id=target_task and user_id=auth.uid() and review_status='approved') then raise exception 'Task is already approved'; end if;
  if task_row.frequency='once' then key:='once';
  elsif task_row.frequency='monthly' then key:=to_char(now() at time zone 'UTC','YYYY-MM');
  elsif task_row.frequency='weekly' then key:=to_char(date_trunc('week',now() at time zone 'UTC')::date,'YYYY-MM-DD');
  else key:=to_char(now() at time zone 'UTC','YYYY-MM-DD'); end if;
  select count(*) into n from public.task_completions where task_id=target_task and user_id=auth.uid() and period_key=key and review_status <> 'rejected';
  if n >= task_row.required_count then raise exception 'Task frequency limit reached for this period'; end if;
  select coalesce(max(occurrence),0)+1 into n from public.task_completions where task_id=target_task and user_id=auth.uid() and period_key=key;
  insert into public.task_completions(dynamic_id,task_id,user_id,period_key,occurrence,review_status)
  values(task_row.dynamic_id,target_task,auth.uid(),key,n,'pending');
  return n;
end $$;

create or replace function public.review_task_completion(target_completion uuid, decision text, note text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare completion_row public.task_completions%rowtype;
begin
  if auth.uid() is null or decision not in ('approved','rejected') then raise exception 'Invalid review'; end if;
  select * into completion_row from public.task_completions where id=target_completion for update;
  if not found or not public.is_dynamic_dom(completion_row.dynamic_id) then raise exception 'DOM membership required'; end if;
  if completion_row.review_status <> 'pending' or completion_row.user_id=auth.uid() then raise exception 'Submission cannot be reviewed by this member'; end if;
  update public.task_completions set review_status=decision, reviewed_at=now(), reviewed_by=auth.uid(), review_note=left(coalesce(note,''),500) where id=target_completion;
end $$;

revoke all on function public.create_dynamic(text) from public;
revoke all on function public.create_dynamic_invite(uuid) from public;
revoke all on function public.accept_dynamic_invite(text) from public;
revoke all on function public.record_task_completion(uuid) from public;
grant execute on function public.create_dynamic(text) to authenticated;
grant execute on function public.create_dynamic_invite(uuid) to authenticated;
grant execute on function public.accept_dynamic_invite(text) to authenticated;
grant execute on function public.record_task_completion(uuid) to authenticated;
revoke all on function public.review_task_completion(uuid,text,text) from public;
grant execute on function public.review_task_completion(uuid,text,text) to authenticated;

alter table public.dynamics enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.agreements enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.dynamic_invites enable row level security;

drop policy if exists dynamics_member_read on public.dynamics;
create policy dynamics_member_read on public.dynamics for select to authenticated using (public.is_dynamic_member(id));
drop policy if exists dynamics_dom_update on public.dynamics;
create policy dynamics_dom_update on public.dynamics for update to authenticated using (public.is_dynamic_dom(id)) with check (public.is_dynamic_dom(id));
drop policy if exists dynamics_dom_create on public.dynamics;
drop policy if exists memberships_self_or_dom_read on public.memberships;
create policy memberships_self_or_dom_read on public.memberships for select to authenticated using (user_id=(select auth.uid()) or public.is_dynamic_dom(dynamic_id));
drop policy if exists profiles_member_read on public.profiles;
create policy profiles_member_read on public.profiles for select to authenticated using (user_id=(select auth.uid()) or public.is_dynamic_dom(dynamic_id));
drop policy if exists profiles_owner_write on public.profiles;
create policy profiles_owner_write on public.profiles for all to authenticated using (user_id=(select auth.uid()) and public.is_dynamic_member(dynamic_id)) with check (user_id=(select auth.uid()) and public.is_dynamic_member(dynamic_id));
drop policy if exists agreements_member_read on public.agreements;
create policy agreements_member_read on public.agreements for select to authenticated using (public.is_dynamic_member(dynamic_id));
drop policy if exists agreements_dom_insert on public.agreements;
create policy agreements_dom_insert on public.agreements for insert to authenticated with check (public.is_dynamic_dom(dynamic_id) and created_by=(select auth.uid()));
drop policy if exists agreements_dom_update on public.agreements;
create policy agreements_dom_update on public.agreements for update to authenticated using (public.is_dynamic_dom(dynamic_id)) with check (public.is_dynamic_dom(dynamic_id));
drop policy if exists agreements_dom_delete on public.agreements;
create policy agreements_dom_delete on public.agreements for delete to authenticated using (public.is_dynamic_dom(dynamic_id));
drop policy if exists tasks_member_read on public.tasks;
create policy tasks_member_read on public.tasks for select to authenticated using (public.is_dynamic_member(dynamic_id));
drop policy if exists tasks_dom_insert on public.tasks;
create policy tasks_dom_insert on public.tasks for insert to authenticated with check (public.is_dynamic_dom(dynamic_id) and created_by=(select auth.uid()));
drop policy if exists tasks_dom_update on public.tasks;
create policy tasks_dom_update on public.tasks for update to authenticated using (public.is_dynamic_dom(dynamic_id)) with check (public.is_dynamic_dom(dynamic_id));
drop policy if exists tasks_dom_delete on public.tasks;
create policy tasks_dom_delete on public.tasks for delete to authenticated using (public.is_dynamic_dom(dynamic_id));
drop policy if exists task_completions_member_read on public.task_completions;
drop policy if exists task_completions_self_or_dom_read on public.task_completions;
create policy task_completions_self_or_dom_read on public.task_completions for select to authenticated using (user_id=(select auth.uid()) or public.is_dynamic_dom(dynamic_id));
drop policy if exists task_completions_sum_insert on public.task_completions;
drop policy if exists dynamic_invites_no_client_access on public.dynamic_invites;
revoke all on public.dynamic_invites from anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.dynamics,public.memberships,public.agreements,public.tasks,public.task_completions,public.profiles to authenticated;
grant insert,update on public.profiles to authenticated;
revoke insert on public.tasks from anon, authenticated;
grant insert (dynamic_id,title,instructions,frequency,required_count,due_date,deadline_time,created_by) on public.tasks to authenticated;
grant insert,update,delete on public.agreements to authenticated;

-- Task metadata and archival are DOM-managed. Deletes and direct completion edits are forbidden.
revoke update, delete on public.tasks from anon, authenticated;
revoke delete on public.tasks from anon, authenticated;
grant update (title, instructions, frequency, required_count, due_date, deadline_time, archived_at) on public.tasks to authenticated;
revoke update, delete on public.agreements from anon, authenticated;
revoke update, delete on public.task_completions from anon, authenticated;

drop policy if exists tasks_dom_insert on public.tasks;
create policy tasks_dom_insert on public.tasks for insert to authenticated
  with check (public.is_dynamic_dom(dynamic_id) and created_by=(select auth.uid())
    and not exists (select 1 from public.dynamics d where d.id=dynamic_id and d.paused));
drop policy if exists tasks_dom_update on public.tasks;
create policy tasks_dom_update on public.tasks for update to authenticated
  using (public.is_dynamic_dom(dynamic_id))
  with check (public.is_dynamic_dom(dynamic_id)
    and not exists (select 1 from public.dynamics d where d.id=dynamic_id and d.paused));

