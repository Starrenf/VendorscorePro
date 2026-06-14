-- VendorScorePro v0.9.70
-- Kroonjuwelenbeheer + veilige dashboard_tiles policies

create table if not exists public.dashboard_tiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text not null,
  description text,
  icon_url text,
  target_url text,
  is_kroonjuweel boolean default true,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  logo_url text,
  tile_type text default 'application',
  supplier_id uuid,
  application_id uuid,
  governance_score integer,
  risk_level text
);

alter table public.dashboard_tiles
add column if not exists description text,
add column if not exists icon_url text,
add column if not exists target_url text,
add column if not exists is_kroonjuweel boolean default true,
add column if not exists is_active boolean default true,
add column if not exists sort_order integer default 0,
add column if not exists updated_at timestamptz default now(),
add column if not exists logo_url text,
add column if not exists tile_type text default 'application',
add column if not exists supplier_id uuid,
add column if not exists application_id uuid,
add column if not exists governance_score integer,
add column if not exists risk_level text;

alter table public.dashboard_tiles
drop constraint if exists dashboard_tiles_supplier_id_fkey;

alter table public.dashboard_tiles
add constraint dashboard_tiles_supplier_id_fkey
foreign key (supplier_id)
references public.suppliers(id)
on delete set null;

alter table public.dashboard_tiles
drop constraint if exists dashboard_tiles_application_id_fkey;

alter table public.dashboard_tiles
add constraint dashboard_tiles_application_id_fkey
foreign key (application_id)
references public.applications(id)
on delete set null;

create index if not exists dashboard_tiles_org_active_idx
on public.dashboard_tiles (organization_id, is_active, is_kroonjuweel, sort_order);

-- Veiligheid: geen publieke/anon toegang; alleen ingelogde gebruikers binnen eigen organisatie.
revoke all on public.dashboard_tiles from anon;
grant select, insert, update, delete on public.dashboard_tiles to authenticated;

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
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "dashboard_tiles_insert_own_org"
on public.dashboard_tiles
for insert
to authenticated
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "dashboard_tiles_update_own_org"
on public.dashboard_tiles
for update
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
)
with check (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

create policy "dashboard_tiles_delete_own_org"
on public.dashboard_tiles
for delete
to authenticated
using (
  organization_id in (
    select organization_id
    from public.profiles
    where id = auth.uid()
  )
);

-- Correctie pad VendorScorePro-logo indien bestand in public/logos/leveranciers staat.
update public.dashboard_tiles
set logo_url = '/logos/leveranciers/logo-vendorscore.pro.png',
    is_kroonjuweel = true,
    is_active = true,
    updated_at = now()
where title = 'VendorScorePro';

notify pgrst, 'reload schema';
