-- VendorScorePro v0.9.48
-- Softwarelandschap import-first CRUD
-- Doel: records in software_landscape_import via de frontend kunnen toevoegen, aanpassen en verwijderen.

alter table public.software_landscape_import
  add column if not exists application_type text,
  add column if not exists application_name text,
  add column if not exists description text,
  add column if not exists manual_url text,
  add column if not exists didactic_component text,
  add column if not exists main_functions text,
  add column if not exists licenses text,
  add column if not exists key_user text,
  add column if not exists source_file text default 'Applicatie Portfolio.csv',
  add column if not exists import_status text default 'new',
  add column if not exists updated_at timestamptz default now();

alter table public.software_landscape_import enable row level security;

drop policy if exists "software_landscape_select" on public.software_landscape_import;
drop policy if exists "software_landscape_insert" on public.software_landscape_import;
drop policy if exists "software_landscape_update" on public.software_landscape_import;
drop policy if exists "software_landscape_delete" on public.software_landscape_import;

create policy "software_landscape_select"
on public.software_landscape_import
for select
using (auth.uid() is not null);

create policy "software_landscape_insert"
on public.software_landscape_import
for insert
with check (auth.uid() is not null);

create policy "software_landscape_update"
on public.software_landscape_import
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "software_landscape_delete"
on public.software_landscape_import
for delete
using (auth.uid() is not null);

-- Zorg dat PostgREST de nieuwe policies/kolommen oppakt.
notify pgrst, 'reload schema';
