-- VendorScorePro v0.9.47
-- Softwarelandschap import-first structuur
-- Doel: eerst de geïmporteerde applicatieportfolio 1-op-1 beheren.
-- Geen automatische koppeling of verrijking in deze migratie.

create table if not exists public.software_landscape_import (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,

  application_type text,
  application_name text not null,
  description text,
  manual_url text,
  didactic_component text,
  main_functions text,
  licenses text,
  key_user text,

  source_file text default 'Applicatie Portfolio.csv',
  import_status text default 'new',

  -- Bestaande verrijkingsvelden blijven bewust bestaan voor later,
  -- maar worden in de frontend van v0.9.47 niet gebruikt als bronwaarheid.
  is_overhead boolean default false,
  suggested_category text,
  suggested_supplier_name text,
  gilde_domain text,
  is_gilde_core boolean default false,
  domain text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.software_landscape_import
  add column if not exists organization_id uuid,
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
  add column if not exists is_overhead boolean default false,
  add column if not exists suggested_category text,
  add column if not exists suggested_supplier_name text,
  add column if not exists gilde_domain text,
  add column if not exists is_gilde_core boolean default false,
  add column if not exists domain text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.software_landscape_import enable row level security;

drop policy if exists "software_landscape_import_select" on public.software_landscape_import;
drop policy if exists "software_landscape_import_insert" on public.software_landscape_import;
drop policy if exists "software_landscape_import_update" on public.software_landscape_import;
drop policy if exists "software_landscape_import_delete" on public.software_landscape_import;

create policy "software_landscape_import_select"
on public.software_landscape_import
for select
using (auth.uid() is not null);

create policy "software_landscape_import_insert"
on public.software_landscape_import
for insert
with check (auth.uid() is not null);

create policy "software_landscape_import_update"
on public.software_landscape_import
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy "software_landscape_import_delete"
on public.software_landscape_import
for delete
using (auth.uid() is not null);

create index if not exists idx_software_landscape_import_org_type
on public.software_landscape_import (organization_id, application_type);

create index if not exists idx_software_landscape_import_org_name
on public.software_landscape_import (organization_id, application_name);

notify pgrst, 'reload schema';
