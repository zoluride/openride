-- ============================================================================
-- driver_documents storage bucket & RLS policies
-- ============================================================================
-- Create the storage bucket for private driver document uploads
insert into storage.buckets (id, name, file_size_limit, allowed_mime_types, public)
values (
  'driver_documents',
  'driver_documents',
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'image/*',
    'application/*'
  ],
  false
)
on conflict (id) do nothing;

-- Allow authenticated drivers to upload to their own paths
create policy driver_documents_authenticated_upload on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'driver_documents'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

-- Allow authenticated drivers to read their own documents
create policy driver_documents_authenticated_read on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver_documents'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

-- Allow authenticated drivers to update (overwrite) their own documents
create policy driver_documents_authenticated_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'driver_documents'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  )
  with check (
    bucket_id = 'driver_documents'
    and (storage.foldername(name))[1]::uuid = auth.uid()
  );

-- Allow service role (backend functions, admins) to read all documents
create policy driver_documents_service_role_read on storage.objects
  for select
  to service_role
  using (bucket_id = 'driver_documents');

-- Allow service role to delete documents (for cleanup/expiration)
create policy driver_documents_service_role_delete on storage.objects
  for delete
  to service_role
  using (bucket_id = 'driver_documents');
