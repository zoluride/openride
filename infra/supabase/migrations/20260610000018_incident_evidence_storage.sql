-- ============================================================================
-- incident_evidence storage bucket & RLS policies
-- ============================================================================
-- Create the storage bucket for private incident evidence uploads (photos, documents)
insert into storage.buckets (id, name, file_size_limit, allowed_mime_types, public)
values (
  'incident_evidence',
  'incident_evidence',
  104857600,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'image/*',
    'video/*',
    'application/*'
  ],
  false
)
on conflict (id) do nothing;

-- Allow authenticated users to upload evidence for their own incidents
create policy incident_evidence_authenticated_upload on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'incident_evidence'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

-- Allow authenticated users to read their own incident evidence
create policy incident_evidence_authenticated_read on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'incident_evidence'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

-- Allow authenticated users to delete their own evidence
create policy incident_evidence_authenticated_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'incident_evidence'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

-- Allow service role (backend functions, admins) to read all evidence
create policy incident_evidence_service_role_read on storage.objects
  for select
  to service_role
  using (bucket_id = 'incident_evidence');

-- Allow service role to delete evidence (for cleanup/expiration)
create policy incident_evidence_service_role_delete on storage.objects
  for delete
  to service_role
  using (bucket_id = 'incident_evidence');
