alter type public.driver_doc_type add value if not exists 'license';
alter type public.driver_doc_type add value if not exists 'lasdri';
alter type public.driver_doc_type add value if not exists 'nhia';

create trigger trg_set_operator_id_driver_documents
  before insert on public.driver_documents
  for each row execute function public.set_operator_id();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_documents'
  ) then
    alter publication supabase_realtime add table public.driver_documents;
  end if;
end $$;

alter table public.driver_documents replica identity full;
