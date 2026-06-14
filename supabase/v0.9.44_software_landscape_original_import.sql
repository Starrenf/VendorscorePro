-- VendorScorePro v0.9.44
-- Softwarelandschap: originele import 1-op-1 kunnen tonen en verrijking gescheiden houden.
-- Deze migratie is niet-destructief.

alter table if exists public.software_landscape_import
  add column if not exists application_type text,
  add column if not exists application_name text,
  add column if not exists description text,
  add column if not exists manual_url text,
  add column if not exists didactic_component text,
  add column if not exists main_functions text,
  add column if not exists licenses text,
  add column if not exists key_user text,
  add column if not exists suggested_category text,
  add column if not exists suggested_supplier_name text,
  add column if not exists gilde_domain text default 'Nog niet ingedeeld',
  add column if not exists is_gilde_core boolean default false,
  add column if not exists is_overhead boolean default false,
  add column if not exists import_status text default 'new',
  add column if not exists source_file text default 'Applicatie Portfolio.csv',
  add column if not exists updated_at timestamptz default now();

create or replace view public.software_landscape_import_original_view as
select
  id,
  organization_id,
  application_type as "Type applicatie",
  application_name as "Applicatienaam",
  description as "Omschrijving",
  manual_url as "Handleiding website",
  didactic_component as "Didactische component",
  main_functions as "Belangrijkste functies",
  licenses as "Licenties",
  key_user as "Key user",
  source_file,
  created_at,
  updated_at
from public.software_landscape_import;

grant select on public.software_landscape_import_original_view to authenticated;
notify pgrst, 'reload schema';
