-- v0.8.1 - supplier document model refinement + dashboard readiness
alter table public.supplier_documents
add column if not exists storage_provider text,
add column if not exists folder_url text;

-- Backward compatible migration from older field names
update public.supplier_documents
set storage_provider = coalesce(storage_provider, source_system)
where coalesce(storage_provider, '') = '';

update public.supplier_documents
set folder_url = coalesce(folder_url, folder_path)
where coalesce(folder_url, '') = '';
