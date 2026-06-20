-- VendorScorePro v0.9.69
-- Kroonjuwelen-tegels met logo's uit public/logos/leveranciers/.
-- Let op: logo-paden zijn hoofdletter- en extensiegevoelig.

alter table public.dashboard_tiles
add column if not exists application_id uuid,
add column if not exists supplier_id uuid,
add column if not exists description text,
add column if not exists logo_url text,
add column if not exists target_url text,
add column if not exists is_kroonjuweel boolean not null default true,
add column if not exists is_active boolean not null default true,
add column if not exists governance_score numeric,
add column if not exists risk_level text,
add column if not exists sort_order integer not null default 0,
add column if not exists updated_at timestamptz not null default now();

create index if not exists dashboard_tiles_org_idx
on public.dashboard_tiles (organization_id, is_active, is_kroonjuweel, sort_order);

create unique index if not exists dashboard_tiles_unique_org_title
on public.dashboard_tiles (organization_id, lower(title));

alter table public.dashboard_tiles enable row level security;

drop policy if exists "dashboard_tiles_select_own_org" on public.dashboard_tiles;
drop policy if exists "dashboard_tiles_insert_own_org" on public.dashboard_tiles;
drop policy if exists "dashboard_tiles_update_own_org" on public.dashboard_tiles;
drop policy if exists "dashboard_tiles_delete_own_org" on public.dashboard_tiles;

create policy "dashboard_tiles_select_own_org"
on public.dashboard_tiles
for select
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "dashboard_tiles_insert_own_org"
on public.dashboard_tiles
for insert
to authenticated
with check (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "dashboard_tiles_update_own_org"
on public.dashboard_tiles
for update
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
)
with check (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

create policy "dashboard_tiles_delete_own_org"
on public.dashboard_tiles
for delete
to authenticated
using (
  organization_id in (
    select organization_id from public.profiles where id = auth.uid()
  )
);

grant select, insert, update, delete on public.dashboard_tiles to authenticated;

insert into public.dashboard_tiles (
  organization_id,
  title,
  description,
  logo_url,
  target_url,
  is_kroonjuweel,
  is_active,
  sort_order,
  risk_level
)
values
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'Eduarte', 'Studentinformatiesysteem', '/logos/leveranciers/TOPICUS.jpeg', null, true, true, 10, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'PortalPlus', 'Portaal en koppelingen rondom onderwijsprocessen', '/logos/leveranciers/TOPICUS.jpeg', null, true, true, 20, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'AFAS HR', 'HRM en personeelsprocessen', '/logos/leveranciers/AFAS.jpeg', null, true, true, 30, 'high'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'AFAS Fin', 'Financiële administratie', '/logos/leveranciers/AFAS.jpeg', null, true, true, 40, 'high'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'TOPdesk', 'Servicemanagement en selfservice', '/logos/leveranciers/TOPDESK.png', null, true, true, 50, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'Xedule', 'Roostering en planning', '/logos/leveranciers/XEDULE.png', null, true, true, 60, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'IAM', 'Identity & Access Management', '/logos/leveranciers/TOOLS4EVER.png', null, true, true, 70, 'low'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'SharePoint', 'Samenwerking en documentatie', '/logos/leveranciers/MICROSOFT.jpeg', null, true, true, 80, 'low'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'LMS', 'Learning Management System', '/logos/leveranciers/DRIEAM.png', null, true, true, 90, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'Decisions', 'Besluitvorming en governance tooling', '/logos/leveranciers/MEEV.jpeg', null, true, true, 100, 'low'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'Join', 'Zaakgericht werken en documentenstroom', '/logos/leveranciers/DECOS.jpeg', null, true, true, 110, 'low'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'TOA', 'Toets- en examenplatform', '/logos/leveranciers/BUREAU ICE.png', null, true, true, 120, 'low'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'VendorScorePro', 'Regieplatform voor leveranciers, applicaties en governance', '/logo-vendorscore-icon.png', '/', true, true, 999, 'low')
on conflict (organization_id, lower(title)) do update
set
  description = excluded.description,
  logo_url = excluded.logo_url,
  target_url = excluded.target_url,
  is_kroonjuweel = excluded.is_kroonjuweel,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  risk_level = excluded.risk_level,
  updated_at = now();

notify pgrst, 'reload schema';
