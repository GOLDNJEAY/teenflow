begin;

create function app_private.can_manage_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_role('employer')
    and (
      app_private.is_company_member(p_company_id, 'owner')
      or app_private.is_company_member(p_company_id, 'recruiter')
    );
$$;
revoke all on function app_private.can_manage_company(uuid) from public, anon;
grant execute on function app_private.can_manage_company(uuid) to authenticated;

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 12000),
  requirements text check (requirements is null or char_length(requirements) <= 8000),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  location text not null check (char_length(btrim(location)) between 1 and 160),
  is_remote boolean not null default false,
  schedule text not null check (schedule in ('part_time', 'full_time', 'flexible', 'seasonal', 'one_time')),
  employment_type text not null check (employment_type in ('employee', 'internship', 'contract', 'gig')),
  compensation_min numeric(10, 2) check (compensation_min is null or compensation_min >= 0),
  compensation_max numeric(10, 2) check (compensation_max is null or compensation_max >= 0),
  compensation_type text not null default 'unspecified' check (compensation_type in ('hourly', 'fixed', 'range', 'unspecified')),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  minimum_age smallint check (minimum_age is null or minimum_age between 13 and 99),
  maximum_age smallint check (maximum_age is null or maximum_age between 13 and 99),
  application_instructions text check (application_instructions is null or char_length(application_instructions) <= 4000),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (compensation_min is null or compensation_max is null or compensation_min <= compensation_max),
  check (minimum_age is null or maximum_age is null or minimum_age <= maximum_age),
  check ((status = 'published' and published_at is not null and closed_at is null)
    or (status = 'closed' and closed_at is not null)
    or (status = 'draft' and published_at is null and closed_at is null))
);

create index jobs_public_search_idx on public.jobs (status, category, location) where status = 'published';
create index jobs_company_status_idx on public.jobs (company_id, status, created_at desc);
create index jobs_created_by_idx on public.jobs (created_by_user_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete cascade,
  cover_note text check (cover_note is null or char_length(cover_note) <= 4000),
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'interviewing', 'offered', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, student_id)
);

create index applications_student_idx on public.applications (student_id, created_at desc);
create index applications_job_status_idx on public.applications (job_id, status, created_at desc);

create table public.saved_jobs (
  student_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, job_id)
);
create index saved_jobs_job_idx on public.saved_jobs (job_id);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  content_type text not null check (content_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  file_size_bytes integer not null check (file_size_bytes between 1 and 5242880),
  created_at timestamptz not null default now(),
  check (split_part(object_path, '/', 1) = student_id::text)
);
create index resumes_student_idx on public.resumes (student_id, created_at desc);

create table public.work_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  role_title text not null check (char_length(btrim(role_title)) between 1 and 120),
  organization_name text check (organization_name is null or char_length(organization_name) <= 120),
  description text check (description is null or char_length(description) <= 3000),
  started_on date,
  ended_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (started_on is null or ended_on is null or started_on <= ended_on),
  check (not is_current or ended_on is null)
);
create index work_history_student_idx on public.work_history (student_id, started_on desc);

create function app_private.reset_published_job_on_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.requirements is distinct from old.requirements
    or new.category is distinct from old.category
    or new.location is distinct from old.location
    or new.is_remote is distinct from old.is_remote
    or new.schedule is distinct from old.schedule
    or new.employment_type is distinct from old.employment_type
    or new.compensation_min is distinct from old.compensation_min
    or new.compensation_max is distinct from old.compensation_max
    or new.compensation_type is distinct from old.compensation_type
    or new.minimum_age is distinct from old.minimum_age
    or new.maximum_age is distinct from old.maximum_age
    or new.application_instructions is distinct from old.application_instructions
  ) then
    new.status := 'draft';
    new.published_at := null;
    new.closed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger teenflow_jobs_updated_at
before update on public.jobs
for each row execute function app_private.reset_published_job_on_edit();

create trigger teenflow_applications_updated_at
before update on public.applications
for each row execute function app_private.set_updated_at();

create trigger teenflow_work_history_updated_at
before update on public.work_history
for each row execute function app_private.set_updated_at();

create function public.employer_set_job_status(p_job_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  job_company_id uuid;
  current_status text;
  company_status text;
begin
  if actor_id is null or not app_private.has_role('employer') then
    raise exception 'Employer role required.' using errcode = '42501';
  end if;
  if p_job_id is null or p_status is null or p_status not in ('published', 'closed', 'draft') then
    raise exception 'Invalid job status.' using errcode = '22023';
  end if;

  select j.company_id, j.status, c.employer_verification_status
    into job_company_id, current_status, company_status
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.id = p_job_id;

  if not found or not app_private.can_manage_company(job_company_id) then
    raise exception 'Job not found or access denied.' using errcode = '42501';
  end if;

  if p_status = 'published' and company_status <> 'verified' then
    raise exception 'Company verification is required before publishing.' using errcode = '42501';
  end if;
  if p_status = 'published' and current_status <> 'draft' then
    raise exception 'Only draft jobs can be published.' using errcode = '22023';
  end if;
  if p_status = 'closed' and current_status <> 'published' then
    raise exception 'Only published jobs can be closed.' using errcode = '22023';
  end if;
  if p_status = 'draft' and current_status <> 'closed' then
    raise exception 'Only closed jobs can be returned to draft.' using errcode = '22023';
  end if;

  update public.jobs
  set status = p_status,
      published_at = case when p_status = 'published' then now() else null end,
      closed_at = case when p_status = 'closed' then now() else null end,
      updated_at = now()
  where id = p_job_id;
end;
$$;

create function public.student_withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not app_private.has_role('student') then
    raise exception 'Student role required.' using errcode = '42501';
  end if;
  update public.applications
  set status = 'withdrawn', updated_at = now()
  where id = p_application_id
    and student_id = auth.uid()
    and status in ('submitted', 'reviewing');
  if not found then
    raise exception 'Application not found or cannot be withdrawn.' using errcode = '42501';
  end if;
end;
$$;

create function public.employer_set_application_status(p_application_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_company_id uuid;
  current_status text;
begin
  if auth.uid() is null or not app_private.has_role('employer') then
    raise exception 'Employer role required.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('reviewing', 'interviewing', 'offered', 'rejected') then
    raise exception 'Invalid application status.' using errcode = '22023';
  end if;

  select j.company_id, a.status
    into job_company_id, current_status
  from public.applications a
  join public.jobs j on j.id = a.job_id
  join public.companies c on c.id = j.company_id
  where a.id = p_application_id
    and c.employer_verification_status = 'verified';

  if not found or not app_private.can_manage_company(job_company_id) then
    raise exception 'Application not found or access denied.' using errcode = '42501';
  end if;
  if current_status in ('withdrawn', 'offered', 'rejected') then
    raise exception 'Application is already in a final state.' using errcode = '22023';
  end if;

  update public.applications
  set status = p_status, updated_at = now()
  where id = p_application_id;
end;
$$;

revoke all on function public.employer_set_job_status(uuid, text) from public, anon;
revoke all on function public.student_withdraw_application(uuid) from public, anon;
revoke all on function public.employer_set_application_status(uuid, text) from public, anon;
grant execute on function public.employer_set_job_status(uuid, text) to authenticated;
grant execute on function public.student_withdraw_application(uuid) to authenticated;
grant execute on function public.employer_set_application_status(uuid, text) to authenticated;

alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.resumes enable row level security;
alter table public.work_history enable row level security;

create policy jobs_public_read_published_verified
on public.jobs for select to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1 from public.companies c
    where c.id = company_id and c.employer_verification_status = 'verified'
  )
);

create policy jobs_company_member_read
on public.jobs for select to authenticated
using (app_private.is_company_member(company_id) or app_private.has_role('admin'));

create policy jobs_insert_draft_for_managed_company
on public.jobs for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and status = 'draft'
  and app_private.can_manage_company(company_id)
  and exists (
    select 1 from public.companies c
    where c.id = company_id and c.employer_verification_status = 'verified'
  )
);

create policy jobs_update_managed_draft_or_published
on public.jobs for update to authenticated
using (
  status in ('draft', 'published')
  and app_private.can_manage_company(company_id)
)
with check (app_private.can_manage_company(company_id));

create policy applications_student_read_own
on public.applications for select to authenticated
using (student_id = (select auth.uid()) or app_private.has_role('admin'));

create policy applications_employer_read_managed_jobs
on public.applications for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = job_id
      and c.employer_verification_status = 'verified'
      and app_private.can_manage_company(j.company_id)
  )
);

create policy applications_student_insert_published_job
on public.applications for insert to authenticated
with check (
  student_id = (select auth.uid())
  and status = 'submitted'
  and app_private.has_role('student')
  and exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = job_id
      and j.status = 'published'
      and c.employer_verification_status = 'verified'
      and not app_private.is_company_member(j.company_id)
  )
);

create policy saved_jobs_student_select_own
on public.saved_jobs for select to authenticated
using (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy saved_jobs_student_insert_published
on public.saved_jobs for insert to authenticated
with check (
  student_id = (select auth.uid())
  and app_private.has_role('student')
  and exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = job_id and j.status = 'published'
      and c.employer_verification_status = 'verified'
  )
);

create policy saved_jobs_student_delete_own
on public.saved_jobs for delete to authenticated
using (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy resumes_student_select_own
on public.resumes for select to authenticated
using (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy resumes_student_insert_own
on public.resumes for insert to authenticated
with check (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy resumes_student_delete_own
on public.resumes for delete to authenticated
using (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy work_history_student_select_own
on public.work_history for select to authenticated
using (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy work_history_student_insert_own
on public.work_history for insert to authenticated
with check (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy work_history_student_update_own
on public.work_history for update to authenticated
using (student_id = (select auth.uid()) and app_private.has_role('student'))
with check (student_id = (select auth.uid()) and app_private.has_role('student'));

create policy work_history_student_delete_own
on public.work_history for delete to authenticated
using (student_id = (select auth.uid()) and app_private.has_role('student'));

revoke all on public.jobs, public.applications, public.saved_jobs, public.resumes, public.work_history from public, anon, authenticated;
grant select (id, company_id, title, description, requirements, category, location, is_remote, schedule, employment_type, compensation_min, compensation_max, compensation_type, currency, minimum_age, maximum_age, application_instructions, status, published_at, created_at, updated_at) on public.jobs to anon, authenticated;
grant insert (company_id, created_by_user_id, title, description, requirements, category, location, is_remote, schedule, employment_type, compensation_min, compensation_max, compensation_type, currency, minimum_age, maximum_age, application_instructions) on public.jobs to authenticated;
grant update (title, description, requirements, category, location, is_remote, schedule, employment_type, compensation_min, compensation_max, compensation_type, currency, minimum_age, maximum_age, application_instructions) on public.jobs to authenticated;
grant select on public.applications, public.saved_jobs, public.resumes, public.work_history to authenticated;
grant insert (job_id, student_id, cover_note) on public.applications to authenticated;
grant insert (student_id, job_id) on public.saved_jobs to authenticated;
grant delete on public.saved_jobs to authenticated;
grant insert (student_id, object_path, file_name, content_type, file_size_bytes) on public.resumes to authenticated;
grant delete on public.resumes to authenticated;
grant insert (student_id, role_title, organization_name, description, started_on, ended_on, is_current) on public.work_history to authenticated;
grant update (role_title, organization_name, description, started_on, ended_on, is_current) on public.work_history to authenticated;
grant delete on public.work_history to authenticated;

commit;
