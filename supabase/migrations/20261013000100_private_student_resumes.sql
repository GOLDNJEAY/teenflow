do $$
begin
  if exists (
    select 1
    from storage.buckets
    where id = 'student-resumes'
      and public = true
  ) then
    raise exception 'The student-resumes bucket already exists as public; inspect it and its policies before continuing.';
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'student-resumes',
    'student-resumes',
    false,
    5242880,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  on conflict (id) do nothing;
end;
$$;

create policy "student_resumes_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "student_resumes_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "student_resumes_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-resumes'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
