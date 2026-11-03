begin;

create schema app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'employer', 'admin')),
  granted_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role, user_id);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  website text check (website is null or char_length(website) <= 300),
  description text check (description is null or char_length(description) <= 2000),
  employer_verification_status text not null default 'pending'
    check (employer_verification_status in ('pending', 'verified', 'rejected')),
  verification_updated_at timestamptz,
  verified_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (employer_verification_status = 'verified' and verification_updated_at is not null and verified_by_user_id is not null)
    or (employer_verification_status <> 'verified' and verified_by_user_id is null)
  )
);

create index companies_created_by_idx on public.companies (created_by_user_id);
create index companies_verification_status_idx on public.companies (employer_verification_status, created_at desc);

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null check (membership_role in ('owner', 'recruiter', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index company_members_user_idx on public.company_members (user_id, company_id);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('user_role_granted', 'user_role_revoked', 'employer_verification_changed')),
  target_entity text not null check (target_entity in ('user', 'company')),
  target_id uuid not null,
  reason_code text not null check (reason_code in ('onboarding_approval', 'employer_review', 'admin_appointment', 'correction')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_user_id, created_at desc);

create function app_private.has_role(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = p_role
  );
$$;

create function app_private.is_company_member(
  p_company_id uuid,
  p_membership_role text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
      and (p_membership_role is null or membership_role = p_membership_role)
  );
$$;

revoke all on function app_private.has_role(text) from public, anon;
revoke all on function app_private.is_company_member(uuid, text) from public, anon;
grant execute on function app_private.has_role(text) to authenticated;
grant execute on function app_private.is_company_member(uuid, text) to authenticated;

create function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger teenflow_profiles_set_updated_at
before update on public.profiles
for each row execute function app_private.set_updated_at();

create function app_private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger teenflow_create_profile_after_signup
after insert on auth.users
for each row execute function app_private.create_profile_for_auth_user();

insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create function app_private.add_company_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_members (company_id, user_id, membership_role)
  values (new.id, new.created_by_user_id, 'owner');
  return new;
end;
$$;

create trigger teenflow_add_company_owner
after insert on public.companies
for each row execute function app_private.add_company_owner_membership();

create function app_private.guard_company_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_admin boolean := app_private.has_role('admin');
  company_details_changed boolean;
  verification_changed boolean;
begin
  company_details_changed :=
    new.name is distinct from old.name
    or new.website is distinct from old.website
    or new.description is distinct from old.description;
  verification_changed :=
    new.employer_verification_status is distinct from old.employer_verification_status
    or new.verification_updated_at is distinct from old.verification_updated_at
    or new.verified_by_user_id is distinct from old.verified_by_user_id;

  if verification_changed and not is_admin then
    raise exception 'Employer verification can only be changed by an administrator.' using errcode = '42501';
  end if;

  if company_details_changed
    and old.employer_verification_status = 'verified'
    and not is_admin
  then
    new.employer_verification_status := 'pending';
    new.verification_updated_at := now();
    new.verified_by_user_id := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger teenflow_guard_company_verification
before update on public.companies
for each row execute function app_private.guard_company_verification();

create function public.admin_set_user_role(
  p_user_id uuid,
  p_role text,
  p_granted boolean,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not app_private.has_role('admin') then
    raise exception 'Administrator permission required.' using errcode = '42501';
  end if;
  if p_user_id is null or p_role is null or p_role not in ('student', 'employer', 'admin') then
    raise exception 'Invalid role assignment.' using errcode = '22023';
  end if;
  if p_granted is null or p_reason_code is null or p_reason_code not in ('onboarding_approval', 'employer_review', 'admin_appointment', 'correction') then
    raise exception 'Invalid reason code.' using errcode = '22023';
  end if;
  if p_user_id = actor_id and p_role = 'admin' then
    raise exception 'Administrators cannot change their own administrator role.' using errcode = '42501';
  end if;

  if p_role = 'admin' and not p_granted then
    perform pg_advisory_xact_lock(731904201);
    if (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception 'The last administrator cannot be removed.' using errcode = '23514';
    end if;
  end if;

  if p_granted then
    insert into public.user_roles (user_id, role, granted_by_user_id)
    values (p_user_id, p_role, actor_id)
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
    where user_id = p_user_id and role = p_role;
  end if;

  insert into public.admin_audit_log (
    actor_user_id, action, target_entity, target_id, reason_code, details
  ) values (
    actor_id,
    case when p_granted then 'user_role_granted' else 'user_role_revoked' end,
    'user',
    p_user_id,
    p_reason_code,
    jsonb_build_object('role', p_role, 'granted', p_granted)
  );
end;
$$;

create function public.admin_set_employer_verification(
  p_company_id uuid,
  p_status text,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not app_private.has_role('admin') then
    raise exception 'Administrator permission required.' using errcode = '42501';
  end if;
  if p_company_id is null or p_status is null or p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'Invalid employer verification status.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.companies
    where id = p_company_id
      and (created_by_user_id = actor_id or app_private.is_company_member(id, 'owner'))
  ) then
    raise exception 'Administrators cannot review a company they own.' using errcode = '42501';
  end if;
  if p_reason_code is null or p_reason_code not in ('employer_review', 'correction') then
    raise exception 'Invalid reason code.' using errcode = '22023';
  end if;

  update public.companies
  set employer_verification_status = p_status,
      verification_updated_at = now(),
      verified_by_user_id = case when p_status = 'verified' then actor_id else null end,
      updated_at = now()
  where id = p_company_id;

  if not found then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (
    actor_user_id, action, target_entity, target_id, reason_code, details
  ) values (
    actor_id,
    'employer_verification_changed',
    'company',
    p_company_id,
    p_reason_code,
    jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text, boolean, text) from public, anon;
revoke all on function public.admin_set_employer_verification(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text, boolean, text) to authenticated;
grant execute on function public.admin_set_employer_verification(uuid, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.admin_audit_log enable row level security;

create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or app_private.has_role('admin'));

create policy profiles_update_self
on public.profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy user_roles_select_self_or_admin
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or app_private.has_role('admin'));

create policy companies_select_verified_public
on public.companies for select to anon
using (employer_verification_status = 'verified');

create policy companies_select_verified_or_member
on public.companies for select to authenticated
using (
  employer_verification_status = 'verified'
  or app_private.is_company_member(id)
  or app_private.has_role('admin')
);

create policy companies_insert_authorized_employer
on public.companies for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and app_private.has_role('employer')
  and employer_verification_status = 'pending'
  and verification_updated_at is null
  and verified_by_user_id is null
);

create policy companies_update_owner
on public.companies for update to authenticated
using (
  app_private.has_role('employer')
  and app_private.is_company_member(id, 'owner')
)
with check (
  app_private.has_role('employer')
  and app_private.is_company_member(id, 'owner')
);

create policy company_members_select_self_or_admin
on public.company_members for select to authenticated
using (user_id = (select auth.uid()) or app_private.has_role('admin'));

create policy admin_audit_log_select_admin
on public.admin_audit_log for select to authenticated
using (app_private.has_role('admin'));

revoke all on public.profiles, public.user_roles, public.companies, public.company_members, public.admin_audit_log from public, anon, authenticated;
grant select on public.profiles, public.user_roles, public.company_members to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select (id, name, website, description, employer_verification_status, created_at, updated_at)
  on public.companies to anon, authenticated;
grant insert on public.companies to authenticated;
grant update (name, website, description) on public.companies to authenticated;
grant select on public.admin_audit_log to authenticated;

commit;
