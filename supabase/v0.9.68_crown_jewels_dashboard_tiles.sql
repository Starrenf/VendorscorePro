-- VendorScorePro v0.9.68
-- Kroonjuwelen-dashboardtegels voor de openingspagina.
-- Documenten blijven buiten VendorScorePro; deze tegels verwijzen alleen naar applicaties/websites.

create table if not exists public.dashboard_tiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  application_id uuid null,
  supplier_id uuid null,

  title text not null,
  description text null,
  logo_url text null,
  target_url text null,

  is_kroonjuweel boolean not null default false,
  is_active boolean not null default true,
  governance_score numeric null,
  risk_level text null,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Basis-tegels voor Gilde. Logo's en URL's kun je morgen actualiseren.
insert into public.dashboard_tiles (
  organization_id,
  title,
  description,
  logo_url,
  target_url,
  is_kroonjuweel,
  sort_order,
  risk_level
)
values
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'Eduarte', 'Studentinformatiesysteem', null, null, true, 10, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'AFAS HR', 'HRM en personeelsprocessen', null, null, true, 20, 'high'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'AFAS Fin', 'Financiële administratie', null, null, true, 30, 'high'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'TOPdesk', 'Servicemanagement', null, null, true, 40, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'Xedule', 'Roostering en planning', null, null, true, 50, 'medium'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'IAM', 'Identity & Access Management', null, null, true, 60, 'low'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'SharePoint', 'Samenwerking en documentatie', null, null, true, 70, 'low'),
('7ec54263-6b9b-4cb2-9b97-526d8909550d', 'VendorScorePro', 'Regieplatform voor leveranciers, applicaties en governance', null, '/', true, 999, 'low')
on conflict (organization_id, lower(title)) do update
set
  description = excluded.description,
  is_kroonjuweel = excluded.is_kroonjuweel,
  sort_order = excluded.sort_order,
  risk_level = excluded.risk_level,
  updated_at = now();

notify pgrst, 'reload schema';
